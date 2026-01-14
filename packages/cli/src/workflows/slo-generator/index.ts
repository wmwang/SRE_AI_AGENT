/**
 * SLO Generator Workflow - Main Entry
 * 
 * LangGraph 風格的 workflow orchestrator
 */

import { ChatOpenAI } from '@langchain/openai';
import type { MCPClientManager } from '../../mcp/manager.js';
import { getConfig } from '../../config.js';
import {
    type SLOWorkflowState,
    type WorkflowCallbacks,
    createInitialState,
} from './state.js';
import {
    inputNode,
    analyzeNode,
    reviewNode,
    refineNode,
    generateNode,
} from './nodes.js';

/**
 * SLO Generator Workflow
 * 
 * 專門用於 SLO 自動生成的導引式流程
 */
export class SLOGeneratorWorkflow {
    private llm: ChatOpenAI;
    private mcpManager: MCPClientManager;
    private callbacks: WorkflowCallbacks;

    constructor(mcpManager: MCPClientManager, callbacks: WorkflowCallbacks = {}) {
        const config = getConfig();
        this.mcpManager = mcpManager;
        this.callbacks = callbacks;

        this.llm = new ChatOpenAI({
            apiKey: config.openai.apiKey,
            configuration: {
                baseURL: config.openai.baseURL,
            },
            model: config.openai.model,
            temperature: 0,
            streaming: true,  // 使用 SSE 串流模式
        });
    }

    /**
     * 執行 Workflow
     */
    async run(input: {
        yamlPath?: string;
        yamlContent?: string;
        serviceName?: string;
        outputPath?: string;
    }): Promise<SLOWorkflowState> {
        let state: SLOWorkflowState = {
            ...createInitialState(),
            ...input,
        };

        // 步驟執行循環
        while (state.currentStep !== 'complete') {
            this.callbacks.onStepChange?.(state.currentStep, state);

            switch (state.currentStep) {
                case 'input':
                    state = { ...state, ...(await inputNode(state, this.callbacks)) };
                    break;
                case 'analyze':
                    state = { ...state, ...(await analyzeNode(state, this.mcpManager, this.callbacks)) };
                    break;
                case 'review':
                    state = { ...state, ...(await reviewNode(state, this.callbacks)) };
                    break;
                case 'refine':
                    state = { ...state, ...(await refineNode(state, this.llm, this.callbacks)) };
                    break;
                case 'generate':
                    state = { ...state, ...(await generateNode(state, this.mcpManager, this.callbacks)) };
                    break;
            }

            // 如果有錯誤，跳出
            if (state.error) {
                break;
            }
        }

        this.callbacks.onStepChange?.('complete', state);
        return state;
    }
}

// Re-export types for convenience
export type { SLOWorkflowState, SLODefinition, WorkflowCallbacks } from './state.js';
export { createInitialState } from './state.js';
