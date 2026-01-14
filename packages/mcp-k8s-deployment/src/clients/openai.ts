import OpenAI from 'openai';
import { getConfig } from '../config.js';

/**
 * OpenAI Client Wrapper
 */
export class OpenAIClient {
    private client: OpenAI;
    private model: string;

    constructor() {
        const config = getConfig();

        this.client = new OpenAI({
            apiKey: config.openai.apiKey,
            baseURL: config.openai.baseURL,
        });

        this.model = config.openai.model || 'gpt-4o-mini';
    }

    /**
     * 呼叫 OpenAI API（使用 SSE 串流模式）
     */
    async complete(systemPrompt: string, userPrompt: string): Promise<string> {
        const stream = await this.client.chat.completions.create({
            model: this.model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            temperature: 0,
            stream: true,  // SSE 串流模式
        });

        // 收集串流回應
        let fullContent = '';
        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content;
            if (delta) fullContent += delta;
        }

        return fullContent;
    }

    /**
     * 生成 Repo 摘要
     */
    async summarizeRepo(data: {
        repoPath: string;
        fileCount: number;
        totalResources: number;
        resourcesByKind: Record<string, number>;
        resources: Array<{ kind: string; name: string }>;
    }): Promise<string> {
        const systemPrompt = `你是一位資深的 Kubernetes 專家。
根據提供的 K8s Repo 掃描結果，用繁體中文撰寫一段自然語言摘要。

摘要應包含：
1. 這個 Repo 大概在做什麼（根據資源類型和名稱推測）
2. 整體架構概述
3. 主要組件說明

請用口語化的方式描述，像是在向同事解釋這個專案。
回應時直接輸出文字，不要用 JSON 格式，不要用 markdown 標題。`;

        const userPrompt = `Repo 路徑: ${data.repoPath}
檔案數量: ${data.fileCount}
資源總數: ${data.totalResources}

資源類型統計:
${Object.entries(data.resourcesByKind).map(([kind, count]) => `- ${kind}: ${count} 個`).join('\n')}

主要資源列表:
${data.resources.map(r => `- ${r.kind}: ${r.name}`).join('\n')}`;

        return await this.complete(systemPrompt, userPrompt);
    }

    /**
     * 分析 K8s YAML 部署
     */
    async analyzeDeployment(yaml: string): Promise<object> {
        const systemPrompt = `你是一位資深的 Kubernetes 專家。
分析提供的 K8s YAML manifests，並以 JSON 格式輸出：

{
  "summary": "一句話描述這個部署在做什麼",
  "resources": [
    { "kind": "Deployment", "name": "xxx", "description": "描述" }
  ],
  "architecture": "描述整體架構和資源之間的關係",
  "dependencies": ["列出相依的服務或資源"],
  "ports": ["暴露的端口"],
  "volumes": ["使用的儲存卷"]
}

以繁體中文回應，只輸出 JSON，不要 markdown 格式。`;

        const response = await this.complete(systemPrompt, yaml);
        return this.parseJSON(response);
    }

    /**
     * 提供改進建議
     */
    async suggestImprovements(yaml: string, focus: string): Promise<object> {
        const focusMap: Record<string, string> = {
            'security': '安全性問題（如 privileged containers, root user, secrets 管理）',
            'performance': '效能問題（如 resource limits, HPA, affinity）',
            'best-practices': 'Kubernetes 最佳實踐（如 labels, probes, restart policy）',
            'cost': '成本優化（如 resource requests 過高, replica 數量）',
            'all': '所有面向（安全性、效能、最佳實踐、成本）',
        };

        const focusDescription = focusMap[focus] || focusMap['all'];

        const systemPrompt = `你是一位資深的 Kubernetes SRE 專家。
分析提供的 K8s YAML manifests，針對「${focusDescription}」提出改進建議。

以 JSON 格式輸出：
{
  "issues": [
    {
      "severity": "high|medium|low",
      "category": "security|performance|best-practices|cost",
      "title": "問題標題",
      "description": "問題描述",
      "location": "資源名稱或位置",
      "suggestion": "建議修改方式"
    }
  ],
  "overallScore": 0-100,
  "summary": "整體評估摘要"
}

以繁體中文回應，只輸出 JSON，不要 markdown 格式。`;

        const response = await this.complete(systemPrompt, yaml);
        return this.parseJSON(response);
    }

    /**
     * 解析 JSON 回應
     */
    private parseJSON(response: string): object {
        try {
            return JSON.parse(response);
        } catch {
            // 嘗試移除 markdown wrapper
            const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/);
            if (jsonMatch && jsonMatch[1]) {
                return JSON.parse(jsonMatch[1]);
            }

            // 嘗試清理
            const cleaned = response
                .replace(/^```\w*\n?/, '')
                .replace(/\n?```$/, '')
                .trim();

            return JSON.parse(cleaned);
        }
    }
}
