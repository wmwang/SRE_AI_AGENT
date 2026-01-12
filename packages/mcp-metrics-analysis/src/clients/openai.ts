import OpenAI from 'openai';
import { getConfig } from '../config.js';
import { llmLogger } from '../utils/llm-logger.js';

/**
 * OpenAI Client for Metrics Analysis
 * 
 * 提供 LLM 功能支援：
 * - 自然語言轉 PromQL
 * - 查詢建議生成
 * - 指標健康診斷
 */
export class OpenAIClient {
    private client: OpenAI;
    private model: string;

    constructor() {
        const config = getConfig();

        if (!config.openai?.apiKey) {
            throw new Error('OpenAI API key is not configured');
        }

        this.client = new OpenAI({
            apiKey: config.openai.apiKey,
            baseURL: config.openai.baseURL,
        });

        this.model = config.openai.model || 'gpt-4o-mini';
    }

    /**
     * 將自然語言查詢轉換為 PromQL
     */
    async translateNLToPromQL(input: {
        naturalQuery: string;
        availableMetrics?: string[];
        userContext?: {
            defaultNamespace?: string;
            defaultService?: string;
            labelPreferences?: Record<string, string>;
        };
    }): Promise<{
        promql: string;
        explanation: string;
        confidence: number;
        timeRange?: { duration: string; start?: number; end?: number };
    }> {
        // 建構 System Prompt
        const systemPrompt = this.buildTranslationSystemPrompt(input.availableMetrics, input.userContext);

        // Few-shot Examples
        const examples = this.getFewShotExamples();

        // 建構完整的 messages
        const messages: OpenAI.ChatCompletionMessageParam[] = [
            { role: 'system', content: systemPrompt },
            ...examples,
            { role: 'user', content: input.naturalQuery },
        ];

        try {
            // Log the complete prompt
            llmLogger.log('nl-to-promql', {
                prompt: `[System Prompt]\n${systemPrompt}\n\n[Examples]\n${JSON.stringify(examples, null, 2)}\n\n[User Query]\n${input.naturalQuery}`,
                metadata: {
                    availableMetricsCount: input.availableMetrics?.length || 0,
                    hasUserContext: !!input.userContext
                }
            });

            const stream = await this.client.chat.completions.create({
                model: this.model,
                messages,
                temperature: 0,
                stream: true,  // SSE 串流
            });

            // 收集串流回應
            let fullContent = '';
            for await (const chunk of stream) {
                const delta = chunk.choices[0]?.delta?.content;
                if (delta) fullContent += delta;
            }

            const content = fullContent;
            if (!content) {
                throw new Error('No response from OpenAI');
            }

            // Log the response
            llmLogger.log('nl-to-promql', { response: content });

            // 清理 Markdown 標記
            const cleanContent = fullContent.replace(/^```json\n|\n```$/g, '').replace(/^```\n|\n```$/g, '').trim();
            const result = JSON.parse(cleanContent);

            // 如果有 user context，自動補充 labels
            if (input.userContext && result.promql) {
                result.promql = this.enhancePromQLWithContext(result.promql, input.userContext);
            }

            return {
                promql: result.promql || '',
                explanation: result.explanation || '',
                confidence: result.confidence || 0.5,
                timeRange: result.timeRange,
            };
        } catch (error) {
            console.error('[OpenAI Client] Error in translateNLToPromQL:', error);
            throw error;
        }
    }

    /**
     * 建構翻譯系統 Prompt
     */
    private buildTranslationSystemPrompt(
        availableMetrics?: string[],
        userContext?: { defaultNamespace?: string; defaultService?: string }
    ): string {
        let prompt = `你是一個 Prometheus PromQL 專家。你的任務是將自然語言查詢轉換為正確的 PromQL 查詢語句。

## 規則
1. 輸出必須是有效的 JSON 格式
2. JSON 包含以下欄位：
   - promql: 生成的 PromQL 查詢（字串）
   - explanation: 解釋查詢意圖（繁體中文）
   - confidence: 信心度 0-1（數字）
   - timeRange: 時間範圍（可選，包含 duration 字串）

## PromQL 常用模式
- CPU 使用率: rate(container_cpu_usage_seconds_total{...}[5m])
- 記憶體使用: container_memory_usage_bytes{...}
- HTTP 請求率: rate(http_requests_total{...}[5m])
- HTTP 錯誤率: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])
- P95 延遲: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{...}[5m]))
- Top N: topk(N, metric{...})

## 時間範圍提取
- "過去 X 小時/分鐘/天" → duration: Xh/Xm/Xd
- 如果沒有明確時間 → 預設 duration: "1h"
`;

        // 加入可用指標列表
        if (availableMetrics && availableMetrics.length > 0) {
            prompt += `\n## 可用指標（優先使用這些）\n`;
            prompt += availableMetrics.slice(0, 50).map(m => `- ${m}`).join('\n');
        }

        // 加入使用者上下文
        if (userContext) {
            prompt += `\n## 使用者上下文（查詢時自動套用）\n`;
            if (userContext.defaultNamespace) {
                prompt += `- 預設 namespace: ${userContext.defaultNamespace}\n`;
            }
            if (userContext.defaultService) {
                prompt += `- 預設 service: ${userContext.defaultService}\n`;
            }
        }

        return prompt;
    }

    /**
     * Few-shot 範例
     */
    private getFewShotExamples(): OpenAI.ChatCompletionMessageParam[] {
        return [
            {
                role: 'user',
                content: '過去 1 小時 payment-service 的 CPU 使用率',
            },
            {
                role: 'assistant',
                content: JSON.stringify({
                    promql: 'rate(container_cpu_usage_seconds_total{pod=~"payment-service-.*"}[5m])',
                    explanation: '查詢 payment-service 的 CPU 使用率（5 分鐘平均）',
                    confidence: 0.9,
                    timeRange: { duration: '1h' },
                }),
            },
            {
                role: 'user',
                content: '所有服務的錯誤率 Top 5',
            },
            {
                role: 'assistant',
                content: JSON.stringify({
                    promql: 'topk(5, rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]))',
                    explanation: '取得錯誤率最高的前 5 個服務',
                    confidence: 0.85,
                    timeRange: { duration: '5m' },
                }),
            },
            {
                role: 'user',
                content: 'user-api 的記憶體使用量',
            },
            {
                role: 'assistant',
                content: JSON.stringify({
                    promql: 'container_memory_usage_bytes{pod=~"user-api-.*"}',
                    explanation: '查詢 user-api 的記憶體使用量（bytes）',
                    confidence: 0.95,
                    timeRange: { duration: '1h' },
                }),
            },
        ];
    }

    /**
     * 用 user context 增強 PromQL
     */
    private enhancePromQLWithContext(
        promql: string,
        context: { defaultNamespace?: string; defaultService?: string; labelPreferences?: Record<string, string> }
    ): string {
        let enhanced = promql;

        // 如果 PromQL 中沒有 namespace，且 context 有預設 namespace
        if (context.defaultNamespace && !promql.includes('namespace=')) {
            // 在第一個 { 後加入 namespace
            enhanced = enhanced.replace(/\{/, `{namespace="${context.defaultNamespace}",`);
        }

        // 套用其他 label preferences
        if (context.labelPreferences) {
            for (const [key, value] of Object.entries(context.labelPreferences)) {
                if (!promql.includes(`${key}=`) && key !== 'namespace') {
                    enhanced = enhanced.replace(/\{/, `{${key}="${value}",`);
                }
            }
        }

        return enhanced;
    }

    /**
     * 基於上下文生成查詢建議
     */
    async suggestQueryHints(input: {
        availableMetrics?: string[];
        userContext?: {
            defaultNamespace?: string;
            defaultService?: string;
        };
    }): Promise<{
        hints: Array<{
            category: string;
            suggestions: Array<{
                text: string;
                promql: string;
                description: string;
            }>;
        }>;
    }> {
        // 建構針對 context 的建議
        const namespace = input.userContext?.defaultNamespace || 'production';
        const service = input.userContext?.defaultService || 'api';

        // 預設建議（基於常見 SRE 需求）
        const defaultHints = [
            {
                category: '🔥 資源使用',
                suggestions: [
                    {
                        text: `${service} 的 CPU 使用率`,
                        promql: `rate(container_cpu_usage_seconds_total{namespace="${namespace}",pod=~"${service}-.*"}[5m])`,
                        description: '監控服務的 CPU 使用情況',
                    },
                    {
                        text: `${service} 的記憶體使用量`,
                        promql: `container_memory_usage_bytes{namespace="${namespace}",pod=~"${service}-.*"}`,
                        description: '監控服務的記憶體消耗',
                    },
                    {
                        text: `${namespace} 整體資源 Top 5`,
                        promql: `topk(5, sum by(pod)(rate(container_cpu_usage_seconds_total{namespace="${namespace}"}[5m])))`,
                        description: '找出資源使用最高的 Pods',
                    },
                ],
            },
            {
                category: '🌐 請求流量',
                suggestions: [
                    {
                        text: `${service} 的每秒請求數 (QPS)`,
                        promql: `sum(rate(http_requests_total{namespace="${namespace}",service="${service}"}[5m]))`,
                        description: '監控服務的請求流量',
                    },
                    {
                        text: `${service} 的 P95 延遲`,
                        promql: `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{namespace="${namespace}",service="${service}"}[5m])) by (le))`,
                        description: '監控 95% 請求的延遲',
                    },
                ],
            },
            {
                category: '❌ 錯誤監控',
                suggestions: [
                    {
                        text: `${service} 的 5xx 錯誤率`,
                        promql: `sum(rate(http_requests_total{namespace="${namespace}",service="${service}",status=~"5.."}[5m])) / sum(rate(http_requests_total{namespace="${namespace}",service="${service}"}[5m]))`,
                        description: '監控服務的錯誤比例',
                    },
                    {
                        text: `${namespace} 錯誤率 Top 5`,
                        promql: `topk(5, sum by(service)(rate(http_requests_total{namespace="${namespace}",status=~"5.."}[5m])))`,
                        description: '找出錯誤最多的服務',
                    },
                ],
            },
        ];

        return { hints: defaultHints };
    }

    /**
     * 分析指標健康度
     */
    async analyzeMetricsHealth(input: {
        promql: string;
        metricsData: Array<{ timestamps: number[]; values: number[] }>;
        timeRange: { start: number; end: number };
    }): Promise<{
        health: 'healthy' | 'warning' | 'critical' | 'unknown';
        analysis: {
            summary: string;
            findings: Array<{
                severity: 'info' | 'warning' | 'critical';
                message: string;
                suggestion?: string;
            }>;
            trend: {
                direction: 'increasing' | 'decreasing' | 'stable';
                changeRate: string;
            };
        };
        recommendations: string[];
    }> {
        const systemPrompt = `你是一個 SRE 專家，負責分析 Prometheus 指標健康度。

## 分析維度與規則（嚴格遵守）

1. **趨勢分析**：
   - 變化率絕對值 > 20% 必須標記為 "increasing" 或 "decreasing"
   - 變化率絕對值 <= 20% 才可視為 "stable"
   - **嚴格一致性**：如果 trend 是 increasing/decreasing，summary 絕對不能說「穩定」！必須說「有顯著上升/下降」。

2. **健康評估**：
   - **healthy**: 指標在預期範圍內
   - **warning**: 變化率 > 50% 且無合理預期（如流量突增），或接近異常閾值
   - **critical**: 服務不可用、錯誤率飆升或資源耗盡
   - **unknown**: 數據不足

3. **數值解讀**：
   - 注意數值基數：從 1.0 變為 1.5 雖然是 +50%，但絕對值變化小。分析時應指出「雖然變化率高，但絕對數值仍在低位」。

4. **改善建議**：提供具體的 Prometheus 監控建議或 K8s 資源調整建議。

## 輸出格式（JSON）
{
  "health": "healthy" | "warning" | "critical" | "unknown",
  "analysis": {
    "summary": "一句話總結（繁體中文），必須與 trend 方向一致，若變化大請直接指出",
    "findings": [
      { "severity": "info|warning|critical", "message": "發現描述", "suggestion": "建議" }
    ],
    "trend": {
      "direction": "increasing" | "decreasing" | "stable",
      "changeRate": "變化率，如 +50.0%"
    }
  },
  "recommendations": ["建議1", "建議2"]
}`;

        // 準備數據摘要
        const dataPoints = input.metricsData[0]?.values || [];
        const dataSummary = {
            count: dataPoints.length,
            min: dataPoints.length > 0 ? Math.min(...dataPoints) : 0,
            max: dataPoints.length > 0 ? Math.max(...dataPoints) : 0,
            avg: dataPoints.length > 0 ? dataPoints.reduce((a, b) => a + b, 0) / dataPoints.length : 0,
            latest: dataPoints[dataPoints.length - 1] || 0,
            first: dataPoints[0] || 0,
        };

        const userMessage = `請分析以下指標：

**PromQL**: ${input.promql}

**數據摘要**:
- 資料點數量: ${dataSummary.count}
- 最小值: ${dataSummary.min.toFixed(2)}
- 最大值: ${dataSummary.max.toFixed(2)}
- 平均值: ${dataSummary.avg.toFixed(2)}
- 起始值: ${dataSummary.first.toFixed(2)}
- 最新值: ${dataSummary.latest.toFixed(2)}
- 變化率: ${dataSummary.first !== 0 ? (((dataSummary.latest - dataSummary.first) / dataSummary.first) * 100).toFixed(1) : 0}%

**時間範圍**: ${new Date(input.timeRange.start * 1000).toISOString()} ~ ${new Date(input.timeRange.end * 1000).toISOString()}
`;

        try {
            // Log the complete prompt
            llmLogger.log('metrics-health', {
                prompt: `[System Prompt]\n${systemPrompt}\n\n[User Message]\n${userMessage}`,
                metadata: { promql: input.promql, dataPointsCount: dataSummary.count }
            });

            const stream = await this.client.chat.completions.create({
                model: this.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMessage },
                ],
                temperature: 0,
                stream: true,  // SSE 串流
            });

            // 收集串流回應
            let fullContent = '';
            for await (const chunk of stream) {
                const delta = chunk.choices[0]?.delta?.content;
                if (delta) fullContent += delta;
            }

            const content = fullContent;
            if (!content) {
                throw new Error('No response from OpenAI');
            }

            // Log the response
            llmLogger.log('metrics-health', { response: content });

            // 清理 Markdown 標記
            const cleanContent = content.replace(/^```json\n|\n```$/g, '').replace(/^```\n|\n```$/g, '').trim();
            return JSON.parse(cleanContent);
        } catch (error) {
            console.error('[OpenAI Client] Error in analyzeMetricsHealth:', error);

            // 返回基本分析（fallback）
            const changeRate = dataSummary.first !== 0
                ? ((dataSummary.latest - dataSummary.first) / dataSummary.first) * 100
                : 0;

            return {
                health: Math.abs(changeRate) > 50 ? 'warning' : 'healthy',
                analysis: {
                    summary: `指標變化率為 ${changeRate.toFixed(1)}%`,
                    findings: [{
                        severity: Math.abs(changeRate) > 50 ? 'warning' : 'info',
                        message: `最新值 ${dataSummary.latest.toFixed(2)}，平均值 ${dataSummary.avg.toFixed(2)}`,
                    }],
                    trend: {
                        direction: changeRate > 5 ? 'increasing' : changeRate < -5 ? 'decreasing' : 'stable',
                        changeRate: `${changeRate >= 0 ? '+' : ''}${changeRate.toFixed(1)}%`,
                    },
                },
                recommendations: ['建議持續監控此指標'],
            };
        }
    }
}
