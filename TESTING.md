# 快速開始測試 CLI Agent

## 前置條件

確認環境變數已設定：
```bash
echo $OPENAI_API_KEY  # 應該有值
echo $OPENAI_MODEL    # 可選，預設 gpt-4o-mini
```

## 方式 1：使用啟動腳本（推薦）

```bash
cd /Users/isosoman/Documents/SRE_AI_AGENT
./start-cli.sh
```

## 方式 2：手動啟動

```bash
cd /Users/isosoman/Documents/SRE_AI_AGENT

# 建置所有 packages（如果還沒建置）
pnpm run build

# 啟動 CLI
pnpm --filter @sre-agent/cli start
```

## 測試查詢範例

啟動後，可以試試這些查詢：

### 簡單查詢
```
> 查詢所有 SLO 狀態
```

### SLO相關
```
> 分析 packages/mcp-slo-management/test-data/guestbook.yaml 並建議 SLO
> 計算錯誤預算
> 生成 SLO 報告
```

### Metrics 相關
```
> 探索可用的 Prometheus 指標
> 查詢 CPU 使用率
> 檢測異常
```

## 預期行為

1. CLI 啟動後會連接到兩個 MCP Servers
2. 輸入查詢後會顯示「正在處理...」
3. AI 會分析您的意圖
4. 自動選擇並執行適當的 tools
5. 以友善的格式展示結果

## 如果遇到問題

### 問題 1: MCP Server 連接失敗
```bash
# 確認 servers 已建置
ls -la packages/mcp-slo-management/dist/
ls -la packages/mcp-metrics-analysis/dist/

# 重新建置
pnpm run build
```

### 問題 2: OpenAI API 錯誤
```bash
# 檢查 API key
echo $OPENAI_API_KEY

# 重新設定
export OPENAI_API_KEY=your-actual-key
```

### 問題 3: 查看 Debug 訊息
```bash
# 啟用 debug 模式
DEBUG_MCP=true ./start-cli.sh
```

## 退出

按 `Ctrl+C` 退出 CLI
