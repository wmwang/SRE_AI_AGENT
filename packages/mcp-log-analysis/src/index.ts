#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { getConfig, displayConfig } from './config.js';
import { ToolHandlers } from './tools/handlers.js';
import {
    SearchLogsInputSchema,
    NLToESQueryInputSchema,
    AnalyzeErrorPatternsInputSchema,
    SummarizeLogsInputSchema,
} from './tools/schemas.js';

/**
 * Log Analysis MCP Server
 * 
 * 提供 Elasticsearch 日誌分析與 AI 診斷功能
 */

// 初始化配置
const config = getConfig();
displayConfig(config);

// 初始化 Tool Handlers
const toolHandlers = new ToolHandlers();

// 建立 MCP Server
const server = new Server(
    {
        name: 'sre-log-analysis',
        version: '1.0.0',
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

/**
 * 註冊 Tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: 'search_logs',
                description: '搜尋 Elasticsearch 日誌。支援自然語言查詢、時間範圍過濾、Log Level 過濾等。',
                inputSchema: {
                    type: 'object',
                    properties: {
                        query: {
                            type: 'string',
                            description: '搜尋查詢（Lucene syntax 或自然語言）',
                        },
                        timeRange: {
                            type: 'object',
                            properties: {
                                start: {
                                    type: ['number', 'string'],
                                    description: '開始時間（Unix timestamp 或 ISO string）',
                                },
                                end: {
                                    type: ['number', 'string'],
                                    description: '結束時間',
                                },
                            },
                        },
                        filters: {
                            type: 'object',
                            properties: {
                                level: {
                                    description: 'Log level (ERROR, WARN, INFO, DEBUG)',
                                },
                                service: {
                                    type: 'string',
                                    description: '服務名稱',
                                },
                                namespace: {
                                    type: 'string',
                                    description: 'Kubernetes namespace',
                                },
                            },
                        },
                        size: {
                            type: 'number',
                            description: '返回筆數（預設 100）',
                        },
                    },
                },
            },
            {
                name: 'nl_to_es_query',
                description: '將自然語言轉換為 Elasticsearch Query DSL。例如：「過去 1 小時 payment-service 的錯誤日誌」',
                inputSchema: {
                    type: 'object',
                    properties: {
                        naturalQuery: {
                            type: 'string',
                            description: '自然語言查詢',
                        },
                        userContext: {
                            type: 'object',
                            properties: {
                                defaultService: { type: 'string' },
                                defaultNamespace: { type: 'string' },
                            },
                        },
                    },
                    required: ['naturalQuery'],
                },
            },
            {
                name: 'analyze_error_patterns',
                description: '分析錯誤日誌模式，識別重複的錯誤、潛在原因和改善建議。使用 AI 提供深入分析。',
                inputSchema: {
                    type: 'object',
                    properties: {
                        timeRange: {
                            type: 'object',
                            properties: {
                                start: { type: ['number', 'string'] },
                                end: { type: ['number', 'string'] },
                            },
                            required: ['start', 'end'],
                        },
                        service: {
                            type: 'string',
                            description: '特定服務（可選）',
                        },
                        minOccurrences: {
                            type: 'number',
                            description: '最小出現次數（預設 3）',
                        },
                    },
                    required: ['timeRange'],
                },
            },
            {
                name: 'summarize_logs',
                description: '使用 AI 總結日誌內容，提取關鍵發現、錯誤統計和改善建議。',
                inputSchema: {
                    type: 'object',
                    properties: {
                        timeRange: {
                            type: 'object',
                            properties: {
                                start: { type: ['number', 'string'] },
                                end: { type: ['number', 'string'] },
                            },
                            required: ['start', 'end'],
                        },
                        query: {
                            type: 'string',
                            description: '日誌查詢條件（可選）',
                        },
                        service: {
                            type: 'string',
                            description: '服務名稱（可選）',
                        },
                        maxLogs: {
                            type: 'number',
                            description: '最多分析的日誌數（預設 500）',
                        },
                    },
                    required: ['timeRange'],
                },
            },
        ],
    };
});

/**
 * 處理 Tool 呼叫
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
        let result: object;

        switch (name) {
            case 'search_logs': {
                const input = SearchLogsInputSchema.parse(args);
                result = await toolHandlers.searchLogs(input);
                break;
            }

            case 'nl_to_es_query': {
                const input = NLToESQueryInputSchema.parse(args);
                result = await toolHandlers.nlToESQuery(input);
                break;
            }

            case 'analyze_error_patterns': {
                const input = AnalyzeErrorPatternsInputSchema.parse(args);
                result = await toolHandlers.analyzeErrorPatterns(input);
                break;
            }

            case 'summarize_logs': {
                const input = SummarizeLogsInputSchema.parse(args);
                result = await toolHandlers.summarizeLogs(input);
                break;
            }

            default:
                throw new Error(`Unknown tool: ${name}`);
        }

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(result, null, 2),
                },
            ],
        };
    } catch (error) {
        console.error(`[MCP Server] Error handling tool ${name}:`, error);

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        success: false,
                        error: error instanceof Error ? error.message : String(error),
                    }, null, 2),
                },
            ],
            isError: true,
        };
    }
});

/**
 * 啟動 Server
 */
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error('[Log Analysis MCP Server] Started and ready');
}

main().catch((error) => {
    console.error('[Log Analysis MCP Server] Fatal error:', error);
    process.exit(1);
});
