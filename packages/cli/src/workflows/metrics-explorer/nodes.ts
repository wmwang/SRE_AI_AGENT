/**
 * Metrics Explorer Workflow - Nodes
 * 
 * 定義 LangGraph workflow 的各個節點
 */

import type { MetricsExplorerState, MetricsSeries } from './state.js';
import { debugLog } from '../../utils/debug.js';

// 模擬 MCPManager 類型（實際會從 cli 匯入）
interface MCPManager {
    callTool(server: string, tool: string, args: any): Promise<any>;
}

/**
 * Discover Metrics Node
 * 
 * 探索可用的指標和 labels
 */
export async function discoverMetricsNode(
    _state: MetricsExplorerState,
    mcpManager: MCPManager
): Promise<Partial<MetricsExplorerState>> {
    try {
        // 使用 discover_metrics 取得指標列表
        const metricsResult = await mcpManager.callTool('metrics', 'discover_metrics', {
            limit: 200
        });

        // 使用 discover_labels 取得 labels
        const labelsResult = await mcpManager.callTool('metrics', 'discover_labels', {});

        // 解析 metrics - 支援兩種格式：
        // 1. MCP 格式: { content: [{ text: '{"metrics": [...]}' }] }
        // 2. 直接返回: { success: true, metrics: [...] }
        let availableMetrics: string[] = [];
        if (metricsResult.content?.[0]?.text) {
            const parsed = JSON.parse(metricsResult.content[0].text);
            availableMetrics = parsed.metrics || [];
        } else if (metricsResult.metrics) {
            availableMetrics = metricsResult.metrics;
        }

        debugLog('[Metrics Explorer] Discovered metrics count:', availableMetrics.length);

        // 解析 labels - 同樣支援兩種格式
        let labelsData: any = {};
        if (labelsResult.content?.[0]?.text) {
            labelsData = JSON.parse(labelsResult.content[0].text);
        } else if (labelsResult.commonLabels || labelsResult.allLabels) {
            labelsData = labelsResult;
        }

        return {
            availableMetrics,
            availableLabels: labelsData.commonLabels || {},
            currentStep: `已探索 ${availableMetrics.length} 個指標`,
            mode: 'idle',
        };
    } catch (error) {
        return {
            error: error instanceof Error ? error.message : String(error),
            mode: 'error',
            currentStep: '探索指標時發生錯誤',
        };
    }
}

/**
 * Generate Hints Node
 * 
 * 基於 context 生成查詢建議
 */
export async function generateHintsNode(
    state: MetricsExplorerState,
    mcpManager: MCPManager
): Promise<Partial<MetricsExplorerState>> {
    try {
        const result = await mcpManager.callTool('metrics', 'suggest_query_hints', {
            availableMetrics: state.availableMetrics.slice(0, 50),
            userContext: state.userContext,
        });

        const data = result.content?.[0]?.text
            ? JSON.parse(result.content[0].text)
            : {};

        return {
            metricHints: data.hints || [],
            currentStep: '已生成查詢建議',
        };
    } catch (error) {
        return {
            error: error instanceof Error ? error.message : String(error),
            currentStep: '生成建議時發生錯誤',
        };
    }
}

/**
 * Translate NL to PromQL Node
 * 
 * 將自然語言查詢轉換為 PromQL
 */
export async function translateNode(
    state: MetricsExplorerState,
    mcpManager: MCPManager
): Promise<Partial<MetricsExplorerState>> {
    if (!state.naturalQuery.trim()) {
        return {
            error: '請輸入查詢內容',
            mode: 'idle',
        };
    }

    try {
        const result = await mcpManager.callTool('metrics', 'translate_nl_to_promql', {
            naturalQuery: state.naturalQuery,
            availableMetrics: state.availableMetrics.slice(0, 50),
            userContext: {
                defaultNamespace: state.userContext.namespace,
                defaultService: state.userContext.service,
                labelPreferences: state.userContext.labelPreferences,
            },
        });

        const data = result.content?.[0]?.text
            ? JSON.parse(result.content[0].text)
            : {};

        if (!data.success) {
            return {
                error: data.error || '翻譯失敗',
                mode: 'error',
                currentStep: '翻譯查詢時發生錯誤',
            };
        }

        const needsClarification = data.confidence < 0.7;

        return {
            promql: data.promql || '',
            queryExplanation: data.explanation || '',
            translationConfidence: data.confidence || 0,
            timeRange: {
                ...state.timeRange,
                duration: data.timeRange?.duration || '1h',
            },
            needsClarification,
            clarificationQuestion: needsClarification
                ? `信心度較低 (${(data.confidence * 100).toFixed(0)}%)，請確認或修改查詢`
                : undefined,
            currentStep: needsClarification ? '需要確認查詢' : '已翻譯查詢',
            mode: needsClarification ? 'idle' : 'querying',
        };
    } catch (error) {
        return {
            error: error instanceof Error ? error.message : String(error),
            mode: 'error',
            currentStep: '翻譯查詢時發生錯誤',
        };
    }
}

/**
 * Query Metrics Node
 * 
 * 查詢指標數據
 */
export async function queryMetricsNode(
    state: MetricsExplorerState,
    mcpManager: MCPManager
): Promise<Partial<MetricsExplorerState>> {
    if (!state.promql) {
        return {
            error: '沒有有效的 PromQL',
            mode: 'error',
        };
    }

    try {
        // 計算時間範圍
        const end = Math.floor(Date.now() / 1000);
        const start = end - parseDuration(state.timeRange.duration);

        debugLog('[Metrics Explorer] Querying:', state.promql, { start, end });

        const result = await mcpManager.callTool('metrics', 'query_metrics_range', {
            promql: state.promql,
            start,
            end,
            step: '60s',
        });

        debugLog('[Metrics Explorer] MCP Result:', JSON.stringify(result).slice(0, 500));

        // 處理兩種可能的回應格式：
        // 1. 直接返回數據: { success: true, results: [...] }
        // 2. MCP 格式: { content: [{ text: '{"success": true, ...}' }] }
        let data: any;
        if (result.content?.[0]?.text) {
            data = JSON.parse(result.content[0].text);
        } else if (result.success !== undefined) {
            // 直接返回的數據
            data = result;
        } else {
            data = {};
        }

        debugLog('[Metrics Explorer] Parsed data:', JSON.stringify(data).slice(0, 500));

        // 允許 success 為 true 或者有 results
        if (data.success === false) {
            return {
                error: data.error || '查詢失敗',
                mode: 'error',
                currentStep: '查詢數據時發生錯誤',
            };
        }

        // 轉換數據格式
        const metricsData: MetricsSeries[] = (data.results || []).map((r: any) => ({
            timestamps: (r.values || []).map((v: any[]) => v[0]),
            values: (r.values || []).map((v: any[]) => parseFloat(v[1] || '0')),
            labels: r.metric || {},
        }));

        return {
            metricsData,
            timeRange: { start, end, duration: state.timeRange.duration },
            currentStep: `已取得 ${metricsData.length} 個時間序列`,
            mode: 'rendering',
            error: null,
        };
    } catch (error) {
        debugLog('[Metrics Explorer] Query error:', error);
        return {
            error: error instanceof Error ? error.message : String(error),
            mode: 'error',
            currentStep: '查詢數據時發生錯誤',
        };
    }
}

/**
 * AI Diagnosis Node
 * 
 * 使用 AI 分析指標健康度
 */
export async function diagnosisNode(
    state: MetricsExplorerState,
    mcpManager: MCPManager
): Promise<Partial<MetricsExplorerState>> {
    if (!state.promql || !state.timeRange.start || !state.timeRange.end) {
        return {
            error: '需要先查詢數據才能進行診斷',
            mode: 'error',
        };
    }

    try {
        debugLog('[Metrics Explorer] Diagnosing:', state.promql);

        const result = await mcpManager.callTool('metrics', 'analyze_metrics_health', {
            promql: state.promql,
            timeRange: {
                start: state.timeRange.start,
                end: state.timeRange.end,
            },
        });

        debugLog('[Metrics Explorer] Diagnosis Result:', JSON.stringify(result).slice(0, 500));

        // 處理兩種格式
        let data: any;
        if (result.content?.[0]?.text) {
            data = JSON.parse(result.content[0].text);
        } else if (result.success !== undefined) {
            data = result;
        } else {
            data = {};
        }

        debugLog('[Metrics Explorer] Diagnosis Data:', JSON.stringify(data).slice(0, 500));

        if (data.success === false) {
            return {
                error: data.error || '診斷失敗',
                mode: 'error',
                currentStep: '診斷時發生錯誤',
            };
        }

        // 合併 analysis 和 recommendations
        const diagnosis = {
            summary: data.analysis?.summary || '無分析結果',
            findings: data.analysis?.findings || [],
            trend: data.analysis?.trend,
            recommendations: data.recommendations || [],
        };

        return {
            healthStatus: data.health || 'unknown',
            diagnosis,
            currentStep: `診斷完成：${data.health?.toUpperCase() || 'UNKNOWN'}`,
            mode: 'diagnosing',
            error: null,
        };
    } catch (error) {
        debugLog('[Metrics Explorer] Diagnosis error:', error);
        return {
            error: error instanceof Error ? error.message : String(error),
            mode: 'error',
            currentStep: '診斷時發生錯誤',
        };
    }
}

/**
 * Save Context Node
 * 
 * 儲存使用者上下文
 */
export async function saveContextNode(
    state: MetricsExplorerState,
    mcpManager: MCPManager
): Promise<Partial<MetricsExplorerState>> {
    try {
        await mcpManager.callTool('metrics', 'save_user_context', {
            context: {
                defaultNamespace: state.userContext.namespace,
                defaultService: state.userContext.service,
                labelPreferences: state.userContext.labelPreferences,
                favoriteQueries: state.userContext.favoriteQueries,
            },
        });

        return {
            userContext: {
                ...state.userContext,
                isOnboarded: true,
            },
            currentStep: '已儲存使用者設定',
        };
    } catch (error) {
        // 儲存失敗不影響主流程
        console.error('Failed to save context:', error);
        return {};
    }
}

/**
 * 輔助函數：解析時間長度字串
 */
function parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) {
        return 3600; // 預設 1 小時
    }

    const value = parseInt(match[1] || '1');
    const unit = match[2];

    switch (unit) {
        case 's': return value;
        case 'm': return value * 60;
        case 'h': return value * 3600;
        case 'd': return value * 86400;
        default: return 3600;
    }
}
