/**
 * SLO Generator Workflow - Nodes
 * 
 * 定義 LangGraph workflow 的各個節點
 * 
 * 這個版本使用抽象介面，不依賴具體的 MCP 或 LLM 實作
 */

import type { MCPToolCaller, LLMClient, WorkflowEventEmitter } from '../types.js';
import type { SLOWorkflowState, SLODefinition } from './state.js';

/**
 * Input Node - 讀取並驗證輸入
 */
export async function inputNode(
    state: SLOWorkflowState,
    emitter: WorkflowEventEmitter
): Promise<Partial<SLOWorkflowState>> {
    emitter.emit({ type: 'progress', message: '📂 讀取 K8s YAML...' });

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
 * Analyze Node - 分析 K8s YAML 並建議 SLO
 */
export async function analyzeNode(
    state: SLOWorkflowState,
    mcpCaller: MCPToolCaller,
    emitter: WorkflowEventEmitter
): Promise<Partial<SLOWorkflowState>> {
    emitter.emit({ type: 'progress', message: '🔍 分析部署配置...' });

    try {
        // 調用 K8s analyze_deployment
        const analysisResult = await mcpCaller.callTool(
            'k8s',
            'analyze_deployment',
            { yaml: state.yamlContent }
        ) as any;

        if (!analysisResult.success) {
            throw new Error(analysisResult.error || '分析失敗');
        }

        emitter.emit({ type: 'progress', message: '💡 生成 SLO 建議...' });

        // 調用 SLO recommend_slos
        const sloResult = await mcpCaller.callTool(
            'slo',
            'recommend_slos',
            {
                serviceType: inferServiceType(analysisResult),
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
            serviceName: state.serviceName || inferServiceName(analysisResult),
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
 * Review Node - 等待用戶審核
 */
export async function reviewNode(
    state: SLOWorkflowState,
    emitter: WorkflowEventEmitter
): Promise<Partial<SLOWorkflowState>> {
    emitter.emit({
        type: 'step_change',
        step: 'review',
        data: state
    });

    // 等待用戶輸入
    if (emitter.requestInput) {
        const feedback = await emitter.requestInput(
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
 * Refine Node - 根據用戶反饋修正 SLO (使用 SSE 串流)
 */
export async function refineNode(
    state: SLOWorkflowState,
    llmClient: LLMClient,
    emitter: WorkflowEventEmitter
): Promise<Partial<SLOWorkflowState>> {
    emitter.emit({ type: 'progress', message: '🔄 AI 正在根據反饋調整 SLO...' });

    const currentSLOsJson = JSON.stringify(state.currentSLOs, null, 2);

    const systemPrompt = `你是一位 SRE 專家。你的任務是根據用戶反饋修改 SLO 建議。
請根據反饋修改 SLO，輸出修改後的 JSON 陣列（格式與輸入相同）。
只輸出 JSON，不要其他說明。`;

    const userPrompt = `目前的 SLO 建議：
${currentSLOsJson}

用戶反饋：${state.userFeedback}`;

    const messages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: userPrompt },
    ];

    try {
        const stream = llmClient.stream(messages);

        let content = '';
        let lastUpdateLength = 0;

        for await (const chunk of stream) {
            const chunkText = typeof chunk.content === 'string' ? chunk.content : '';
            content += chunkText;

            if (content.length - lastUpdateLength >= 100) {
                lastUpdateLength = content.length;
                emitter.emit({ type: 'progress', message: `🔄 AI 生成中... (${content.length} 字符)` });
            }
        }

        if (content.length === 0) {
            emitter.emit({ type: 'progress', message: '⚠️ LLM 回應為空，請重試' });
            return { currentStep: 'review' };
        }

        emitter.emit({ type: 'progress', message: '✅ AI 回應完成，正在解析...' });

        // 解析 JSON
        let jsonStr = content;
        const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/);
        if (jsonMatch) {
            jsonStr = jsonMatch[1] || content;
        }

        let refinedSLOs;
        try {
            refinedSLOs = JSON.parse(jsonStr);
        } catch {
            const arrayMatch = content.match(/\[[\s\S]*\]/);
            if (arrayMatch) {
                refinedSLOs = JSON.parse(arrayMatch[0]);
            } else {
                throw new Error('無法解析 JSON');
            }
        }

        emitter.emit({ type: 'progress', message: '✅ SLO 調整完成' });

        return {
            currentSLOs: refinedSLOs,
            userFeedback: undefined,
            currentStep: 'review',
        };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        emitter.emit({ type: 'progress', message: `⚠️ 調整失敗: ${errorMsg}` });
        return {
            currentStep: 'review',
        };
    }
}

/**
 * Generate Node - 生成 Prometheus 和 Grafana 配置
 */
export async function generateNode(
    state: SLOWorkflowState,
    mcpCaller: MCPToolCaller,
    emitter: WorkflowEventEmitter
): Promise<Partial<SLOWorkflowState>> {
    emitter.emit({ type: 'progress', message: '📊 生成 Prometheus Rules...' });

    try {
        const promResult = await mcpCaller.callTool(
            'slo',
            'generate_prometheus_rules',
            {
                slos: state.currentSLOs,
                serviceName: state.serviceName || 'default-service',
                namespace: 'default',
            }
        ) as any;

        emitter.emit({ type: 'progress', message: '📈 生成 Grafana Dashboard...' });

        const grafanaResult = await mcpCaller.callTool(
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

// ==================== Helper Functions ====================

export function inferServiceType(analysis: any): string {
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

export function inferServiceName(analysis: any): string {
    const resources = analysis.resources || [];
    const deployment = resources.find((r: any) => r.kind === 'Deployment');
    return deployment?.name || 'default-service';
}
