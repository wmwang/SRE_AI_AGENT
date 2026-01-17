import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

/**
 * 智能環境變數載入器
 * 
 * 解決 IDE 或不同執行環境下找不到 .env 檔案的問題。
 * 使用 import.meta.url 定位當前檔案，並往上尋找專案根目錄。
 */

// 1. 計算專案根目錄
// 此檔案位置: packages/mcp-slo-management/src/env.ts
// 結構同上，往上 3 層到達 Repo Root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = process.env.PROJECT_ROOT || path.resolve(__dirname, '../../../');

// 2. 定義可能的 .env 路徑
const envPaths = [
    path.join(projectRoot, '.env'), //Repo Root (優先)
    path.join(__dirname, '../../.env') // Package Root (備選)
];

// 3. 嘗試載入
let loaded = false;
for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath });
        // console.error(`[EnvLoader] Loaded environment from ${envPath}`);
        loaded = true;
        break;
    }
}

if (!loaded && process.env.DEBUG === 'true') {
    console.error(`[EnvLoader] Warning: No .env file found in checked paths: ${envPaths.join(', ')}`);
}

export { };
