import { z } from 'zod';

/**
 * query_metrics 工具的輸入 schema
 */
export const QueryMetricsSchema = z.object({
    promql: z.string().describe('Prometheus 查詢語句'),
    time: z.number().optional().describe('查詢時間點（Unix timestamp）'),
});

export type QueryMetricsInput = z.infer<typeof QueryMetricsSchema>;

/**
 * query_metrics_range 工具的輸入 schema
 */
export const QueryMetricsRangeSchema = z.object({
    promql: z.string().describe('Prometheus 查詢語句'),
    start: z.number().describe('開始時間（Unix timestamp）'),
    end: z.number().describe('結束時間（Unix timestamp）'),
    step: z.string().default('15s').describe('步長，例如: 15s, 1m, 5m'),
});

export type QueryMetricsRangeInput = z.infer<typeof QueryMetricsRangeSchema>;

/**
 * discover_metrics 工具的輸入 schema
 */
export const DiscoverMetricsSchema = z.object({
    pattern: z.string().optional().describe('過濾指標名稱的正則表達式'),
    limit: z.number().default(100).describe('返回結果數量限制'),
});

export type DiscoverMetricsInput = z.infer<typeof DiscoverMetricsSchema>;

/**
 * analyze_metric_trend 工具的輸入 schema
 */
export const AnalyzeMetricTrendSchema = z.object({
    promql: z.string().describe('Prometheus 查詢語句'),
    duration: z.string().default('1h').describe('分析時段，例如: 1h, 6h, 1d'),
});

export type AnalyzeMetricTrendInput = z.infer<typeof AnalyzeMetricTrendSchema>;

/**
 * detect_anomalies 工具的輸入 schema
 */
export const DetectAnomaliesSchema = z.object({
    promql: z.string().describe('Prometheus 查詢語句'),
    duration: z.string().default('1h').describe('檢測時段'),
    threshold: z.number().optional().describe('異常閾值（標準差倍數）'),
});

export type DetectAnomaliesInput = z.infer<typeof DetectAnomaliesSchema>;

/**
 * get_top_metrics 工具的輸入 schema
 */
export const GetTopMetricsSchema = z.object({
    metricType: z.enum(['cpu', 'memory', 'requests', 'errors', 'latency']).describe('指標類型'),
    limit: z.number().default(10).describe('返回前 N 個結果'),
});

export type GetTopMetricsInput = z.infer<typeof GetTopMetricsSchema>;

/**
 * discover_labels 工具的輸入 schema
 */
export const DiscoverLabelsSchema = z.object({
    metricName: z.string().optional().describe('特定指標的 labels（optional）'),
    labelKey: z.string().optional().describe('特定 label 的可用值（optional）'),
});

export type DiscoverLabelsInput = z.infer<typeof DiscoverLabelsSchema>;

/**
 * translate_nl_to_promql 工具的輸入 schema
 */
export const TranslateNLToPromQLSchema = z.object({
    naturalQuery: z.string().describe('自然語言查詢'),
    availableMetrics: z.array(z.string()).optional().describe('可用指標列表'),
    userContext: z.object({
        defaultNamespace: z.string().optional(),
        defaultService: z.string().optional(),
        labelPreferences: z.record(z.string()).optional(),
    }).optional().describe('使用者上下文'),
});

export type TranslateNLToPromQLInput = z.infer<typeof TranslateNLToPromQLSchema>;

/**
 * suggest_query_hints 工具的輸入 schema
 */
export const SuggestQueryHintsSchema = z.object({
    availableMetrics: z.array(z.string()).optional().describe('可用指標列表'),
    userContext: z.object({
        defaultNamespace: z.string().optional(),
        defaultService: z.string().optional(),
    }).optional().describe('使用者上下文'),
});

export type SuggestQueryHintsInput = z.infer<typeof SuggestQueryHintsSchema>;

/**
 * analyze_metrics_health 工具的輸入 schema
 */
export const AnalyzeMetricsHealthSchema = z.object({
    promql: z.string().describe('要分析的 PromQL'),
    timeRange: z.object({
        start: z.number().describe('開始時間 (Unix timestamp)'),
        end: z.number().describe('結束時間 (Unix timestamp)'),
    }),
});

export type AnalyzeMetricsHealthInput = z.infer<typeof AnalyzeMetricsHealthSchema>;
