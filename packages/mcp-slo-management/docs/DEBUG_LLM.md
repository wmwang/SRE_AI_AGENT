# 如何查看 LLM 請求與回應

本系統已採用統一的 **LLM Logger** 機制，將所有與 OpenAI 的交互紀錄寫入集中的日誌檔案，以確保不干擾 CLI 介面並提供完整的除錯資訊。

## 1. 啟用 DEBUG 模式

設定環境變數 `DEBUG_LLM=true` 即可啟用詳細日誌：

```bash
# 方式 1：啟動 CLI 時啟用
DEBUG_LLM=true ./start-cli.sh

# 方式 2：在開發時啟用
export DEBUG_LLM=true
# 然後執行測試或啟動應用
```

## 2. 查看日誌

所有 LLM 相關的日誌都會寫入專案根目錄下的 `logs/llm-debug.log`。

### 即時查看

```bash
# 在新的終端機視窗執行
tail -f logs/llm-debug.log
```

## 3. 日誌格式

日誌採用結構化的文字格式，方便閱讀與解析。

### Request Log
記錄發送給 LLM 的完整 Prompt。

```
[2024-01-13T12:00:00.000Z] [REQUEST] [metrics-health]
Metadata: { model: 'gpt-4o-mini', stream: true }

--- User Message ---
<task>
...
</task>
```

### Response Log
記錄 LLM 返回的完整內容（包含 SSE 串流Metadata）。

```
[2024-01-13T12:00:05.000Z] [RESPONSE] [metrics-health]
Metadata: { finishReason: 'stop', contentLength: 1234, streamMode: true }

{
  "health": "warning",
  "analysis": { ... }
}
```

### Error Log
記錄 API 呼叫錯誤或解析錯誤。

```
[2024-01-13T12:00:10.000Z] [ERROR] [metrics-health]
Metadata: { errorType: 'APIError' }

Error: 401 Unauthorized ...
```

## 4. 這有什麼用？

1. **檢查 Prompt 結構**：確認 System Prompt 和 User Prompt 是否正確組合。
2. **驗證 SSE 串流**：確認系統是否正確使用了 `stream: true`。
3. **除錯 JSON 解析**：當 UI 顯示錯誤時，查看 `Raw Response` 找出 LLM 是否輸出格式錯誤的 JSON。
4. **效能監控**：透過時間戳記觀察回應延遲。
