/**
 * CLI Agent 配置
 */
export interface CLIConfig {
    /** OpenAI 配置 */
    openai: {
        apiKey: string;
        baseURL?: string;
        model?: string;
    };

    /** MCP Servers 配置 */
    mcpServers: {
        slo: {
            command: string;
            args: string[];
            enabled: boolean;
        };
        metrics: {
            command: string;
            args: string[];
            enabled: boolean;
        };
        k8s: {
            command: string;
            args: string[];
            enabled: boolean;
        };
        log: {
            command: string;
            args: string[];
            enabled: boolean;
        };
    };

    /** Shared Memory 路徑 */
    sharedMemoryPath?: string;
}

/**
 * 預設配置
 */
export const defaultConfig: CLIConfig = {
    openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
        baseURL: process.env.OPENAI_BASE_URL,
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    },
    mcpServers: {
        slo: {
            command: 'node',
            args: [
                process.env.SLO_SERVER_PATH ||
                './packages/mcp-slo-management/dist/index.js',
            ],
            enabled: true,
        },
        metrics: {
            command: 'node',
            args: [
                process.env.METRICS_SERVER_PATH ||
                './packages/mcp-metrics-analysis/dist/index.js',
            ],
            enabled: true,
        },
        k8s: {
            command: 'node',
            args: [
                process.env.K8S_SERVER_PATH ||
                './packages/mcp-k8s-deployment/dist/index.js',
            ],
            enabled: true,
        },
        log: {
            command: 'node',
            args: [
                process.env.LOG_SERVER_PATH ||
                './packages/mcp-log-analysis/dist/index.js',
            ],
            enabled: true,
        },
    },
    sharedMemoryPath: process.env.SHARED_MEMORY_PATH || ':memory:',
};

/**
 * 取得配置
 */
export function getConfig(): CLIConfig {
    return defaultConfig;
}
