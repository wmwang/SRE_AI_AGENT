# MCP Registry

MCP 服務註冊與發現中心，負責管理所有 MCP Server 的註冊、查詢和事件通知。

## 功能特色

- ✅ **服務註冊**：MCP Server 自動註冊與取消註冊
- ✅ **服務發現**：動態查詢可用的 MCP Servers
- ✅ **全文搜尋**：快速搜尋工具和功能
- ✅ **事件通知**：即時通知 Server 的新增/移除/更新
- ✅ **分類管理**：依分類和標籤組織 Servers
- ✅ **持久化儲存**：使用 SQLite 儲存 metadata

## 安裝

```bash
pnpm install @sre-agent/mcp-registry
```

## 使用方式

### Registry Server（由系統啟動）

```typescript
import { MCPRegistry } from '@sre-agent/mcp-registry';

const registry = new MCPRegistry('~/.sre-agent/registry.db');

// 監聽事件
registry.on('server-added', (data) => {
  console.log(`新增 Server: ${data.metadata?.name}`);
});

// 查詢所有 Servers
const servers = registry.listServers();

// 搜尋工具
const results = registry.searchTools('SLO');
```

### Registry Client（CLI/Web 使用）

```typescript
import { MCPRegistryClient } from '@sre-agent/mcp-registry/client';

const client = new MCPRegistryClient();

// 列出所有 Servers
const servers = await client.listServers();

// 依分類查詢
const monitoringServers = await client.getServersByCategory('monitoring');

// 搜尋工具
const tools = await client.searchTools('prometheus');

// 監聽新增事件
client.on('server-added', (data) => {
  console.log('新的 MCP Server 可用！', data.metadata?.name);
});
```

### MCP Server 註冊（由各 MCP Server 呼叫）

```typescript
import { registerMCPServer } from '@sre-agent/mcp-registry/client';

await registerMCPServer({
  id: 'slo-management',
  name: 'SLO Management Server',
  version: '1.0.0',
  description: 'Manage SLO lifecycle',
  category: 'monitoring',
  endpoint: 'stdio',
  status: 'active',
  capabilities: {
    tools: [
      {
        name: 'analyze_k8s_manifests',
        description: 'Analyze K8s manifests',
        description_zh: '分析 K8s manifests',
        category: 'analysis',
        inputSchema: { /* ... */ },
      },
    ],
    resources: [],
    prompts: [],
  },
  tags: ['slo', 'monitoring', 'k8s'],
});
```

## API 文件

### MCPRegistry

核心 Registry 類別，負責管理所有 Server 的註冊和查詢。

#### Methods

- `register(metadata: MCPServerMetadata): void` - 註冊 Server
- `unregister(serverId: string): void` - 取消註冊
- `listServers(filters?): MCPServerMetadata[]` - 列出 Servers
- `getServer(serverId: string): MCPServerMetadata | undefined` - 取得特定 Server
- `searchTools(keyword: string): SearchResult[]` - 搜尋工具
- `updateStatus(serverId, status): void` - 更新 Server 狀態

#### Events

- `server-added` - Server 新增時
- `server-removed` - Server 移除時
- `server-updated` - Server 更新時
- `server-status-changed` - Server 狀態變更時

### MCPRegistryClient

Client 類別，供 CLI 和 Web Interface 使用。

#### Methods

- `listServers(filters?): Promise<MCPServerMetadata[]>` - 列出 Servers
- `getServer(serverId): Promise<MCPServerMetadata | null>` - 取得 Server
- `searchTools(keyword): Promise<SearchResult[]>` - 搜尋工具
- `on(event, handler)` - 監聽事件
- `off(event, handler)` - 取消監聽

## 型別定義

詳細的型別定義請參考 [src/types.ts](./src/types.ts)。

## 授權

MIT
