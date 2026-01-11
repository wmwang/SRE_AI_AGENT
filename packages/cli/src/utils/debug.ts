/**
 * Debug Logger Utility
 * 
 * 只有在 DEBUG=true 環境變數設定時才會輸出
 */

const DEBUG = process.env.DEBUG === 'true' || process.env.DEBUG === '1';

/**
 * 輸出除錯訊息 (只在 debug 模式)
 */
export function debugLog(...args: unknown[]): void {
    if (DEBUG) {
        console.error(...args);
    }
}

/**
 * 檢查是否為 debug 模式
 */
export function isDebugMode(): boolean {
    return DEBUG;
}
