/**
 * Metrics Explorer Workflow - Main Entry
 * 
 * LangGraph 風格的 workflow orchestrator
 */

import {
    type MetricsExplorerState,
    createInitialState,
} from './state.js';

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
            currentStep: '正在探索可用指標...',
        });

        try {
            // Step 1: 探索指標
            const discoverResult = await discoverMetricsNode(this.state, this.mcpManager);
            this.updateState(discoverResult);

            // Step 2: 生成查詢建議
            this.updateState({ currentStep: '正在生成查詢建議...' });
            const hintsResult = await generateHintsNode(this.state, this.mcpManager);
            this.updateState(hintsResult);

            this.updateState({
                isLoading: false,
                mode: 'idle',
                currentStep: '準備就緒，請輸入查詢',
            });
        } catch (error) {
            this.updateState({
                isLoading: false,
                mode: 'error',
                error: error instanceof Error ? error.message : String(error),
                currentStep: '初始化失敗',
            });
        }
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
     * 執行 AI 診斷
     */
    async diagnose(): Promise<void> {
        this.updateState({
            mode: 'diagnosing',
            isLoading: true,
            currentStep: '正在進行 AI 診斷...',
        });

        try {
            const diagnosisResult = await diagnosisNode(this.state, this.mcpManager);
            this.updateState(diagnosisResult);

            this.updateState({ isLoading: false });
        } catch (error) {
            this.updateState({
                isLoading: false,
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
