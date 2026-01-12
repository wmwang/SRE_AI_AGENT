import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * LLM Logger - 記錄所有 LLM 通訊以便 Debug
 * 
 * (MCP Server 版本 - 與 CLI 版本相同，但獨立實作)
 * 
 * 使用環境變數控制：
 * - DEBUG_LLM=true - 啟用日誌記錄
 * - LLM_LOG_PATH - 自訂日誌路徑（預設：~/.sre-agent/llm-debug.log）
 */
export class LLMLogger {
    private static instance: LLMLogger;
    private logPath: string;
    private enabled: boolean;

    private constructor() {
        this.enabled = process.env.DEBUG_LLM === 'true';

        const defaultPath = path.join(os.homedir(), '.sre-agent', 'llm-debug.log');
        this.logPath = process.env.LLM_LOG_PATH || defaultPath;

        if (this.enabled) {
            // 確保目錄存在
            const dir = path.dirname(this.logPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            console.error(`[MCP Metrics] LLM Logger enabled: ${this.logPath}`);
        }
    }

    static getInstance(): LLMLogger {
        if (!LLMLogger.instance) {
            LLMLogger.instance = new LLMLogger();
        }
        return LLMLogger.instance;
    }

    /**
     * 記錄 LLM 請求/回應
     */
    log(type: 'metrics-health' | 'nl-to-promql', data: {
        prompt?: string;
        response?: string;
        error?: string;
        metadata?: Record<string, any>;
    }): void {
        if (!this.enabled) return;

        const timestamp = new Date().toISOString();

        const formatted = `
[${timestamp}] [MCP-METRICS: ${type.toUpperCase()}]
${'-'.repeat(80)}
${data.prompt ? `📝 Prompt:\n${data.prompt}\n${'-'.repeat(80)}\n` : ''}${data.response ? `✅ Response:\n${data.response}\n${'-'.repeat(80)}\n` : ''}${data.error ? `❌ Error:\n${data.error}\n${'-'.repeat(80)}\n` : ''}${data.metadata ? `ℹ️  Metadata:\n${JSON.stringify(data.metadata, null, 2)}\n${'-'.repeat(80)}\n` : ''}
`;

        try {
            fs.appendFileSync(this.logPath, formatted);
        } catch (error) {
            console.error('[LLM Logger] 寫入日誌失敗:', error);
        }
    }
}

// 匯出單例
export const llmLogger = LLMLogger.getInstance();
