/**
 * Metrics Explorer Workflow - State Schema
 * 
 * 定義 LangGraph workflow 的狀態結構
 */

/**
 * 使用者上下文（多租戶環境支援）
 */
export interface UserContext {
    namespace?: string;
    service?: string;
    labelPreferences: Record<string, string>;
    favoriteQueries: Array<{ name: string; promql: string }>;
    isOnboarded: boolean;
}

/**
 * 時間範圍
 */
export interface TimeRange {
    start: number;
    end: number;
    duration: string;
}

/**
 * 指標數據
 */
export interface MetricsSeries {
    timestamps: number[];
    values: number[];
    labels: Record<string, string>;
}

/**
 * 查詢建議
 */
export interface QueryHint {
    category: string;
    suggestions: Array<{
        text: string;
        promql: string;
        description: string;
    }>;
}

/**
 * 診斷結果
 */
export interface DiagnosisResult {
    summary: string;
    findings: Array<{
        severity: 'info' | 'warning' | 'critical';
        message: string;
        suggestion?: string;
    }>;
    trend: {
        direction: 'increasing' | 'decreasing' | 'stable';
        changeRate: string;
    };
    recommendations: string[];
}

/**
 * Workflow 模式
 */
export type WorkflowMode =
    | 'idle'           // 等待輸入
    | 'discovering'    // 探索指標
    | 'translating'    // 翻譯查詢
    | 'querying'       // 查詢數據
    | 'rendering'      // 渲染圖表
    | 'diagnosing'     // AI 診斷
    | 'error';         // 錯誤狀態

/**
 * 健康狀態
 */
export type HealthStatus = 'healthy' | 'warning' | 'critical' | 'unknown';

/**
 * Metrics Explorer Workflow State
 * 
 * 完整的 workflow 狀態定義
 */
export interface MetricsExplorerState {
    // ==================== 使用者輸入 ====================
    /** 使用者的自然語言查詢 */
    naturalQuery: string;

    // ==================== 使用者上下文 ====================
    /** 使用者的 context（namespace, service 等） */
    userContext: UserContext;

    // ==================== 指標資訊 ====================
    /** 可用的指標列表 */
    availableMetrics: string[];

    /** 可用的 labels（例如 { namespace: ['prod', 'staging'], pod: [...] }） */
    availableLabels: Record<string, string[]>;

    /** 查詢建議列表 */
    metricHints: QueryHint[];

    // ==================== 查詢翻譯 ====================
    /** 生成的 PromQL */
    promql: string;

    /** 查詢解釋 */
    queryExplanation: string;

    /** 翻譯信心度 (0-1) */
    translationConfidence: number;

    /** 是否需要使用者澄清 */
    needsClarification: boolean;

    /** 澄清問題（當 needsClarification 為 true） */
    clarificationQuestion?: string;

    // ==================== 數據 ====================
    /** 時間範圍 */
    timeRange: TimeRange;

    /** 指標數據 */
    metricsData: MetricsSeries[];

    // ==================== AI 診斷 ====================
    /** 健康狀態 */
    healthStatus: HealthStatus;

    /** 診斷結果 */
    diagnosis: DiagnosisResult | null;

    // ==================== UI 狀態 ====================
    /** 當前模式 */
    mode: WorkflowMode;

    /** 錯誤訊息 */
    error: string | null;

    /** 當前步驟描述 */
    currentStep: string;

    /** 是否正在載入 */
    isLoading: boolean;
}

/**
 * 建立初始狀態
 */
export function createInitialState(): MetricsExplorerState {
    return {
        // 使用者輸入
        naturalQuery: '',

        // 使用者上下文
        userContext: {
            labelPreferences: {},
            favoriteQueries: [],
            isOnboarded: false,
        },

        // 指標資訊
        availableMetrics: [],
        availableLabels: {},
        metricHints: [],

        // 查詢翻譯
        promql: '',
        queryExplanation: '',
        translationConfidence: 0,
        needsClarification: false,

        // 數據
        timeRange: {
            start: 0,
            end: 0,
            duration: '1h',
        },
        metricsData: [],

        // AI 診斷
        healthStatus: 'unknown',
        diagnosis: null,

        // UI 狀態
        mode: 'idle',
        error: null,
        currentStep: '等待使用者輸入...',
        isLoading: false,
    };
}

/**
 * State reducer 類型定義
 */
export type StateReducer = (
    state: MetricsExplorerState,
    update: Partial<MetricsExplorerState>
) => MetricsExplorerState;

/**
 * LangGraph Channel 定義（用於 state 更新）
 */
export const metricsExplorerChannels = {
    naturalQuery: { value: (_prev: string, next: string) => next },
    userContext: { value: (_prev: UserContext, next: UserContext) => ({ ..._prev, ...next }) },
    availableMetrics: { value: (_prev: string[], next: string[]) => next },
    availableLabels: { value: (_prev: Record<string, string[]>, next: Record<string, string[]>) => ({ ..._prev, ...next }) },
    metricHints: { value: (_prev: QueryHint[], next: QueryHint[]) => next },
    promql: { value: (_prev: string, next: string) => next },
    queryExplanation: { value: (_prev: string, next: string) => next },
    translationConfidence: { value: (_prev: number, next: number) => next },
    needsClarification: { value: (_prev: boolean, next: boolean) => next },
    clarificationQuestion: { value: (_prev: string | undefined, next: string | undefined) => next },
    timeRange: { value: (_prev: TimeRange, next: TimeRange) => ({ ..._prev, ...next }) },
    metricsData: { value: (_prev: MetricsSeries[], next: MetricsSeries[]) => next },
    healthStatus: { value: (_prev: HealthStatus, next: HealthStatus) => next },
    diagnosis: { value: (_prev: DiagnosisResult | null, next: DiagnosisResult | null) => next },
    mode: { value: (_prev: WorkflowMode, next: WorkflowMode) => next },
    error: { value: (_prev: string | null, next: string | null) => next },
    currentStep: { value: (_prev: string, next: string) => next },
    isLoading: { value: (_prev: boolean, next: boolean) => next },
};
