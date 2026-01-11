#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { SharedMemory } from '@sre-agent/shared-memory';
import { OpenAIClient } from './clients/openai.js';
import { SLOToolsHandler } from './tools/handlers.js';
import {
    AnalyzeK8sManifestsSchema,
    TrackSLOStatusSchema,
    CalculateErrorBudgetSchema,
    RecommendSLOsSchema,
    UpdateSLOStatusSchema,
    GenerateSLOReportSchema,
    GeneratePrometheusRulesSchema,
    GenerateGrafanaDashboardSchema,
} from './tools/schemas.js';
import { getConfig } from './config.js';

/**
 * SLO Management MCP Server
 * 
 * 提供 SLO 生命週期管理功能：
 * - 分析 K8s manifests 並建議 SLOs
 * - 追蹤 SLO 狀態
 * - 計算錯誤預算
 * - 推薦 SLOs
 * - 更新 SLO 狀態
 * - 生成 SLO 報告
 */
class SLOManagementServer {
    private server: Server;
    private memory: SharedMemory;
    private ai: OpenAIClient;
    private handler: SLOToolsHandler;

    constructor() {
        const config = getConfig();

        // 初始化核心組件
        this.memory = new SharedMemory(config.sharedMemoryPath);
        this.ai = new OpenAIClient();
        this.handler = new SLOToolsHandler(this.memory, this.ai);

        // 建立 MCP Server
        this.server = new Server(
            {
                name: 'slo-management',
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
                    name: 'analyze_k8s_manifests',
                    description: '分析 K8s manifests 並建議 SLO',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            manifests: {
                                type: 'string',
                                description: 'K8s YAML manifests 內容',
                            },
                            serviceId: {
                                type: 'string',
                                description: '服務 ID（可選）',
                            },
                        },
                        required: ['manifests'],
                    },
                },
                {
                    name: 'track_slo_status',
                    description: '追蹤 SLO 達成狀態',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            serviceId: {
                                type: 'string',
                                description: '過濾特定服務的 SLOs',
                            },
                            status: {
                                type: 'string',
                                enum: ['met', 'at-risk', 'violated', 'unknown'],
                                description: '過濾 SLO 狀態',
                            },
                        },
                    },
                },
                {
                    name: 'calculate_error_budget',
                    description: '計算錯誤預算',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            sloId: {
                                type: 'string',
                                description: 'SLO ID',
                            },
                        },
                        required: ['sloId'],
                    },
                },
                {
                    name: 'recommend_slos',
                    description: '基於服務特性推薦 SLO',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            serviceType: {
                                type: 'string',
                                description: '服務類型，例如: api, web, database',
                            },
                            description: {
                                type: 'string',
                                description: '服務描述',
                            },
                        },
                        required: ['serviceType'],
                    },
                },
                {
                    name: 'update_slo_status',
                    description: '更新 SLO 狀態',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            sloId: {
                                type: 'string',
                                description: 'SLO ID',
                            },
                            status: {
                                type: 'string',
                                enum: ['met', 'at-risk', 'violated', 'unknown'],
                                description: '新的 SLO 狀態',
                            },
                            errorBudget: {
                                type: 'number',
                                description: '錯誤預算百分比',
                                minimum: 0,
                                maximum: 100,
                            },
                        },
                        required: ['sloId', 'status', 'errorBudget'],
                    },
                },
                {
                    name: 'generate_slo_report',
                    description: '生成 SLO 報告',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            serviceId: {
                                type: 'string',
                                description: '過濾特定服務',
                            },
                            period: {
                                type: 'string',
                                enum: ['7d', '30d', '90d'],
                                description: '報告期間',
                                default: '30d',
                            },
                        },
                    },
                },
                {
                    name: 'generate_prometheus_rules',
                    description: '根據 SLO 定義生成 Prometheus Recording Rules 和 Alert Rules',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            slos: {
                                type: 'array',
                                description: 'SLO 定義列表',
                                items: {
                                    type: 'object',
                                    properties: {
                                        id: { type: 'string' },
                                        name: { type: 'string' },
                                        target: { type: 'number' },
                                        threshold: { type: 'number' },
                                        window: { type: 'string' },
                                        golden_signal: { type: 'string' },
                                        metric_name: { type: 'string' },
                                    },
                                    required: ['id', 'name', 'target', 'window', 'golden_signal'],
                                },
                            },
                            serviceName: { type: 'string', description: '服務名稱' },
                            namespace: { type: 'string', description: 'Prometheus namespace', default: 'default' },
                        },
                        required: ['slos', 'serviceName'],
                    },
                },
                {
                    name: 'generate_grafana_dashboard',
                    description: '根據 SLO 定義生成 Grafana Dashboard JSON 檔案',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            slos: {
                                type: 'array',
                                description: 'SLO 定義列表',
                                items: {
                                    type: 'object',
                                    properties: {
                                        id: { type: 'string' },
                                        name: { type: 'string' },
                                        target: { type: 'number' },
                                        threshold: { type: 'number' },
                                        window: { type: 'string' },
                                        golden_signal: { type: 'string' },
                                        metric_name: { type: 'string' },
                                    },
                                    required: ['id', 'name', 'target', 'window', 'golden_signal'],
                                },
                            },
                            serviceName: { type: 'string', description: '服務名稱' },
                            dashboardTitle: { type: 'string', description: 'Dashboard 標題' },
                            outputPath: { type: 'string', description: '輸出檔案路徑（可選）' },
                        },
                        required: ['slos', 'serviceName'],
                    },
                },
            ],
        }));

        // 處理 tool 調用
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;

            try {
                switch (name) {
                    case 'analyze_k8s_manifests': {
                        const input = AnalyzeK8sManifestsSchema.parse(args);
                        const result = await this.handler.analyzeK8sManifests(input);
                        return {
                            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
                        };
                    }

                    case 'track_slo_status': {
                        const input = TrackSLOStatusSchema.parse(args);
                        const result = await this.handler.trackSLOStatus(input);
                        return {
                            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
                        };
                    }

                    case 'calculate_error_budget': {
                        const input = CalculateErrorBudgetSchema.parse(args);
                        const result = await this.handler.calculateErrorBudget(input);
                        return {
                            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
                        };
                    }

                    case 'recommend_slos': {
                        const input = RecommendSLOsSchema.parse(args);
                        const result = await this.handler.recommendSLOs(input);
                        return {
                            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
                        };
                    }

                    case 'update_slo_status': {
                        const input = UpdateSLOStatusSchema.parse(args);
                        const result = await this.handler.updateSLOStatus(input);
                        return {
                            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
                        };
                    }

                    case 'generate_slo_report': {
                        const input = GenerateSLOReportSchema.parse(args);
                        const result = await this.handler.generateSLOReport(input);
                        return {
                            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
                        };
                    }

                    case 'generate_prometheus_rules': {
                        const input = GeneratePrometheusRulesSchema.parse(args);
                        const result = await this.handler.generatePrometheusRules(input);
                        return {
                            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
                        };
                    }

                    case 'generate_grafana_dashboard': {
                        const input = GenerateGrafanaDashboardSchema.parse(args);
                        const result = await this.handler.generateGrafanaDashboard(input);
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

        console.error('SLO Management MCP Server 已啟動');
    }
}

// 啟動 Server
const server = new SLOManagementServer();
server.start().catch((error: unknown) => {
    console.error('Failed to start server:', error);
    process.exit(1);
});
