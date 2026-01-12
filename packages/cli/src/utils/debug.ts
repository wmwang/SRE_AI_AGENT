/**
 * Debug Logger Utility
 * 
 * 只有在 DEBUG=true 環境變數設定時才會輸出
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const DEBUG = process.env.DEBUG === 'true' || process.env.DEBUG === '1';

// 確保 logs 目錄存在
const PROJECT_ROOT = process.env.PROJECT_ROOT || process.cwd();
const LOG_DIR = path.join(PROJECT_ROOT, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'app-debug.log');

try {
    if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR, { recursive: true });
    }
} catch (e) {
    // 忽略錯誤
}

/**
 * 輸出除錯訊息 (只在 debug 模式，且寫入檔案)
 */
export function debugLog(...args: unknown[]): void {
    if (DEBUG) {
        try {
            const message = args.map(arg =>
                typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
            ).join(' ');
            const timestamp = new Date().toISOString();
            fs.appendFileSync(LOG_FILE, `[${timestamp}] ${message}\n`);
        } catch (e) {
            // 寫入失敗則忽略，千萬不能 console.error
        }
    }
}

/**
 * 檢查是否為 debug 模式
 */
export function isDebugMode(): boolean {
    return DEBUG;
}
