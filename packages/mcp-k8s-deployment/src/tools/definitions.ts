import { zodToJsonSchema } from 'zod-to-json-schema';
import {
    ScanRepoSchema,
    AnalyzeDeploymentSchema,
    SuggestImprovementsSchema,
    RenderHelmChartSchema,
} from './schemas.js';

/**
 * 工具定義
 */
export const toolDefinitions = [
    {
        name: 'scan_repo',
        description: '掃描本地 Repo，找出所有 K8s YAML 檔案並提供結構摘要',
        inputSchema: zodToJsonSchema(ScanRepoSchema),
    },
    {
        name: 'analyze_deployment',
        description: '分析 K8s 部署 YAML，統整這個部署在做什麼，包括資源清單、架構描述、相依服務',
        inputSchema: zodToJsonSchema(AnalyzeDeploymentSchema),
    },
    {
        name: 'suggest_improvements',
        description: '針對 K8s 部署 YAML 提出改進建議，包括安全性、效能、最佳實踐、成本等面向',
        inputSchema: zodToJsonSchema(SuggestImprovementsSchema),
    },
    {
        name: 'render_helm_chart',
        description: '將 Helm Chart 渲染為 K8s YAML（需要系統已安裝 Helm CLI）',
        inputSchema: zodToJsonSchema(RenderHelmChartSchema),
    },
];
