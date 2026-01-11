import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import * as YAML from 'yaml';
import { execSync } from 'child_process';
import { OpenAIClient } from '../clients/openai.js';
import type {
    ScanRepoInput,
    AnalyzeDeploymentInput,
    SuggestImprovementsInput,
    RenderHelmChartInput,
} from './schemas.js';

/**
 * K8s Deployment Tools Handler
 */
export class K8sToolsHandler {
    constructor(private ai: OpenAIClient) { }

    /**
     * 掃描 Repo 找出 K8s YAML 檔案
     */
    async scanRepo(input: ScanRepoInput): Promise<object> {
        const { repoPath, pattern } = input;

        // 檢查路徑是否存在
        if (!fs.existsSync(repoPath)) {
            return {
                success: false,
                error: `路徑不存在: ${repoPath}`,
            };
        }

        const searchPattern = pattern || '**/*.{yaml,yml}';
        const fullPattern = path.join(repoPath, searchPattern);

        try {
            const files = await glob(fullPattern, { ignore: ['**/node_modules/**', '**/.git/**'] });

            // 分析每個檔案
            const fileInfos = files.map(file => {
                const content = fs.readFileSync(file, 'utf-8');
                const docs = YAML.parseAllDocuments(content);
                const resources = docs
                    .map(doc => doc.toJSON())
                    .filter(Boolean)
                    .map((resource: any) => ({
                        kind: resource.kind,
                        name: resource.metadata?.name,
                    }));

                return {
                    path: path.relative(repoPath, file),
                    size: fs.statSync(file).size,
                    resourceCount: resources.length,
                    resources,
                };
            });

            // 統計
            const allResources = fileInfos.flatMap(f => f.resources);
            const kindCount: Record<string, number> = {};
            for (const r of allResources) {
                kindCount[r.kind] = (kindCount[r.kind] || 0) + 1;
            }

            // 使用 AI 生成自然語言摘要
            let summary = '';
            try {
                summary = await this.ai.summarizeRepo({
                    repoPath,
                    fileCount: files.length,
                    totalResources: allResources.length,
                    resourcesByKind: kindCount,
                    resources: allResources.slice(0, 20), // 只傳前 20 個資源避免 token 過長
                });
            } catch {
                // AI 摘要失敗時仍然返回結構化資料
                summary = `這個 Repo 包含 ${files.length} 個 YAML 檔案，共 ${allResources.length} 個 K8s 資源。`;
            }

            return {
                success: true,
                summary,
                repoPath,
                fileCount: files.length,
                totalResources: allResources.length,
                resourcesByKind: kindCount,
                files: fileInfos,
            };
        } catch (error) {
            return {
                success: false,
                error: `掃描失敗: ${error}`,
            };
        }
    }

    /**
     * 分析 K8s 部署
     */
    async analyzeDeployment(input: AnalyzeDeploymentInput): Promise<object> {
        let yaml = input.yaml;

        // 如果提供的是路徑，讀取檔案
        if (!yaml && input.path) {
            if (!fs.existsSync(input.path)) {
                return {
                    success: false,
                    error: `檔案不存在: ${input.path}`,
                };
            }
            yaml = fs.readFileSync(input.path, 'utf-8');
        }

        if (!yaml) {
            return {
                success: false,
                error: '請提供 yaml 內容或 path 路徑',
            };
        }

        try {
            const analysis = await this.ai.analyzeDeployment(yaml);
            return {
                success: true,
                ...analysis,
            };
        } catch (error) {
            return {
                success: false,
                error: `分析失敗: ${error}`,
            };
        }
    }

    /**
     * 提供改進建議
     */
    async suggestImprovements(input: SuggestImprovementsInput): Promise<object> {
        let yaml = input.yaml;

        // 如果提供的是路徑，讀取檔案
        if (!yaml && input.path) {
            if (!fs.existsSync(input.path)) {
                return {
                    success: false,
                    error: `檔案不存在: ${input.path}`,
                };
            }
            yaml = fs.readFileSync(input.path, 'utf-8');
        }

        if (!yaml) {
            return {
                success: false,
                error: '請提供 yaml 內容或 path 路徑',
            };
        }

        try {
            const suggestions = await this.ai.suggestImprovements(yaml, input.focus || 'all');
            return {
                success: true,
                focus: input.focus || 'all',
                ...suggestions,
            };
        } catch (error) {
            return {
                success: false,
                error: `分析失敗: ${error}`,
            };
        }
    }

    /**
     * 渲染 Helm Chart
     */
    async renderHelmChart(input: RenderHelmChartInput): Promise<object> {
        // 檢查 Helm 是否已安裝
        try {
            execSync('helm version --short', { encoding: 'utf-8', stdio: 'pipe' });
        } catch {
            return {
                success: false,
                error: '系統未安裝 Helm CLI。請先執行: brew install helm (macOS) 或參考 https://helm.sh/docs/intro/install/',
            };
        }

        // 檢查 Chart 路徑
        if (!fs.existsSync(input.chartPath)) {
            return {
                success: false,
                error: `Chart 路徑不存在: ${input.chartPath}`,
            };
        }

        try {
            let cmd = `helm template ${input.releaseName} ${input.chartPath} --namespace ${input.namespace}`;

            if (input.valuesFile) {
                if (!fs.existsSync(input.valuesFile)) {
                    return {
                        success: false,
                        error: `Values 檔案不存在: ${input.valuesFile}`,
                    };
                }
                cmd += ` -f ${input.valuesFile}`;
            }

            const renderedYaml = execSync(cmd, { encoding: 'utf-8' });

            // 解析渲染後的 YAML
            const docs = YAML.parseAllDocuments(renderedYaml);
            const resources = docs
                .map(doc => doc.toJSON())
                .filter(Boolean)
                .map((resource: any) => ({
                    kind: resource.kind,
                    name: resource.metadata?.name,
                    namespace: resource.metadata?.namespace,
                }));

            return {
                success: true,
                releaseName: input.releaseName,
                namespace: input.namespace,
                resourceCount: resources.length,
                resources,
                renderedYaml,
            };
        } catch (error: any) {
            return {
                success: false,
                error: `Helm 渲染失敗: ${error.message || error}`,
            };
        }
    }
}
