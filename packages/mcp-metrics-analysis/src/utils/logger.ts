import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

/**
 * MCP Server Logger
 * 
 * 將日誌寫入檔案，避免干擾 stdio 通訊和 CLI UI
 */
class MCPLogger {
    private logFile: string;

    constructor() {
        // 優先使用環境變數設定的 Log 路徑
        if (process.env.MCP_LOG_PATH) {
            this.logFile = process.env.MCP_LOG_PATH;
        } else {
            // 智能路徑推斷：基於當前檔案位置，而非執行目錄(CWD)
            try {
                const __filename = fileURLToPath(import.meta.url);
                const __dirname = path.dirname(__filename);

                // 更穩健的做法：尋找 PROJECT_ROOT 環境變數，如果沒有，則嘗試從當前檔案往上找
                // .../packages/mcp-metrics-analysis/src/utils/logger.ts -> 往上 4 層
                const projectRoot = process.env.PROJECT_ROOT || path.resolve(__dirname, '../../../../');
                const logDir = path.join(projectRoot, 'logs');
                this.logFile = path.join(logDir, 'mcp-metrics.log');
            } catch (e) {
                // Fallback to homedir if path resolution fails
                const homeDir = process.env.HOME || process.env.USERPROFILE || '.';
                this.logFile = path.join(homeDir, '.sre-agent', 'logs', 'mcp-metrics.log');
            }
        }

        // 確保目錄存在
        try {
            const dir = path.dirname(this.logFile);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        } catch (e) {
            // 忽略權限錯誤，但這可能會導致之後寫入失敗
        }
    }

    log(message: string, ...args: any[]) {
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
