# SRE AI Agent 系統設計全覽

> Version: 2.0.0
> Last Updated: 2026-01-13

## 📖 概述

**SRE AI Agent** 是一個基於 Context-Aware Generative AI 的智慧維運輔助系統。它利用 LLM 的語義理解與推理能力，結合 Model Context Protocol (MCP) 標準，為 SRE/DevOps 團隊提供一個自然的互動介面，以執行複雜的可觀測性分析、SLO 管理、以及根因排查任務。

### 核心設計理念

1.  **AI-First**: 從 CLI 交互到資料分析，全面採用 LLM 驅動。
2.  **Tool-Use**: 透過 MCP 協議將基礎設施能力封裝為標準工具。
3.  **Human-in-the-Loop**: 複雜決策（如修改 SLO、執行修復）始終保留人工確認環節。
4.  **Context-Aware**: 系統具備記憶能力，理解當前排查的服務與環境上下文。

---

## 🏗️ 系統架構

整體架構採用**微服務化**設計，透過 MCP 協議進行鬆散耦合。

```mermaid
graph TD
    User([SRE Engineer]) <--> CLI[CLI Agent<br/>(Ink + LangGraph)]

    subgraph "Infrastructure Layer"
        Registry[MCP Registry<br/>(Service Discovery)]
        SharedMem[Shared Memory<br/>(Context Storage)]
    end

    subgraph "MCP Servers Layer"
        SLO[SLO Management<br/>Server]
        Metrics[Metrics Analysis<br/>Server]
        K8s[K8s Deployment<br/>Server]
        Logs[Log Analysis<br/>Server]
    end

    subgraph "Data Sources"
        Prometheus[(Prometheus)]
        K8sAPI[Kubernetes API]
        ES[(Elasticsearch)]
        Git[Git Repository]
        OpenAI[OpenAI API]
    end

    %% Connections
    CLI <--> Registry
    CLI <--> SharedMem
    
    CLI <--> SLO
    CLI <--> Metrics
    CLI <--> K8s
    CLI <--> Logs

    SLO <--> OpenAI
    SLO <--> SharedMem

    Metrics <--> Prometheus
    Metrics <--> OpenAI

    K8s <--> K8sAPI
    K8s <--> Git
    K8s <--> OpenAI

    Logs <--> ES
    Logs <--> OpenAI
    
    classDef infra fill:#e1f5fe,stroke:#01579b
    classDef mcp fill:#fff3e0,stroke:#e65100
    classDef cli fill:#e8f5e9,stroke:#1b5e20
    
    class Registry,SharedMem infra
    class SLO,Metrics,K8s,Logs mcp
    class CLI cli
```

---

## 🧩 組件詳解

### 1. 應用層：CLI Agent

> **角色**：中央大腦與互動介面

-   **核心技術**：TypeScript, React Ink, LangGraph, LLM
-   **功能模組**：
    -   **MCP Client Manager**: 自動發現並連接所有註冊的 MCP Servers。
    -   **Context Manager**: 管理使用者 Session（如當前 Namespace, Time Range），存儲於 Shared Memory。
    -   **Smart Router**: 解析自然語言，決定調用哪個 Tool 或啟動哪個 Workflow。
    -   **UI Engine**: 基於 Ink 渲染動態、互動式的 Terminal UI。

### 2. 基礎設施層

#### MCP Registry
-   **職責**：服務註冊與發現中心。
-   **機制**：各 MCP Server 啟動時註冊自身 Capabilities，CLI 啟動時拉取清單。

#### Shared Memory
-   **職責**：跨 Server 狀態共享與持久化。
-   **實作**：輕量級 Key-Value Store (Map-based for compatibility)，支援 JSON 序列化。
-   **用途**：存儲 User Context、跨步驟分析的中間結果。

### 3. MCP Servers 層

這一層封裝了具體的領域知識與操作能力。

#### A. SLO Management Server `packages/mcp-slo-management`
專注於服務水準目標的生命週期管理。

-   **Tools**:
    -   `analyze_k8s_manifests`: 分析 YAML 結構。
    -   `recommend_slos`: AI 建議合適的 SLO 指標與閾值。
    -   `track_slo_status`: 計算目前的 Burn Rate。
    -   `calculate_error_budget`: 計算剩餘錯誤預算。
    -   `generate_slo_report`: 生成 Markdown 格式報告。

#### B. Metrics Analysis Server `packages/mcp-metrics-analysis`
專注於時序資料的查詢與異常檢測。

-   **Tools**:
    -   `query_metrics_range`: 執行 PromQL 區間查詢。
    -   `discover_metrics`: 自動發現可用的指標名稱。
    -   `detect_anomalies`: AI 分析趨勢，檢測異常波動。
    -   `analyze_metric_trend`: 解讀指標走勢的業務含義。

#### C. K8s Deployment Server `packages/mcp-k8s-deployment`
專注於應用部署與配置管理。

-   **Tools**:
    -   `scan_repo`: 掃描 Git Repo 中的 K8s 資源。
    -   `analyze_deployment`: 解讀 Deployment 架構與相依性。
    -   `suggest_improvements`: 安全性與最佳實踐建議。
    -   `render_helm_chart`: 渲染 Helm Chart 為純 YAML。

#### D. Log Analysis Server (Planned) `packages/mcp-log-analysis`
**[New]** 專注於日誌檢索與根因分析。

-   **Tools**:
    -   `search_logs_nl`: 自然語言轉 ES Query 搜尋。
    -   `summarize_logs`: 智慧摘要海量日誌。
    -   `analyze_root_cause`: 跨日誌與指標的關聯分析。
    -   `detect_log_anomalies`: 識別日誌模式異常。

---

## 🔄 任務編排與協作 (Orchestration)

### 1. 核心資料流向圖 (Data Flow)

展示從用戶輸入到最終工具執行的完整資料路徑。

```text
                                  ┌──────────────────┐
                                  │    User Input    │
                                  │ "Check errors"   │
                                  └────────┬─────────┘
                                           │
                                           ▼
                                  ┌──────────────────┐
                                  │   Smart Router   │
                                  │ (Intent Analysis)│
                                  └────────┬─────────┘
              ┌────────────────────────────┼─────────────────────────────┐
              ▼                            ▼                             ▼
    ┌──────────────────┐         ┌──────────────────┐          ┌──────────────────┐
    │   Log Workflow   │         │ Metric Workflow  │          │   RCA Workflow   │
    └─────────┬────────┘         └─────────┬────────┘          └─────────┬────────┘
              │                            │                             │
              │◄───────────────────────────┼────────────────────────────►│
              │                    ┌───────┴───────┐                     │
              │                    │ Context Mgr   │◄───► Shared Memory  │
              │                    └───────────────┘                     │
              │                            │                             │
              ▼                            ▼                             ▼
    ┌──────────────────┐         ┌──────────────────┐          ┌──────────────────┐
    │ Log Analysis MCP │         │ Metrics MCP      │          │ SLO MCP          │
    └─────────┬────────┘         └─────────┬────────┘          └─────────┬────────┘
              │                            │                             │
              └─────────────┬──────────────┴──────────────┬──────────────┘
                            │                             │
                            ▼                             ▼
                  ┌──────────────────┐          ┌──────────────────┐
                  │ Result Synthesizer│         │   Ink UI Renderer │
                  └──────────────────┘          └─────────┬────────┘
                                                         │
                                                         ▼
                                                ┌──────────────────┐
                                                │   User Terminal  │
                                                └──────────────────┘
```

### 2. Context 狀態管理模型

展示 Shared Memory 中儲存的狀態結構。

```text
┌────────────────────────────────────────────────────────┐
│                   Shared Memory Store                  │
│                                                        │
│  Key: "user_ctx"                                       │
│  ┌──────────────────────────────────────────────────┐  │
│  │ UserContext                                      │  │
│  │ ├─ namespace: "production-payment"               │  │
│  │ ├─ service: "payment-api"                        │  │
│  │ └─ timeRange: { start: 1705..., end: 1705... }   │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  Key: "analysis_state"                                 │
│  ┌──────────────────────────────────────────────────┐  │
│  │ AnalysisState                                    │  │
│  │ ├─ currentFocus: "High Error Rate"               │  │
│  │ ├─ findings: ["DB Connection Failed", ...]       │  │
│  │ └─ rootCauseHypothesis: "Pool Exhausted"         │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  Key: "sys_config"                                     │
│  ┌──────────────────────────────────────────────────┐  │
│  │ SystemConfig                                     │  │
│  │ ├─ debugMode: true                               │  │
│  │ └─ activeServers: ["slo", "metrics", "logs"]     │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

### 3. Root Cause Analysis (RCA) 協作流程

跨 Server 協作的時序流程：

```text
User           CLI Agent          Supervisor          Log Agent          Metrics Agent          OpenAI (LLM)
 │                 │                  │                   │                    │                     │
 ├── "分析錯誤" ──►│                  │                   │                    │                     │
 │                 ├── Invoke ───────►│                   │                    │                     │
 │                 │                  ├── Phase 1. Plan ──┼────────────────────┼────────────────────►│
 │                 │                  │                   │                    │                     │
 │                 │                  │◄──────────────────┼────────────────────┼─────── Plan ────────┤
 │                 │                  │                   │                    │                     │
 │                 │                  ├── Phase 2. Logs ─►│                    │                     │
 │                 │                  │                   ├── Gen ES Query ────┼────────────────────►│
 │                 │                  │                   │◄── Query ──────────┼─────────────────────┤
 │                 │                  │                   │                    │                     │
 │                 │                  │◄── Found Error ───┤                    │                     │
 │                 │                  │                   │                    │                     │
 │                 │                  ├── Phase 3. Verify ┼───────────────────►│                     │
 │                 │                  │                   │                    ├── Check Anomaly ───►│
 │                 │                  │                   │                    │◄── Confirmed ───────┤
 │                 │                  │                   │                    │                     │
 │                 │                  │◄── DB High Conn ──┼────────────────────┤                     │
 │                 │                  │                   │                    │                     │
 │                 │                  ├── Phase 4. Report ┼────────────────────┼────────────────────►│
 │                 │                  │                   │                    │                     │
 │                 │                  │◄── Final Report ──┼────────────────────┼── Root Cause ───────┤
 │                 │                  │                   │                    │                     │
 │◄── Display ─────┼──────────────────┤                   │                    │                     │
 ▼                 ▼                  ▼                   ▼                    ▼                     ▼
```

### 4. CLI 內部組件互動圖

CLI 內部的 UI 與 邏輯層互動：

```text
       ┌────────────────────────┐                  ┌────────────────────────┐
       │     UI Layer (Ink)     │                  │ Logic Layer (LangGraph)│
       └───────────┬────────────┘                  └───────────┬────────────┘
                   │                                           │
         [ Idle State ]                                  [ Wait State ]
                   │                                           │
       User Types  │                                           │
       "Explain..."│                                           │
                   ▼                                           │
         [ Input State ] ────── Submit Action ───────────────► │
                   │                                           │
                   │                                     [ Analyzing ]
                   │                                           │
                   │                                   Creates Plan &
                   │                                   Executes Tools
                   │                                           │
                   │                                           ▼
                   │                                   [ Synthesizing ]
                   │                                           │
         [ Display State ] ◄────── Result / State ─────────────┘
                   │                  Update
                   │
                   ▼
         [ Idle State ]
```

---

## 🖥️ 使用者介面設計

User Interface 旨在解決 "資訊過載" 與 "上下文丟失" 的問題。

### Context-Aware CLI

介面設計採用分層結構：

```
┌─────────────────────────────────────────────────────────────┐
│  🤖 SRE AI Agent                                            │
├─────────────────────────────────────────────────────────────┤
│  Context: production / payment-service                      │
│                                                              │
│  [Tabs]                                                     │
│  Logs | Metrics | SLOs | Deployments                        │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ User: "為什麼最近的錯誤率上升？"                          │ │
│  │                                                        │ │
│  │ AI Thinking...                                         │ │
│  │ 1. Checking SLO status... [Burn Rate High]             │ │
│  │ 2. Analyzing Logs... [Found 500 errors]                │ │
│  │ 3. Correlating...                                      │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  > Report: SQL Timeout caused by slow query on table X.     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 未來擴展規劃

### Phase 1: 整合與強化 (Current)
- [x] 基礎三大 MCP Servers。
- [x] CLI 基礎互動。
- [ ] 整合 Log Analysis Server。
- [ ] 完善 Multi-Agent 協作邏輯。

### Phase 2: 自動化閉環
- [ ] **Auto-Remediation**: 允許 Agent 在人工授權下執行 `kubectl patch` 或 `rollback`。
- [ ] **Proactive Alerting**: Agent 主動監控並推送分析報告，而非被動等待查詢。

### Phase 3: 企業級能力
- [ ] **RBAC 整合**: 根據使用者權限限制 Tool 調用。
- [ ] **Audit Logging**: 記錄所有 AI 的操作與決策過程。
- [ ] **Knowledge Base**: 允許 Agent 讀取內部的 Post-mortem 文件庫學習。
