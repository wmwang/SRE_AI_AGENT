# CLI Agent 錯誤排查指南

## 常見錯誤與解決方案

### 錯誤 1: "抱歉，處理您的查詢時發生錯誤"

這個錯誤可能有多種原因，請按照以下步驟排查：

#### Step 1: 檢查 stderr 輸出

CLI 會在 stderr 輸出詳細的錯誤訊息。請查看終端中是否有以下訊息：

**MCP Server 連接問題：**
```
[MCP] ✗ Failed to connect to SLO Management
[MCP] ✗ Failed to connect to Metrics Analysis
```

**OpenAI API 問題：**
```
Error: 401 Unauthorized
Error: Invalid API key
```

**Workflow 執行問題：**
```
[Workflow] Failed to parse plan
[MCP] Error calling slo.track_slo_status
```

#### Step 2: 確認環境變數

```bash
# 檢查 OpenAI API Key
echo $OPENAI_API_KEY
# 應該有值，且正確

# 檢查其他設定
echo $OPENAI_MODEL
echo $SHARED_MEMORY_PATH
```

#### Step 3: 測試 MCP Servers 獨立運行

**測試 SLO Server：**
```bash
cd packages/mcp-slo-management
#OPENAI_API_KEY=your-key node dist/index.js
# 應該啟動不報錯（Ctrl+C 退出）
```

**測試 Metrics Server：**
```bash
cd packages/mcp-metrics-analysis
PROMETHEUS_ENDPOINT=http://localhost:9090 node dist/index.js
# 應該啟動不報錯（Ctrl+C 退出）
```

#### Step 4: 啟用 Debug 模式

重新啟動 CLI 並啟用 debug：

```bash
# 方式 1: 環境變數
DEBUG_MCP=true DEBUG_LLM=true ./start-cli.sh

# 方式 2: 直接執行
cd packages/cli
DEBUG_MCP=true DEBUG_LLM=true node dist/index.js
```

**⚠️ 注意**：為了避免干擾 CLI 介面（UI），所有的 Debug 日誌現在都會**寫入檔案**，而不是顯示在螢幕上。

請打開新的終端機視窗查看日誌：

```bash
# 查看應用程式 Debug 日誌 (MCP 連接、程式錯誤等)
tail -f logs/app-debug.log

# 查看 LLM 請求與回應詳情 (System Prompt, User Prompt, JSON Response)
tail -f logs/llm-debug.log
```

#### Step 4.1: 找不到 Log 檔案？(Windows / IDE 使用者必讀)

如果您是在 Windows 上，或是透過 VS Code / Windsurf / Cursor 等 IDE 啟動 MCP Server，您可能會找不到 Log 放在哪裡。

日誌系統會按照以下順序決定存放位置：
1. **專案目錄下的 `logs/`**：這是最優先的位置。系統會根據**程式碼檔案所在的實際路徑**去推算專案根目錄，所以無論您的 IDE 從哪裡啟動執行檔，日誌都應該出現在您下載的這個專案資料夾裡的 `logs` 目錄中。
2. **使用者家目錄的 Fallback**：如果上述嘗試失敗（例如權限不足），日誌會被寫入到 `~/.sre-agent/logs/`。
   - Windows: `C:\Users\<您的使用者名稱>\.sre-agent\logs\`
   - macOS/Linux: `/Users/<您的使用者名稱>/.sre-agent/logs/`

**強制指定路徑：**
您也可以透過環境變數強制指定絕對路徑：
- `MCP_LOG_PATH`: 指定 `mcp-metrics.log` 的完整路徑 (e.g. `C:\logs\mcp.log`)
- `LLM_LOG_PATH`: 指定 `llm-debug.log` 的完整路徑 (e.g. `C:\logs\llm.log`)

#### Step 5: 檢查查詢內容

某些查詢可能需要特定的參數。試試最簡單的查詢：

```
> 列出所有可用的工具
```

如果這個也失敗，問題可能在 workflow 的 analyze 階段。

## 具體錯誤案例

### 案例 1: OpenAI API Key 無效

**症狀：**
```
Error: 401 Unauthorized
```

**解決：**
```bash
# 重新設定正確的 API key
export OPENAI_API_KEY=sk-...
```

### 案例 2: MCP Server 路徑錯誤

**症狀：**
```
[MCP] Failed to connect to SLO Management
Error: ENOENT: no such file or directory
```

**解決：**
```bash
# 確認檔案存在
ls -la packages/mcp-slo-management/dist/index.js
ls -la packages/mcp-metrics-analysis/dist/index.js

# 重新建置
pnpm run build
```

### 案例 3: Node.js 版本問題

**症狀：**
```
SyntaxError: Unexpected token
```

**解決：**
```bash
# 檢查 Node.js 版本
node --version
# 應該是 v22.x

# 如果版本過舊，請升級
```

### 案例 4: Shared Memory 權限問題

**症狀：**
```
Error: EACCES: permission denied
```

**解決：**
```bash
# 使用記憶體模式（不寫檔案）
export SHARED_MEMORY_PATH=:memory:
```

## 需要提供的資訊

如果以上步驟都無法解決，請提供：

1. **完整的錯誤訊息**（從 stderr）
2. **您輸入的查詢**
3. **環境資訊：**
   ```bash
   node --version
   echo $OPENAI_API_KEY | cut -c1-10  # 只顯示前10字元
   echo $OPENAI_MODEL
   ```
4. **MCP Server 連接狀態**（啟動時的訊息）

## 快速診斷命令

```bash
# 一鍵診斷
cd /Users/isosoman/Documents/SRE_AI_AGENT

echo "=== Node Version ==="
node --version

echo "=== Build Status ==="
ls -la packages/*/dist/index.js

echo "=== Environment ==="
echo "OPENAI_API_KEY: ${OPENAI_API_KEY:0:10}..."
echo "OPENAI_MODEL: $OPENAI_MODEL"

echo "=== Test OpenAI Connection ==="
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  | head -n 20
```
