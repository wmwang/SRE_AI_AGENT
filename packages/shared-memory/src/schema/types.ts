/**
 * 服務資訊
 */
export interface ServiceInfo {
    /** 服務唯一 ID */
    id: string;

    /** 服務名稱 */
    name: string;

    /** 服務類型 */
    type: ServiceType;

    /** 依賴的服務 ID 列表 */
    dependencies: string[];

    /** K8s 配置 */
    k8sConfig?: K8sConfig;

    /** 標籤 */
    labels: Record<string, string>;

    /** 最後更新時間 */
    lastUpdated: string;

    /** 額外的元數據 */
    metadata?: Record<string, unknown>;
}

export type ServiceType =
    | 'web'
    | 'api'
    | 'database'
    | 'cache'
    | 'queue'
    | 'worker'
    | 'other';

export interface K8sConfig {
    namespace: string;
    deploymentName: string;
    replicas?: number;
    resources?: {
        requests?: { cpu?: string; memory?: string };
        limits?: { cpu?: string; memory?: string };
    };
}

/**
 * SLO 定義
 */
export interface SLODefinition {
    /** SLO 唯一 ID */
    id: string;

    /** 關聯的服務 ID */
    serviceId: string;

    /** SLO 名稱 */
    name: string;

    /** 描述 */
    description: string;

    /** 描述（繁體中文） */
    description_zh: string;

    /** 目標百分比 (0-100) */
    target: number;

    /** 閾值（可選，例如 "200ms"） */
    threshold: string | null;

    /** 時間窗口（例如 "30d"） */
    window: string;

    /** Golden Signal 分類 */
    goldenSignal: GoldenSignal;

    /** 當前狀態 */
    status: SLOStatus;

    /** 錯誤預算（百分比） */
    errorBudget: number;

    /** 最後評估時間 */
    lastEvaluated: string;

    /** 建立時間 */
    createdAt: string;

    /** 更新時間 */
    updatedAt: string;
}

export type GoldenSignal = 'Latency' | 'Traffic' | 'Errors' | 'Saturation';

export type SLOStatus = 'met' | 'at-risk' | 'violated' | 'unknown';

/**
 * 指標元數據
 */
export interface MetricMetadata {
    /** 指標名稱 */
    name: string;

    /** 指標類型 */
    type: MetricType;

    /** 標籤列表 */
    labels: string[];

    /** 描述 */
    description: string;

    /** 關聯的服務 ID 列表 */
    relatedServices: string[];

    /** 單位（可選） */
    unit?: string;

    /** 是否為高基數指標 */
    highCardinality?: boolean;

    /** 最後更新時間 */
    lastUpdated: string;
}

export type MetricType =
    | 'counter'
    | 'gauge'
    | 'histogram'
    | 'summary';

/**
 * 事件記錄
 */
export interface IncidentRecord {
    /** 事件唯一 ID */
    id: string;

    /** 事件標題 */
    title: string;

    /** 嚴重程度 */
    severity: IncidentSeverity;

    /** 當前狀態 */
    status: IncidentStatus;

    /** 受影響的服務 ID 列表 */
    affectedServices: string[];

    /** 事件時間線 */
    timeline: TimelineEvent[];

    /** 解決方案（如已解決） */
    resolution: string | null;

    /** 根因分析 */
    rootCause?: string;

    /** 開始時間 */
    startedAt: string;

    /** 解決時間 */
    resolvedAt?: string;

    /** 建立時間 */
    createdAt: string;

    /** 更新時間 */
    updatedAt: string;
}

export type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low';

export type IncidentStatus =
    | 'investigating'
    | 'identified'
    | 'monitoring'
    | 'resolved'
    | 'closed';

export interface TimelineEvent {
    timestamp: string;
    type: 'detected' | 'investigating' | 'update' | 'resolved';
    description: string;
    author?: string;
}

/**
 * AI 上下文
 */
export interface AIContext {
    /** 當前關注的焦點 */
    currentFocus: string;

    /** 最近的分析結果 */
    recentAnalysis: Analysis[];

    /** AI 建議 */
    recommendations: Recommendation[];

    /** 最後更新時間 */
    lastUpdated: string;
}

export interface Analysis {
    id: string;
    type: string;
    title: string;
    summary: string;
    details: Record<string, unknown>;
    timestamp: string;
}

export interface Recommendation {
    id: string;
    category: string;
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    actionItems: string[];
    relatedServices: string[];
    timestamp: string;
}

/**
 * 查詢過濾條件
 */
export interface QueryFilter {
    /** 服務 ID 過濾 */
    serviceId?: string;

    /** 服務類型過濾 */
    serviceType?: ServiceType;

    /** SLO 狀態過濾 */
    sloStatus?: SLOStatus;

    /** 事件嚴重程度過濾 */
    incidentSeverity?: IncidentSeverity;

    /** 事件狀態過濾 */
    incidentStatus?: IncidentStatus;

    /** 時間範圍（開始） */
    startTime?: string;

    /** 時間範圍（結束） */
    endTime?: string;

    /** 限制返回數量 */
    limit?: number;

    /** 偏移量（用於分頁） */
    offset?: number;
}

/**
 * Shared Memory 事件類型
 */
export type SharedMemoryEvent =
    | 'service-added'
    | 'service-updated'
    | 'service-removed'
    | 'slo-added'
    | 'slo-updated'
    | 'slo-status-changed'
    | 'incident-created'
    | 'incident-updated'
    | 'incident-resolved'
    | 'metric-added'
    | 'metric-updated';

export interface SharedMemoryEventData {
    event: SharedMemoryEvent;
    resourceId: string;
    resourceType: 'service' | 'slo' | 'metric' | 'incident';
    timestamp: string;
    data?: unknown;
}
