import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * LLM Logger - 記錄所有 LLM 通訊以便 Debug
 * 
 * (與其他 MCP Server 共用同一個日誌檔案)
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
            const dir = path.dirname(this.logPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            console.error(`[MCP Log-Analysis] LLM Logger enabled: ${this.logPath}`);
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
    log(type: 'nl-to-es-query' | 'analyze-patterns' | 'root-cause' | 'summarize' | 'anomaly-detect', data: {
        prompt?: string;
        response?: string;
        error?: string;
        metadata?: Record<string, any>;
    }): void {
        if (!this.enabled) return;

        const timestamp = new Date().toISOString();

        const formatted = `
[${timestamp}] [MCP-LOG-ANALYSIS: ${type.toUpperCase()}]
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
