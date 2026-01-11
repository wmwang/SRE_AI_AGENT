# Shared Memory Service

各 MCP Server 的統一資料共享層，提供服務拓撲、SLO 定義、指標元數據、事件記錄和 AI 上下文的儲存與查詢。

## 功能特色

- ✅ **服務拓撲管理**：儲存和查詢服務資訊、依賴關係
- ✅ **SLO 管理**：SLO 定義、狀態追蹤、錯誤預算計算
- ✅ **指標元數據**：Prometheus 指標的元數據管理
- ✅ **事件記錄**：事故追蹤、時間線記錄
- ✅ **AI 上下文**：共享 AI 分析結果和建議
- ✅ **事件通知**：即時通知資料變更
- ✅ **全文搜尋**：快速搜尋服務、SLO、事件
- ✅ **事務支援**：確保資料一致性

## 安裝

```bash
pnpm install @sre-agent/shared-memory
```

## 使用方式

### 基本使用

```typescript
import { SharedMemory } from '@sre-agent/shared-memory';

// 建立 Shared Memory 實例
const memory = new SharedMemory('~/.sre-agent/shared-memory.db');

// 監聽事件
memory.on('service-added', (event) => {
  console.log('新增服務:', event.data);
});

memory.on('slo-status-changed', (event) => {
  console.log('SLO 狀態變更:', event.data);
});
```

### 服務管理

```typescript
// 新增服務
memory.upsertService({
  id: 'api-service',
  name: 'API Service',
  type: 'api',
  dependencies: ['database-service', 'cache-service'],
  k8sConfig: {
    namespace: 'production',
    deploymentName: 'api-deployment',
    replicas: 3,
  },
  labels: {
    env: 'production',
    team: 'backend',
  },
  lastUpdated: new Date().toISOString(),
});

// 取得服務
const service = memory.getService('api-service');

// 列出所有服務
const services = memory.listServices();

// 列出特定類型的服務
const apiServices = memory.listServices({ serviceType: 'api' });
```

### SLO 管理

```typescript
// 新增 SLO
memory.upsertSLO({
  id: 'slo-001',
  serviceId: 'api-service',
  name: 'API Availability',
  description: 'API service availability',
  description_zh: 'API 服務可用性',
  target: 99.9,
  threshold: null,
  window: '30d',
  goldenSignal: 'Errors',
  status: 'met',
  errorBudget: 0.1,
  lastEvaluated: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

// 更新 SLO 狀態
memory.updateSLOStatus('slo-001', 'at-risk', 0.05);

// 取得服務的所有 SLOs
const slos = memory.listSLOs({ serviceId: 'api-service' });

// 取得違反的 SLOs
const violatedSLOs = memory.listSLOs({ sloStatus: 'violated' });
```

### 指標管理

```typescript
// 新增指標元數據
memory.upsertMetric({
  name: 'http_requests_total',
  type: 'counter',
  labels: ['method', 'status', 'endpoint'],
  description: 'Total HTTP requests',
  relatedServices: ['api-service'],
  unit: 'requests',
  highCardinality: false,
  lastUpdated: new Date().toISOString(),
});

// 取得服務相關的指標
const metrics = memory.listMetrics('api-service');
```

### 事件管理

```typescript
// 建立事件
memory.createIncident({
  id: 'inc-001',
  title: 'API Service High Error Rate',
  severity: 'high',
  status: 'investigating',
  affectedServices: ['api-service'],
  timeline: [
    {
      timestamp: new Date().toISOString(),
      type: 'detected',
      description: 'Error rate exceeded 5%',
    },
  ],
  resolution: null,
  startedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

// 更新事件
memory.updateIncident('inc-001', {
  status: 'resolved',
  resolution: 'Increased connection pool size',
  resolvedAt: new Date().toISOString(),
  timeline: [
    /* ... */
  ],
});

// 列出進行中的事件
const activeIncidents = memory.listIncidents({
  incidentStatus: 'investigating',
});

// 列出高嚴重度事件
const criticalIncidents = memory.listIncidents({
  incidentSeverity: 'critical',
  limit: 10,
});
```

### AI 上下文

```typescript
// 更新 AI 上下文
memory.updateAIContext({
  currentFocus: 'Analyzing API service performance',
  recentAnalysis: [
    {
      id: 'analysis-001',
      type: 'performance',
      title: 'API Latency Analysis',
      summary: 'Detected increased latency in /api/users endpoint',
      details: { p95: 450, p99: 850 },
      timestamp: new Date().toISOString(),
    },
  ],
  recommendations: [
    {
      id: 'rec-001',
      category: 'performance',
      priority: 'high',
      title: 'Optimize database queries',
      description: 'Add index on user_id column',
      actionItems: ['Add index', 'Test performance', 'Deploy'],
      relatedServices: ['api-service', 'database-service'],
      timestamp: new Date().toISOString(),
    },
  ],
});

// 取得 AI 上下文
const context = memory.getAIContext();
```

## API 文件

### SharedMemory

核心 Shared Memory 類別。

#### 服務管理

- `upsertService(service: ServiceInfo): void` - 新增或更新服務
- `getService(serviceId: string): ServiceInfo | null` - 取得服務
- `listServices(filter?: QueryFilter): ServiceInfo[]` - 列出服務
- `deleteService(serviceId: string): void` - 刪除服務

#### SLO 管理

- `upsertSLO(slo: SLODefinition): void` - 新增或更新 SLO
- `getSLO(sloId: string): SLODefinition | null` - 取得 SLO
- `listSLOs(filter?: QueryFilter): SLODefinition[]` - 列出 SLOs
- `updateSLOStatus(sloId, status, errorBudget): void` - 更新 SLO 狀態

#### 指標管理

- `upsertMetric(metric: MetricMetadata): void` - 新增或更新指標
- `getMetric(metricName: string): MetricMetadata | null` - 取得指標
- `listMetrics(serviceId?: string): MetricMetadata[]` - 列出指標

#### 事件管理

- `createIncident(incident: IncidentRecord): void` - 建立事件
- `updateIncident(incidentId, updates): void` - 更新事件
- `getIncident(incidentId: string): IncidentRecord | null` - 取得事件
- `listIncidents(filter?: QueryFilter): IncidentRecord[]` - 列出事件

#### AI 上下文

- `getAIContext(): AIContext` - 取得 AI 上下文
- `updateAIContext(context: Partial<AIContext>): void` - 更新 AI 上下文

#### 事件

- `service-added` - 服務新增
- `service-updated` - 服務更新
- `service-removed` - 服務移除
- `slo-added` - SLO 新增
- `slo-status-changed` - SLO 狀態變更
- `metric-added` - 指標新增
- `incident-created` - 事件建立
- `incident-updated` - 事件更新

## 資料結構

詳細的型別定義請參考 [src/schema/types.ts](./src/schema/types.ts)。

## 授權

MIT
