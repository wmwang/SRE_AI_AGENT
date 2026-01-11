/**
 * Metrics Analysis Server 配置
 */
export interface MetricsServerConfig {
    /** Prometheus 端點 */
    prometheus: {
        endpoint: string;
        timeout?: number;
    };

    /** OpenAI API 配置（用於異常分析） */
    openai?: {
        apiKey: string;
        baseURL?: string;
        model?: string;
    };

    /** Shared Memory 路徑 */
    sharedMemoryPath?: string;

    /** 是否啟用 Mock 模式 */
    mockMode?: boolean;
}

/**
 * 預設配置
 */
export const defaultConfig: MetricsServerConfig = {
    prometheus: {
        endpoint: process.env.PROMETHEUS_ENDPOINT || 'http://localhost:9090',
        timeout: parseInt(process.env.PROMETHEUS_TIMEOUT || '30000'),
    },
    openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
        baseURL: process.env.OPENAI_BASE_URL,
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    },
    sharedMemoryPath: process.env.SHARED_MEMORY_PATH || ':memory:',

    /** 是否啟用 Mock 模式（用於無 Prometheus 環境測試） */
    mockMode: process.env.MOCK_PROMETHEUS === 'true',
};

/**
 * 取得配置
 */
export function getConfig(): MetricsServerConfig {
    return defaultConfig;
}
