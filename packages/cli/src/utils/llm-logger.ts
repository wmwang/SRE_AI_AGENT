import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

/**
 * LLM Logger - 記錄所有 LLM 通訊以便 Debug
 * 
 * 使用環境變數控制：
 * - DEBUG_LLM=true - 啟用日誌記錄
 * - LLM_LOG_PATH - 自訂日誌路徑（預設：./logs/llm-debug.log）
 */
export class LLMLogger {
    private static instance: LLMLogger;
    private logPath: string;
    private enabled: boolean;

    private constructor() {
        this.enabled = process.env.DEBUG_LLM === 'true';

        // 在 ESM 中取得 __dirname
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(__filename);

        // 計算專案根目錄：從 cli/dist/utils 往上三層到專案根目錄
        const projectRoot = path.resolve(__dirname, '..', '..', '..', '..');
        const defaultPath = path.join(projectRoot, 'logs', 'llm-debug.log');
        this.logPath = process.env.LLM_LOG_PATH || defaultPath;

        if (this.enabled) {
            // 確保目錄存在
            const dir = path.dirname(this.logPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // 啟動時寫入分隔線
            const separator = `\n${'='.repeat(80)}\n🚀 CLI 啟動於 ${new Date().toISOString()}\n${'='.repeat(80)}\n`;
            fs.appendFileSync(this.logPath, separator);

            console.log(`[LLM Logger] 日誌已啟用，記錄至：${this.logPath}`);
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
    log(type: 'analyze' | 'plan' | 'execute' | 'synthesize', data: {
        prompt?: string;
        response?: string;
        error?: string;
        metadata?: Record<string, any>;
    }): void {
        if (!this.enabled) return;

        const timestamp = new Date().toISOString();

        const formatted = `
[${timestamp}] [${type.toUpperCase()}]
${'-'.repeat(80)}
${data.prompt ? `📝 Prompt:\n${data.prompt}\n${'-'.repeat(80)}\n` : ''}${data.response ? `✅ Response:\n${data.response}\n${'-'.repeat(80)}\n` : ''}${data.error ? `❌ Error:\n${data.error}\n${'-'.repeat(80)}\n` : ''}${data.metadata ? `ℹ️  Metadata:\n${JSON.stringify(data.metadata, null, 2)}\n${'-'.repeat(80)}\n` : ''}
`;

        try {
            fs.appendFileSync(this.logPath, formatted);
        } catch (error) {
            console.error('[LLM Logger] 寫入日誌失敗:', error);
        }
    }

    /**
     * 記錄工具執行
     */
    logToolExecution(toolName: string, input: any, output: any, error?: string): void {
        if (!this.enabled) return;

        this.log('execute', {
            metadata: {
                tool: toolName,
                input,
                output: error ? undefined : output,
                error,
            },
        });
    }

    /**
     * 取得日誌檔案路徑
     */
    getLogPath(): string {
        return this.logPath;
    }

    /**
     * 清除日誌檔案
     */
    clearLog(): void {
        if (fs.existsSync(this.logPath)) {
            fs.unlinkSync(this.logPath);
            console.log(`[LLM Logger] 日誌已清除：${this.logPath}`);
        }
    }
}

// 匯出單例
export const llmLogger = LLMLogger.getInstance();
