/**
 * Shared Workflow Types
 * 
 * 定義通用的 workflow 類型和事件介面
 */

/**
 * MCP Tool Caller Interface
 * 
 * 抽象化的 MCP 呼叫介面，讓 workflow 不依賴具體的 MCP 實作
 */
export interface MCPToolCaller {
    callTool(serverName: string, toolName: string, args: Record<string, unknown>): Promise<unknown>;
}

/**
 * LLM Interface
 * 
 * 抽象化的 LLM 介面，支援串流
 */
export interface LLMClient {
    stream(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>): AsyncIterable<{ content: string }>;
}

/**
 * Workflow Event Types
 * 
 * 用於通知進度的事件類型
 */
export type WorkflowEventType =
    | 'step_change'
    | 'progress'
    | 'waiting_for_input'
    | 'error'
    | 'complete';

export interface WorkflowEvent {
    type: WorkflowEventType;
    step?: string;
    message?: string;
    data?: unknown;
}

/**
 * Workflow Event Emitter Interface
 * 
 * 用於發送事件的介面，可被 CLI/API 各自實作
 */
export interface WorkflowEventEmitter {
    emit(event: WorkflowEvent): void;
    requestInput?(prompt: string): Promise<string>;
}

/**
 * Base Workflow Configuration
 */
export interface WorkflowConfig {
    mcpCaller: MCPToolCaller;
    llmClient?: LLMClient;
    eventEmitter: WorkflowEventEmitter;
}
