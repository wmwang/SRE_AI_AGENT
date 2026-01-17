/**
 * MCP Server 配置
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

export interface MCPServerConfig {
    id: string;
    name: string;
    command: string;
    args: string[];
    enabled: boolean;
}

/**
 * 預設 MCP Server 配置
 */
export function getDefaultServers(): MCPServerConfig[] {
    // 獲取專案根目錄 (SRE_AI_AGENT)
    // packages/api/src/mcp/config.ts -> 向上 4 層到專案根目錄
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const projectRoot = resolve(__dirname, '..', '..', '..', '..');

    console.log('[MCP Config] Project root:', projectRoot);

    return [
        {
            id: 'slo',
            name: 'SLO Management',
            command: 'node',
            args: [resolve(projectRoot, 'packages/mcp-slo-management/dist/index.js')],
            enabled: true,
        },
        {
            id: 'metrics',
            name: 'Metrics Analysis',
            command: 'node',
            args: [resolve(projectRoot, 'packages/mcp-metrics-analysis/dist/index.js')],
            enabled: true,
        },
        {
            id: 'k8s',
            name: 'K8s Integration',
            command: 'node',
            args: [resolve(projectRoot, 'packages/mcp-k8s-integration/dist/index.js')],
            enabled: false, // 暫時停用，套件尚未建立
        },
    ];
}
