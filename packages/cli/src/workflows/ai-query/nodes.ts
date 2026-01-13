/**
 * AI Query Workflow - Nodes
 * 
 * 定義 LangGraph workflow 的各個節點
 */

import type { ChatOpenAI } from '@langchain/openai';
import { llmLogger } from '../../utils/llm-logger.js';
import type { MCPClientManager, MCPToolInfo } from '../../mcp/manager.js';
import type { WorkflowState } from './state.js';

/**
 * Analyze Node - 分析用戶意圖
 */
export async function analyzeNode(
    state: WorkflowState,
    llm: ChatOpenAI,
    availableTools: MCPToolInfo[]
): Promise<Partial<WorkflowState>> {
    const toolsDescription = availableTools
        .map(t => `- ${t.serverId}.${t.name}: ${t.description}`)
        .join('\n');

    const prompt = `你是一位 SRE 專家助手。分析用戶的查詢並判斷意圖。

可用的工具：
${toolsDescription}

用戶查詢：${state.userQuery}

請用一句話描述用戶的意圖（繁體中文）。`;

    llmLogger.log('analyze', { prompt });
    const response = await llm.invoke(prompt);
    const intent = response.content.toString();
    llmLogger.log('analyze', { response: intent });

    return { intent };
}

/**
 * Plan Node - 規劃要執行的 tools
 */
export async function planNode(
    state: WorkflowState,
    llm: ChatOpenAI,
    availableTools: MCPToolInfo[]
): Promise<Partial<WorkflowState>> {
    const toolsDescription = availableTools
        .map(t => ({
            id: `${t.serverId}.${t.name}`,
            description: t.description,
            parameters: t.inputSchema,
        }))
        .map(t => `- ${t.id}: ${t.description}`)
        .join('\n');

    const prompt = `你是一位 SRE 專家助手。根據用戶意圖，選擇適當的工具並準備參數。

用戶意圖：${state.intent}
用戶原始查詢：${state.userQuery}

可用工具：
${toolsDescription}

請以 JSON 格式回應，包含要執行的工具列表：
{
  "tools": [
    {
      "serverId": "slo",
      "toolName": "track_slo_status",
      "args": {},
      "reasoning": "查詢 SLO 狀態"
    }
  ]
}

只返回 JSON，不要其他說明。`;

    llmLogger.log('plan', { prompt });
    const response = await llm.invoke(prompt);
    const content = response.content.toString();
    llmLogger.log('plan', { response: content });

    try {
        // 嘗試解析 JSON
        let jsonStr = content;
        const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/);
        if (jsonMatch) {
            jsonStr = jsonMatch[1] || '';
        }

        const parsed = JSON.parse(jsonStr);
        return { selectedTools: parsed.tools || [] };
    } catch (error) {
        console.error('[Workflow] Failed to parse plan:', error);
        return {
            selectedTools: [],
            error: 'Failed to create execution plan'
        };
    }
}

/**
 * Execute Node - 執行 MCP tools
 */
export async function executeNode(
    state: WorkflowState,
    mcpManager: MCPClientManager
): Promise<Partial<WorkflowState>> {
    const results: WorkflowState['results'] = [];

    for (const tool of state.selectedTools) {
        try {
            const data = await mcpManager.callTool(
                tool.serverId,
                tool.toolName,
                tool.args
            );

            results.push({
                tool: `${tool.serverId}.${tool.toolName}`,
                success: true,
                data,
            });
        } catch (error) {
            results.push({
                tool: `${tool.serverId}.${tool.toolName}`,
                success: false,
                data: {
                    error: error instanceof Error ? error.message : String(error)
                },
            });
        }
    }

    return { results };
}

/**
 * Synthesize Node - 整合結果並生成回應
 */
export async function synthesizeNode(
    state: WorkflowState,
    llm: ChatOpenAI
): Promise<Partial<WorkflowState>> {
    const resultsDescription = state.results
        .map(r => `工具: ${r.tool}\n結果: ${JSON.stringify(r.data, null, 2)}`)
        .join('\n\n');

    const prompt = `你是一位 SRE 專家助手。根據執行結果，為用戶生成友善的回應。

用戶查詢：${state.userQuery}
用戶意圖：${state.intent}

執行結果：
${resultsDescription}

請用繁體中文生成簡潔、清楚的回應，包含：
1. 摘要主要發現
2. 關鍵數據（如果有）
3. 建議（如果適用）

使用 markdown 格式讓輸出更易讀。`;

    llmLogger.log('synthesize', { prompt, metadata: { intent: state.intent } });
    const response = await llm.invoke(prompt);
    const finalResponse = response.content.toString();
    llmLogger.log('synthesize', { response: finalResponse });

    return { response: finalResponse };
}
