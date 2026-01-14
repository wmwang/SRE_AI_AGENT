import { ElasticsearchClient } from '../clients/elasticsearch.js';
import { OpenAIClient } from '../clients/openai.js';
import type {
    SearchLogsInput,
    NLToESQueryInput,
    AnalyzeErrorPatternsInput,
    SummarizeLogsInput,
} from './schemas.js';

/**
 * Tool Handlers - 處理 MCP Tool 請求
 */
export class ToolHandlers {
    private esClient: ElasticsearchClient;
    private openaiClient: OpenAIClient | null = null;

    constructor() {
        this.esClient = new ElasticsearchClient();

        // 嘗試初始化 OpenAI（如果沒有 API Key 則不使用 AI 功能）
        try {
            this.openaiClient = new OpenAIClient();
        } catch (error) {
            console.error('[Tool Handlers] OpenAI not available, AI features disabled');
        }
    }

    /**
     * 1. search_logs - 搜尋日誌
     */
    async searchLogs(input: SearchLogsInput): Promise<object> {
        try {
            const result = await this.esClient.search({
                query: input.query,
                index: input.index,
                timeRange: input.timeRange,
                filters: input.filters,
                size: input.size,
            });

            return {
                success: true,
                total: result.total,
                took: result.took,
                hits: result.hits,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * 2. nl_to_es_query - 自然語言轉 ES Query
     */
    async nlToESQuery(input: NLToESQueryInput): Promise<object> {
        if (!this.openaiClient) {
            return {
                success: false,
                error: 'AI features not available (OpenAI API key not configured)',
            };
        }

        try {
            const indices = await this.esClient.getIndices();

            const result = await this.openaiClient.translateNLToESQuery({
                naturalQuery: input.naturalQuery,
                availableIndices: indices,
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
     * 3. analyze_error_patterns - 分析錯誤模式
     */
    async analyzeErrorPatterns(input: AnalyzeErrorPatternsInput): Promise<object> {
        if (!this.openaiClient) {
            return {
                success: false,
                error: 'AI features not available',
            };
        }

        try {
            // 1. 搜尋錯誤日誌
            const errorLogs = await this.esClient.search({
                timeRange: input.timeRange,
                filters: {
                    level: 'ERROR',
                    service: input.service,
                },
                size: 1000, // 分析最多 1000 筆
            });

            if (errorLogs.total === 0) {
                return {
                    success: true,
                    patterns: [],
                    message: '未發現錯誤日誌',
                };
            }

            // 2. 統計錯誤訊息
            const errorCounts = new Map<string, { count: number; firstSeen: string; lastSeen: string }>();

            errorLogs.hits.forEach(log => {
                const msg = log.message.substring(0, 200); // 截斷
                const existing = errorCounts.get(msg);
                if (existing) {
                    existing.count++;
                    existing.lastSeen = log.timestamp;
                } else {
                    errorCounts.set(msg, {
                        count: 1,
                        firstSeen: log.timestamp,
                        lastSeen: log.timestamp,
                    });
                }
            });

            // 3. 過濾達到最小出現次數的錯誤
            const significantErrors = Array.from(errorCounts.entries())
                .filter(([_, data]) => data.count >= input.minOccurrences)
                .sort((a, b) => b[1].count - a[1].count)
                .slice(0, 10) // 最多分析 10 種模式
                .map(([message, data]) => ({
                    message,
                    count: data.count,
                    firstSeen: data.firstSeen,
                    lastSeen: data.lastSeen,
                }));

            if (significantErrors.length === 0) {
                return {
                    success: true,
                    patterns: [],
                    message: `未發現重複出現 ${input.minOccurrences} 次以上的錯誤模式`,
                };
            }

            // 4. AI 分析
            const aiAnalysis = await this.openaiClient.analyzeErrorPatterns({
                errors: significantErrors,
                context: input.service ? `服務: ${input.service}` : undefined,
            });

            return {
                success: true,
                totalErrors: errorLogs.total,
                analyzedPatterns: significantErrors.length,
                ...aiAnalysis,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * 4. summarize_logs - 日誌摘要
     */
    async summarizeLogs(input: SummarizeLogsInput): Promise<object> {
        if (!this.openaiClient) {
            return {
                success: false,
                error: 'AI features not available',
            };
        }

        try {
            // 搜尋日誌
            const logs = await this.esClient.search({
                query: input.query,
                timeRange: input.timeRange,
                filters: input.service ? { service: input.service } : undefined,
                size: input.maxLogs,
            });

            if (logs.total === 0) {
                return {
                    success: true,
                    summary: '未找到任何日誌',
                    keyFindings: [],
                    errorCount: 0,
                    topErrors: [],
                };
            }

            // AI 摘要
            const summary = await this.openaiClient.summarizeLogs({
                logs: logs.hits,
                query: input.query,
            });

            return {
                success: true,
                totalLogs: logs.total,
                analyzedLogs: logs.hits.length,
                ...summary,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * 輔助：取得可用的服務列表
     */
    async getAvailableServices(): Promise<string[]> {
        return this.esClient.getServices();
    }

    /**
     * 輔助：取得可用的 indices
     */
    async getAvailableIndices(): Promise<string[]> {
        return this.esClient.getIndices();
    }
}
