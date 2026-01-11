import Database from 'better-sqlite3';
import { EventEmitter } from 'eventemitter3';
import type {
    MCPServerMetadata,
    RegistryEvent,
    RegistryEventData,
    SearchResult,
    ServerCategory,
} from './types.js';

/**
 * MCP Registry - 服務註冊與發現中心
 * 
 * 負責：
 * 1. MCP Server 的註冊與取消註冊
 * 2. Server 元數據的儲存與查詢
 * 3. 工具搜尋與發現
 * 4. 事件通知（server 新增/移除/更新）
 */
export class MCPRegistry extends EventEmitter<Record<RegistryEvent, [RegistryEventData]>> {
    private db: Database.Database;
    private servers: Map<string, MCPServerMetadata> = new Map();

    constructor(dbPath: string = ':memory:') {
        super();
        this.db = new Database(dbPath);
        this.initializeDatabase();
        this.loadServers();
    }

    /**
     * 初始化資料庫結構
     */
    private initializeDatabase(): void {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS servers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        version TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        status TEXT NOT NULL,
        tags TEXT NOT NULL,
        registered_at TEXT NOT NULL,
        last_updated_at TEXT NOT NULL,
        metadata_json TEXT NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_category ON servers(category);
      CREATE INDEX IF NOT EXISTS idx_status ON servers(status);
      
      CREATE VIRTUAL TABLE IF NOT EXISTS tools_fts USING fts5(
        server_id,
        tool_name,
        description,
        description_zh,
        category,
        content=''
      );
    `);
    }

    /**
     * 從資料庫載入所有伺服器
     */
    private loadServers(): void {
        const stmt = this.db.prepare('SELECT metadata_json FROM servers WHERE status = ?');
        const rows = stmt.all('active') as Array<{ metadata_json: string }>;

        for (const row of rows) {
            const metadata = JSON.parse(row.metadata_json) as MCPServerMetadata;
            this.servers.set(metadata.id, metadata);
        }
    }

    /**
     * 註冊 MCP Server
     */
    register(metadata: MCPServerMetadata): void {
        const now = new Date().toISOString();
        const fullMetadata: MCPServerMetadata = {
            ...metadata,
            registeredAt: metadata.registeredAt || now,
            lastUpdatedAt: now,
            status: metadata.status || 'active',
        };

        // 儲存到記憶體
        this.servers.set(fullMetadata.id, fullMetadata);

        // 儲存到資料庫
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO servers (
        id, name, version, description, category, endpoint, status, tags,
        registered_at, last_updated_at, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

        stmt.run(
            fullMetadata.id,
            fullMetadata.name,
            fullMetadata.version,
            fullMetadata.description,
            fullMetadata.category,
            fullMetadata.endpoint,
            fullMetadata.status,
            JSON.stringify(fullMetadata.tags),
            fullMetadata.registeredAt,
            fullMetadata.lastUpdatedAt,
            JSON.stringify(fullMetadata)
        );

        // 索引工具以供搜尋
        this.indexTools(fullMetadata);

        // 發送事件
        this.notifyClients('server-added', fullMetadata);
    }

    /**
     * 取消註冊 MCP Server
     */
    unregister(serverId: string): void {
        const metadata = this.servers.get(serverId);
        if (!metadata) {
            throw new Error(`Server "${serverId}" not found`);
        }

        // 從記憶體移除
        this.servers.delete(serverId);

        // 從資料庫移除
        this.db.prepare('DELETE FROM servers WHERE id = ?').run(serverId);
        this.db.prepare('DELETE FROM tools_fts WHERE server_id = ?').run(serverId);

        // 發送事件
        this.notifyClients('server-removed', metadata);
    }

    /**
     * 更新 Server 狀態
     */
    updateStatus(serverId: string, status: MCPServerMetadata['status']): void {
        const metadata = this.servers.get(serverId);
        if (!metadata) {
            throw new Error(`Server "${serverId}" not found`);
        }

        metadata.status = status;
        metadata.lastUpdatedAt = new Date().toISOString();

        this.db.prepare('UPDATE servers SET status = ?, last_updated_at = ?, metadata_json = ? WHERE id = ?')
            .run(status, metadata.lastUpdatedAt, JSON.stringify(metadata), serverId);

        this.notifyClients('server-status-changed', metadata);
    }

    /**
     * 列出所有伺服器
     */
    listServers(filters?: { category?: ServerCategory; status?: MCPServerMetadata['status'] }): MCPServerMetadata[] {
        let servers = Array.from(this.servers.values());

        if (filters?.category) {
            servers = servers.filter(s => s.category === filters.category);
        }

        if (filters?.status) {
            servers = servers.filter(s => s.status === filters.status);
        }

        return servers;
    }

    /**
     * 取得特定伺服器
     */
    getServer(serverId: string): MCPServerMetadata | undefined {
        return this.servers.get(serverId);
    }

    /**
     * 依分類查詢伺服器
     */
    getServersByCategory(category: ServerCategory): MCPServerMetadata[] {
        return this.listServers({ category });
    }

    /**
     * 搜尋工具（全文搜尋）
     */
    searchTools(keyword: string): SearchResult[] {
        const stmt = this.db.prepare(`
      SELECT server_id, tool_name, description, description_zh, category, rank
      FROM tools_fts
      WHERE tools_fts MATCH ?
      ORDER BY rank
      LIMIT 20
    `);

        const rows = stmt.all(keyword) as Array<{
            server_id: string;
            tool_name: string;
            description: string;
            description_zh: string;
            category: string;
            rank: number;
        }>;

        const results: SearchResult[] = [];

        for (const row of rows) {
            const server = this.servers.get(row.server_id);
            if (!server) continue;

            const tool = server.capabilities.tools.find(t => t.name === row.tool_name);
            if (!tool) continue;

            results.push({
                serverId: row.server_id,
                serverName: server.name,
                tool,
                relevance: 1 / (Math.abs(row.rank) + 1), // 轉換 rank 為 0-1 分數
            });
        }

        return results;
    }

    /**
     * 索引工具以供全文搜尋
     */
    private indexTools(metadata: MCPServerMetadata): void {
        // 先移除舊的索引
        this.db.prepare('DELETE FROM tools_fts WHERE server_id = ?').run(metadata.id);

        // 建立新索引
        const stmt = this.db.prepare(`
      INSERT INTO tools_fts (server_id, tool_name, description, description_zh, category)
      VALUES (?, ?, ?, ?, ?)
    `);

        for (const tool of metadata.capabilities.tools) {
            stmt.run(
                metadata.id,
                tool.name,
                tool.description,
                tool.description_zh,
                tool.category
            );
        }
    }

    /**
     * 通知所有監聽的 clients
     */
    private notifyClients(event: RegistryEvent, metadata: MCPServerMetadata): void {
        const eventData: RegistryEventData = {
            event,
            serverId: metadata.id,
            metadata,
            timestamp: new Date().toISOString(),
        };

        this.emit(event, eventData);
    }

    /**
     * 關閉 Registry
     */
    close(): void {
        this.db.close();
        this.removeAllListeners();
    }
}
