/**
 * Log Explorer State
 */
export interface LogExplorerState {
    // 搜尋參數
    query: string;
    timeRange: {
        start: number;
        end: number;
        duration: string; // 例如: '1h', '24h'
    };
    filters: {
        level?: string[];
        service?: string;
        namespace?: string;
    };

    // 結果
    results: LogEntry[];
    total: number;
    took: number; // Query time in ms

    // AI 分析
    aiAnalysis?: {
        patterns?: ErrorPattern[];
        summary?: LogSummary;
    };

    // UI 狀態
    currentStep: string;
    mode: 'idle' | 'searching' | 'analyzing' | 'summarizing' | 'error';
    error?: string;
    isAnalyzing: boolean; // AI 分析中（避免閃爍）
}

/**
 * Log Entry
 */
export interface LogEntry {
    timestamp: string;
    level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'TRACE';
    message: string;
    service?: string;
    namespace?: string;
    pod?: string;
    container?: string;
    traceId?: string;
    stack?: string;
}

/**
 * Error Pattern (from AI analysis)
 */
export interface ErrorPattern {
    pattern: string;
    severity: 'critical' | 'warning' | 'info';
    description: string;
    potentialCause: string;
    recommendations: string[];
}

/**
 * Log Summary (from AI)
 */
export interface LogSummary {
    summary: string;
    keyFindings: string[];
    errorCount: number;
    topErrors: Array<{ message: string; count: number }>;
}

/**
 * Time Range Presets
 */
export const TIME_RANGES = [
    { label: 'Past 15 minutes', value: '15m' },
    { label: 'Past 1 hour', value: '1h' },
    { label: 'Past 6 hours', value: '6h' },
    { label: 'Past 24 hours', value: '24h' },
    { label: 'Past 7 days', value: '7d' },
] as const;

/**
 * Log Levels
 */
export const LOG_LEVELS = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'] as const;
