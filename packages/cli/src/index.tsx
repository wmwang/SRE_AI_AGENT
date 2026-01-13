#!/usr/bin/env node

import { render } from 'ink';
import { createMCPManager } from './mcp/index.js';
import { SREAgentWorkflow } from './workflows/ai-query/index.js';
import { App } from './ui/App.js';
import { debugLog } from './utils/debug.js';

/**
 * Main CLI Application
 */
async function main() {
    debugLog('[CLI] Starting SRE AI Agent...');

    // 初始化 MCP Manager
    const mcpManager = await createMCPManager();

    // 建立 Workflow
    const workflow = new SREAgentWorkflow(mcpManager);

    // State management
    let isProcessing = false;
    let currentStep = '';
    let response = '';
    let error = '';

    // 查詢處理函數
    const handleQuery = async (query: string) => {
        isProcessing = true;
        currentStep = '分析查詢...';
        response = '';
        error = '';

        try {
            // 執行 workflow
            currentStep = '執行中...';
            const result = await workflow.run(query);

            // 更新回應
            response = result.response;
            currentStep = '';
        } catch (err) {
            error = err instanceof Error ? err.message : String(err);
            currentStep = '';
        } finally {
            isProcessing = false;
        }
    };

    // 處理直接工具調用
    const handleExecuteTool = async (tool: any, args: any) => {
        isProcessing = true;
        currentStep = `正在執行 ${tool.name}...`;
        response = '';
        error = '';

        try {
            const result = await mcpManager.callTool(tool.serverId, tool.name, args);
            response = ''; // Reset AI response
            // Direct tool execution result is returned to be handled by UI state
            return result;
        } catch (err) {
            error = err instanceof Error ? err.message : String(err);
            throw err;
        } finally {
            isProcessing = false;
            currentStep = '';
        }
    };

    // 清除畫面，創造全螢幕效果
    process.stdout.write('\x1b[2J\x1b[H');  // ANSI: 清除畫面 + 游標移到左上角

    // 渲染 UI（全螢幕模式）
    const { rerender, unmount } = render(
        <App
            onQuery={handleQuery}
            onExecuteTool={handleExecuteTool}
            mcpManager={mcpManager}
            isProcessing={isProcessing}
            currentStep={currentStep}
            response={response}
            error={error}
        />,
        { exitOnCtrlC: false }  // 讓我們自己處理 Ctrl+C
    );

    // 定期更新 UI
    const updateInterval = setInterval(() => {
        rerender(
            <App
                onQuery={handleQuery}
                onExecuteTool={handleExecuteTool}
                mcpManager={mcpManager}
                isProcessing={isProcessing}
                currentStep={currentStep}
                response={response}
                error={error}
            />
        );
    }, 100);

    // Cleanup on exit
    process.on('SIGINT', async () => {
        clearInterval(updateInterval);
        unmount();
        await mcpManager.disconnectAll();
        process.exit(0);
    });
}

main().catch((error) => {
    console.error('[CLI] Fatal error:', error);
    process.exit(1);
});
