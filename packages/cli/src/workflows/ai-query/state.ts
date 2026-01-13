/**
 * AI Query Workflow - State Schema
 * 
 * 定義 LangGraph workflow 的狀態結構
 */

/**
 * AI Query Workflow State
 */
export interface WorkflowState {
    userQuery: string;
    intent: string;
    selectedTools: Array<{
        serverId: string;
        toolName: string;
        args: Record<string, unknown>;
        reasoning: string;
    }>;
    results: Array<{
        tool: string;
        success: boolean;
        data: object;
    }>;
    response: string;
    error?: string;
}

/**
 * 建立初始狀態
 */
export function createInitialState(userQuery: string): WorkflowState {
    return {
        userQuery,
        intent: '',
        selectedTools: [],
        results: [],
        response: '',
    };
}
