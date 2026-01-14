import type { MCPClientManager } from '../../mcp/manager.js';
import type { LogExplorerState } from './state.js';

/**
 * Log Explorer Workflow
 * 
 * 管理日誌搜尋、AI 分析等操作
 */
export class LogExplorerWorkflow {
    private state: LogExplorerState;
    private stateUpdateCallback?: (state: LogExplorerState) => void;

    constructor(private mcpManager: MCPClientManager) {
        // 初始化 state
        const now = Math.floor(Date.now() / 1000);
        const oneHourAgo = now - 3600;

        this.state = {
            query: '',
            timeRange: {
                start: oneHourAgo,
                end: now,
                duration: '1h',
            },
            filters: {},
            results: [],
            total: 0,
            took: 0,
            currentStep: '準備就緒',
            mode: 'idle',
            isAnalyzing: false,
        };
    }

    /**
     * 設定 state 更新回調
     */
    onStateUpdate(callback: (state: LogExplorerState) => void): void {
        this.stateUpdateCallback = callback;
    }

    /**
     * 取得當前 state
     */
    getState(): LogExplorerState {
        return this.state;
    }

    /**
     * 更新 state
     */
    private updateState(updates: Partial<LogExplorerState>): void {
        this.state = { ...this.state, ...updates };
        this.stateUpdateCallback?.(this.state);
    }

    /**
     * 搜尋日誌
     */
    async search(params: {
        query?: string;
        timeRange?: { start: number; end: number; duration: string };
        filters?: { level?: string[]; service?: string; namespace?: string };
    }): Promise<void> {
        this.updateState({
            mode: 'searching',
            currentStep: '正在搜尋日誌...',
            query: params.query || this.state.query,
            timeRange: params.timeRange || this.state.timeRange,
            filters: params.filters || this.state.filters,
        });

        try {
            const result = await this.mcpManager.callTool('log', 'search_logs', {
                query: this.state.query,
                timeRange: {
                    start: this.state.timeRange.start,
                    end: this.state.timeRange.end,
                },
                filters: this.state.filters,
                size: 100,
            });

            // callTool 已經解析過 JSON，result 就是解析後的物件
            const data = result as any;

            if (data.success) {
                this.updateState({
                    results: data.hits || [],
                    total: data.total || 0,
                    took: data.took || 0,
                    mode: 'idle',
                    currentStep: `找到 ${data.total} 筆日誌`,
                    error: undefined,
                });
            } else {
                throw new Error(data.error || 'Search failed');
            }
        } catch (error) {
            this.updateState({
                mode: 'error',
                error: error instanceof Error ? error.message : String(error),
                currentStep: '搜尋失敗',
            });
        }
    }

    /**
     * 分析錯誤模式
     */
    async analyzePatterns(): Promise<void> {
        this.updateState({
            mode: 'analyzing',
            isAnalyzing: true,
            currentStep: '正在分析錯誤模式...',
        });

        try {
            const result = await this.mcpManager.callTool('log', 'analyze_error_patterns', {
                timeRange: {
                    start: this.state.timeRange.start,
                    end: this.state.timeRange.end,
                },
                service: this.state.filters.service,
                minOccurrences: 1, // 降低閾值，讓少量錯誤也能分析
            });

            const data = result as any;

            if (data.success) {
                this.updateState({
                    aiAnalysis: {
                        ...this.state.aiAnalysis,
                        patterns: data.patterns || [],
                    },
                    mode: 'idle',
                    isAnalyzing: false,
                    currentStep: `分析完成，發現 ${data.patterns?.length || 0} 種模式`,
                });
            } else {
                throw new Error(data.error || 'Analysis failed');
            }
        } catch (error) {
            this.updateState({
                mode: 'error',
                isAnalyzing: false,
                error: error instanceof Error ? error.message : String(error),
                currentStep: '分析失敗',
            });
        }
    }

    /**
     * 總結日誌
     */
    async summarize(): Promise<void> {
        this.updateState({
            mode: 'summarizing',
            isAnalyzing: true,
            currentStep: '正在生成日誌摘要...',
        });

        try {
            const result = await this.mcpManager.callTool('log', 'summarize_logs', {
                timeRange: {
                    start: this.state.timeRange.start,
                    end: this.state.timeRange.end,
                },
                query: this.state.query,
                service: this.state.filters.service,
                maxLogs: 500,
            });

            const data = result as any;

            if (data.success) {
                this.updateState({
                    aiAnalysis: {
                        ...this.state.aiAnalysis,
                        summary: {
                            summary: data.summary,
                            keyFindings: data.keyFindings || [],
                            errorCount: data.errorCount || 0,
                            topErrors: data.topErrors || [],
                        },
                    },
                    mode: 'idle',
                    isAnalyzing: false,
                    currentStep: '摘要生成完成',
                });
            } else {
                throw new Error(data.error || 'Summarization failed');
            }
        } catch (error) {
            this.updateState({
                mode: 'error',
                isAnalyzing: false,
                error: error instanceof Error ? error.message : String(error),
                currentStep: '摘要生成失敗',
            });
        }
    }

    /**
     * 自然語言查詢
     */
    async nlQuery(naturalQuery: string): Promise<void> {
        this.updateState({
            mode: 'searching',
            currentStep: '正在解析自然語言查詢...',
        });

        try {
            const result = await this.mcpManager.callTool('log', 'nl_to_es_query', {
                naturalQuery,
                userContext: {
                    defaultService: this.state.filters.service,
                    defaultNamespace: this.state.filters.namespace,
                },
            });

            const data = result as any;

            if (data.success) {
                // 顯示解析結果
                this.updateState({
                    currentStep: `查詢解析: ${data.explanation}`,
                    mode: 'idle',
                });

                // 自動執行搜尋
                await this.search({ query: naturalQuery });
            } else {
                throw new Error(data.error || 'NL query translation failed');
            }
        } catch (error) {
            this.updateState({
                mode: 'error',
                error: error instanceof Error ? error.message : String(error),
                currentStep: '查詢解析失敗',
            });
        }
    }

    /**
     * 更新時間範圍
     */
    updateTimeRange(duration: string): void {
        const durationMap: Record<string, number> = {
            '15m': 15 * 60,
            '1h': 3600,
            '6h': 6 * 3600,
            '24h': 24 * 3600,
            '7d': 7 * 24 * 3600,
        };

        const seconds = durationMap[duration] || 3600;
        const now = Math.floor(Date.now() / 1000);
        const start = now - seconds;

        this.updateState({
            timeRange: {
                start,
                end: now,
                duration,
            },
        });
    }

    /**
     * 更新過濾條件
     */
    updateFilters(filters: Partial<LogExplorerState['filters']>): void {
        this.updateState({
            filters: {
                ...this.state.filters,
                ...filters,
            },
        });
    }
}
