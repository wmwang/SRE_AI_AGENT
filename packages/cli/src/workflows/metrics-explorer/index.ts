/**
 * Metrics Explorer Workflow - Main Entry
 * 
 * LangGraph 風格的 workflow orchestrator
 */

import {
    type MetricsExplorerState,
    createInitialState,
} from './state.js';
import { debugLog } from '../../utils/debug.js';

import {
    discoverMetricsNode,
    generateHintsNode,
    translateNode,
    queryMetricsNode,
    diagnosisNode,
    saveContextNode,
} from './nodes.js';

// 模擬 MCPManager 類型
interface MCPManager {
    callTool(server: string, tool: string, args: any): Promise<any>;
}

/**
 * Metrics Explorer Workflow
 * 
 * 使用 LangGraph 風格管理狀態流轉
 */
export class MetricsExplorerWorkflow {
    private state: MetricsExplorerState;
    private mcpManager: MCPManager;
    private listeners: Set<(state: MetricsExplorerState) => void> = new Set();

    constructor(mcpManager: MCPManager) {
        this.mcpManager = mcpManager;
        this.state = createInitialState();
    }

    /**
     * 取得當前狀態
     */
    getState(): MetricsExplorerState {
        return { ...this.state };
    }

    /**
     * 訂閱狀態變化
     */
    subscribe(listener: (state: MetricsExplorerState) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * 更新狀態並通知訂閱者
     */
    private updateState(partial: Partial<MetricsExplorerState>): void {
        this.state = { ...this.state, ...partial };
        this.listeners.forEach(listener => listener(this.state));
    }

    /**
     * 初始化 workflow（探索指標和生成建議）
     */
    async initialize(): Promise<void> {
        this.updateState({
            mode: 'discovering',
            isLoading: true,
            currentStep: '正在初始化...',
        });

        try {
            // Step 1: 嘗試探索指標（允許失敗）
            try {
                const discoverResult = await discoverMetricsNode(this.state, this.mcpManager);
                this.updateState(discoverResult);
            } catch (e) {
                debugLog('[Metrics Explorer] discover failed:', e);
            }

            // Step 2: 嘗試通過 MCP 生成查詢建議
            try {
                this.updateState({ currentStep: '正在生成查詢建議...' });
                const hintsResult = await generateHintsNode(this.state, this.mcpManager);
                if (hintsResult.metricHints && hintsResult.metricHints.length > 0) {
                    this.updateState(hintsResult);
                } else {
                    // 如果沒有 hints，使用本地 fallback
                    this.updateState({ metricHints: this.getDefaultHints() });
                }
            } catch (e) {
                debugLog('[Metrics Explorer] hints failed, using fallback:', e);
                // 使用本地 fallback hints
                this.updateState({ metricHints: this.getDefaultHints() });
            }

            this.updateState({
                isLoading: false,
                mode: 'idle',
                currentStep: '準備就緒，請輸入查詢',
                error: null,
            });
        } catch (error) {
            debugLog('[Metrics Explorer] init failed:', error);
            // 即使失敗也提供 fallback hints
            this.updateState({
                isLoading: false,
                mode: 'idle',
                metricHints: this.getDefaultHints(),
                error: null,
                currentStep: '準備就緒（離線模式）',
            });
        }
    }

    /**
     * 取得本地 fallback hints（不需要 MCP）
     */
    private getDefaultHints() {
        return [
            {
                category: '🔥 資源使用',
                suggestions: [
                    {
                        text: 'API 的 CPU 使用率',
                        promql: 'rate(container_cpu_usage_seconds_total{namespace="production",pod=~"api-.*"}[5m])',
                        description: '監控服務的 CPU 使用情況',
                    },
                    {
                        text: 'API 的記憶體使用量',
                        promql: 'container_memory_usage_bytes{namespace="production",pod=~"api-.*"}',
                        description: '監控服務的記憶體消耗',
                    },
                ],
            },
            {
                category: '🌐 請求流量',
                suggestions: [
                    {
                        text: '每秒請求數 (QPS)',
                        promql: 'sum(rate(http_requests_total[5m]))',
                        description: '監控整體請求流量',
                    },
                    {
                        text: 'P95 延遲',
                        promql: 'histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))',
                        description: '監控 95% 請求的延遲',
                    },
                ],
            },
            {
                category: '❌ 錯誤監控',
                suggestions: [
                    {
                        text: '5xx 錯誤率',
                        promql: 'sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))',
                        description: '監控錯誤比例',
                    },
                ],
            },
        ];
    }

    /**
     * 執行自然語言查詢
     */
    async query(naturalQuery: string): Promise<void> {
        this.updateState({
            naturalQuery,
            mode: 'translating',
            isLoading: true,
            currentStep: '正在翻譯查詢...',
            error: null,
        });

        try {
            // Step 1: 翻譯自然語言為 PromQL
            const translateResult = await translateNode(this.state, this.mcpManager);
            this.updateState(translateResult);

            // 如果需要澄清，停止等待用戶回應
            if (this.state.needsClarification) {
                this.updateState({ isLoading: false });
                return;
            }

            // Step 2: 查詢指標數據
            this.updateState({ currentStep: '正在查詢數據...' });
            const queryResult = await queryMetricsNode(this.state, this.mcpManager);
            this.updateState(queryResult);

            this.updateState({
                isLoading: false,
                currentStep: '查詢完成',
            });
        } catch (error) {
            this.updateState({
                isLoading: false,
                mode: 'error',
                error: error instanceof Error ? error.message : String(error),
                currentStep: '查詢失敗',
            });
        }
    }

    /**
     * 直接執行 PromQL（用於預設查詢，跳過翻譯）
     */
    async executePromQL(promql: string, explanation: string = ''): Promise<void> {
        this.updateState({
            promql,
            queryExplanation: explanation,
            translationConfidence: 1.0,
            mode: 'querying',
            isLoading: true,
            currentStep: '正在查詢數據...',
            error: null,
        });

        try {
            const queryResult = await queryMetricsNode(this.state, this.mcpManager);
            this.updateState(queryResult);

            this.updateState({
                isLoading: false,
                currentStep: '查詢完成',
            });
        } catch (error) {
            this.updateState({
                isLoading: false,
                mode: 'error',
                error: error instanceof Error ? error.message : String(error),
                currentStep: '查詢失敗',
            });
        }
    }

    /**
     * 確認並執行低信心度查詢
     */
    async confirmQuery(): Promise<void> {
        if (!this.state.promql) return;

        this.updateState({
            needsClarification: false,
            clarificationQuestion: undefined,
            mode: 'querying',
            isLoading: true,
            currentStep: '正在查詢數據...',
        });

        try {
            const queryResult = await queryMetricsNode(this.state, this.mcpManager);
            this.updateState(queryResult);

            this.updateState({
                isLoading: false,
                currentStep: '查詢完成',
            });
        } catch (error) {
            this.updateState({
                isLoading: false,
                mode: 'error',
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /**
     * 刷新當前查詢
     */
    async refresh(): Promise<void> {
        if (!this.state.promql) return;

        this.updateState({
            isLoading: true,
            currentStep: '正在刷新數據...',
        });

        try {
            const queryResult = await queryMetricsNode(this.state, this.mcpManager);
            this.updateState(queryResult);

            this.updateState({
                isLoading: false,
                currentStep: '數據已刷新',
            });
        } catch (error) {
            this.updateState({
                isLoading: false,
                mode: 'error',
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    /**
     * 執行 AI 診斷（使用 isDiagnosing 避免圖表閃爍）
     */
    async diagnose(): Promise<void> {
        this.updateState({
            mode: 'diagnosing',
            isDiagnosing: true,  // 使用 isDiagnosing，不影響圖表
            currentStep: '正在進行 AI 診斷...',
        });

        try {
            const diagnosisResult = await diagnosisNode(this.state, this.mcpManager);
            this.updateState(diagnosisResult);

            this.updateState({ isDiagnosing: false });
        } catch (error) {
            this.updateState({
                isDiagnosing: false,
                mode: 'error',
                error: error instanceof Error ? error.message : String(error),
                currentStep: '診斷失敗',
            });
        }
    }

    /**
     * 更新使用者上下文
     */
    async updateContext(context: Partial<MetricsExplorerState['userContext']>): Promise<void> {
        this.updateState({
            userContext: { ...this.state.userContext, ...context },
        });

        // 背景儲存
        await saveContextNode(this.state, this.mcpManager);
    }

    /**
     * 重置 workflow
     */
    reset(): void {
        const initialState = createInitialState();
        this.updateState({
            ...initialState,
            // 保留用戶上下文
            userContext: this.state.userContext,
            // 保留可用指標
            availableMetrics: this.state.availableMetrics,
            availableLabels: this.state.availableLabels,
            metricHints: this.state.metricHints,
        });
    }
}

// Export types
export type { MetricsExplorerState, WorkflowMode } from './state.js';
export { createInitialState } from './state.js';
