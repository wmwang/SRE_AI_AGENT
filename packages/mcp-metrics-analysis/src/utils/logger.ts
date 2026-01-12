import * as fs from 'fs';
import * as path from 'path';

/**
 * MCP Server Logger
 * 
 * 將日誌寫入檔案，避免干擾 stdio 通訊和 CLI UI
 */
class MCPLogger {
    private logFile: string;

    constructor() {
        // 嘗試寫入到專案根目錄的 logs
        // 假設運行目錄在 packages/mcp-metrics-analysis
        // 所以往上兩層是根目錄
        const logDir = path.resolve(process.cwd(), '../../logs');

        // 如果目錄不存在，嘗試建立（如果原本就有，會忽略）
        try {
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
        } catch (e) {
            // 忽略權限錯誤
        }

        this.logFile = path.join(logDir, 'mcp-metrics.log');
    }

    log(message: string, ...args: any[]) {
        // 總是寫入檔案（或者只在 Debug 模式寫入？使用者希望 Mock 模式也有 log，但不要在螢幕上）
        // 這裡策略：所有日誌都寫入檔案，不檢查 DEBUG 開關，或者只檢查 Mock Mode？
        // 原本的程式碼是無條件 console.error (Mock Mode)
        // 所以這裡我們總是寫入檔案，只有當寫入失敗時才忽略
        // 但為了避免檔案太大，也許還是檢查一下 DEBUG？
        // 不，使用者現在甚至在非 DEBUG 模式下也看到了 Mock log，這表示我們需要攔截這些。

        try {
            const timestamp = new Date().toISOString();
            const formattedArgs = args.map(arg =>
                typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
            ).join(' ');

            const logLine = `[${timestamp}] ${message} ${formattedArgs}\n`;
            fs.appendFileSync(this.logFile, logLine);
        } catch (e) {
            // 寫入失敗，靜默失敗
        }
    }
}

export const mcpLogger = new MCPLogger();
