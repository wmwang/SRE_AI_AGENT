/**
 * API Service - 與 API Gateway 通訊的服務層
 */

const API_BASE = '/api';

/**
 * 通用 API 呼叫函式
 */
async function apiCall<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: {
            'Content-Type': 'application/json',
        },
        ...options,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `API Error: ${response.status}`);
    }

    return response.json();
}

// ============================================
// SLO Workflow API
// ============================================

export interface SLO {
    name: string;
    target: string;
    signal: string;
    description?: string;
}

export interface AnalyzeResult {
    success: boolean;
    result: {
        serviceName: string;
        serviceType: string;
        slos: SLO[];
    };
}

export interface RefineResult {
    success: boolean;
    result: {
        slos: SLO[];
        message?: string;
    };
}

export interface GenerateResult {
    success: boolean;
    result: {
        prometheusRules: string;
        grafanaDashboard: string;
    };
}

/**
 * 分析 K8s YAML 並生成初始 SLO 建議
 */
export async function analyzeSLO(yamlContent: string): Promise<AnalyzeResult> {
    return apiCall<AnalyzeResult>('/slo/analyze', {
        method: 'POST',
        body: JSON.stringify({ yamlContent }),
    });
}

/**
 * AI 協助調整 SLO
 */
export async function refineSLO(
    currentSlos: SLO[],
    feedback: string,
    serviceName: string
): Promise<RefineResult> {
    return apiCall<RefineResult>('/slo/refine', {
        method: 'POST',
        body: JSON.stringify({ currentSlos, feedback, serviceName }),
    });
}

/**
 * 生成 Prometheus Rules 和 Grafana Dashboard
 */
export async function generateSLOConfigs(
    slos: SLO[],
    serviceName: string
): Promise<GenerateResult> {
    return apiCall<GenerateResult>('/slo/generate', {
        method: 'POST',
        body: JSON.stringify({ slos, serviceName }),
    });
}

// ============================================
// SLO Workflow SSE (Agent Mode)
// ============================================

export interface WorkflowEvent {
    type: 'step_change' | 'progress' | 'error' | 'complete' | 'result';
    step?: string;
    message?: string;
    data?: unknown;
}

export interface SLOWorkflowResult {
    slos: SLO[];
    prometheusRules?: string;
    grafanaDashboard?: object;
    error?: string;
}

/**
 * 串流式執行 SLO Workflow (Agent Mode)
 * 
 * 透過 SSE 即時接收 workflow 進度並回傳結果
 */
export async function runSLOWorkflowSSE(
    yamlContent: string,
    serviceName: string,
    onEvent: (event: WorkflowEvent) => void
): Promise<SLOWorkflowResult> {
    const response = await fetch(`${API_BASE}/workflow/slo`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ yamlContent, serviceName }),
    });

    if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let result: SLOWorkflowResult = { slos: [] };

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                try {
                    const event = JSON.parse(line.slice(6)) as WorkflowEvent;
                    onEvent(event);

                    // 收集最終結果
                    if (event.type === 'result' && event.data) {
                        result = event.data as SLOWorkflowResult;
                    }
                } catch (e) {
                    console.warn('[SSE] Failed to parse event:', line);
                }
            }
        }
    }

    return result;
}

// ============================================
// Metrics Explorer API
// ============================================

export interface QueryResult {
    success: boolean;
    result: {
        promql: string;
        explanation: string;
        data?: unknown;
    };
}

export interface DiagnoseResult {
    success: boolean;
    result: {
        summary: string;
        status: 'healthy' | 'warning' | 'critical';
        recommendations: string[];
    };
}

/**
 * 自然語言轉 PromQL
 */
export async function queryMetrics(query: string): Promise<QueryResult> {
    return apiCall<QueryResult>('/metrics/query', {
        method: 'POST',
        body: JSON.stringify({ query }),
    });
}

/**
 * AI 診斷分析
 */
export async function diagnoseMetrics(
    metricsData: unknown,
    context?: string
): Promise<DiagnoseResult> {
    return apiCall<DiagnoseResult>('/metrics/diagnose', {
        method: 'POST',
        body: JSON.stringify({ metricsData, context }),
    });
}

// ============================================
// Health Check
// ============================================

export interface HealthResult {
    status: string;
    mcp: string;
}

export async function checkHealth(): Promise<HealthResult> {
    return apiCall<HealthResult>('/health'.replace('/api', ''));
}
