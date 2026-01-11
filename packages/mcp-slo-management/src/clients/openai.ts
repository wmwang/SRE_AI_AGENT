import OpenAI from 'openai';
import { getConfig } from '../config.js';

/**
 * OpenAI Client Wrapper
 * 
 * 提供統一的 OpenAI API 調用介面，支援 SSE streaming
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
     * 呼叫 OpenAI API（非 streaming）
     */
    async complete(systemPrompt: string, userPrompt: string): Promise<string> {
        const response = await this.client.chat.completions.create({
            model: this.model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            temperature: 0,
        });

        return response.choices[0]?.message?.content || '';
    }

    /**
     * 呼叫 OpenAI API（streaming）
     */
    async *stream(systemPrompt: string, userPrompt: string): AsyncGenerator<string> {
        const stream = await this.client.chat.completions.create({
            model: this.model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            temperature: 0,
            stream: true,
        });

        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
                yield content;
            }
        }
    }

    /**
     * 分析 K8s manifests 並推薦 SLOs
     */
    async analyzeSLOs(manifests: string): Promise<{
        slos: Array<{
            id: string;
            name: string;
            description: string;
            description_zh: string;
            target: number;
            threshold: string | null;
            window: string;
            golden_signal: string;
        }>;
    }> {
        const systemPrompt = `你是一位資深的 SRE 專家與架構師。
你的任務是分析提供的 Kubernetes manifests 並推薦 5 到 8 個合適的 Service Level Objectives (SLOs)。

對於每個 SLO，提供：
1. 唯一 ID (例如: "slo-001")
2. 名稱 (例如: "API Availability")
3. 描述（英文）: 說明正在測量什麼
4. 建議的目標百分比 (例如: 99.9)。這必須是可用性目標 (0-100)，而非延遲閾值
5. 建議的閾值 (可選，例如: "200ms")。若不適用則返回 null
6. 建議的時間窗口 (例如: "30d")
7. Golden Signal 分類: "Latency", "Traffic", "Errors", 或 "Saturation"
8. description_zh: 繁體中文的初學者友善說明。解釋為什麼這個指標重要以及對使用者的意義

專注於 Golden Signals: Latency, Traffic, Errors, and Saturation。
考慮 manifests 中的資源類型 (Deployment, Service, Ingress, StatefulSet)。
嚴格以 JSON 格式輸出。輸出必須是具有單一 key "slos" 的有效 JSON 物件，包含物件陣列。

JSON 結構約束：
{
  "slos": [
    {
      "id": "slo-001",
      "name": "API Availability",
      "description": "...",
      "target": 99.9,
      "threshold": null,
      "window": "30d",
      "golden_signal": "Errors",
      "description_zh": "..."
    }
  ]
}

重要規則：
1. 欄位名稱必須完全是: "id", "name", "description", "target", "threshold", "window", "golden_signal", "description_zh"
2. "target" 必須是 0 到 100 之間的數字。不能是 null。如果不確定具體目標，使用 99.9 作為預設值
3. "threshold" 可以是 null 或字串如 "200ms"
4. "golden_signal" 必須是以下之一: "Latency", "Traffic", "Errors", "Saturation"
5. 不要在回應中包含 markdown 格式（如 \\\`\\\`\\\`json），只需原始 JSON 字串`;

        const userPrompt = `<task>
K8s Manifests:

${manifests}
        </task>`;

        // DEBUG: 輸出送給 LLM 的資料
        if (process.env.DEBUG_LLM === 'true') {
            console.error('\n========== LLM REQUEST DEBUG ==========');
            console.error('System Prompt:');
            console.error(systemPrompt);
            console.error('\n---\nUser Prompt:');
            console.error(userPrompt);
            console.error('========== END REQUEST DEBUG ==========\n');
        }

        const response = await this.complete(systemPrompt, userPrompt);

        // DEBUG: 輸出 LLM 的原始回應
        if (process.env.DEBUG_LLM === 'true') {
            console.error('\n========== LLM RESPONSE DEBUG ==========');
            console.error('Raw Response:');
            console.error(response);
            console.error('========== END RESPONSE DEBUG ==========\n');
        }

        try {
            // 嘗試解析 JSON
            const parsed = JSON.parse(response);
            return parsed;
        } catch (error) {
            // 如果有 markdown wrapper，移除它
            const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[1] || '');
            }
            throw new Error(`Failed to parse OpenAI response: ${error}`);
        }
    }
}
