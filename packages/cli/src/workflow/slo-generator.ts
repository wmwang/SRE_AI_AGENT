import { ChatOpenAI } from '@langchain/openai';
import type { MCPClientManager } from '../mcp/manager.js';
import { getConfig } from '../config.js';

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
 * Workflow 事件回調
 */
export interface WorkflowCallbacks {
    onStepChange?: (step: SLOWorkflowState['currentStep'], state: SLOWorkflowState) => void;
    onWaitingForInput?: (message: string) => Promise<string>;
    onProgress?: (message: string) => void;
}

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
        });
    }

    /**
     * 初始化 State
     */
    private createInitialState(): SLOWorkflowState {
        return {
            suggestedSLOs: [],
            currentSLOs: [],
            currentStep: 'input',
            needsRefinement: false,
        };
    }

    /**
     * Step 1: Input Node - 讀取並驗證輸入
     */
    private async inputNode(state: SLOWorkflowState): Promise<Partial<SLOWorkflowState>> {
        this.callbacks.onProgress?.('📂 讀取 K8s YAML...');

        let yamlContent = state.yamlContent;

        // 如果提供路徑，讀取檔案
        if (state.yamlPath && !yamlContent) {
            try {
                const fs = await import('fs');
                yamlContent = fs.readFileSync(state.yamlPath, 'utf-8');
            } catch (error) {
                return {
                    error: `無法讀取檔案: ${state.yamlPath}`,
                    currentStep: 'complete',
                };
            }
        }

        if (!yamlContent) {
            return {
                error: '請提供 YAML 內容或路徑',
                currentStep: 'complete',
            };
        }

        return { yamlContent, currentStep: 'analyze' };
    }

    /**
     * Step 2: Analyze Node - 分析 K8s YAML 並建議 SLO
     */
    private async analyzeNode(state: SLOWorkflowState): Promise<Partial<SLOWorkflowState>> {
        this.callbacks.onProgress?.('🔍 分析部署配置...');

        try {
            // 調用 K8s analyze_deployment
            const analysisResult = await this.mcpManager.callTool(
                'k8s',
                'analyze_deployment',
                { yaml: state.yamlContent }
            ) as any;

            if (!analysisResult.success) {
                throw new Error(analysisResult.error || '分析失敗');
            }

            this.callbacks.onProgress?.('💡 生成 SLO 建議...');

            // 調用 SLO recommend_slos
            const sloResult = await this.mcpManager.callTool(
                'slo',
                'recommend_slos',
                {
                    serviceType: this.inferServiceType(analysisResult),
                    description: analysisResult.summary || '',
                }
            ) as any;

            const suggestedSLOs: SLODefinition[] = (sloResult.recommendations || []).map((r: any) => ({
                id: r.id,
                name: r.name,
                description: r.description_zh || r.description,
                target: r.target,
                threshold: r.threshold,
                window: r.window,
                golden_signal: r.golden_signal,
            }));

            return {
                deploymentAnalysis: {
                    summary: analysisResult.summary,
                    resources: analysisResult.resources || [],
                    architecture: analysisResult.architecture,
                    dependencies: analysisResult.dependencies,
                },
                suggestedSLOs,
                currentSLOs: suggestedSLOs,
                serviceName: state.serviceName || this.inferServiceName(analysisResult),
                currentStep: 'review',
            };
        } catch (error) {
            return {
                error: `分析失敗: ${error instanceof Error ? error.message : String(error)}`,
                currentStep: 'complete',
            };
        }
    }

    /**
     * Step 3: Review Node - 等待用戶審核
     */
    private async reviewNode(state: SLOWorkflowState): Promise<Partial<SLOWorkflowState>> {
        this.callbacks.onStepChange?.('review', state);

        // 等待用戶輸入
        if (this.callbacks.onWaitingForInput) {
            const feedback = await this.callbacks.onWaitingForInput(
                '請審核以上 SLO 建議。輸入修改意見，或輸入 "確認" 繼續：'
            );

            if (feedback.toLowerCase() === '確認' || feedback.toLowerCase() === 'confirm' || feedback === '') {
                return {
                    needsRefinement: false,
                    currentStep: 'generate',
                };
            } else {
                return {
                    userFeedback: feedback,
                    needsRefinement: true,
                    currentStep: 'refine',
                };
            }
        }

        // 預設直接進入生成步驟
        return { currentStep: 'generate' };
    }

    /**
     * Step 4: Refine Node - 根據用戶反饋修正 SLO
     */
    private async refineNode(state: SLOWorkflowState): Promise<Partial<SLOWorkflowState>> {
        this.callbacks.onProgress?.('🔄 根據反饋調整 SLO...');

        const currentSLOsJson = JSON.stringify(state.currentSLOs, null, 2);

        const prompt = `你是一位 SRE 專家。根據用戶的反饋修改 SLO 建議。

目前的 SLO 建議：
${currentSLOsJson}

用戶反饋：${state.userFeedback}

請根據反饋修改 SLO，輸出修改後的 JSON 陣列（格式與輸入相同）。
只輸出 JSON，不要其他說明。`;

        try {
            const response = await this.llm.invoke(prompt);
            const content = response.content.toString();

            // 解析 JSON
            let jsonStr = content;
            const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/);
            if (jsonMatch) {
                jsonStr = jsonMatch[1] || content;
            }

            const refinedSLOs = JSON.parse(jsonStr);

            return {
                currentSLOs: refinedSLOs,
                userFeedback: undefined,
                currentStep: 'review', // 回到審核步驟
            };
        } catch (error) {
            this.callbacks.onProgress?.('⚠️ 無法解析修改，保留原有設定');
            return {
                currentStep: 'review',
            };
        }
    }

    /**
     * Step 5: Generate Node - 生成 Prometheus 和 Grafana 配置
     */
    private async generateNode(state: SLOWorkflowState): Promise<Partial<SLOWorkflowState>> {
        this.callbacks.onProgress?.('📊 生成 Prometheus Rules...');

        try {
            // 生成 Prometheus Rules
            const promResult = await this.mcpManager.callTool(
                'slo',
                'generate_prometheus_rules',
                {
                    slos: state.currentSLOs,
                    serviceName: state.serviceName || 'default-service',
                    namespace: 'default',
                }
            ) as any;

            this.callbacks.onProgress?.('📈 生成 Grafana Dashboard...');

            // 生成 Grafana Dashboard
            const grafanaResult = await this.mcpManager.callTool(
                'slo',
                'generate_grafana_dashboard',
                {
                    slos: state.currentSLOs,
                    serviceName: state.serviceName || 'default-service',
                    dashboardTitle: `${state.serviceName || 'Service'} SLO Dashboard`,
                    outputPath: state.outputPath,
                }
            ) as any;

            return {
                prometheusRules: promResult.rulesYaml,
                grafanaDashboard: grafanaResult.dashboard,
                currentStep: 'complete',
            };
        } catch (error) {
            return {
                error: `生成配置失敗: ${error instanceof Error ? error.message : String(error)}`,
                currentStep: 'complete',
            };
        }
    }

    /**
     * 推斷服務類型
     */
    private inferServiceType(analysis: any): string {
        const resources = analysis.resources || [];
        const kinds = resources.map((r: any) => r.kind?.toLowerCase());

        if (kinds.includes('statefulset') || kinds.some((k: string) => k?.includes('database'))) {
            return 'database';
        }
        if (kinds.includes('ingress')) {
            return 'web';
        }
        return 'api';
    }

    /**
     * 推斷服務名稱
     */
    private inferServiceName(analysis: any): string {
        const resources = analysis.resources || [];
        const deployment = resources.find((r: any) => r.kind === 'Deployment');
        return deployment?.name || 'default-service';
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
            ...this.createInitialState(),
            ...input,
        };

        // 步驟執行循環
        while (state.currentStep !== 'complete') {
            this.callbacks.onStepChange?.(state.currentStep, state);

            switch (state.currentStep) {
                case 'input':
                    state = { ...state, ...(await this.inputNode(state)) };
                    break;
                case 'analyze':
                    state = { ...state, ...(await this.analyzeNode(state)) };
                    break;
                case 'review':
                    state = { ...state, ...(await this.reviewNode(state)) };
                    break;
                case 'refine':
                    state = { ...state, ...(await this.refineNode(state)) };
                    break;
                case 'generate':
                    state = { ...state, ...(await this.generateNode(state)) };
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
