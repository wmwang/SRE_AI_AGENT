import { ChatOpenAI } from '@langchain/openai';
import type { MCPClientManager, MCPToolInfo } from '../mcp/manager.js';
import { getConfig } from '../config.js';

/**
 * Workflow State
 */
export interface WorkflowState {
    userQuery: string;
    intent: string;
    selectedTools: Array<{
        serverId: string;
        toolName: string;
        args: Record<string, unknown>;
        reasoning: string;
    }>;
    results: Array<{
        tool: string;
        success: boolean;
        data: object;
    }>;
    response: string;
    error?: string;
}

/**
 * SRE Agent Workflow
 * 
 * 簡化實作：順序執行各個步驟
 */
export class SREAgentWorkflow {
    private llm: ChatOpenAI;
    private mcpManager: MCPClientManager;
    private availableTools: MCPToolInfo[];

    constructor(mcpManager: MCPClientManager) {
        const config = getConfig();
        this.mcpManager = mcpManager;
        this.availableTools = mcpManager.listAllTools();

        this.llm = new ChatOpenAI({
            apiKey: config.openai.apiKey,
            configuration: {
                baseURL: config.openai.baseURL,
            },
            model: config.openai.model,
            temperature: 0,
        });
    }

    /**
     * Analyze node - 分析用戶意圖
     */
    private async analyzeNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
        const toolsDescription = this.availableTools
            .map(t => `- ${t.serverId}.${t.name}: ${t.description}`)
            .join('\n');

        const prompt = `你是一位 SRE 專家助手。分析用戶的查詢並判斷意圖。

可用的工具：
${toolsDescription}

用戶查詢：${state.userQuery}

請用一句話描述用戶的意圖（繁體中文）。`;

        const response = await this.llm.invoke(prompt);
        const intent = response.content.toString();

        return { intent };
    }

    /**
     * Plan node - 規劃要執行的 tools
     */
    private async planNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
        const toolsDescription = this.availableTools
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

        const response = await this.llm.invoke(prompt);
        const content = response.content.toString();

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
     * Execute node - 執行 MCP tools
     */
    private async executeNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
        const results: WorkflowState['results'] = [];

        for (const tool of state.selectedTools) {
            try {
                const data = await this.mcpManager.callTool(
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
     * Synthesize node - 整合結果並生成回應
     */
    private async synthesizeNode(state: WorkflowState): Promise<Partial<WorkflowState>> {
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

        const response = await this.llm.invoke(prompt);
        const finalResponse = response.content.toString();

        return { response: finalResponse };
    }

    /**
     * 執行查詢（順序執行各步驟）
     */
    async run(userQuery: string): Promise<WorkflowState> {
        let state: WorkflowState = {
            userQuery,
            intent: '',
            selectedTools: [],
            results: [],
            response: '',
        };

        try {
            // Step 1: Analyze
            const analyzeUpdate = await this.analyzeNode(state);
            state = { ...state, ...analyzeUpdate };

            // Step 2: Plan
            const planUpdate = await this.planNode(state);
            state = { ...state, ...planUpdate };

            // Step 3: Execute
            const executeUpdate = await this.executeNode(state);
            state = { ...state, ...executeUpdate };

            // Step 4: Synthesize
            const synthesizeUpdate = await this.synthesizeNode(state);
            state = { ...state, ...synthesizeUpdate };

            return state;
        } catch (error) {
            return {
                ...state,
                error: error instanceof Error ? error.message : String(error),
                response: '抱歉，處理您的查詢時發生錯誤。',
            };
        }
    }
}
