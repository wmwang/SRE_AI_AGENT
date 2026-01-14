import { Client } from '@elastic/elasticsearch';
import { getConfig } from '../config.js';

/**
 * Log Entry 介面
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
    spanId?: string;
    stack?: string;
    metadata?: Record<string, any>;
}

/**
 * Search Parameters
 */
export interface SearchParams {
    query?: string;
    index?: string;
    timeRange?: {
        start: number | string;  // Unix timestamp (seconds) or ISO string
        end: number | string;
    };
    filters?: {
        level?: string | string[];
        service?: string;
        namespace?: string;
        pod?: string;
    };
    size?: number;
    from?: number;
    sort?: Array<Record<string, 'asc' | 'desc'>>;
}

/**
 * Search Result
 */
export interface SearchResult {
    hits: LogEntry[];
    total: number;
    took: number;  // Query time in ms
    aggregations?: Record<string, any>;
}

/**
 * Elasticsearch Client for Log Analysis
 * 
 * 支援：
 * - Header-based API Key 認證
 * - Mock 模式（無 ES 時返回模擬數據）
 * - 彈性查詢建構
 */
export class ElasticsearchClient {
    private client: Client | null = null;
    private config: ReturnType<typeof getConfig>['elasticsearch'];
    private mockMode: boolean;

    constructor() {
        const config = getConfig();
        this.config = config.elasticsearch;
        this.mockMode = this.config.mockMode;

        if (!this.mockMode) {
            try {
                // 建立 ES client
                const headers: Record<string, string> = {};

                // 設定 API Key header
                if (this.config.apiKey) {
                    const headerValue = this.config.useBearerToken
                        ? `Bearer ${this.config.apiKey}`
                        : this.config.apiKey;
                    headers[this.config.apiKeyHeader] = headerValue;
                }

                this.client = new Client({
                    node: this.config.endpoint,
                    headers,
                });

                console.error('[ES Client] Connected to:', this.config.endpoint);
            } catch (error) {
                console.error('[ES Client] Failed to connect:', error);
                console.error('[ES Client] Falling back to mock mode');
                this.mockMode = true;
            }
        } else {
            console.error('[ES Client] Running in MOCK mode (simulated data)');
        }
    }

    /**
     * 搜尋日誌
     */
    async search(params: SearchParams): Promise<SearchResult> {
        if (this.mockMode) {
            return this.mockSearch(params);
        }

        try {
            const index = params.index || this.config.defaultIndex || 'logs-*';
            const size = params.size || 100;
            const from = params.from || 0;

            // 建構 ES Query
            const esQuery = this.buildQuery(params);

            const result = await this.client!.search({
                index,
                body: {
                    query: esQuery,
                    size,
                    from,
                    sort: params.sort || [{ '@timestamp': 'desc' }],
                },
            });

            // 解析結果
            const hits = result.hits.hits.map((hit: any) => this.parseLogEntry(hit._source));
            const total = typeof result.hits.total === 'number'
                ? result.hits.total
                : result.hits.total?.value || 0;

            return {
                hits,
                total,
                took: result.took || 0,
                aggregations: result.aggregations,
            };
        } catch (error) {
            console.error('[ES Client] Search error:', error);
            // 自動 fallback 到 mock 模式
            console.error('[ES Client] Falling back to mock mode');
            this.mockMode = true;
            return this.mockSearch(params);
        }
    }

    /**
     * 取得可用的 indices
     */
    async getIndices(): Promise<string[]> {
        if (this.mockMode) {
            return ['logs-app-2026', 'logs-system-2026'];
        }

        try {
            const result = await this.client!.cat.indices({ format: 'json' });
            return result.map((idx: any) => idx.index);
        } catch (error) {
            console.error('[ES Client] Get indices error:', error);
            return [];
        }
    }

    /**
     * 取得服務列表
     */
    async getServices(): Promise<string[]> {
        if (this.mockMode) {
            return ['payment-service', 'user-api', 'order-service'];
        }

        try {
            const result = await this.client!.search({
                index: this.config.defaultIndex,
                body: {
                    size: 0,
                    aggs: {
                        services: {
                            terms: { field: 'service.keyword', size: 100 },
                        },
                    },
                },
            });
            const agg = result.aggregations?.services as any;
            return agg?.buckets?.map((b: any) => b.key) || [];
        } catch (error) {
            console.error('[ES Client] Get services error:', error);
            return [];
        }
    }

    /**
     * 取得 Log Levels
     */
    async getLogLevels(): Promise<string[]> {
        return ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'];
    }

    // ==================== Private Methods ====================

    /**
     * 建構 Elasticsearch Query DSL
     */
    private buildQuery(params: SearchParams): any {
        const must: any[] = [];

        // Time range
        if (params.timeRange) {
            must.push({
                range: {
                    '@timestamp': {
                        gte: params.timeRange.start,
                        lte: params.timeRange.end,
                    },
                },
            });
        }

        // Query string
        if (params.query) {
            must.push({
                query_string: {
                    query: params.query,
                    default_field: 'message',
                },
            });
        }

        // Filters
        if (params.filters) {
            if (params.filters.level) {
                const levels = Array.isArray(params.filters.level)
                    ? params.filters.level
                    : [params.filters.level];
                must.push({
                    terms: { 'level.keyword': levels },
                });
            }

            if (params.filters.service) {
                must.push({
                    term: { 'service.keyword': params.filters.service },
                });
            }

            if (params.filters.namespace) {
                must.push({
                    term: { 'namespace.keyword': params.filters.namespace },
                });
            }

            if (params.filters.pod) {
                must.push({
                    term: { 'pod.keyword': params.filters.pod },
                });
            }
        }

        return {
            bool: {
                must: must.length > 0 ? must : [{ match_all: {} }],
            },
        };
    }

    /**
     * 解析 log entry
     */
    private parseLogEntry(source: any): LogEntry {
        return {
            timestamp: source['@timestamp'] || source.timestamp,
            level: source.level || 'INFO',
            message: source.message || '',
            service: source.service,
            namespace: source.namespace,
            pod: source.pod,
            container: source.container,
            traceId: source.trace_id || source.traceId,
            spanId: source.span_id || source.spanId,
            stack: source.stack || source.stacktrace,
            metadata: source.metadata || {},
        };
    }

    /**
     * Mock 搜尋（模擬數據）
     */
    private mockSearch(params: SearchParams): SearchResult {
        const mockLogs: LogEntry[] = [
            {
                timestamp: new Date().toISOString(),
                level: 'ERROR',
                message: 'Database connection timeout',
                service: 'payment-service',
                namespace: 'production',
                pod: 'payment-service-789abc',
                traceId: 'trace-123',
            },
            {
                timestamp: new Date(Date.now() - 60000).toISOString(),
                level: 'WARN',
                message: 'High memory usage detected',
                service: 'user-api',
                namespace: 'production',
                pod: 'user-api-456def',
            },
            {
                timestamp: new Date(Date.now() - 120000).toISOString(),
                level: 'INFO',
                message: 'Service started successfully',
                service: 'payment-service',
                namespace: 'production',
                pod: 'payment-service-789abc',
            },
        ];

        // 簡單的過濾
        let filtered = mockLogs;
        if (params.filters?.level) {
            const levels = Array.isArray(params.filters.level) ? params.filters.level : [params.filters.level];
            filtered = filtered.filter(log => levels.includes(log.level));
        }
        if (params.filters?.service) {
            filtered = filtered.filter(log => log.service === params.filters!.service);
        }

        const size = params.size || 100;
        const paged = filtered.slice(0, size);

        return {
            hits: paged,
            total: filtered.length,
            took: 5,
        };
    }
}
