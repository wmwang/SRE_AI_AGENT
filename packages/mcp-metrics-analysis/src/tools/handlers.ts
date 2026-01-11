import { SharedMemory } from '@sre-agent/shared-memory';
import { PrometheusClient } from '../clients/prometheus.js';
import type {
    QueryMetricsInput,
    QueryMetricsRangeInput,
    DiscoverMetricsInput,
    AnalyzeMetricTrendInput,
    DetectAnomaliesInput,
    GetTopMetricsInput,
} from './schemas.js';

/**
 * Metrics Tools Handler
 * 
 * 實作所有 Metrics 相關的工具邏輯
 */
export class MetricsToolsHandler {
    // 靜態 Map 用於儲存使用者上下文（跨實例共享）
    private static userContextStore = new Map<string, any>();

    constructor(
        private memory: SharedMemory,
        private prometheus: PrometheusClient
    ) { }

    /**
     * 查詢即時指標
     */
    async queryMetrics(input: QueryMetricsInput): Promise<object> {
        try {
            const result = await this.prometheus.query(input.promql, input.time);

            if (result.status === 'error') {
                return {
                    success: false,
                    error: result.error || 'Prometheus query failed',
                };
            }

            return {
                success: true,
                resultType: result.data?.resultType,
                resultCount: result.data?.result?.length || 0,
                results: result.data?.result || [],
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * 查詢指標範圍
     */
    async queryMetricsRange(input: QueryMetricsRangeInput): Promise<object> {
        try {
            const result = await this.prometheus.queryRange(
                input.promql,
                input.start,
                input.end,
                input.step
            );

            if (result.status === 'error') {
                return {
                    success: false,
                    error: result.error || 'Prometheus query failed',
                };
            }

            return {
                success: true,
                resultType: result.data?.resultType,
                resultCount: result.data?.result?.length || 0,
                results: result.data?.result || [],
                timeRange: {
                    start: new Date(input.start * 1000).toISOString(),
                    end: new Date(input.end * 1000).toISOString(),
                    step: input.step,
                },
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * 探索可用指標
     */
    async discoverMetrics(input: DiscoverMetricsInput): Promise<object> {
        try {
            let metrics = await this.prometheus.getMetricNames();

            // 如果有 pattern，過濾指標
            if (input.pattern) {
                const regex = new RegExp(input.pattern);
                metrics = metrics.filter(m => regex.test(m));
            }

            // 限制結果數量
            const limited = metrics.slice(0, input.limit);

            // 儲存到 Shared Memory
            for (const metricName of limited) {
                const existing = this.memory.getMetric(metricName);
                if (!existing) {
                    this.memory.upsertMetric({
                        name: metricName,
                        type: 'gauge', // 預設類型
                        labels: [],
                        description: `Discovered metric: ${metricName}`,
                        relatedServices: [],
                        lastUpdated: new Date().toISOString(),
                    });
                }
            }

            return {
                success: true,
                totalCount: metrics.length,
                returnedCount: limited.length,
                metrics: limited,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * 分析指標趨勢
     */
    async analyzeMetricTrend(input: AnalyzeMetricTrendInput): Promise<object> {
        try {
            // 計算時間範圍
            const end = Math.floor(Date.now() / 1000);
            const durationSeconds = this.parseDuration(input.duration);
            const start = end - durationSeconds;

            // 查詢指標
            const result = await this.prometheus.queryRange(
                input.promql,
                start,
                end,
                '1m'
            );

            if (result.status === 'error') {
                return {
                    success: false,
                    error: result.error || 'Prometheus query failed',
                };
            }

            // 簡單的趨勢分析
            const analysis = this.analyzeTrendData(result.data?.result || []);

            return {
                success: true,
                duration: input.duration,
                timeRange: {
                    start: new Date(start * 1000).toISOString(),
                    end: new Date(end * 1000).toISOString(),
                },
                analysis,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * 檢測異常
     */
    async detectAnomalies(input: DetectAnomaliesInput): Promise<object> {
        try {
            const end = Math.floor(Date.now() / 1000);
            const durationSeconds = this.parseDuration(input.duration);
            const start = end - durationSeconds;

            const result = await this.prometheus.queryRange(
                input.promql,
                start,
                end,
                '1m'
            );

            if (result.status === 'error') {
                return {
                    success: false,
                    error: result.error || 'Prometheus query failed',
                };
            }

            // 異常檢測
            const anomalies = this.detectAnomaliesInData(
                result.data?.result || [],
                input.threshold || 3
            );

            return {
                success: true,
                duration: input.duration,
                threshold: input.threshold || 3,
                anomaliesDetected: anomalies.length,
                anomalies,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * 取得 Top N 指標
     */
    async getTopMetrics(input: GetTopMetricsInput): Promise<object> {
        try {
            const promql = this.buildTopMetricsQuery(input.metricType);
            const result = await this.prometheus.query(promql);

            if (result.status === 'error') {
                return {
                    success: false,
                    error: result.error || 'Prometheus query failed',
                };
            }

            // 排序並取前 N 個
            const sorted = (result.data?.result || [])
                .map(r => ({
                    metric: r.metric,
                    value: parseFloat(r.value?.[1] || '0'),
                }))
                .sort((a, b) => b.value - a.value)
                .slice(0, input.limit);

            return {
                success: true,
                metricType: input.metricType,
                limit: input.limit,
                results: sorted,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * 探索可用的 labels
     */
    async discoverLabels(input: { metricName?: string; labelKey?: string }): Promise<object> {
        try {
            // 如果指定了 labelKey，返回該 label 的所有值
            if (input.labelKey) {
                const values = await this.prometheus.getLabelValuesEnhanced(input.labelKey);
                return {
                    success: true,
                    labelKey: input.labelKey,
                    values,
                    count: values.length,
                };
            }

            // 否則返回所有可用的 labels 及其值
            const labelNames = await this.prometheus.getLabels();
            const labelsWithValues: Record<string, string[]> = {};

            // 取得常用 labels 的值（限制數量避免太慢）
            const commonLabels = ['namespace', 'service', 'pod', 'container', 'job'];
            for (const labelName of commonLabels) {
                if (labelNames.includes(labelName)) {
                    labelsWithValues[labelName] = await this.prometheus.getLabelValuesEnhanced(labelName);
                }
            }

            // 識別常用的 label 組合
            const commonCombinations = this.identifyCommonLabelPatterns(labelsWithValues);

            return {
                success: true,
                labelCount: labelNames.length,
                allLabels: labelNames,
                commonLabels: labelsWithValues,
                commonCombinations,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    // ==================== 輔助方法 ====================

    /**
     * 識別常用的 label patterns
     */
    private identifyCommonLabelPatterns(labels: Record<string, string[]>): Array<{
        category: string;
        labels: string[];
        example: string;
    }> {
        const patterns = [];

        // Pattern 1: Namespace-based queries
        if (labels.namespace && labels.namespace.length > 0) {
            patterns.push({
                category: '按 Namespace 查詢',
                labels: ['namespace', 'pod', 'container'],
                example: 'container_cpu_usage_seconds_total{namespace="production-payment"}',
            });
        }

        // Pattern 2: Service-based queries
        if (labels.service && labels.service.length > 0) {
            patterns.push({
                category: '按 Service 查詢',
                labels: ['namespace', 'service'],
                example: 'http_requests_total{namespace="production-payment",service="payment-api"}',
            });
        }

        // Pattern 3: Job-based queries
        if (labels.job && labels.job.length > 0) {
            patterns.push({
                category: '按 Job 類型查詢',
                labels: ['job'],
                example: 'up{job="kubernetes-pods"}',
            });
        }

        return patterns;
    }

    /**
     * 儲存使用者上下文
     */
    async saveUserContext(context: {
        userId?: string;
        defaultNamespace?: string;
        defaultService?: string;
        labelPreferences?: Record<string, string>;
        favoriteQueries?: Array<{ name: string; promql: string; description?: string }>;
    }): Promise<object> {
        try {
            const userId = context.userId || 'default';
            const contextData = {
                ...context,
                userId,
                lastUpdated: new Date().toISOString(),
            };

            // 儲存到靜態 Map（跨實例共享）
            const key = `user_context_${userId}`;
            const stored = MetricsToolsHandler.userContextStore.get(key);

            // 合併現有資料
            const merged = stored ? { ...stored, ...contextData } : contextData;
            MetricsToolsHandler.userContextStore.set(key, merged);

            return {
                success: true,
                message: 'User context saved successfully',
                context: merged,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * 取得使用者上下文
     */
    async getUserContext(input: { userId?: string }): Promise<object> {
        try {
            const userId = input.userId || 'default';
            const key = `user_context_${userId}`;
            const context = MetricsToolsHandler.userContextStore.get(key);

            if (!context) {
                // 返回預設的空上下文
                return {
                    success: true,
                    exists: false,
                    context: {
                        userId,
                        labelPreferences: {},
                        favoriteQueries: [],
                    },
                };
            }

            return {
                success: true,
                exists: true,
                context,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * 將自然語言轉換為 PromQL
     */
    async translateNLToPromQL(input: {
        naturalQuery: string;
        availableMetrics?: string[];
        userContext?: {
            defaultNamespace?: string;
            defaultService?: string;
            labelPreferences?: Record<string, string>;
        };
    }): Promise<object> {
        try {
            // 動態載入 OpenAI Client（避免沒有 API key 時啟動失敗）
            const { OpenAIClient } = await import('../clients/openai.js');
            const openaiClient = new OpenAIClient();

            const result = await openaiClient.translateNLToPromQL({
                naturalQuery: input.naturalQuery,
                availableMetrics: input.availableMetrics,
                userContext: input.userContext,
            });

            return {
                success: true,
                ...result,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * 生成查詢建議
     */
    async suggestQueryHints(input: {
        availableMetrics?: string[];
        userContext?: {
            defaultNamespace?: string;
            defaultService?: string;
        };
    }): Promise<object> {
        try {
            const { OpenAIClient } = await import('../clients/openai.js');
            const openaiClient = new OpenAIClient();

            const result = await openaiClient.suggestQueryHints({
                availableMetrics: input.availableMetrics,
                userContext: input.userContext,
            });

            return {
                success: true,
                ...result,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * 分析指標健康度
     */
    async analyzeMetricsHealth(input: {
        promql: string;
        timeRange: { start: number; end: number };
    }): Promise<object> {
        try {
            // 先查詢指標數據
            const metricsResult = await this.queryMetricsRange({
                promql: input.promql,
                start: input.timeRange.start,
                end: input.timeRange.end,
                step: '60s',
            }) as { success: boolean; results?: any[] };

            if (!metricsResult.success) {
                return metricsResult;
            }

            // 轉換數據格式
            const metricsData = (metricsResult.results || []).map((result: any) => ({
                timestamps: (result.values || []).map((v: any[]) => v[0]),
                values: (result.values || []).map((v: any[]) => parseFloat(v[1] || '0')),
            }));

            // 使用 AI 分析
            const { OpenAIClient } = await import('../clients/openai.js');
            const openaiClient = new OpenAIClient();

            const analysis = await openaiClient.analyzeMetricsHealth({
                promql: input.promql,
                metricsData,
                timeRange: input.timeRange,
            });

            return {
                success: true,
                ...analysis,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    private parseDuration(duration: string): number {
        const match = duration.match(/^(\d+)([smhd])$/);
        if (!match) {
            throw new Error(`Invalid duration format: ${duration}`);
        }

        const value = parseInt(match[1] || '0');
        const unit = match[2] || 's'; // 預設單位為秒

        const multipliers: Record<string, number> = {
            s: 1,
            m: 60,
            h: 3600,
            d: 86400,
        };

        return value * (multipliers[unit] || 1);
    }

    /**
     * 分析趨勢資料
     */
    private analyzeTrendData(results: Array<{ values?: Array<[number, string]> }>): object {
        if (results.length === 0 || !results[0]?.values) {
            return { trend: 'unknown', message: 'No data available' };
        }

        const values = results[0].values.map(v => parseFloat(v[1]));

        if (values.length < 2) {
            return { trend: 'unknown', message: 'Insufficient data points' };
        }

        // 簡單線性趨勢
        const first = values[0] || 0;
        const last = values[values.length - 1] || 0;
        const change = ((last - first) / first) * 100;

        return {
            trend: change > 5 ? 'increasing' : change < -5 ? 'decreasing' : 'stable',
            changePercentage: change.toFixed(2),
            firstValue: first.toFixed(2),
            lastValue: last.toFixed(2),
            dataPoints: values.length,
        };
    }

    /**
     * 在資料中檢測異常
     */
    private detectAnomaliesInData(
        results: Array<{ metric: Record<string, string>; values?: Array<[number, string]> }>,
        threshold: number
    ): Array<object> {
        const anomalies: Array<object> = [];

        for (const result of results) {
            if (!result.values || result.values.length < 3) {
                continue;
            }

            const values = result.values.map(v => parseFloat(v[1]));
            const mean = values.reduce((a, b) => a + b, 0) / values.length;
            const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
            const stdDev = Math.sqrt(variance);

            // 檢測超過閾值的點
            for (let i = 0; i < result.values.length; i++) {
                const value = parseFloat(result.values[i]?.[1] || '0');
                const deviation = Math.abs(value - mean) / stdDev;

                if (deviation > threshold) {
                    anomalies.push({
                        metric: result.metric,
                        timestamp: new Date((result.values[i]?.[0] || 0) * 1000).toISOString(),
                        value: value.toFixed(2),
                        mean: mean.toFixed(2),
                        deviation: deviation.toFixed(2),
                    });
                }
            }
        }

        return anomalies.slice(0, 20); // 限制返回數量
    }

    /**
     * 建立 Top Metrics 查詢
     */
    private buildTopMetricsQuery(metricType: string): string {
        const queries: Record<string, string> = {
            cpu: 'topk(10, rate(container_cpu_usage_seconds_total[5m]))',
            memory: 'topk(10, container_memory_usage_bytes)',
            requests: 'topk(10, rate(http_requests_total[5m]))',
            errors: 'topk(10, rate(http_requests_total{status=~"5.."}[5m]))',
            latency: 'topk(10, histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])))',
        };

        return queries[metricType] || queries['cpu'] || '';
    }
}
