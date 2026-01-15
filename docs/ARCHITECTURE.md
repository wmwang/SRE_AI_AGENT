# SRE AI Agent 系統架構圖

> 版本: 2.1.0 | 更新日期: 2026-01-15

## 📐 整體系統架構

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER LAYER                                     │
│                                                                             │
│                          👤 SRE Engineer                                    │
│                                │                                            │
│         ┌──────────────────────┼──────────────────────┐                     │
│         ▼                      ▼                      ▼                     │
│   💻 Terminal            🌐 Web Browser         🖥️ IDE                      │
│         │                      │                (Cline/Cursor)              │
│         │               ┌──────┴──────┐               │                     │
│         │               │Web Frontend │               │                     │
│         │               │(Vite+React) │               │                     │
│         │               └──────┬──────┘               │                     │
│         │                      │ HTTP                 │                     │
└─────────┼──────────────────────┼──────────────────────┼─────────────────────┘
          │                      │                      │
          ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          BACKEND SERVICES                                   │
│                                                                             │
│   ┌────────────────┐   ┌──────────────────────┐   ┌────────────────┐       │
│   │   CLI Agent    │   │    API Gateway       │   │   IDE 內建     │       │
│   │(Ink + LangGraph)│   │      (Hono)          │   │   MCP Client   │       │
│   │                │   │                      │   │                │       │
│   │ • 終端機互動   │   │ • HTTP → MCP 轉換   │   │ • 直連 MCP     │       │
│   │ • LangGraph    │   │ • CORS 支援         │   │                │       │
│   │   Workflow     │   │ • SSE 串流          │   │                │       │
│   └───────┬────────┘   └─────────┬────────────┘   └───────┬────────┘       │
│           │                      │                        │                 │
│           └──────────────────────┼────────────────────────┘                 │
│                                  │                                          │
└──────────────────────────────────┼──────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        MCP INFRASTRUCTURE                                   │
│                                                                             │
│   ┌────────────────┐    ┌────────────────┐    ┌────────────────┐           │
│   │   MCP Client   │    │  MCP Registry  │    │ Shared Memory  │           │
│   │     (SDK)      │◄──►│ (Svc Discovery)│◄──►│(Context Store) │           │
│   └───────┬────────┘    └────────────────┘    └────────────────┘           │
│           │                                                                 │
└───────────┼─────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MCP SERVERS                                       │
│                                                                             │
│   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌─────────────┐ │
│   │ SLO Mgmt      │  │ Metrics       │  │ K8s Deploy    │  │ Log         │ │
│   │ Server        │  │ Analysis      │  │ Server        │  │ Analysis    │ │
│   │ ─────────     │  │ ─────────     │  │ ─────────     │  │ ─────────   │ │
│   │ analyze_k8s   │  │ query_metrics │  │ scan_repo     │  │ search_logs │ │
│   │ recommend_slos│  │ detect_anom   │  │ analyze_deploy│  │ summarize   │ │
│   │ gen_report    │  │ trend_analyze │  │ suggest_improv│  │ error_patt  │ │
│   └───────┬───────┘  └───────┬───────┘  └───────┬───────┘  └──────┬──────┘ │
│           │                  │                  │                 │        │
└───────────┼──────────────────┼──────────────────┼─────────────────┼────────┘
            │                  │                  │                 │
            ▼                  ▼                  ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA SOURCES                                      │
│                                                                             │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│   │Prometheus│  │   K8s    │  │  Elastic │  │  OpenAI  │  │   Git    │     │
│   │          │  │   API    │  │  Search  │  │   API    │  │   Repo   │     │
│   └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 三種存取路徑

```
路徑 A: CLI 直連 (Terminal → MCP)
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Terminal │───►│CLI Agent │───►│MCP Client│───►│MCP Server│
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                    │
                    └─ LangGraph Workflow 編排

路徑 B: Web 透過 API (Browser 不能直接用 MCP SDK)
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Browser  │───►│  Web UI  │───►│API Gatway│───►│MCP Client│───►│MCP Server│
│          │    │(Frontend)│HTTP│  (Hono)  │    │          │    │          │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
                                    │
                                    └─ HTTP → MCP 協議轉換

路徑 C: IDE 直連 (IDE 內建 MCP Client)
┌──────────┐    ┌──────────┐    ┌──────────┐
│   IDE    │───►│MCP Client│───►│MCP Server│
│(Cline等) │    │ (內建)   │    │          │
└──────────┘    └──────────┘    └──────────┘
```

---

## 🌐 API Gateway 職責說明

**為什麼需要 API Gateway？**

| 問題 | API Gateway 解決方案 |
|------|---------------------|
| Browser 無法使用 MCP SDK | 提供 HTTP REST API |
| 跨域請求限制 | CORS middleware |
| AI 回應需要串流 | SSE 串流端點 |
| 統一認證授權 | 可在 Gateway 層處理 |

**API 端點：**
```
POST /api/slo/analyze      → analyze_k8s_manifests
POST /api/slo/refine       → recommend_slos
POST /api/slo/generate     → generate_prometheus_rules
POST /api/metrics/query    → nl_to_promql
POST /api/metrics/diagnose → analyze_metrics_health
POST /api/logs/search      → search_logs
POST /api/logs/summarize   → summarize_logs
POST /api/logs/analyze     → analyze_error_patterns
```

---

## 📦 Monorepo 結構

```
SRE_AI_AGENT/
├── packages/
│   ├── cli/                      # CLI Agent (Ink TUI)
│   ├── api/                      # API Gateway (Hono) ← Web 專用
│   ├── web/                      # Web Frontend (Vite + React)
│   ├── mcp-slo-management/       # SLO MCP Server
│   ├── mcp-metrics-analysis/     # Metrics MCP Server
│   ├── mcp-log-analysis/         # Log MCP Server
│   ├── mcp-k8s-deployment/       # K8s MCP Server
│   ├── mcp-registry/             # MCP Service Discovery
│   └── shared-memory/            # Context Store
├── .env.example
├── start-cli.sh
└── start-cli.bat
```

---

## 🔌 MCP Server 工具清單

### SLO Management Server
| Tool                  | Description              |
|-----------------------|--------------------------|
| analyze_k8s_manifests | 分析 K8s YAML 結構       |
| recommend_slos        | AI 建議 SLO 指標與閾值   |
| track_slo_status      | 計算 Burn Rate           |
| calculate_error_budget| 計算剩餘錯誤預算         |
| generate_slo_report   | 生成 Markdown 報告       |

### Metrics Analysis Server
| Tool                  | Description              |
|-----------------------|--------------------------|
| query_metrics         | 執行 PromQL 即時查詢     |
| query_metrics_range   | 執行 PromQL 區間查詢     |
| discover_metrics      | 自動發現可用指標         |
| detect_anomalies      | AI 分析異常              |
| analyze_metric_trend  | 趨勢分析                 |
| nl_to_promql          | 自然語言轉 PromQL        |

### Log Analysis Server
| Tool                  | Description              |
|-----------------------|--------------------------|
| search_logs           | 搜尋日誌                 |
| nl_to_es_query        | 自然語言轉 ES Query      |
| summarize_logs        | 智慧摘要日誌             |
| analyze_error_patterns| 分析錯誤模式             |

### K8s Deployment Server
| Tool                  | Description              |
|-----------------------|--------------------------|
| scan_repo             | 掃描 Git Repo K8s 資源   |
| analyze_deployment    | 解讀 Deployment 架構     |
| suggest_improvements  | 最佳實踐建議             |
| render_helm_chart     | 渲染 Helm Chart          |

---

## 🔐 認證設定

### Prometheus
```bash
PROMETHEUS_ENDPOINT="https://prometheus.example.com"
PROMETHEUS_HEADERS='{"Authorization": "Bearer your-token"}'
```

### Elasticsearch
```bash
ELASTICSEARCH_ENDPOINT="http://localhost:9200"
ELASTICSEARCH_API_KEY="your-api-key"
```

---

## 🔧 技術棧

| 類別   | 技術                          |
|--------|-------------------------------|
| 語言   | TypeScript                    |
| AI/LLM | OpenAI SDK (SSE 串流)         |
| MCP    | Model Context Protocol SDK    |
| CLI    | Ink (React for CLI)           |
| Web    | Vite + React 19 + Tailwind v4 |
| API    | Hono                          |
