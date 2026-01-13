# SRE/OPS AI Agent 系統

企業級的 SRE/OPS AI Agent 系統，扮演顧問、專家、資深架構師的角色，為公司內的 SRE/OPS 團隊提供高階建議與診斷。

## 🎯 功能特色

- **SLO 管理**：動態建立、建議、追蹤、部署和長期優化 SLO 指標
- **日誌分析**：Kibana/Loki 日誌診斷、告警指標建議、維運追蹤
- **指標監控**：Prometheus 指標追蹤、探索、建議、偵測
- **部署優化**：K8s/CI-CD 部署流程建議、調整、優化

## 🏗️ 架構設計

採用模組化 MCP (Model Context Protocol) 架構：

- **MCP Servers**：
  - SLO Management Server
  - Log Analysis Server
  - Metrics Analysis Server
  - K8s Integration Server
- **Shared Memory**：統一的上下文管理
- **CLI Agent**：基於 LangGraph + Ink 的終端介面
- **Web Interface**：Vite + React + Tailwind 的現代化 Web UI
- **API Gateway**：Hono HTTP API 閘道

## 🚀 快速開始 (Quick Start)

### 1. 環境準備 (Prerequisites)

本系統需要 **Node.js** (v18+) 環境。

```bash
# 檢查 Node.js 版本
node -v

# 安裝 pnpm (必要)
npm install -g pnpm
```

### 2. 安裝與建置 (Installation)

```bash
# 1. 複製專案
git clone <repository_url>
cd SRE_AI_AGENT

# 2. 安裝所有依賴
pnpm install

# 3. 建置專案
pnpm build
```

### 3. 設定環境變數 (Configuration)

在專案根目錄建立 `.env` 檔案（或直接設定環境變數）：

```bash
# [必要] OpenAI API Key
OPENAI_API_KEY="sk-..."

# [選填] Prometheus 端點
PROMETHEUS_ENDPOINT="http://localhost:9090"
```

### 4. 啟動系統 (Running)

#### 方式 A：CLI 介面

```bash
# Mac/Linux
./start-cli.sh

# Windows
start-cli.bat
```

#### 方式 B：Web 介面 ✨ NEW

```bash
# 終端機 1：啟動 API Gateway
cd packages/api && pnpm dev

# 終端機 2：啟動 Web Frontend
cd packages/web && pnpm dev

# 開啟瀏覽器：http://localhost:5173
```

---

## 🌐 Web 介面

全新的 Web UI 提供更直覺的操作體驗：

| 頁面 | 功能 |
|------|------|
| **Dashboard** | 總覽頁面，快速進入各功能 |
| **SLO Workflow** | K8s YAML → SLO → Prometheus Rules |
| **Metrics Explorer** | 自然語言查詢 + 圖表 + AI 診斷 |
| **Tool Browser** | 瀏覽和測試所有 MCP 工具 |

---

## 📦 Monorepo 結構

```
SRE_AI_AGENT/
├── packages/
│   ├── cli/                    # CLI Agent (Ink TUI)
│   ├── api/                    # API Gateway (Hono)
│   ├── web/                    # Web Frontend (Vite + React)
│   ├── mcp-slo-management/     # SLO 管理 MCP Server
│   ├── mcp-metrics-analysis/   # 指標分析 MCP Server
│   ├── mcp-k8s-integration/    # K8s 整合 MCP Server
│   └── shared-memory/          # Shared Memory Service
├── logs/                       # 日誌目錄
├── start-cli.sh               # Mac/Linux 啟動腳本
└── start-cli.bat              # Windows 啟動腳本
```

---

## 🐛 Debug 模式

```bash
# 開啟所有 Debug 日誌
export DEBUG=true DEBUG_LLM=true
./start-cli.sh

# 查看日誌
tail -f logs/app-debug.log
tail -f logs/llm-debug.log
```

詳細除錯說明請參考 [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

---

## 🛠️ 技術棧

| 類別 | 技術 |
|------|------|
| **語言** | TypeScript |
| **AI/LLM** | OpenAI SDK (相容 OpenAI API 協定) |
| **MCP** | Model Context Protocol SDK |
| **CLI** | Ink (React for CLI) |
| **Web** | Vite + React 19 + Tailwind CSS v4 |
| **API** | Hono |
| **Workflow** | LangGraph-style State Machine |
| **圖表** | Recharts |

---

## 📚 文件

- [系統設計](./SYSTEM_DESIGN.md)
- [疑難排解](./TROUBLESHOOTING.md)

## 📄 授權

MIT License
