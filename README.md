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

## 🚀 快速開始

### 前置需求

- Node.js >= 18.0.0
- pnpm >= 8.0.0

### 安裝

```bash
# 安裝依賴
pnpm install

# 建置所有 packages
pnpm build
```

### 開發

```bash
# 開發模式
pnpm dev

# 執行測試
pnpm test

# 類型檢查
pnpm typecheck
```

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
