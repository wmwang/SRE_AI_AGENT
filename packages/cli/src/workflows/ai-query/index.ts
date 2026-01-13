/**
 * AI Query Workflow - Main Entry
 * 
 * LangGraph 風格的 workflow orchestrator
 */

import { ChatOpenAI } from '@langchain/openai';
import type { MCPClientManager, MCPToolInfo } from '../../mcp/manager.js';
import { getConfig } from '../../config.js';
import { type WorkflowState, createInitialState } from './state.js';
import {
    analyzeNode,
    planNode,
    executeNode,
    synthesizeNode,
} from './nodes.js';

/**
 * SRE Agent Workflow
 * 
 * 簡化實作：順序執行各個步驟
 */
export class SREAgentWorkflow {
    private llm: ChatOpenAI;
    private mcpManager: MCPClientManager;
    private availableTools: MCPToolInfo[];

    constructor(mcpManager: MCPClientManager) {
        const config = getConfig();
        this.mcpManager = mcpManager;
        this.availableTools = mcpManager.listAllTools();

        this.llm = new ChatOpenAI({
            apiKey: config.openai.apiKey,
            configuration: {
                baseURL: config.openai.baseURL,
            },
            model: config.openai.model,
            temperature: 0,
        });
    }

    /**
     * 執行查詢（順序執行各步驟）
     */
    async run(userQuery: string): Promise<WorkflowState> {
        let state: WorkflowState = createInitialState(userQuery);

        try {
            // Step 1: Analyze
            const analyzeUpdate = await analyzeNode(state, this.llm, this.availableTools);
            state = { ...state, ...analyzeUpdate };

            // Step 2: Plan
            const planUpdate = await planNode(state, this.llm, this.availableTools);
            state = { ...state, ...planUpdate };

            // Step 3: Execute
            const executeUpdate = await executeNode(state, this.mcpManager);
            state = { ...state, ...executeUpdate };

            // Step 4: Synthesize
            const synthesizeUpdate = await synthesizeNode(state, this.llm);
            state = { ...state, ...synthesizeUpdate };

            return state;
        } catch (error) {
            return {
                ...state,
                error: error instanceof Error ? error.message : String(error),
                response: '抱歉，處理您的查詢時發生錯誤。',
            };
        }
    }
}

// Re-export types for convenience
export type { WorkflowState } from './state.js';
export { createInitialState } from './state.js';
