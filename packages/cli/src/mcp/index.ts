import { getConfig } from '../config.js';
import { MCPClientManager, type MCPServerConfig } from './manager.js';
import { debugLog } from '../utils/debug.js';

/**
 * 建立並初始化 MCP Manager
 */
export async function createMCPManager(): Promise<MCPClientManager> {
    const config = getConfig();
    const manager = new MCPClientManager();

    // 準備 server 配置
    const servers: MCPServerConfig[] = [
        {
            id: 'slo',
            name: 'SLO Management',
            ...config.mcpServers.slo,
        },
        {
            id: 'metrics',
            name: 'Metrics Analysis',
            ...config.mcpServers.metrics,
        },
        {
            id: 'k8s',
            name: 'K8s Deployment',
            ...config.mcpServers.k8s,
        },
    ];

    // 連接到所有啟用的 servers
    debugLog('[MCP] Initializing MCP Client Manager...');

    for (const serverConfig of servers) {
        if (serverConfig.enabled) {
            try {
                await manager.connect(serverConfig);
            } catch (error) {
                debugLog(`[MCP] Warning: Failed to connect to ${serverConfig.name}`);
                // 繼續連接其他 servers
            }
        }
    }

    const connected = manager.getConnectedServers();
    debugLog(`[MCP] Initialized with ${connected.length} server(s):`);
    connected.forEach(id => debugLog(`[MCP]   - ${id}`));

    return manager;
}

