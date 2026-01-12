# SRE/OPS AI Agent 系統

企業級的 SRE/OPS AI Agent 系統，扮演顧問、專家、資深架構師的角色，為公司內的 SRE/OPS 團隊提供高階建議與診斷。

## 🎯 功能特色

- **SLO 管理**：動態建立、建議、追蹤、部署和長期優化 SLO 指標
- **日誌分析**：Kibana/Loki 日誌診斷、告警指標建議、維運追蹤
- **指標監控**：Prometheus 指標追蹤、探索、建議、偵測
- **部署優化**：K8s/CI-CD 部署流程建議、調整、優化

## 🏗️ 架構設計

採用模組化 MCP (Model Context Protocol) 架構：

- **MCP Registry**：服務發現與註冊中心
- **MCP Servers**：
  - SLO Management Server
  - Log Analysis Server
  - Metrics Analysis Server
  - K8s/CI-CD Server
- **Shared Memory**：統一的上下文管理（SQLite/Redis）
- **CLI Agent**：基於 LangGraph + Ink 的終端介面
- **Web Interface**：Web 管理介面

## 🚀 快速開始 (Quick Start)

### 1. 環境準備 (Prerequisites)

本系統需要 **Node.js** (v18+) 環境。

#### 步驟 1：安裝 Node.js
請確認你的電腦已安裝 Node.js (建議 v18 或 v20 LTS 版本)。
> 檢查方式：打開終端機 (Terminal) 輸入 `node -v`

#### 步驟 2：安裝 pnpm (必要)
本專案使用 `pnpm` 進行套件管理 (因為是 Monorepo 架構，能大幅節省硬碟空間)。
如果你的電腦還沒安裝 pnpm，請執行以下指令安裝：

```bash
# 使用 npm 安裝 pnpm
npm install -g pnpm

# 驗證安裝
pnpm -v
```

---

### 2. 安裝與建置 (Installation)

```bash
# 1. 複製專案
git clone <repository_url>
cd SRE_AI_AGENT

# 2. 安裝所有依賴 (會自動處理所有 packages)
pnpm install

# 3. 建置專案
pnpm build
```

---

### 3. 設定環境變數 (Configuration)

你需要設定以下變數才能讓 Agent 正常運作。可以直接在終端機執行，或寫入 `~/.zshrc` / `.env` 檔案。

```bash
# [必要] OpenAI API Key (用於 AI 分析與生成)
export OPENAI_API_KEY="sk-..."

# [選填] Prometheus 端點 (Metrics Explorer 需要)
# 若無真實 Prometheus，可略過此行，系統預設會使用 Mock 模式
export PROMETHEUS_ENDPOINT="http://localhost:9090"

# [選填] K8s 設定 (SLO Workflow 需要)
# 通常系統會自動讀取 ~/.kube/config，若位置不同請設定：
export KUBECONFIG="~/.kube/config"
```

---

### 4. 啟動系統 (Running)

我們提供了啟動腳本，直接執行即可進入 CLI 介面：

**Mac/Linux:**
```bash
# 賦予執行權限 (初次執行需要)
chmod +x start-cli.sh

# 啟動 Agent
./start-cli.sh
```

**Windows:**
```batch
# 直接點擊 start-cli.bat 或在 CMD/PowerShell 執行：
start-cli.bat
```

---

### 5. 開發指令 (Development)

如果你是開發者，可以使用以下指令：

```bash
# 開發模式 (Watch Mode)
pnpm dev

# 執行測試
pnpm test

# 類型檢查
pnpm typecheck
```

### 6. 進階模式 (Advanced Modes)

#### 🐛 Debug 模式
如果你遇到問題，可以開啟 Debug 模式查看詳細日誌：

**Mac/Linux:**
```bash
export DEBUG=true
./start-cli.sh
```

**Windows:**
```batch
set DEBUG=true
start-cli.bat
```

#### 🧪 Mock 模式 (模擬 Prometheus)
如果你**沒有**真實的 Prometheus 環境，可以開啟 Mock 模式，系統會使用模擬數據讓你體驗功能：

**Mac/Linux:**
```bash
export MOCK_PROMETHEUS=true
./start-cli.sh
```

**Windows:**
```batch
set MOCK_PROMETHEUS=true
start-cli.bat
```

---

## 📦 Monorepo 結構

```
sre-ops-ai-agent/
├── packages/
│   ├── mcp-registry/          # MCP 服務註冊中心
│   ├── mcp-orchestrator/      # MCP 協調器
│   ├── mcp-slo-management/    # SLO 管理 MCP Server
│   ├── mcp-log-analysis/      # 日誌分析 MCP Server
│   ├── mcp-metrics-analysis/  # 指標分析 MCP Server
│   ├── mcp-k8s-cicd/         # K8s/CI-CD MCP Server
│   ├── shared-memory/         # Shared Memory Service
│   ├── cli-agent/            # CLI Agent
│   └── web-interface/        # Web Interface
└── docs/                     # 文件
```

## 📚 文件

詳細文件請參考 [docs/](./docs/) 目錄：

- [架構設計](./docs/architecture.md)
- [使用者手冊](./docs/user-manual.md)
- [開發者指南](./docs/developer-guide.md)

## 🛠️ 技術棧

- **語言**：TypeScript
- **AI/LLM**：OpenAI SDK (相容 OpenAI API 協定)
- **MCP**：Model Context Protocol SDK
- **CLI UI**：Ink (React for CLI)
- **Workflow**：LangGraph
- **儲存**：SQLite (開發) / Redis (生產)
- **Web**：Next.js

## 📄 授權

MIT License
