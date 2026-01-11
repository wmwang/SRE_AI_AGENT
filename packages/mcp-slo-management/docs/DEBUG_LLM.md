# 如何查看 LLM 請求與回應

## 啟用 DEBUG 模式

設定環境變數 `DEBUG_LLM=true` 即可查看所有送給 OpenAI 的資料：

```bash
# 方式 1：執行測試時啟用
DEBUG_LLM=true pnpm --filter @sre-agent/mcp-slo-management test:integration

# 方式 2：啟動 server 時啟用
DEBUG_LLM=true pnpm --filter @sre-agent/mcp-slo-management start

# 方式 3：在環境變數中設定（持續）
export DEBUG_LLM=true
pnpm --filter @sre-agent/mcp-slo-management test:integration
```

## 輸出內容

啟用後，會在 stderr 輸出以下資訊：

### 1. REQUEST DEBUG
顯示送給 LLM 的完整內容：
- **System Prompt**：系統指令（告訴 AI 扮演什麼角色、如何回應）
- **User Prompt**：用戶輸入（包含 K8s manifests）

### 2. RESPONSE DEBUG
顯示 LLM 返回的原始回應：
- 未經處理的完整回應
- 可以看到是否有 markdown wrapper
- 可以檢查 JSON 格式是否正確

## 範例輸出

```
========== LLM REQUEST DEBUG ==========
System Prompt:
你是一位資深的 SRE 專家與架構師。
你的任務是分析提供的 Kubernetes manifests...

---
User Prompt:
<task>
K8s Manifests:

apiVersion: apps/v1
kind: Deployment
...
</task>
========== END REQUEST DEBUG ==========

========== LLM RESPONSE DEBUG ==========
Raw Response:
{
  "slos": [
    {
      "id": "slo-001",
      "name": "API Availability",
      ...
    }
  ]
}
========== END RESPONSE DEBUG ==========
```

## 用途

1. **檢查 Prompt 是否正確**：確認送給 LLM 的指令符合預期
2. **Debug AI 回應問題**：當 JSON 解析失敗時，查看原始回應
3. **優化 Prompt**：根據實際輸出調整 system prompt
4. **驗證資料傳遞**：確認 K8s manifests 完整傳送給 LLM

## 關閉 DEBUG

```bash
# 取消環境變數
unset DEBUG_LLM

# 或設為 false
export DEBUG_LLM=false
```
