/**
 * SLO Generator Workflow - State Schema
 * 
 * 定義 LangGraph workflow 的狀態結構
 */

/**
 * SLO 定義介面
 */
export interface SLODefinition {
    id: string;
    name: string;
    description?: string;
    target: number;
    threshold?: number;
    window: string;
    golden_signal: string;
    metric_name?: string;
}

/**
 * SLO Generator Workflow State
 */
export interface SLOWorkflowState {
    // 輸入
    yamlPath?: string;
    yamlContent?: string;
    serviceName?: string;

    // 分析結果
    deploymentAnalysis?: {
        summary: string;
        resources: Array<{ kind: string; name: string; description?: string }>;
        architecture?: string;
        dependencies?: string[];
    };

    // SLO 建議
    suggestedSLOs: SLODefinition[];
    currentSLOs: SLODefinition[];

    // 用戶反饋
    userFeedback?: string;

    // 輸出
    prometheusRules?: string;
    grafanaDashboard?: object;
    outputPath?: string;

    // 控制
    currentStep: 'input' | 'analyze' | 'review' | 'refine' | 'generate' | 'complete';
    needsRefinement: boolean;
    error?: string;
}

/**
 * 建立初始狀態
 */
export function createInitialState(): SLOWorkflowState {
    return {
        suggestedSLOs: [],
        currentSLOs: [],
        currentStep: 'input',
        needsRefinement: false,
    };
}
