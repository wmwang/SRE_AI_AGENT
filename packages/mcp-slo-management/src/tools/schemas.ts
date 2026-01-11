import { z } from 'zod';

/**
 * analyze_k8s_manifests 工具的輸入 schema
 */
export const AnalyzeK8sManifestsSchema = z.object({
    manifests: z.string().describe('K8s YAML manifests 內容'),
    serviceId: z.string().optional().describe('服務 ID（可選）'),
});

export type AnalyzeK8sManifestsInput = z.infer<typeof AnalyzeK8sManifestsSchema>;

/**
 * track_slo_status 工具的輸入 schema
 */
export const TrackSLOStatusSchema = z.object({
    serviceId: z.string().optional().describe('過濾特定服務的 SLOs'),
    status: z.enum(['met', 'at-risk', 'violated', 'unknown']).optional().describe('過濾 SLO 狀態'),
});

export type TrackSLOStatusInput = z.infer<typeof TrackSLOStatusSchema>;

/**
 * calculate_error_budget 工具的輸入 schema
 */
export const CalculateErrorBudgetSchema = z.object({
    sloId: z.string().describe('SLO ID'),
});

export type CalculateErrorBudgetInput = z.infer<typeof CalculateErrorBudgetSchema>;

/**
 * recommend_slos 工具的輸入 schema
 */
export const RecommendSLOsSchema = z.object({
    serviceType: z.string().describe('服務類型，例如: api, web, database'),
    description: z.string().optional().describe('服務描述'),
});

export type RecommendSLOsInput = z.infer<typeof RecommendSLOsSchema>;

/**
 * update_slo_status 工具的輸入 schema
 */
export const UpdateSLOStatusSchema = z.object({
    sloId: z.string().describe('SLO ID'),
    status: z.enum(['met', 'at-risk', 'violated', 'unknown']).describe('新的 SLO 狀態'),
    errorBudget: z.number().min(0).max(100).describe('錯誤預算百分比'),
});

export type UpdateSLOStatusInput = z.infer<typeof UpdateSLOStatusSchema>;

/**
 * generate_slo_report 工具的輸入 schema
 */
export const GenerateSLOReportSchema = z.object({
    serviceId: z.string().optional().describe('過濾特定服務'),
    period: z.enum(['7d', '30d', '90d']).default('30d').describe('報告期間'),
});

export type GenerateSLOReportInput = z.infer<typeof GenerateSLOReportSchema>;

/**
 * generate_prometheus_rules 工具的輸入 schema
 */
export const GeneratePrometheusRulesSchema = z.object({
    slos: z.array(z.object({
        id: z.string(),
        name: z.string(),
        target: z.number(),
        threshold: z.number().optional(),
        window: z.string(),
        golden_signal: z.string(),
        metric_name: z.string().optional(),
    })).describe('SLO 定義列表'),
    serviceName: z.string().describe('服務名稱'),
    namespace: z.string().default('default').describe('Prometheus namespace'),
});

export type GeneratePrometheusRulesInput = z.infer<typeof GeneratePrometheusRulesSchema>;

/**
 * generate_grafana_dashboard 工具的輸入 schema
 */
export const GenerateGrafanaDashboardSchema = z.object({
    slos: z.array(z.object({
        id: z.string(),
        name: z.string(),
        target: z.number(),
        threshold: z.number().optional(),
        window: z.string(),
        golden_signal: z.string(),
        metric_name: z.string().optional(),
    })).describe('SLO 定義列表'),
    serviceName: z.string().describe('服務名稱'),
    dashboardTitle: z.string().optional().describe('Dashboard 標題'),
    outputPath: z.string().optional().describe('輸出檔案路徑（可選，若提供則寫入檔案）'),
});

export type GenerateGrafanaDashboardInput = z.infer<typeof GenerateGrafanaDashboardSchema>;

