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

**重要指導原則**：
1. **參數提取範例**：
   - 如果用戶說「Web 應用程式」或「幫我生成 API 服務的 SLO」，提取 serviceType 為 "web" 或 "api"
   - 如果用戶說「一個處理支付的 API」，提取 serviceType="api", description="處理支付的 API"
   - 服務類型常見值：web, api, database, cache, queue

2. **嚴格的參數驗證**：
   - 對於 recommend_slos 工具，serviceType 是**必須參數**
   - 如果用戶只說「我想要 SLO 建議」而沒有提及任何服務類型（web、api、database 等），**必須**返回 needsMoreInfo=true
   - **禁止猜測或虛構服務類型**，即使是常見的類型（如 payment, user, order 等）

3. 不要使用 undefined/null 作為參數值
4. 在 missingInfo 中，提供具體的範例查詢

請以 JSON 格式回應：
{
  "needsMoreInfo": false,
  "missingInfo": "",
  "tools": [
    {
      "serverId": "slo",
      "toolName": "recommend_slos",
      "args": { "serviceType": "api", "description": "處理支付" },
      "reasoning": "用戶要求生成 API 服務的 SLO"
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

        // 檢查是否需要更多資訊
        if (parsed.needsMoreInfo) {
            return {
                selectedTools: [],
                needsMoreInfo: true,
                missingInfo: parsed.missingInfo || '需要更多資訊才能執行此操作',
            };
        }

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
    // 如果需要更多資訊，直接返回引導性回應
    if (state.needsMoreInfo) {
        return {
            response: `### ℹ️ 需要更多資訊\n\n${state.missingInfo}\n\n💡 **提示**：按 ESC 返回主選單，然後選擇「AI Query」重新輸入查詢。`
        };
    }

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
