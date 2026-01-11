import { SharedMemory } from '@sre-agent/shared-memory';
import { OpenAIClient } from '../clients/openai.js';
import * as fs from 'fs';
import type {
    AnalyzeK8sManifestsInput,
    TrackSLOStatusInput,
    CalculateErrorBudgetInput,
    RecommendSLOsInput,
    UpdateSLOStatusInput,
    GenerateSLOReportInput,
    GeneratePrometheusRulesInput,
    GenerateGrafanaDashboardInput,
} from './schemas.js';

/**
 * SLO Tools Handler
 * 
 * 實作所有 SLO 相關的工具邏輯
 */
export class SLOToolsHandler {
    constructor(
        private memory: SharedMemory,
        private ai: OpenAIClient
    ) { }

    /**
     * 分析 K8s manifests 並建議 SLOs
     */
    async analyzeK8sManifests(input: AnalyzeK8sManifestsInput): Promise<object> {
        // 使用 OpenAI 分析 manifests
        const result = await this.ai.analyzeSLOs(input.manifests);

        // 儲存到 Shared Memory
        const serviceId = input.serviceId || 'default-service';
        const now = new Date().toISOString();

        // 先建立服務（如果不存在）
        const existingService = this.memory.getService(serviceId);
        if (!existingService) {
            this.memory.upsertService({
                id: serviceId,
                name: serviceId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
                type: 'other',
                dependencies: [],
                labels: { source: 'analyze_k8s_manifests' },
                lastUpdated: now,
            });
        }

        // 然後建立 SLOs
        for (const slo of result.slos) {
            this.memory.upsertSLO({
                id: slo.id,
                serviceId,
                name: slo.name,
                description: slo.description,
                description_zh: slo.description_zh,
                target: slo.target,
                threshold: slo.threshold,
                window: slo.window,
                goldenSignal: slo.golden_signal as 'Latency' | 'Traffic' | 'Errors' | 'Saturation',
                status: 'unknown',
                errorBudget: 100,
                lastEvaluated: now,
                createdAt: now,
                updatedAt: now,
            });
        }

        return {
            success: true,
            slosCount: result.slos.length,
            slos: result.slos,
            message: `成功分析並建立 ${result.slos.length} 個 SLO`,
        };
    }

    /**
     * 追蹤 SLO 狀態
     */
    async trackSLOStatus(input: TrackSLOStatusInput): Promise<object> {
        const filter: { serviceId?: string; sloStatus?: 'met' | 'at-risk' | 'violated' | 'unknown' } = {};

        if (input.serviceId) {
            filter.serviceId = input.serviceId;
        }

        if (input.status) {
            filter.sloStatus = input.status;
        }

        const slos = this.memory.listSLOs(filter);

        // 統計
        const stats = {
            total: slos.length,
            met: slos.filter(s => s.status === 'met').length,
            atRisk: slos.filter(s => s.status === 'at-risk').length,
            violated: slos.filter(s => s.status === 'violated').length,
            unknown: slos.filter(s => s.status === 'unknown').length,
        };

        return {
            success: true,
            stats,
            slos: slos.map(slo => ({
                id: slo.id,
                name: slo.name,
                serviceId: slo.serviceId,
                status: slo.status,
                target: slo.target,
                errorBudget: slo.errorBudget,
                goldenSignal: slo.goldenSignal,
            })),
        };
    }

    /**
     * 計算錯誤預算
     */
    async calculateErrorBudget(input: CalculateErrorBudgetInput): Promise<object> {
        const slo = this.memory.getSLO(input.sloId);

        if (!slo) {
            return {
                success: false,
                error: `SLO ${input.sloId} 不存在`,
            };
        }

        // 錯誤預算計算（簡化版本，實際應該從 Prometheus 取得數據）
        const errorBudget = 100 - slo.target;
        const remainingBudget = slo.errorBudget;
        const consumedBudget = errorBudget - remainingBudget;
        const consumedPercentage = (consumedBudget / errorBudget) * 100;

        return {
            success: true,
            slo: {
                id: slo.id,
                name: slo.name,
                target: slo.target,
            },
            errorBudget: {
                total: errorBudget,
                remaining: remainingBudget,
                consumed: consumedBudget,
                consumedPercentage: consumedPercentage.toFixed(2),
                status: slo.status,
            },
            recommendation: consumedPercentage > 80
                ? '警告：錯誤預算已消耗超過 80%，建議立即檢查服務狀態'
                : consumedPercentage > 50
                    ? '注意：錯誤預算已消耗超過 50%，建議密切監控'
                    : '錯誤預算使用正常',
        };
    }

    /**
     * 推薦 SLOs（基於服務類型）
     */
    async recommendSLOs(input: RecommendSLOsInput): Promise<object> {
        const systemPrompt = `你是一位資深的 SRE 專家。
根據給定的服務類型和描述，推薦 3-5 個合適的 SLOs。

對於每個 SLO，提供：
- id: 唯一識別碼
- name: SLO 名稱
- description: 英文描述
- description_zh: 繁體中文描述
- target: 目標百分比 (0-100)
- threshold: 閾值（可選）
- window: 時間窗口
- golden_signal: Golden Signal 分類

以 JSON 格式輸出：
{
  "slos": [...]
}`;

        const userPrompt = `服務類型: ${input.serviceType}
${input.description ? `服務描述: ${input.description}` : ''}

請推薦合適的 SLOs。`;

        const response = await this.ai.complete(systemPrompt, userPrompt);

        // DEBUG: 輸出 AI 回應以便調試
        if (globalThis.process.env.DEBUG_LLM === 'true') {
            console.error('[recommendSLOs] Raw AI Response:', response);
        }

        try {
            // 嘗試直接解析
            const parsed = JSON.parse(response);
            return {
                success: true,
                recommendations: parsed.slos || [],
            };
        } catch {
            // 如果有 markdown wrapper，移除它
            const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/);
            if (jsonMatch && jsonMatch[1]) {
                try {
                    const parsed = JSON.parse(jsonMatch[1]);
                    return {
                        success: true,
                        recommendations: parsed.slos || [],
                    };
                } catch (innerError) {
                    console.error('[recommendSLOs] Failed to parse extracted JSON:', innerError);
                }
            }

            // 嘗試移除其他常見的非 JSON 前綴/後綴
            const cleanedResponse = response
                .replace(/^```\w*\n?/, '')  // 移除開頭的 ```
                .replace(/\n?```$/, '')      // 移除結尾的 ```
                .trim();

            try {
                const parsed = JSON.parse(cleanedResponse);
                return {
                    success: true,
                    recommendations: parsed.slos || [],
                };
            } catch {
                console.error('[recommendSLOs] All parse attempts failed. Raw response:', response);
                return {
                    success: false,
                    error: '無法解析 AI 回應',
                    rawResponse: response.substring(0, 500), // 返回部份原始回應以便 debug
                };
            }
        }
    }

    /**
     * 更新 SLO 狀態
     */
    async updateSLOStatus(input: UpdateSLOStatusInput): Promise<object> {
        this.memory.updateSLOStatus(input.sloId, input.status, input.errorBudget);

        const slo = this.memory.getSLO(input.sloId);

        return {
            success: true,
            slo: {
                id: slo?.id,
                name: slo?.name,
                status: input.status,
                errorBudget: input.errorBudget,
            },
            message: `成功更新 SLO ${input.sloId} 的狀態為 ${input.status}`,
        };
    }

    /**
     * 生成 SLO 報告
     */
    async generateSLOReport(input: GenerateSLOReportInput): Promise<object> {
        const filter: { serviceId?: string } = {};

        if (input.serviceId) {
            filter.serviceId = input.serviceId;
        }

        const slos = this.memory.listSLOs(filter);

        // 生成報告統計
        const report = {
            period: input.period,
            generatedAt: new Date().toISOString(),
            summary: {
                total: slos.length,
                met: slos.filter(s => s.status === 'met').length,
                atRisk: slos.filter(s => s.status === 'at-risk').length,
                violated: slos.filter(s => s.status === 'violated').length,
            },
            slos: slos.map(slo => ({
                id: slo.id,
                name: slo.name,
                name_zh: slo.description_zh,
                serviceId: slo.serviceId,
                status: slo.status,
                target: slo.target,
                errorBudget: slo.errorBudget,
                goldenSignal: slo.goldenSignal,
            })),
            recommendations: [] as string[],
        };

        // 添加建議
        if (report.summary.violated > 0) {
            report.recommendations.push(`有 ${report.summary.violated} 個 SLO 被違反，需要立即處理`);
        }
        if (report.summary.atRisk > 0) {
            report.recommendations.push(`有 ${report.summary.atRisk} 個 SLO 處於風險狀態，建議密切監控`);
        }
        if (report.summary.met === report.summary.total) {
            report.recommendations.push('所有 SLO 都達標，系統運行良好');
        }

        return {
            success: true,
            report,
        };
    }

    /**
     * 生成 Prometheus Recording Rules 和 Alert Rules
     */
    async generatePrometheusRules(input: GeneratePrometheusRulesInput): Promise<object> {
        const { slos, serviceName, namespace } = input;

        // 生成 Recording Rules
        const recordingRules: any[] = [];
        const alertRules: any[] = [];

        for (const slo of slos) {
            const metricName = slo.metric_name || `${serviceName}_${slo.golden_signal.toLowerCase()}_sli`;
            const sloId = slo.id.replace(/-/g, '_');

            // Recording Rule: 計算 SLI
            if (slo.golden_signal === 'Errors') {
                recordingRules.push({
                    record: `slo:${sloId}:error_rate`,
                    expr: `sum(rate(${metricName}_errors_total{service="${serviceName}"}[5m])) / sum(rate(${metricName}_total{service="${serviceName}"}[5m]))`,
                });
            } else if (slo.golden_signal === 'Latency') {
                recordingRules.push({
                    record: `slo:${sloId}:latency_p99`,
                    expr: `histogram_quantile(0.99, sum(rate(${metricName}_bucket{service="${serviceName}"}[5m])) by (le))`,
                });
            } else if (slo.golden_signal === 'Availability') {
                recordingRules.push({
                    record: `slo:${sloId}:availability`,
                    expr: `sum(up{service="${serviceName}"}) / count(up{service="${serviceName}"})`,
                });
            }

            // Alert Rule
            const alertExpr = slo.golden_signal === 'Errors'
                ? `slo:${sloId}:error_rate > ${(100 - slo.target) / 100}`
                : slo.golden_signal === 'Latency'
                    ? `slo:${sloId}:latency_p99 > ${slo.threshold || slo.target}`
                    : `slo:${sloId}:availability < ${slo.target / 100}`;

            alertRules.push({
                alert: `SLO_${slo.name.replace(/\s+/g, '_')}_Breached`,
                expr: alertExpr,
                for: '5m',
                labels: {
                    severity: 'warning',
                    slo_id: slo.id,
                    golden_signal: slo.golden_signal,
                },
                annotations: {
                    summary: `SLO ${slo.name} 已違反`,
                    description: `${slo.name} 的目標是 ${slo.target}%，但目前已超出閾值。`,
                },
            });
        }

        // 組裝 YAML
        const rulesYaml = {
            groups: [
                {
                    name: `${serviceName}_slo_recording_rules`,
                    rules: recordingRules,
                },
                {
                    name: `${serviceName}_slo_alert_rules`,
                    rules: alertRules,
                },
            ],
        };

        // 轉換為 YAML 字串
        const yamlStr = this.toYaml(rulesYaml);

        return {
            success: true,
            serviceName,
            namespace,
            recordingRulesCount: recordingRules.length,
            alertRulesCount: alertRules.length,
            rulesYaml: yamlStr,
            rules: rulesYaml,
        };
    }

    /**
     * 生成 Grafana Dashboard JSON
     */
    async generateGrafanaDashboard(input: GenerateGrafanaDashboardInput): Promise<object> {
        const { slos, serviceName, dashboardTitle, outputPath } = input;

        const title = dashboardTitle || `${serviceName} SLO Dashboard`;

        // 生成 panels
        const panels: any[] = [];
        let gridY = 0;

        // 標題 Row
        panels.push({
            type: 'row',
            title: 'SLO Overview',
            gridPos: { x: 0, y: gridY, w: 24, h: 1 },
        });
        gridY += 1;

        for (let i = 0; i < slos.length; i++) {
            const slo = slos[i];
            if (!slo) continue;
            const sloId = slo.id.replace(/-/g, '_');
            const col = (i % 3) * 8;

            // Gauge Panel
            panels.push({
                id: panels.length + 1,
                type: 'gauge',
                title: slo.name,
                gridPos: { x: col, y: gridY, w: 8, h: 6 },
                targets: [
                    {
                        expr: slo.golden_signal === 'Errors'
                            ? `(1 - slo:${sloId}:error_rate) * 100`
                            : slo.golden_signal === 'Availability'
                                ? `slo:${sloId}:availability * 100`
                                : `slo:${sloId}:latency_p99`,
                        legendFormat: slo.name,
                    },
                ],
                options: {
                    reduceOptions: { calcs: ['lastNotNull'] },
                },
                fieldConfig: {
                    defaults: {
                        unit: slo.golden_signal === 'Latency' ? 'ms' : 'percent',
                        min: 0,
                        max: slo.golden_signal === 'Latency' ? (slo.threshold || 1000) : 100,
                        thresholds: {
                            mode: 'absolute',
                            steps: [
                                { color: 'red', value: null },
                                { color: 'yellow', value: slo.threshold || slo.target * 0.9 },
                                { color: 'green', value: slo.target },
                            ],
                        },
                    },
                },
            });

            if ((i + 1) % 3 === 0) gridY += 6;
        }

        // Error Budget Panel
        gridY += 6;
        panels.push({
            type: 'row',
            title: 'Error Budget',
            gridPos: { x: 0, y: gridY, w: 24, h: 1 },
        });
        gridY += 1;

        panels.push({
            id: panels.length + 1,
            type: 'timeseries',
            title: 'Error Budget Remaining',
            gridPos: { x: 0, y: gridY, w: 24, h: 8 },
            targets: slos.map(slo => ({
                expr: `100 - (slo:${slo.id.replace(/-/g, '_')}:error_rate * 100 / ${100 - slo.target})`,
                legendFormat: slo.name,
            })),
            fieldConfig: {
                defaults: {
                    unit: 'percent',
                    min: 0,
                    max: 100,
                },
            },
        });

        // Dashboard JSON
        const dashboard = {
            title,
            uid: `slo-${serviceName.toLowerCase().replace(/\s+/g, '-')}`,
            tags: ['slo', serviceName.toLowerCase()],
            timezone: 'browser',
            schemaVersion: 38,
            version: 1,
            refresh: '30s',
            time: { from: 'now-1h', to: 'now' },
            panels,
        };

        // 如果提供了輸出路徑，寫入檔案
        if (outputPath) {
            fs.writeFileSync(outputPath, JSON.stringify(dashboard, null, 2), 'utf-8');
        }

        return {
            success: true,
            serviceName,
            dashboardTitle: title,
            panelsCount: panels.length,
            outputPath: outputPath || null,
            dashboard,
        };
    }

    /**
     * 簡易 YAML 序列化
     */
    private toYaml(obj: any, indent = 0): string {
        const spaces = '  '.repeat(indent);
        let result = '';

        if (Array.isArray(obj)) {
            for (const item of obj) {
                if (typeof item === 'object' && item !== null) {
                    result += `${spaces}- `;
                    const itemStr = this.toYaml(item, indent + 1).trim();
                    result += itemStr.replace(/^\s+/, '') + '\n';
                } else {
                    result += `${spaces}- ${item}\n`;
                }
            }
        } else if (typeof obj === 'object' && obj !== null) {
            for (const [key, value] of Object.entries(obj)) {
                if (typeof value === 'object' && value !== null) {
                    result += `${spaces}${key}:\n${this.toYaml(value, indent + 1)}`;
                } else {
                    result += `${spaces}${key}: ${JSON.stringify(value)}\n`;
                }
            }
        } else {
            result += `${obj}`;
        }

        return result;
    }
}

