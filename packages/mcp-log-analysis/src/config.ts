/**
 * Log Analysis MCP Server - Configuration
 * 
 * 支援 Elasticsearch 連線與 OpenAI 整合
 */

export interface LogAnalysisConfig {
    elasticsearch: {
        endpoint: string;
        apiKey: string;
        apiKeyHeader: string;
        useBearerToken: boolean;
        mockMode: boolean;
        defaultIndex: string;
    };
    openai: {
        apiKey: string;
        model: string;
        baseURL?: string;
    };
    defaultIndex: string;
    maxResults: number;
}

/**
 * 取得配置（從環境變數）
 */
export function getConfig(): LogAnalysisConfig {
    // Elasticsearch 配置
    const esEndpoint = process.env.ELASTICSEARCH_ENDPOINT || 'http://localhost:9200';
    const esApiKey = process.env.ELASTICSEARCH_API_KEY || '';
    const esApiKeyHeader = process.env.ELASTICSEARCH_API_KEY_HEADER || 'Authorization';
    const esUseBearerToken = process.env.ELASTICSEARCH_USE_BEARER !== 'false';
    const esMockMode = process.env.MOCK_ELASTICSEARCH === 'true';

    // Debug log
    console.error('[Config] MOCK_ELASTICSEARCH env:', process.env.MOCK_ELASTICSEARCH);
    console.error('[Config] esMockMode:', esMockMode);
    console.error('[Config] esApiKey set:', esApiKey ? 'yes' : 'no');

    // OpenAI 配置
    const openaiApiKey = process.env.OPENAI_API_KEY || '';
    const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const openaiBaseURL = process.env.OPENAI_BASE_URL;

    // 日誌配置
    const defaultIndex = process.env.LOG_INDEX_PATTERN || 'logs-*';
    const maxResults = parseInt(process.env.MAX_LOG_RESULTS || '1000', 10);

    // 驗證必要配置
    if (!esMockMode && !esApiKey) {
        console.warn('[Config] ELASTICSEARCH_API_KEY not set, using mock mode');
    }

    if (!openaiApiKey) {
        console.warn('[Config] OPENAI_API_KEY not set, AI features will be disabled');
    }

    return {
        elasticsearch: {
            endpoint: esEndpoint,
            apiKey: esApiKey,
            apiKeyHeader: esApiKeyHeader,
            useBearerToken: esUseBearerToken,
            mockMode: esMockMode || !esApiKey, // 無 API Key 時自動啟用 mock
            defaultIndex,
        },
        openai: {
            apiKey: openaiApiKey,
            model: openaiModel,
            baseURL: openaiBaseURL,
        },
        defaultIndex,
        maxResults,
    };
}

/**
 * 顯示配置摘要（用於啟動時）
 */
export function displayConfig(config: LogAnalysisConfig): void {
    console.error('[Log Analysis MCP Server] Configuration:');
    console.error(`  Elasticsearch: ${config.elasticsearch.endpoint}`);
    console.error(`  Mode: ${config.elasticsearch.mockMode ? 'Mock (Simulated Data)' : 'Live'}`);
    console.error(`  Auth Header: ${config.elasticsearch.apiKeyHeader}`);
    console.error(`  Index Pattern: ${config.defaultIndex}`);
    console.error(`  OpenAI Model: ${config.openai.model}`);
    console.error(`  Max Results: ${config.maxResults}`);
}
