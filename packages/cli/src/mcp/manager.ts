import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { debugLog } from '../utils/debug.js';

/**
 * MCP Server 配置
 */
export interface MCPServerConfig {
    id: string;
    name: string;
    command: string;
    args: string[];
    enabled: boolean;
}

/**
 * MCP Tool 資訊
 */
export interface MCPToolInfo extends Tool {
    serverId: string;
    serverName: string;
}

/**
 * MCP Client Manager
 * 
 * 管理與所有 MCP Servers 的連接
 */
export class MCPClientManager {
    private clients: Map<string, Client> = new Map();
    private tools: Map<string, MCPToolInfo[]> = new Map();

    /**
     * 連接到 MCP Server
     */
    async connect(config: MCPServerConfig): Promise<void> {
        if (!config.enabled) {
            console.error(`[MCP] Server ${config.id} is disabled`);
            return;
        }

        debugLog(`[MCP] Connecting to ${config.name}...`);

        try {
            // 建立 Client
            const client = new Client(
                {
                    name: `cli-agent-${config.id}`,
                    version: '1.0.0',
                },
                {
                    capabilities: {},
                }
            );

            // 重要：建立環境變數映射
            // 使用 globalThis.process.env 確保不被區域變數覆蓋
            // 過濾掉 undefined 值以符合 StdioClientTransport 的類型要求
            const envVars: Record<string, string> = {};
            for (const [key, value] of Object.entries(globalThis.process.env)) {
                if (value !== undefined) {
                    envVars[key] = value;
                }
            }

            debugLog(`[MCP]   OPENAI_API_KEY: ${envVars['OPENAI_API_KEY'] ? '已設定' : '未設定'}`);

            // 建立 transport (傳遞環境變數)
            const transport = new StdioClientTransport({
                command: config.command,
                args: config.args,
                env: envVars,
            });

            // 連接
            await client.connect(transport);

            // 列出 tools
            const toolsResult = await client.listTools();
            const tools: MCPToolInfo[] = toolsResult.tools.map(tool => ({
                ...tool,
                serverId: config.id,
                serverName: config.name,
            }));

            // 儲存
            this.clients.set(config.id, client);
            this.tools.set(config.id, tools);

            debugLog(`[MCP] ✓ Connected to ${config.name}`);
            debugLog(`[MCP]   Found ${tools.length} tools`);
        } catch (error) {
            console.error(`[MCP] ✗ Failed to connect to ${config.name}:`, error);
            throw error;
        }
    }

    /**
     * 斷開連接
     */
    async disconnect(serverId: string): Promise<void> {
        const client = this.clients.get(serverId);

        if (client) {
            await client.close();
            this.clients.delete(serverId);
        }

        this.tools.delete(serverId);
        debugLog(`[MCP] Disconnected from ${serverId}`);
    }

    /**
     * 斷開所有連接
     */
    async disconnectAll(): Promise<void> {
        const serverIds = Array.from(this.clients.keys());
        await Promise.all(serverIds.map(id => this.disconnect(id)));
    }

    /**
     * 列出所有可用的 tools
     */
    listAllTools(): MCPToolInfo[] {
        const allTools: MCPToolInfo[] = [];
        for (const tools of this.tools.values()) {
            allTools.push(...tools);
        }
        return allTools;
    }

    /**
     * 搜尋 tools
     */
    searchTools(keyword: string): MCPToolInfo[] {
        const lowerKeyword = keyword.toLowerCase();
        return this.listAllTools().filter(
            tool =>
                tool.name.toLowerCase().includes(lowerKeyword) ||
                tool.description?.toLowerCase().includes(lowerKeyword)
        );
    }

    /**
     * 調用 tool
     */
    async callTool(
        serverId: string,
        toolName: string,
        args: Record<string, unknown>
    ): Promise<object> {
        const client = this.clients.get(serverId);
        if (!client) {
            throw new Error(`Server ${serverId} not connected`);
        }

        debugLog(`[MCP] Calling ${serverId}.${toolName}...`);

        try {
            const result = await client.callTool({
                name: toolName,
                arguments: args as Record<string, unknown>,
            });

            // 解析結果
            const content = (result.content as Array<{ type: string; text?: string }>)[0];
            if (content && 'text' in content && content.text) {
                return JSON.parse(content.text);
            }

            return {} as Record<string, unknown>;
        } catch (error) {
            console.error(`[MCP] Error calling ${serverId}.${toolName}:`, error);
            throw error;
        }
    }

    /**
     * 取得已連接的 servers
     */
    getConnectedServers(): string[] {
        return Array.from(this.clients.keys());
    }

    /**
     * 檢查 server 是否已連接
     */
    isConnected(serverId: string): boolean {
        return this.clients.has(serverId);
    }
}
