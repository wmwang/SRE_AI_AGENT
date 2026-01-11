import type {
    MCPServerMetadata,
    RegistryEvent,
    RegistryEventData,
    SearchResult,
    ServerCategory,
} from './types.js';

/**
 * MCP Registry Client
 * 
 * 供 CLI、Web Interface 和其他 clients 使用
 * 用於查詢和監聽 Registry 的變更
 */
export class MCPRegistryClient {
    private eventHandlers: Map<RegistryEvent, Array<(data: RegistryEventData) => void>> = new Map();

    constructor(private readonly registryPath: string = '~/.sre-agent/registry.db') {
        // registryPath 將用於未來的實作
        console.log(`Registry path: ${this.registryPath}`);
    }

    /**
     * 列出所有 MCP Servers
     */
    async listServers(_filters?: {
        category?: ServerCategory;
        status?: MCPServerMetadata['status'];
    }): Promise<MCPServerMetadata[]> {
        // 實際實作時，這裡會透過 IPC 或 HTTP 與 Registry 通訊
        // 目前為示意性實作
        throw new Error('Not implemented - this should connect to the Registry service');
    }

    /**
     * 取得特定 Server 的資訊
     */
    async getServer(_serverId: string): Promise<MCPServerMetadata | null> {
        throw new Error('Not implemented');
    }

    /**
     * 搜尋工具
     */
    async searchTools(_keyword: string): Promise<SearchResult[]> {
        throw new Error('Not implemented');
    }

    /**
     * 依分類查詢 Servers
     */
    async getServersByCategory(category: ServerCategory): Promise<MCPServerMetadata[]> {
        return this.listServers({ category });
    }

    /**
     * 監聽 Registry 事件
     */
    on(event: RegistryEvent, handler: (data: RegistryEventData) => void): void {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event)!.push(handler);
    }

    /**
     * 取消監聽事件
     */
    off(event: RegistryEvent, handler: (data: RegistryEventData) => void): void {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    /**
     * 斷開連接
     */
    disconnect(): void {
        this.eventHandlers.clear();
    }
}

/**
 * 註冊 MCP Server 的輔助函數
 * 供各個 MCP Server 使用
 */
export async function registerMCPServer(
    _metadata: Omit<MCPServerMetadata, 'registeredAt' | 'lastUpdatedAt'>
): Promise<void> {
    // 實際實作時，這裡會連接到 Registry 並註冊
    throw new Error('Not implemented - this should connect to the Registry service');
}

/**
 * 取消註冊 MCP Server
 */
export async function unregisterMCPServer(_serverId: string): Promise<void> {
    throw new Error('Not implemented');
}
