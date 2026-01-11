import { getConfig } from '../config.js';

/**
 * Prometheus API 回應型別
 */
export interface PrometheusQueryResult {
    status: 'success' | 'error';
    data?: {
        resultType: string;
        result: Array<{
            metric: Record<string, string>;
            value?: [number, string];
            values?: Array<[number, string]>;
        }>;
    };
    error?: string;
    errorType?: string;
}

/**
 * Prometheus Client
 * 
 * 提供 Prometheus API 的封裝
 */
export class PrometheusClient {
    private endpoint: string;
    private timeout: number;
    private mockMode: boolean;

    constructor() {
        const config = getConfig();
        this.endpoint = config.prometheus.endpoint;
        this.timeout = config.prometheus.timeout || 30000;
        this.mockMode = config.mockMode || false;

        if (this.mockMode) {
            console.error('[Prometheus Client] Running in MOCK MODE');
        }
    }

    /**
     * 執行即時查詢
     */
    async query(promql: string, time?: number): Promise<PrometheusQueryResult> {
        if (this.mockMode) {
            console.error('[Prometheus Client] Mocking query:', promql);
            return {
                status: 'success',
                data: {
                    resultType: 'vector',
                    result: [
                        {
                            metric: { __name__: 'mock_metric', instance: 'localhost:9090' },
                            value: [Date.now() / 1000, '1.23']
                        }
                    ]
                }
            };
        }

        const url = new URL(`${this.endpoint}/api/v1/query`);
        url.searchParams.append('query', promql);
        if (time) {
            url.searchParams.append('time', time.toString());
        }

        // DEBUG: 輸出查詢
        if (process.env.DEBUG_PROMETHEUS === 'true') {
            console.error('\n========== PROMETHEUS QUERY DEBUG ==========');
            console.error('Endpoint:', this.endpoint);
            console.error('PromQL:', promql);
            console.error('Time:', time || 'now');
            console.error('===========================================\n');
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);

            const response = await fetch(url.toString(), {
                method: 'GET',
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            const result = await response.json() as PrometheusQueryResult;

            // DEBUG: 輸出結果
            if (process.env.DEBUG_PROMETHEUS === 'true') {
                console.error('\n========== PROMETHEUS RESPONSE DEBUG ==========');
                console.error('Status:', result.status);
                console.error('Result Count:', result.data?.result?.length || 0);
                console.error('=============================================\n');
            }

            return result;
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error(`Prometheus query timeout after ${this.timeout}ms`);
            }
            throw error;
        }
    }

    /**
     * 執行範圍查詢
     */
    async queryRange(
        promql: string,
        start: number,
        end: number,
        step: string = '15s'
    ): Promise<PrometheusQueryResult> {
        if (this.mockMode) {
            console.error('[Prometheus Client] Mocking queryRange:', promql);
            return {
                status: 'success',
                data: {
                    resultType: 'matrix',
                    result: [
                        {
                            metric: { __name__: 'mock_metric', instance: 'localhost:9090' },
                            values: [
                                [start, '1.0'],
                                [(start + end) / 2, '2.0'],
                                [end, '1.5']
                            ]
                        }
                    ]
                }
            };
        }

        const url = new URL(`${this.endpoint}/api/v1/query_range`);
        url.searchParams.append('query', promql);
        url.searchParams.append('start', start.toString());
        url.searchParams.append('end', end.toString());
        url.searchParams.append('step', step);

        // DEBUG: 輸出查詢
        if (process.env.DEBUG_PROMETHEUS === 'true') {
            console.error('\n========== PROMETHEUS RANGE QUERY DEBUG ==========');
            console.error('Endpoint:', this.endpoint);
            console.error('PromQL:', promql);
            console.error('Start:', new Date(start * 1000).toISOString());
            console.error('End:', new Date(end * 1000).toISOString());
            console.error('Step:', step);
            console.error('================================================\n');
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);

            const response = await fetch(url.toString(), {
                method: 'GET',
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            const result = await response.json() as PrometheusQueryResult;

            // DEBUG: 輸出結果
            if (process.env.DEBUG_PROMETHEUS === 'true') {
                console.error('\n========== PROMETHEUS RESPONSE DEBUG ==========');
                console.error('Status:', result.status);
                console.error('Result Count:', result.data?.result?.length || 0);
                console.error('=============================================\n');
            }

            return result;
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error(`Prometheus query timeout after ${this.timeout}ms`);
            }
            throw error;
        }
    }

    /**
     * 取得所有指標名稱
     */
    async getMetricNames(): Promise<string[]> {
        if (this.mockMode) {
            console.error('[Prometheus Client] Mocking getMetricNames');
            return [
                'http_requests_total',
                'process_cpu_seconds_total',
                'process_resident_memory_bytes',
                'go_goroutines',
                'node_cpu_seconds_total',
                'node_memory_MemTotal_bytes',
                'node_filesystem_size_bytes',
                'container_cpu_usage_seconds_total',
                'container_memory_usage_bytes'
            ];
        }

        const url = new URL(`${this.endpoint}/api/v1/label/__name__/values`);
        console.error('[Prometheus Client] Fetching metric names from:', url.toString());

        const response = await fetch(url.toString());
        console.error('[Prometheus Client] Response status:', response.status, response.statusText);

        if (!response.ok) {
            const text = await response.text();
            console.error('[Prometheus Client] Error response body:', text);
            throw new Error(`Prometheus API error: ${response.status} ${response.statusText} - ${text}`);
        }

        const result = await response.json() as { status: string; data?: string[] };
        console.error('[Prometheus Client] Result status:', result.status);

        if (result.status === 'success') {
            return result.data || [];
        }

        return [];
    }

    /**
     * 取得指標的標籤值
     */
    async getLabelValues(label: string): Promise<string[]> {
        if (this.mockMode) {
            console.error('[Prometheus Client] Mocking getLabelValues for:', label);
            return ['job-1', 'job-2', 'instance-1', 'instance-2'];
        }

        const url = new URL(`${this.endpoint}/api/v1/label/${label}/values`);

        try {
            const response = await fetch(url.toString());
            const result = await response.json() as { status: string; data?: string[] };

            if (result.status === 'success') {
                return result.data || [];
            }

            return [];
        } catch (error) {
            console.error('[Prometheus Client] Error in getLabelValues:', error);
            throw error;
        }
    }

    /**
     * 取得所有可用的 labels
     */
    async getLabels(): Promise<string[]> {
        if (this.mockMode) {
            console.error('[Prometheus Client] Mocking getLabels');
            return [
                'namespace',
                'pod',
                'container',
                'job',
                'instance',
                'service',
                'deployment',
                'node',
                'prometheus'
            ];
        }

        const url = new URL(`${this.endpoint}/api/v1/labels`);

        try {
            const response = await fetch(url.toString());

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Prometheus API error: ${response.status} ${response.statusText} - ${text}`);
            }

            const result = await response.json() as { status: string; data?: string[] };

            if (result.status === 'success') {
                return result.data || [];
            }

            return [];
        } catch (error) {
            console.error('[Prometheus Client] Error in getLabels:', error);
            throw error;
        }
    }

    /**
     * 取得特定 label 的所有值（增強版，支援 mock 多租戶資料）
     */
    async getLabelValuesEnhanced(labelName: string): Promise<string[]> {
        if (this.mockMode) {
            console.error('[Prometheus Client] Mocking getLabelValuesEnhanced for:', labelName);

            // Mock 多租戶 K8s 環境資料
            const mockData: Record<string, string[]> = {
                namespace: [
                    'production-payment',
                    'production-user',
                    'production-order',
                    'staging-all',
                    'monitoring',
                    'kube-system'
                ],
                service: [
                    'payment-api',
                    'payment-worker',
                    'payment-db-exporter',
                    'user-api',
                    'user-cache',
                    'order-api',
                    'order-worker'
                ],
                pod: [
                    'payment-api-7d9f5c8b6-abc12',
                    'payment-api-7d9f5c8b6-def34',
                    'payment-api-7d9f5c8b6-ghi56',
                    'payment-worker-5c8b6f7d-xyz98',
                    'payment-worker-5c8b6f7d-abc11',
                    'user-api-8b6f7d5c-qwe11',
                    'user-api-8b6f7d5c-asd22',
                    'order-api-6f7d5c8b-zxc33'
                ],
                container: [
                    'payment-api',
                    'user-api',
                    'order-api',
                    'istio-proxy',
                    'prometheus-exporter'
                ],
                job: [
                    'kubernetes-pods',
                    'kubernetes-nodes',
                    'kubernetes-apiservers'
                ],
                deployment: [
                    'payment-api',
                    'payment-worker',
                    'user-api',
                    'order-api'
                ]
            };

            return mockData[labelName] || [];
        }

        return this.getLabelValues(labelName);
    }
}
