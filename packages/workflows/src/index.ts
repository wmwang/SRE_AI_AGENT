/**
 * @sre-agent/workflows
 * 
 * 共用的 LangGraph 風格 workflow 模組
 */

// Core Types
export type {
    MCPToolCaller,
    LLMClient,
    WorkflowEventType,
    WorkflowEvent,
    WorkflowEventEmitter,
    WorkflowConfig,
} from './types.js';

// SLO Generator Workflow
export {
    SLOGeneratorWorkflow,
    createInitialState as createSLOInitialState,
} from './slo-generator/index.js';

export type {
    SLOWorkflowState,
    SLODefinition,
    SLOWorkflowInput,
} from './slo-generator/index.js';
