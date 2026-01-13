#!/usr/bin/env node
import './env.js';

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { SharedMemory } from '@sre-agent/shared-memory';
import { PrometheusClient } from './clients/prometheus.js';
import { MetricsToolsHandler } from './tools/handlers.js';
import {
    QueryMetricsSchema,
    QueryMetricsRangeSchema,
    DiscoverMetricsSchema,
    AnalyzeMetricTrendSchema,
    DetectAnomaliesSchema,
    GetTopMetricsSchema,
    DiscoverLabelsSchema,
    TranslateNLToPromQLSchema,
    SuggestQueryHintsSchema,
    AnalyzeMetricsHealthSchema,
} from './tools/schemas.js';
import { getConfig } from './config.js';
import { mcpLogger } from './utils/logger.js';

/**
 * Metrics Analysis MCP Server
 * 
 * 提供 Prometheus 指標分析功能：
 * - 查詢即時指標
 * - 查詢指標範圍
 * - 探索可用指標
 * - 分析指標趨勢
 * - 檢測異常
 * - 取得 Top N 指標
 */
class MetricsAnalysisServer {
    private server: Server;
    private memory: SharedMemory;
    private prometheus: PrometheusClient;
    private handler: MetricsToolsHandler;

    constructor() {
        const config = getConfig();

        // 初始化核心組件
        this.memory = new SharedMemory(config.sharedMemoryPath);
        this.prometheus = new PrometheusClient();
        this.handler = new MetricsToolsHandler(this.memory, this.prometheus);

        // 建立 MCP Server
        this.server = new Server(
            {
                name: 'metrics-analysis',
                version: '1.0.0',
            },
            {
                capabilities: {
                    tools: {},
                },
            }
        );

        this.setupToolHandlers();
    }

    /**
     * 設置 MCP Tool Handlers
     */
    private setupToolHandlers(): void {
        // 列出所有可用的 tools
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: [
                {
                    name: 'query_metrics',
                    description: '查詢 Prometheus 即時指標',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            promql: {
                                type: 'string',
                                description: 'Prometheus 查詢語句',
                            },
                            time: {
                                type: 'number',
                                description: '查詢時間點（Unix timestamp）',
                            },
                        },
                        required: ['promql'],
                    },
                },
                {
                    name: 'query_metrics_range',
                    description: '查詢 Prometheus 指標範圍',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            promql: {
                                type: 'string',
                                description: 'Prometheus 查詢語句',
                            },
                            start: {
                                type: 'number',
                                description: '開始時間（Unix timestamp）',
                            },
                            end: {
                                type: 'number',
                                description: '結束時間（Unix timestamp）',
                            },
                            step: {
                                type: 'string',
                                description: '步長，例如: 15s, 1m, 5m',
                                default: '15s',
                            },
                        },
                        required: ['promql', 'start', 'end'],
                    },
                },
                {
                    name: 'discover_metrics',
                    description: '探索可用的 Prometheus 指標',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            pattern: {
                                type: 'string',
                                description: '過濾指標名稱的正則表達式',
                            },
                            limit: {
                                type: 'number',
                                description: '返回結果數量限制',
                                default: 100,
                            },
                        },
                    },
                },
                {
                    name: 'analyze_metric_trend',
                    description: '分析指標趨勢',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            promql: {
                                type: 'string',
                                description: 'Prometheus 查詢語句',
                            },
                            duration: {
                                type: 'string',
                                description: '分析時段，例如: 1h, 6h, 1d',
                                default: '1h',
                            },
                        },
                        required: ['promql'],
                    },
                },
                {
                    name: 'detect_anomalies',
                    description: '檢測指標異常',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            promql: {
                                type: 'string',
                                description: 'Prometheus 查詢語句',
                            },
                            duration: {
                                type: 'string',
                                description: '檢測時段',
                                default: '1h',
                            },
                            threshold: {
                                type: 'number',
                                description: '異常閾值（標準差倍數）',
                            },
                        },
                        required: ['promql'],
                    },
                },
                {
                    name: 'get_top_metrics',
                    description: '取得 Top N 指標',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            metricType: {
                                type: 'string',
                                enum: ['cpu', 'memory', 'requests', 'errors', 'latency'],
                                description: '指標類型',
                            },
                            limit: {
                                type: 'number',
                                description: '返回前 N 個結果',
                                default: 10,
                            },
                        },
                        required: ['metricType'],
                    },
                },
                {
                    name: 'discover_labels',
                    description: '探索可用的 Prometheus labels（用於多租戶環境）',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            metricName: {
                                type: 'string',
                                description: '特定指標的 labels（optional）',
                            },
                            labelKey: {
                                type: 'string',
                                description: '特定 label 的可用值（optional）',
                            },
                        },
                    },
                },
                {
                    name: 'translate_nl_to_promql',
                    description: '將自然語言查詢轉換為 PromQL（核心功能）',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            naturalQuery: {
                                type: 'string',
                                description: '自然語言查詢，例如: "過去 1 小時 payment-service 的 CPU"',
                            },
                            availableMetrics: {
                                type: 'array',
                                items: { type: 'string' },
                                description: '可用指標列表（optional）',
                            },
                            userContext: {
                                type: 'object',
                                properties: {
                                    defaultNamespace: { type: 'string' },
                                    defaultService: { type: 'string' },
                                    labelPreferences: { type: 'object' },
                                },
                                description: '使用者上下文（optional）',
                            },
                        },
                        required: ['naturalQuery'],
                    },
                },
                {
                    name: 'suggest_query_hints',
                    description: '基於上下文生成推薦的查詢建議',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            availableMetrics: {
                                type: 'array',
                                items: { type: 'string' },
                                description: '可用指標列表（optional）',
                            },
                            userContext: {
                                type: 'object',
                                properties: {
                                    defaultNamespace: { type: 'string' },
                                    defaultService: { type: 'string' },
                                },
                                description: '使用者上下文（optional）',
                            },
                        },
                    },
                },
                {
                    name: 'analyze_metrics_health',
                    description: 'AI 分析指標健康度（診斷模式）',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            promql: {
                                type: 'string',
                                description: '要分析的 PromQL',
                            },
                            timeRange: {
                                type: 'object',
                                properties: {
                                    start: { type: 'number', description: '開始時間 (Unix timestamp)' },
                                    end: { type: 'number', description: '結束時間 (Unix timestamp)' },
                                },
                                required: ['start', 'end'],
                            },
                        },
                        required: ['promql', 'timeRange'],
                    },
                },
            ],
        }));

        // 處理 tool 調用
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;

            try {
                switch (name) {
                    case 'query_metrics': {
                        const input = QueryMetricsSchema.parse(args);
                        const result = await this.handler.queryMetrics(input);
                        return {
                            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
                        };
                    }

                    case 'query_metrics_range': {
                        const input = QueryMetricsRangeSchema.parse(args);
                        const result = await this.handler.queryMetricsRange(input);
                        return {
                            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
                        };
                    }

                    case 'discover_metrics': {
                        mcpLogger.log('[Metrics MCP] discover_metrics called');
                        const input = DiscoverMetricsSchema.parse(args);
                        mcpLogger.log('[Metrics MCP] Input:', input);
                        const result = await this.handler.discoverMetrics(input);
                        mcpLogger.log('[Metrics MCP] Result:', result);
                        return {
                            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
                        };
                    }

                    case 'analyze_metric_trend': {
                        const input = AnalyzeMetricTrendSchema.parse(args);
                        const result = await this.handler.analyzeMetricTrend(input);
                        return {
                            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
                        };
                    }

                    case 'detect_anomalies': {
                        const input = DetectAnomaliesSchema.parse(args);
                        const result = await this.handler.detectAnomalies(input);
                        return {
                            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
                        };
                    }

                    case 'get_top_metrics': {
                        const input = GetTopMetricsSchema.parse(args);
                        const result = await this.handler.getTopMetrics(input);
                        return {
                            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
                        };
                    }

                    case 'discover_labels': {
                        const input = DiscoverLabelsSchema.parse(args);
                        const result = await this.handler.discoverLabels(input);
                        return {
                            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
                        };
                    }

                    case 'translate_nl_to_promql': {
                        const input = TranslateNLToPromQLSchema.parse(args);
                        const result = await this.handler.translateNLToPromQL(input);
                        return {
                            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
                        };
                    }

                    case 'suggest_query_hints': {
                        const input = SuggestQueryHintsSchema.parse(args);
                        const result = await this.handler.suggestQueryHints(input);
                        return {
                            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
                        };
                    }

                    case 'analyze_metrics_health': {
                        const input = AnalyzeMetricsHealthSchema.parse(args);
                        const result = await this.handler.analyzeMetricsHealth(input);
                        return {
                            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
                        };
                    }

                    default:
                        throw new Error(`Unknown tool: ${name}`);
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({ success: false, error: errorMessage }, null, 2),
                        },
                    ],
                    isError: true,
                };
            }
        });
    }

    /**
     * 啟動 Server
     */
    async start(): Promise<void> {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);

        mcpLogger.log('Metrics Analysis MCP Server 已啟動');
    }
}

// 啟動 Server
const server = new MetricsAnalysisServer();
server.start().catch((error: unknown) => {
    mcpLogger.log('Failed to start server:', error);
    process.exit(1);
});
