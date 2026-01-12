// 測試 LLM Logger 功能
import { llmLogger } from './packages/cli/dist/utils/llm-logger.js';

console.log('📝 測試 LLM Logger...\n');
console.log('日誌路徑:', llmLogger.getLogPath());
console.log('\n請確認已設定 DEBUG_LLM=true');
console.log('如果未設定，日誌不會寫入\n');

// 測試記錄
llmLogger.log('analyze', {
    prompt: '請分析以下 Prometheus 指標...',
    response: '根據分析，系統運作正常',
    metadata: {
        timestamp: new Date().toISOString(),
        service: 'test-service'
    }
});

console.log('✅ 測試完成！');
console.log('\n請查看專案目錄下的 logs/llm-debug.log 檔案');
