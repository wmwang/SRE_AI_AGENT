import { z } from 'zod';

/**
 * scan_repo 工具的輸入 schema
 */
export const ScanRepoSchema = z.object({
    repoPath: z.string().describe('本地 Repo 路徑'),
    pattern: z.string().optional().describe('檔案過濾 glob (預設: **/*.yaml, **/*.yml)'),
});

export type ScanRepoInput = z.infer<typeof ScanRepoSchema>;

/**
 * analyze_deployment 工具的輸入 schema
 */
export const AnalyzeDeploymentSchema = z.object({
    yaml: z.string().optional().describe('K8s YAML 內容'),
    path: z.string().optional().describe('K8s YAML 檔案路徑'),
});

export type AnalyzeDeploymentInput = z.infer<typeof AnalyzeDeploymentSchema>;

/**
 * suggest_improvements 工具的輸入 schema
 */
export const SuggestImprovementsSchema = z.object({
    yaml: z.string().optional().describe('K8s YAML 內容'),
    path: z.string().optional().describe('K8s YAML 檔案路徑'),
    focus: z.enum(['security', 'performance', 'best-practices', 'cost', 'all'])
        .default('all')
        .describe('關注重點: security=安全性, performance=效能, best-practices=最佳實踐, cost=成本, all=全部'),
});

export type SuggestImprovementsInput = z.infer<typeof SuggestImprovementsSchema>;

/**
 * render_helm_chart 工具的輸入 schema
 */
export const RenderHelmChartSchema = z.object({
    chartPath: z.string().describe('Helm Chart 路徑'),
    valuesFile: z.string().optional().describe('values.yaml 檔案路徑'),
    releaseName: z.string().default('release').describe('Release 名稱'),
    namespace: z.string().default('default').describe('Namespace'),
});

export type RenderHelmChartInput = z.infer<typeof RenderHelmChartSchema>;
