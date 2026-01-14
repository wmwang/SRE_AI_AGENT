import OpenAI from 'openai';
import { getConfig } from '../config.js';
import { llmLogger } from '../utils/llm-logger.js';
import type { LogEntry } from './elasticsearch.js';

/**
 * OpenAI Client for Log Analysis
 * 
 * 提供 AI 功能：
 * - 自然語言轉 ES Query DSL
 * - 錯誤模式分析
 * - 根因分析
 * - 日誌摘要
 * - 異常檢測
 */
export class OpenAIClient {
    private client: OpenAI;
    private model: string;

    constructor() {
        const config = getConfig();

        if (!config.openai.apiKey) {
            throw new Error('OpenAI API key is not configured');
        }

        this.client = new OpenAI({
            apiKey: config.openai.apiKey,
            baseURL: config.openai.baseURL,
        });

        this.model = config.openai.model;
    }

    /**
     * 1. 自然語言轉 Elasticsearch Query DSL
     */
    async translateNLToESQuery(input: {
        naturalQuery: string;
        availableIndices?: string[];
        userContext?: {
            defaultService?: string;
            defaultNamespace?: string;
        };
    }): Promise<{
        esQuery: any;
        index?: string;
        timeRange?: { start: string; end: string };
        explanation: string;
        confidence: number;
    }> {
        const systemPrompt = `你是 Elasticsearch Query DSL 專家。將自然語言轉換為 ES Query。

## 輸出格式（JSON）
{
  "esQuery": { ... },  // ES Query DSL object
  "index": "logs-*",   // 可選
  "timeRange": { "start": "now-1h", "end": "now" },  // 可選  
  "explanation": "查詢說明（繁體中文）",
  "confidence": 0.9
}

## 常用模式
- 錯誤日誌: { "term": { "level.keyword": "ERROR" } }
- 時間範圍: { "range": { "@timestamp": { "gte": "now-1h" } } }
- 服務過濾: { "term": { "service.keyword": "payment-service" } }
- 全文搜尋: { "match": { "message": "database timeout" } }
`;

        const userMessage = `自然語言查詢: ${input.naturalQuery}

${input.userContext ? `使用者上下文:
- 預設服務: ${input.userContext.defaultService || 'N/A'}
- 預設 Namespace: ${input.userContext.defaultNamespace || 'N/A'}
` : ''}${input.availableIndices ? `可用 Indices: ${input.availableIndices.join(', ')}` : ''}`;

        try {
            llmLogger.log('nl-to-es-query', { prompt: `${systemPrompt}\n\n${userMessage}` });

            const response = await this.client.chat.completions.create({
                model: this.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMessage },
                ],
                temperature: 0,
                response_format: { type: 'json_object' },
            });

            const content = response.choices[0]?.message?.content;
            if (!content) {
                throw new Error('No response from OpenAI');
            }

            llmLogger.log('nl-to-es-query', { response: content });

            return JSON.parse(content);
        } catch (error) {
            console.error('[OpenAI Client] translateNLToESQuery error:', error);
            throw error;
        }
    }

    /**
     * 2. 分析錯誤模式
     */
    async analyzeErrorPatterns(input: {
        errors: Array<{ message: string; count: number; firstSeen: string; lastSeen: string }>;
        context?: string;
    }): Promise<{
        patterns: Array<{
            pattern: string;
            severity: 'critical' | 'warning' | 'info';
            description: string;
            potentialCause: string;
            recommendations: string[];
        }>;
    }> {
        const systemPrompt = `你是 SRE 專家，分析錯誤日誌模式。

## 輸出格式（JSON）
{
  "patterns": [
    {
      "pattern": "錯誤模式名稱",
      "severity": "critical" | "warning" | "info",
      "description": "模式描述",
      "potentialCause": "可能原因",
      "recommendations": ["建議1", "建議2"]
    }
  ]
}`;

        const errorSummary = input.errors.map(e =>
            `- "${e.message}" (出現 ${e.count} 次，${e.firstSeen} ~ ${e.lastSeen})`
        ).join('\n');

        const userMessage = `請分析以下錯誤模式：

${errorSummary}

${input.context ? `上下文: ${input.context}` : ''}`;

        try {
            llmLogger.log('analyze-patterns', {
                prompt: `${systemPrompt}\n\n${userMessage}`,
                metadata: { errorCount: input.errors.length }
            });

            const response = await this.client.chat.completions.create({
                model: this.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMessage },
                ],
                temperature: 0,
                response_format: { type: 'json_object' },
            });

            const content = response.choices[0]?.message?.content;
            if (!content) {
                throw new Error('No response from OpenAI');
            }

            llmLogger.log('analyze-patterns', { response: content });

            return JSON.parse(content);
        } catch (error) {
            console.error('[OpenAI Client] analyzeErrorPatterns error:', error);
            throw error;
        }
    }

    /**
     * 3. 日誌摘要
     */
    async summarizeLogs(input: {
        logs: LogEntry[];
        query?: string;
    }): Promise<{
        summary: string;
        keyFindings: string[];
        errorCount: number;
        topErrors: Array<{ message: string; count: number }>;
    }> {
        const systemPrompt = `你是 SRE 專家，總結日誌內容。

## 輸出格式（JSON）
{
  "summary": "整體摘要（繁體中文）",
  "keyFindings": ["發現1", "發現2"],
  "errorCount": 10,
  "topErrors": [
    { "message": "錯誤訊息", "count": 5 }
  ]
}`;

        // 統計錯誤
        const errorLogs = input.logs.filter(l => l.level === 'ERROR');
        const errorMessages = new Map<string, number>();
        errorLogs.forEach(log => {
            const msg = log.message.substring(0, 100); // 截斷太長的訊息
            errorMessages.set(msg, (errorMessages.get(msg) || 0) + 1);
        });

        const topErrors = Array.from(errorMessages.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([message, count]) => ({ message, count }));

        const logSample = input.logs.slice(0, 50).map(l =>
            `[${l.level}] ${l.timestamp} ${l.service || ''}: ${l.message.substring(0, 150)}`
        ).join('\n');

        const userMessage = `請總結以下日誌（共 ${input.logs.length} 筆）：

${input.query ? `查詢條件: ${input.query}\n` : ''}總錯誤數: ${errorLogs.length}

日誌樣本:
${logSample}

${topErrors.length > 0 ? `\n常見錯誤:\n${topErrors.map(e => `- ${e.message} (${e.count}次)`).join('\n')}` : ''}`;

        try {
            llmLogger.log('summarize', {
                prompt: `${systemPrompt}\n\n${userMessage}`,
                metadata: { totalLogs: input.logs.length, errors: errorLogs.length }
            });

            const response = await this.client.chat.completions.create({
                model: this.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userMessage },
                ],
                temperature: 0,
                response_format: { type: 'json_object' },
            });

            const content = response.choices[0]?.message?.content;
            if (!content) {
                throw new Error('No response from OpenAI');
            }

            llmLogger.log('summarize', { response: content });

            const result = JSON.parse(content);

            // 確保包含統計數據
            return {
                ...result,
                errorCount: errorLogs.length,
                topErrors,
            };
        } catch (error) {
            console.error('[OpenAI Client] summarizeLogs error:', error);
            throw error;
        }
    }
}
