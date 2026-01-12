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
 * 純 JavaScript 實作，無需 SQLite/better-sqlite3
 * 
 * 負責：
 * 1. MCP Server 的註冊與取消註冊
 * 2. Server 元數據的儲存與查詢
 * 3. 工具搜尋與發現
 * 4. 事件通知（server 新增/移除/更新）
 */
export class MCPRegistry extends EventEmitter<Record<RegistryEvent, [RegistryEventData]>> {
    private servers: Map<string, MCPServerMetadata> = new Map();
    private toolsIndex: Map<string, Array<{ serverId: string; toolName: string }>> = new Map();

    constructor(_dbPath?: string) {
        super();
        console.log('[MCPRegistry] Using pure in-memory storage (no SQLite, Windows compatible)');
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

        // 從索引移除
        this.removeFromIndex(serverId);

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
     * 搜尋工具（簡單字串匹配）
     */
    searchTools(keyword: string): SearchResult[] {
        const lowerKeyword = keyword.toLowerCase();
        const results: SearchResult[] = [];

        for (const [serverId, metadata] of this.servers.entries()) {
            for (const tool of metadata.capabilities.tools) {
                // 搜尋工具名稱、描述
                const score = this.calculateRelevance(tool, lowerKeyword);
                if (score > 0) {
                    results.push({
                        serverId,
                        serverName: metadata.name,
                        tool,
                        relevance: score,
                    });
                }
            }
        }

        // 按相關性排序
        return results.sort((a, b) => b.relevance - a.relevance).slice(0, 20);
    }

    /**
     * 計算工具與關鍵字的相關性
     */
    private calculateRelevance(tool: any, keyword: string): number {
        let score = 0;

        // 工具名稱完全匹配 = 100 分
        if (tool.name.toLowerCase() === keyword) {
            score += 100;
        }
        // 工具名稱包含關鍵字 = 50 分
        else if (tool.name.toLowerCase().includes(keyword)) {
            score += 50;
        }

        // 描述包含關鍵字 = 30 分
        if (tool.description.toLowerCase().includes(keyword)) {
            score += 30;
        }

        // 中文描述包含關鍵字 = 20 分
        if (tool.description_zh?.toLowerCase().includes(keyword)) {
            score += 20;
        }

        // 分類匹配 = 10 分
        if (tool.category?.toLowerCase().includes(keyword)) {
            score += 10;
        }

        return score;
    }

    /**
     * 索引工具以供搜尋
     */
    private indexTools(metadata: MCPServerMetadata): void {
        for (const tool of metadata.capabilities.tools) {
            const keywords = [
                tool.name,
                tool.description,
                tool.description_zh,
                tool.category,
            ].filter(Boolean);

            for (const keyword of keywords) {
                const normalized = keyword.toLowerCase();
                if (!this.toolsIndex.has(normalized)) {
                    this.toolsIndex.set(normalized, []);
                }
                this.toolsIndex.get(normalized)!.push({
                    serverId: metadata.id,
                    toolName: tool.name,
                });
            }
        }
    }

    /**
     * 從索引移除 server
     */
    private removeFromIndex(serverId: string): void {
        for (const [keyword, tools] of this.toolsIndex.entries()) {
            const filtered = tools.filter(t => t.serverId !== serverId);
            if (filtered.length === 0) {
                this.toolsIndex.delete(keyword);
            } else {
                this.toolsIndex.set(keyword, filtered);
            }
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
        this.servers.clear();
        this.toolsIndex.clear();
        this.removeAllListeners();
    }
}
