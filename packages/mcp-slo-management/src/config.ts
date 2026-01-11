/**
 * SLO Management Server 配置
 */
export interface SLOServerConfig {
    /** OpenAI API 配置 */
    openai: {
        apiKey: string;
        baseURL?: string;
        model?: string;
    };

    /** Shared Memory 路徑 */
    sharedMemoryPath?: string;

    /** Prometheus 配置（未來使用） */
    prometheus?: {
        endpoint: string;
    };
}

/**
 * 預設配置
 */
export const defaultConfig: SLOServerConfig = {
    openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
        baseURL: process.env.OPENAI_BASE_URL,
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    },
    sharedMemoryPath: process.env.SHARED_MEMORY_PATH || ':memory:',
    prometheus: {
        endpoint: process.env.PROMETHEUS_ENDPOINT || 'http://localhost:9090',
    },
};

/**
 * 取得配置
 */
export function getConfig(): SLOServerConfig {
    return defaultConfig;
}
