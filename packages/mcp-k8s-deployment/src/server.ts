import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    ListToolsRequestSchema,
    CallToolRequestSchema,
    ErrorCode,
    McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { toolDefinitions } from './tools/definitions.js';
import { K8sToolsHandler } from './tools/handlers.js';
import { OpenAIClient } from './clients/openai.js';
import {
    ScanRepoSchema,
    AnalyzeDeploymentSchema,
    SuggestImprovementsSchema,
    RenderHelmChartSchema,
} from './tools/schemas.js';

/**
 * 建立 K8s Deployment MCP Server
 */
export function createServer() {
    const server = new Server(
        {
            name: 'K8s Deployment',
            version: '1.0.0',
        },
        {
            capabilities: {
                tools: {},
            },
        }
    );

    // 處理列出 tools 請求
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return { tools: toolDefinitions };
    });

    // 處理調用 tool 請求
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;

        // 每次請求都建立新的 OpenAI client，避免長效連線問題
        // 及使用新的 Handler 實例
        const ai = new OpenAIClient();
        const handler = new K8sToolsHandler(ai);

        try {
            let result: object;

            switch (name) {
                case 'scan_repo': {
                    const input = ScanRepoSchema.parse(args);
                    result = await handler.scanRepo(input);
                    break;
                }
                case 'analyze_deployment': {
                    const input = AnalyzeDeploymentSchema.parse(args);
                    result = await handler.analyzeDeployment(input);
                    break;
                }
                case 'suggest_improvements': {
                    const input = SuggestImprovementsSchema.parse(args);
                    result = await handler.suggestImprovements(input);
                    break;
                }
                case 'render_helm_chart': {
                    const input = RenderHelmChartSchema.parse(args);
                    result = await handler.renderHelmChart(input);
                    break;
                }
                default:
                    throw new McpError(
                        ErrorCode.MethodNotFound,
                        `Unknown tool: ${name}`
                    );
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
            if (error instanceof McpError) {
                throw error;
            }

            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({ success: false, error: errorMessage }),
                    },
                ],
            };
        }
    });

    return server;
}

/**
 * 執行 Server
 */
export async function runServer() {
    const server = createServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('[K8s Deployment MCP Server] Started');
}
