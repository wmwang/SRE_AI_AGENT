/**
 * MCP Client Manager - API Gateway 版本
 * 
 * 管理與所有 MCP Servers 的連接
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { type MCPServerConfig, getDefaultServers } from './config.js';

/**
 * MCP Tool 資訊
 */
export interface MCPToolInfo extends Tool {
    serverId: string;
    serverName: string;
}

/**
 * MCP Client Manager
 */
export class MCPClientManager {
    private clients: Map<string, Client> = new Map();
    private tools: Map<string, MCPToolInfo[]> = new Map();

    /**
     * 初始化所有 MCP Servers
     */
    async initialize(): Promise<void> {
        const servers = getDefaultServers();

        for (const server of servers) {
            try {
                await this.connect(server);
            } catch (error) {
                console.error(`[MCP] Failed to connect to ${server.name}:`, error);
            }
        }
    }

    /**
     * 連接到 MCP Server
     */
    async connect(config: MCPServerConfig): Promise<void> {
        if (!config.enabled) {
            console.log(`[MCP] Server ${config.id} is disabled`);
            return;
        }

        console.log(`[MCP] Connecting to ${config.name}...`);

        try {
            const client = new Client(
                {
                    name: `api-gateway-${config.id}`,
                    version: '1.0.0',
                },
                {
                    capabilities: {},
                }
            );

            // 建立環境變數映射
            const envVars: Record<string, string> = {};
            for (const [key, value] of Object.entries(process.env)) {
                if (value !== undefined) {
                    envVars[key] = value;
                }
            }

            const transport = new StdioClientTransport({
                command: config.command,
                args: config.args,
                env: envVars,
            });

            await client.connect(transport);

            // 列出 tools
            const toolsResult = await client.listTools();
            const tools: MCPToolInfo[] = toolsResult.tools.map(tool => ({
                ...tool,
                serverId: config.id,
                serverName: config.name,
            }));

            this.clients.set(config.id, client);
            this.tools.set(config.id, tools);

            console.log(`[MCP] ✓ Connected to ${config.name} (${tools.length} tools)`);
        } catch (error) {
            console.error(`[MCP] ✗ Failed to connect to ${config.name}:`, error);
            throw error;
        }
    }

    /**
     * 斷開所有連接
     */
    async disconnectAll(): Promise<void> {
        for (const [id, client] of this.clients) {
            await client.close();
            console.log(`[MCP] Disconnected from ${id}`);
        }
        this.clients.clear();
        this.tools.clear();
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

        console.log(`[MCP] Calling ${serverId}.${toolName}...`);

        const result = await client.callTool({
            name: toolName,
            arguments: args,
        });

        // 解析結果
        const content = (result.content as Array<{ type: string; text?: string }>)[0];
        if (content && 'text' in content && content.text) {
            return JSON.parse(content.text);
        }

        return {};
    }

    /**
     * 取得已連接的 servers
     */
    getConnectedServers(): string[] {
        return Array.from(this.clients.keys());
    }
}
