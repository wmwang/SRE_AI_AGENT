# SRE AI Agent - Developer Guide 開發者指南

> **For Engineers who want to understand, contribute, or extend this project**  
> 給想要理解、貢獻或擴展此專案的工程師

---

## 📁 Monorepo Structure 專案結構

This project uses **pnpm workspaces** for monorepo management.

```
SRE_AI_AGENT/
├── package.json              # Root package (pnpm workspace config)
├── pnpm-workspace.yaml       # Workspace definition
├── tsconfig.json             # Shared TypeScript config
├── .env.example              # Environment variables template
├── start-cli.sh              # Linux/macOS startup script
├── start-cli.bat             # Windows startup script
│
├── packages/
│   │
│   │  ══════════════════════════════════════════════════════════════
│   │  MCP SERVERS (4 個獨立微服務，可單獨部署)
│   │  ══════════════════════════════════════════════════════════════
│   │
│   ├── mcp-slo-management/       # SLO 管理服務 (5 tools)
│   │   ├── src/
│   │   │   ├── index.ts          # MCP Server entry point
│   │   │   ├── tools/            # Tool handlers
│   │   │   └── clients/          # External API clients
│   │   └── package.json
│   │
│   ├── mcp-metrics-analysis/     # 指標分析服務 (8 tools)
│   │   ├── src/
│   │   │   ├── index.ts          # MCP Server entry point
│   │   │   ├── tools/handlers.ts # Tool implementations
│   │   │   └── clients/
│   │   │       ├── prometheus.ts # Prometheus API client
│   │   │       └── openai.ts     # LLM client for analysis
│   │   └── package.json
│   │
│   ├── mcp-log-analysis/         # 日誌分析服務 (4 tools)
│   │   └── ... (same structure)
│   │
│   ├── mcp-k8s-deployment/       # K8s 部署服務 (4 tools)
│   │   └── ... (same structure)
│   │
│   │  ══════════════════════════════════════════════════════════════
│   │  FRONTEND & ORCHESTRATION 前端與編排層
│   │  ══════════════════════════════════════════════════════════════
│   │
│   ├── cli/                      # CLI Agent (主要進入點)
│   │   ├── src/
│   │   │   ├── index.ts          # Entry point
│   │   │   ├── mcp/manager.ts    # MCP Client Manager
│   │   │   ├── workflows/        # LangGraph workflows
│   │   │   │   ├── ai-query/     # AI Query workflow
│   │   │   │   ├── slo/          # SLO workflow
│   │   │   │   └── metrics-explorer/
│   │   │   │       ├── index.ts  # Workflow orchestration
│   │   │   │       ├── state.ts  # State schema
│   │   │   │       └── nodes.ts  # Node functions
│   │   │   └── ui/               # Ink React components
│   │   └── package.json
│   │
│   ├── api/                      # API Gateway (for Web)
│   │   └── src/
│   │       └── index.ts          # Hono HTTP server
│   │
│   ├── web/                      # Web Frontend
│   │   └── src/
│   │       └── ... (Vite + React)
│   │
│   │  ══════════════════════════════════════════════════════════════
│   │  SHARED INFRASTRUCTURE 共用基礎設施
│   │  ══════════════════════════════════════════════════════════════
│   │
│   ├── shared-memory/            # Context persistence (SQLite)
│   │   └── src/
│   │       └── index.ts          # SharedMemory class
│   │
│   └── mcp-registry/             # Service discovery (optional)
│       └── src/
│           └── index.ts
│
└── docs/
    ├── ARCHITECTURE.md           # System architecture
    ├── TECHNICAL_SHOWCASE.md     # Technical showcase
    └── DEVELOPER_GUIDE.md        # This file
```

---

## 🔧 Development Setup 開發環境設置

### Prerequisites 前置需求

```bash
# Required versions
node >= 18.0.0
pnpm >= 8.0.0
```

### Initial Setup 初始設置

```bash
# 1. Clone the repository
git clone <repo-url>
cd SRE_AI_AGENT

# 2. Install dependencies (all packages)
pnpm install

# 3. Copy environment template
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# 4. Build all packages
pnpm build

# 5. Run the CLI
./start-cli.sh        # Linux/macOS
start-cli.bat         # Windows
```

### Development Commands 開發指令

```bash
# Build all packages 建置所有套件
pnpm build

# Build specific package 建置特定套件
pnpm --filter @sre-agent/mcp-metrics-analysis build

# Watch mode for development 開發監聽模式
pnpm --filter @sre-agent/cli dev

# Run tests 執行測試
pnpm test

# Type checking 類型檢查
pnpm typecheck
```

---

## 🆕 How to Add a New MCP Server 如何新增 MCP Server

### Step 1: Create Package Structure 建立套件結構

```bash
mkdir -p packages/mcp-your-feature/src
cd packages/mcp-your-feature
```

### Step 2: Create package.json

```json
{
    "name": "@sre-agent/mcp-your-feature",
    "version": "1.0.0",
    "type": "module",
    "main": "dist/index.js",
    "scripts": {
        "build": "tsc",
        "dev": "tsc --watch"
    },
    "dependencies": {
        "@modelcontextprotocol/sdk": "^1.0.4",
        "zod": "^3.24.1"
    }
}
```

### Step 3: Implement MCP Server 實作 MCP Server

```typescript
// packages/mcp-your-feature/src/index.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// 建立 Server
const server = new Server(
    { name: 'your-feature-server', version: '1.0.0' },
    { capabilities: { tools: {} } }
);

// 註冊 Tools 列表
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
        {
            name: 'your_tool_name',
            description: 'Description of what this tool does',
            inputSchema: {
                type: 'object',
                properties: {
                    param1: { type: 'string', description: 'Parameter description' },
                },
                required: ['param1'],
            },
        },
        // Add more tools here...
    ],
}));

// 處理 Tool 呼叫
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    switch (name) {
        case 'your_tool_name':
            // Implement your tool logic here
            const result = await doSomething(args.param1);
            return {
                content: [{ type: 'text', text: JSON.stringify(result) }],
            };
            
        default:
            throw new Error(`Unknown tool: ${name}`);
    }
});

// 啟動 Server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('[Your Feature] MCP Server Started');
}

main().catch(console.error);
```

### Step 4: Register in CLI 在 CLI 註冊

```typescript
// packages/cli/src/config.ts
export const defaultConfig: CLIConfig = {
    mcpServers: {
        // ... existing servers
        yourFeature: {
            command: 'node',
            args: [
                process.env.YOUR_FEATURE_SERVER_PATH ||
                './packages/mcp-your-feature/dist/index.js',
            ],
            enabled: true,
        },
    },
};
```

### Step 5: Update Startup Scripts 更新啟動腳本

```bash
# start-cli.sh
export YOUR_FEATURE_SERVER_PATH="$(pwd)/packages/mcp-your-feature/dist/index.js"

# start-cli.bat
set "YOUR_FEATURE_SERVER_PATH=%CD%\packages\mcp-your-feature\dist\index.js"
```

---

## 🔄 Data Flow 資料流

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER INPUT → AI RESPONSE                          │
└─────────────────────────────────────────────────────────────────────────────┘

User: "Show me API error rate"
         │
         ▼
┌─────────────────┐
│ CLI Terminal UI │  (Ink React component)
│ TextInput       │
└────────┬────────┘
         │ onSubmit(query)
         ▼
┌─────────────────┐
│ LangGraph       │  (Workflow orchestration)
│ Workflow        │
│ ─────────────── │
│ 1. translateNode│◄─────┐
│ 2. queryNode    │      │ State updates
│ 3. diagnosisNode│──────┘
└────────┬────────┘
         │ callTool('metrics', 'nl_to_promql', {...})
         ▼
┌─────────────────┐
│ MCP Client      │  (packages/cli/src/mcp/manager.ts)
│ Manager         │
└────────┬────────┘
         │ stdio (JSON-RPC)
         ▼
┌─────────────────┐
│ MCP Server      │  (packages/mcp-metrics-analysis/)
│ metrics-analysis│
│ ─────────────── │
│ Tool: nl_to_    │
│ promql          │
└────────┬────────┘
         │ OpenAI API call
         ▼
┌─────────────────┐
│ OpenAI LLM      │
│ (GPT-4o-mini)   │
└────────┬────────┘
         │ {"promql": "rate(http_requests_total{code=~\"5..\"}[5m])"}
         ▼
    (Response flows back through the same path)
```

---

## 📦 Package Dependencies 套件相依關係

```
                    ┌──────────────────┐
                    │   cli (Agent)    │
                    │ ──────────────── │
                    │ • @langchain/*   │
                    │ • ink            │
                    │ • MCP SDK        │
                    └────────┬─────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ mcp-metrics-    │ │ mcp-slo-        │ │ mcp-log-        │
│ analysis        │ │ management      │ │ analysis        │
│ ─────────────── │ │ ─────────────── │ │ ─────────────── │
│ • MCP SDK       │ │ • MCP SDK       │ │ • MCP SDK       │
│ • OpenAI SDK    │ │ • OpenAI SDK    │ │ • OpenAI SDK    │
└────────┬────────┘ └─────────────────┘ └─────────────────┘
         │
         ▼
┌─────────────────┐
│ shared-memory   │  (Optional, for context persistence)
│ ─────────────── │
│ • better-sqlite3│
└─────────────────┘

All MCP Servers depend on:
• @modelcontextprotocol/sdk  - MCP 協議實作
• zod                        - Schema validation
• openai (optional)          - LLM 呼叫
```

---

## 🧪 Testing Strategy 測試策略

### Unit Tests 單元測試

```bash
# Run all tests
pnpm test

# Run specific package tests
pnpm --filter @sre-agent/mcp-metrics-analysis test
```

### Integration Tests 整合測試

```bash
# Test MCP Server with mock Prometheus
MOCK_PROMETHEUS=true pnpm --filter @sre-agent/mcp-metrics-analysis test:integration
```

### Manual Testing 手動測試

```bash
# 1. Start CLI in debug mode
DEBUG_LLM=true ./start-cli.sh

# 2. Check logs
tail -f logs/llm-debug.log      # LLM 呼叫紀錄
tail -f logs/mcp-metrics.log    # MCP Server 日誌
```

---

## 🔐 Environment Variables 環境變數

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | ✅ | OpenAI API key for LLM calls |
| `OPENAI_MODEL` | ❌ | Model name (default: `gpt-4o-mini`) |
| `PROMETHEUS_ENDPOINT` | ❌ | Prometheus URL (enables mock if missing) |
| `ELASTICSEARCH_ENDPOINT` | ❌ | ES URL (enables mock if missing) |
| `DEBUG_LLM` | ❌ | Set to `true` for LLM call logging |
| `MOCK_PROMETHEUS` | ❌ | Force mock mode for Prometheus |
| `SLO_SERVER_PATH` | ❌ | Override path to SLO MCP server |
| `METRICS_SERVER_PATH` | ❌ | Override path to Metrics MCP server |

---

## 🤝 Contribution Workflow 貢獻流程

```
1. Fork & Clone
   └── git clone <your-fork>

2. Create Feature Branch
   └── git checkout -b feature/your-feature

3. Develop & Test
   ├── pnpm install
   ├── pnpm build
   ├── pnpm test
   └── ./start-cli.sh (manual testing)

4. Commit with Conventional Commits
   └── git commit -m "feat(mcp-metrics): add new anomaly detection tool"

5. Push & Create PR
   └── git push origin feature/your-feature

6. Code Review
   └── Address feedback, ensure CI passes
```

### Commit Message Convention 提交訊息規範

```
feat(scope): add new feature
fix(scope): fix a bug
docs(scope): update documentation
refactor(scope): code refactoring
test(scope): add or update tests
chore(scope): build/tooling changes

Scopes: cli, mcp-metrics, mcp-slo, mcp-log, mcp-k8s, api, web, shared-memory
```

---

> **Questions? 有問題？**  
> Open an issue or contact the maintainers.
