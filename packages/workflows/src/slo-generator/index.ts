/**
 * SLO Generator Workflow - Main Entry
 * 
 * LangGraph 風格的 workflow orchestrator
 */

import type { WorkflowConfig } from '../types.js';
import {
    type SLOWorkflowState,
    createInitialState,
} from './state.js';
import {
    inputNode,
    analyzeNode,
    reviewNode,
    refineNode,
    generateNode,
} from './nodes.js';

export interface SLOWorkflowInput {
    yamlPath?: string;
    yamlContent?: string;
    serviceName?: string;
    outputPath?: string;
}

/**
 * SLO Generator Workflow
 * 
 * 專門用於 SLO 自動生成的導引式流程
 */
export class SLOGeneratorWorkflow {
    private config: WorkflowConfig;

    constructor(config: WorkflowConfig) {
        this.config = config;
    }

    /**
     * 執行 Workflow
     */
    async run(input: SLOWorkflowInput): Promise<SLOWorkflowState> {
        let state: SLOWorkflowState = {
            ...createInitialState(),
            ...input,
        };

        const { mcpCaller, llmClient, eventEmitter } = this.config;

        // 步驟執行循環
        while (state.currentStep !== 'complete') {
            eventEmitter.emit({
                type: 'step_change',
                step: state.currentStep,
                data: state
            });

            switch (state.currentStep) {
                case 'input':
                    state = { ...state, ...(await inputNode(state, eventEmitter)) };
                    break;
                case 'analyze':
                    state = { ...state, ...(await analyzeNode(state, mcpCaller, eventEmitter)) };
                    break;
                case 'review':
                    state = { ...state, ...(await reviewNode(state, eventEmitter)) };
                    break;
                case 'refine':
                    if (!llmClient) {
                        eventEmitter.emit({ type: 'error', message: 'LLM client not configured' });
                        state = { ...state, currentStep: 'review' };
                    } else {
                        state = { ...state, ...(await refineNode(state, llmClient, eventEmitter)) };
                    }
                    break;
                case 'generate':
                    state = { ...state, ...(await generateNode(state, mcpCaller, eventEmitter)) };
                    break;
            }

            // 如果有錯誤，跳出
            if (state.error) {
                eventEmitter.emit({ type: 'error', message: state.error });
                break;
            }
        }

        eventEmitter.emit({ type: 'complete', data: state });
        return state;
    }
}

// Re-export types for convenience
export type { SLOWorkflowState, SLODefinition } from './state.js';
export { createInitialState } from './state.js';
