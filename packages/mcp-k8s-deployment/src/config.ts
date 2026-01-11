/**
 * K8s Deployment Server 配置
 */
export interface K8sDeploymentConfig {
    /** OpenAI API 配置 */
    openai: {
        apiKey: string;
        baseURL?: string;
        model?: string;
    };
}

/**
 * 預設配置
 */
export const defaultConfig: K8sDeploymentConfig = {
    openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
        baseURL: process.env.OPENAI_BASE_URL,
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    },
};

/**
 * 取得配置
 */
export function getConfig(): K8sDeploymentConfig {
    return defaultConfig;
}
