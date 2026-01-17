/**
 * SLO Generator Workflow - CLI Adapter
 * 
 * 將共用的 @sre-agent/workflows 適配到 CLI 的 Ink UI
 */

import { ChatOpenAI } from '@langchain/openai';
import type { MCPClientManager } from '../../mcp/manager.js';
import { getConfig } from '../../config.js';
import {
    SLOGeneratorWorkflow as SharedSLOWorkflow,
    type SLOWorkflowState,
    type WorkflowEventEmitter,
    type LLMClient,
    type MCPToolCaller,
} from '@sre-agent/workflows';

/**
 * CLI 專用的 Workflow Callbacks (舊介面，保持向後兼容)
 */
export interface WorkflowCallbacks {
    onStepChange?: (step: SLOWorkflowState['currentStep'], state: SLOWorkflowState) => void;
    onWaitingForInput?: (message: string) => Promise<string>;
    onProgress?: (message: string) => void;
}

/**
 * SLO Generator Workflow (CLI 版本)
 * 
 * 這個 class 封裝共用的 workflow，並提供 CLI 專用的介面
 */
export class SLOGeneratorWorkflow {
    private workflow: SharedSLOWorkflow;
    private callbacks: WorkflowCallbacks;

    constructor(mcpManager: MCPClientManager, callbacks: WorkflowCallbacks = {}) {
        const config = getConfig();
        this.callbacks = callbacks;

        // 建立 MCP Caller 適配器
        const mcpCaller: MCPToolCaller = {
            callTool: async (serverName: string, toolName: string, args: Record<string, unknown>) => {
                return mcpManager.callTool(serverName, toolName, args);
            }
        };

        // 建立 LLM Client 適配器
        const llm = new ChatOpenAI({
            apiKey: config.openai.apiKey,
            configuration: {
                baseURL: config.openai.baseURL,
            },
            model: config.openai.model,
            temperature: 0,
            streaming: true,
        });

        const llmClient: LLMClient = {
            async *stream(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>) {
                const response = await llm.stream(messages);
                for await (const chunk of response) {
                    yield { content: typeof chunk.content === 'string' ? chunk.content : '' };
                }
            }
        };

        // 建立 Event Emitter 適配器 (將新介面映射回舊 callbacks)
        const eventEmitter: WorkflowEventEmitter = {
            emit: (event: { type: string; step?: string; message?: string; data?: unknown }) => {
                switch (event.type) {
                    case 'step_change':
                        this.callbacks.onStepChange?.(event.step as any, event.data as SLOWorkflowState);
                        break;
                    case 'progress':
                        this.callbacks.onProgress?.(event.message || '');
                        break;
                    case 'error':
                        this.callbacks.onProgress?.(`❌ ${event.message}`);
                        break;
                    case 'complete':
                        this.callbacks.onStepChange?.('complete', event.data as SLOWorkflowState);
                        break;
                }
            },
            requestInput: callbacks.onWaitingForInput,
        };

        // 建立共用 workflow
        this.workflow = new SharedSLOWorkflow({
            mcpCaller,
            llmClient,
            eventEmitter,
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
        return this.workflow.run(input);
    }
}

// Re-export types for convenience
export type { SLOWorkflowState, SLODefinition } from '@sre-agent/workflows';
export { createSLOInitialState as createInitialState } from '@sre-agent/workflows';
