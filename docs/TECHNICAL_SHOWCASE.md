# SRE AI Agent - Technical Showcase

> **AI-Powered Site Reliability Engineering Platform**  
> 結合 LLM、MCP 架構與 LangGraph 工作流的智能運維代理系統

---

## 🎯 Project Overview

A **production-grade AI Agent** enabling SRE/DevOps engineers to interact with Prometheus, Kubernetes, and Elasticsearch using natural language.

**核心能力：**
- 自然語言查詢 Prometheus 指標
- 自動化 SLO 建議與報告生成
- 日誌智慧摘要與錯誤模式分析
- K8s 部署最佳實踐建議

```
                                    ┌─────────────────┐
                                    │  👤 SRE Engineer │
                                    └────────┬────────┘
                                             │
                          "查詢 API 錯誤率"  │
                                             ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│                            AI AGENT CORE                                       │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐         │
│  │ Natural Language │───►│ LangGraph        │───►│ Tool Selection   │         │
│  │ 自然語言處理     │    │ 工作流引擎       │    │ 工具選擇與執行   │         │
│  └──────────────────┘    └──────────────────┘    └────────┬─────────┘         │
└───────────────────────────────────────────────────────────┼────────────────────┘
                                                            │
                    ┌───────────────┬───────────────┬───────┴───────┐
                    ▼               ▼               ▼               ▼
           ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
           │   Metrics    │ │     SLO      │ │     Log      │ │     K8s      │
           │   Analysis   │ │  Management  │ │   Analysis   │ │  Deployment  │
           │  指標分析    │ │  SLO 管理    │ │  日誌分析    │ │  K8s 部署    │
           └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
                  │                │                │                │
                  ▼                ▼                ▼                ▼
           ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
           │  Prometheus  │ │   K8s API    │ │ Elasticsearch│ │   Git Repo   │
           └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

---

## 🏗️ Core Architecture: MCP + LangGraph

### Model Context Protocol (MCP) 的創新應用

本專案是 **MCP (Model Context Protocol)** 的生產級實作範例。MCP 是 Anthropic 提出的標準化 AI 工具呼叫協議，將 LLM 的能力延伸至外部系統。

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          CLI AGENT (Ink React 終端機介面)                       │
│  ┌────────────────┐   ┌────────────────────┐   ┌────────────────────┐          │
│  │  Terminal UI   │──►│  LangGraph         │──►│  MCP Client        │          │
│  │  終端機 UI     │   │  工作流引擎        │   │  Manager 管理器    │          │
│  └────────────────┘   └────────────────────┘   └─────────┬──────────┘          │
└──────────────────────────────────────────────────────────┼──────────────────────┘
                                                           │ stdio 標準輸入輸出
                                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          MCP 基礎設施                                           │
│  ┌────────────────┐   ┌────────────────────┐   ┌────────────────────┐          │
│  │   MCP SDK      │◄──│  Tool Registry     │◄──│  Shared Memory     │          │
│  │   協議層       │   │  工具註冊表(21+)   │   │  共享記憶體(SQLite)│          │
│  └───────┬────────┘   └────────────────────┘   └────────────────────┘          │
└──────────┼──────────────────────────────────────────────────────────────────────┘
           │
           ├─────────────────────┬─────────────────────┬─────────────────────┐
           ▼                     ▼                     ▼                     ▼
┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐
│ mcp-slo-management  │ │ mcp-metrics-analysis│ │ mcp-log-analysis    │ │ mcp-k8s-deployment  │
│ SLO 管理服務        │ │ 指標分析服務        │ │ 日誌分析服務        │ │ K8s 部署服務        │
│ ─────────────────── │ │ ─────────────────── │ │ ─────────────────── │ │ ─────────────────── │
│ • analyze_k8s       │ │ • query_metrics     │ │ • search_logs       │ │ • scan_repo         │
│ • recommend_slos    │ │ • detect_anomalies  │ │ • summarize_logs    │ │ • analyze_deployment│
│ • track_slo_status  │ │ • analyze_trend     │ │ • error_patterns    │ │ • suggest_improve   │
│ • calc_error_budget │ │ • nl_to_promql      │ │ • nl_to_es_query    │ │ • render_helm       │
│ • generate_report   │ │ • suggest_hints     │ │                     │ │                     │
└─────────────────────┘ └─────────────────────┘ └─────────────────────┘ └─────────────────────┘
        5 tools                 8 tools                 4 tools                 4 tools
```

**技術亮點：**
- **Stdio Transport 標準輸入輸出傳輸**：進程間通訊無需網路開銷
- **Dynamic Tool Discovery 動態工具發現**：自動發現 21+ 個 AI Tools，無需硬編碼
- **Shared Memory 共享記憶體**：MCP Servers 之間透過 SQLite 共享使用者偏好與上下文

---

## 🧠 LangGraph Workflow 工作流設計

採用 **LangGraph** 實現狀態機驅動的工作流，支援複雜的多步驟推理與錯誤回復。

```
                        Metrics Explorer Workflow 指標探索工作流
    ┌────────────────────────────────────────────────────────────────────────┐
    │                                                                        │
    │    ┌──────┐      使用者輸入        ┌─────────────┐                     │
    │    │ IDLE │ ────────────────────► │ DISCOVERING │                     │
    │    │ 待命 │                        │ 探索指標中  │                     │
    │    └──────┘                        └──────┬──────┘                     │
    │        ▲                                  │                            │
    │        │                          發現指標成功                          │
    │        │                                  ▼                            │
    │        │                         ┌───────────────────┐                 │
    │     重試/完成                    │ GENERATING HINTS  │                 │
    │        │                         │  LLM 生成查詢建議 │                 │
    │        │                         └────────┬──────────┘                 │
    │        │                                  │                            │
    │        │                          AI 生成建議完成                       │
    │        │                                  ▼                            │
    │  ┌─────┴─────┐                   ┌───────────────────┐                 │
    │  │   ERROR   │◄────── 失敗 ──────│   TRANSLATING     │                 │
    │  │   錯誤    │                   │ 自然語言轉 PromQL │                 │
    │  └───────────┘                   └────────┬──────────┘                 │
    │        ▲                                  │                            │
    │        │                          轉換成功                              │
    │        │                                  ▼                            │
    │        │  Prometheus 錯誤        ┌───────────────────┐                 │
    │        └─────────────────────────│    QUERYING       │                 │
    │                                  │ 執行 Prometheus   │                 │
    │                                  └────────┬──────────┘                 │
    │                                           │                            │
    │                                   查詢成功                              │
    │                                           ▼                            │
    │                                  ┌───────────────────┐                 │
    │                                  │   RENDERING       │                 │
    │                                  │ 渲染 ASCII 圖表   │                 │
    │                                  └────────┬──────────┘                 │
    │                                           │                            │
    │                                   圖表渲染完成                          │
    │                                           ▼                            │
    │                                  ┌───────────────────┐                 │
    │    ◄──────────────────────────── │   DIAGNOSING      │                 │
    │          AI 診斷完成             │ LLM 健康度分析    │                 │
    │                                  └───────────────────┘                 │
    │                                                                        │
    └────────────────────────────────────────────────────────────────────────┘
```

**工作流狀態表 Workflow State Table:**
| State 狀態 | Description 描述 | LLM 參與 |
|------------|------------------|---------|
| `discovering` | 呼叫 Prometheus API 發現可用指標 | ❌ |
| `generating_hints` | LLM 根據可用指標生成智慧查詢建議 | ✅ |
| `translating` | 自然語言轉換為 PromQL 查詢語句 | ✅ |
| `querying` | 執行 Prometheus `query_range` API | ❌ |
| `diagnosing` | LLM 分析數據健康度並給出建議 | ✅ |

---

## 🔧 Key Technical Implementations 關鍵技術實現

### 1. Natural Language to PromQL 自然語言轉 PromQL

```typescript
// packages/mcp-metrics-analysis/src/clients/openai.ts
async nlToPromQL(input: NLToPromQLInput): Promise<{ promql: string; explanation: string }> {
    const systemPrompt = `你是 Prometheus PromQL 專家。
將自然語言轉換為精確的 PromQL 查詢。

可用指標 (Available Metrics):
${input.availableMetrics.slice(0, 30).join('\n')}

輸出 JSON: {"promql": "...", "explanation": "..."}`;

    const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: input.query }
        ],
        response_format: { type: 'json_object' }  // 結構化輸出
    });
}
```

### 2. MCP Tool Handler Pattern MCP 工具處理模式

```typescript
// packages/mcp-metrics-analysis/src/index.ts
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    switch (request.params.name) {
        case 'query_metrics_range':
            // 直接呼叫 Prometheus HTTP API
            const result = await prometheus.queryRange(args.query, args.start, args.end);
            return { content: [{ type: 'text', text: JSON.stringify(result) }] };
            
        case 'analyze_metric_trend':
            // 混合模式：統計計算 + LLM 解讀
            const stats = calculateTrendStats(data);
            const analysis = await openai.analyzeTrend(stats);
            return { content: [{ type: 'text', text: JSON.stringify(analysis) }] };
    }
});
```

### 3. Terminal UI 終端機介面 (Ink React)

```tsx
// packages/cli/src/ui/MetricsExplorerView.tsx
const MetricsExplorerView: React.FC = () => {
    const [hintsMode, setHintsMode] = useState(false);
    
    useInput((input, key) => {
        if (key.tab) setHintsMode(!hintsMode);  // Tab 切換焦點
    });
    
    return (
        <Box flexDirection="column">
            <TextInput focus={!hintsMode} onSubmit={handleQuery} />
            <HintsCarousel isFocused={hintsMode} hints={hints} onSelect={executePromQL} />
            <ASCIIChart data={metricsData} />
            <DiagnosisPanel diagnosis={diagnosis} />
        </Box>
    );
};
```

---

## 📊 System Specifications 系統規格

```
┌────────────────────────────────────────────────────────────────┐
│                      系統規格 SPECIFICATIONS                   │
├────────────────────────┬───────────────────────────────────────┤
│ MCP Servers 微服務數量 │ 4 個獨立微服務                         │
│ AI Tools 工具數量      │ 21+ 個                                │
│ TypeScript 覆蓋率      │ 100%                                  │
│ LLM 呼叫點             │ 12 個 (NL2PromQL, Trend, Anomaly...)  │
│ 串流支援               │ ✅ SSE (Server-Sent Events)            │
│ 跨平台支援             │ macOS, Linux, Windows                 │
├────────────────────────┴───────────────────────────────────────┤
│                      技術堆疊 TECHNOLOGY STACK                 │
├────────────────────────┬───────────────────────────────────────┤
│ 程式語言               │ TypeScript (ES2022)                   │
│ AI/LLM                 │ OpenAI SDK (支援串流)                 │
│ Agent 框架             │ LangGraph                             │
│ 協議層                 │ Model Context Protocol (MCP)          │
│ CLI 介面               │ Ink (React for Terminal)              │
│ Web 前端               │ Vite + React 19 + Tailwind v4         │
│ API 閘道               │ Hono                                  │
└────────────────────────┴───────────────────────────────────────┘
```

---

## 🚀 Technical Innovations 技術創新點

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. MCP Microservices Architecture MCP 微服務架構                           │
│     ───────────────────────────────────────────────────────────────────     │
│     將 21 個 AI Tools 拆分為 4 個獨立 MCP Server                            │
│     可獨立部署、獨立擴展、獨立更新                                          │
│                                                                             │
│  2. Hybrid AI Pattern 混合 AI 模式                                          │
│     ───────────────────────────────────────────────────────────────────     │
│     結合統計演算法 (z-score 異常偵測) + LLM 複判                            │
│     有效減少 AI 幻覺，提高診斷準確度                                        │
│                                                                             │
│  3. Context Persistence 上下文持久化                                        │
│     ───────────────────────────────────────────────────────────────────     │
│     透過 Shared Memory (SQLite) 讓 Agent 記住使用者偏好                     │
│     跨工作流、跨會話的上下文共享                                            │
│                                                                             │
│  4. Unified Backend 統一後端                                                │
│     ───────────────────────────────────────────────────────────────────     │
│     CLI (stdio) / Web (HTTP Gateway) / IDE (原生 MCP)                       │
│     三種存取路徑共用同一套 MCP Server                                       │
│                                                                             │
│  5. LangGraph State Machine 狀態機工作流                                    │
│     ───────────────────────────────────────────────────────────────────     │
│     可視化工作流狀態，支援中斷恢復                                          │
│     比傳統 Chain 更靈活的控制流                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔒 Production Deployment 生產部署考量

```
                    ┌─────────────────────────────────────────┐
                    │       生產部署考量 PRODUCTION           │
                    └─────────────────────────────────────────┘
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         │                             │                             │
         ▼                             ▼                             ▼
┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
│     安全性          │   │   可觀測性          │   │    韌性設計         │
│     SECURITY        │   │   OBSERVABILITY     │   │    RESILIENCE       │
│ ─────────────────── │   │ ─────────────────── │   │ ─────────────────── │
│ • API Key 環境變數  │   │ • LLM Debug Logger  │   │ • Mock Mode 降級    │
│   注入              │   │   LLM 除錯日誌      │   │   模擬模式降級      │
│ • Prometheus Basic  │   │ • MCP Call Tracing  │   │ • Retry w/ Backoff  │
│   Auth 認證         │   │   MCP 呼叫追蹤      │   │   指數退避重試      │
│ • ES API Key 認證   │   │ • Error Budget      │   │ • Graceful Shutdown │
│                     │   │   Dashboard 儀表板  │   │   優雅關機          │
└─────────────────────┘   └─────────────────────┘   └─────────────────────┘
```

---

> **Author**: SRE AI Agent Team  
> **License**: MIT  
> **Last Updated**: 2026-01-16
