/**
 * API Gateway - SRE AI Agent
 * 
 * 提供 HTTP API 介面，將請求轉換為 MCP 呼叫
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { streamSSE } from 'hono/streaming';
import { MCPClientManager } from './mcp/manager.js';

const app = new Hono();

// CORS 設定
app.use('*', cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
}));

// MCP Manager 實例
let mcpManager: MCPClientManager | null = null;

// 健康檢查
app.get('/health', (c) => c.json({ status: 'ok', mcp: mcpManager ? 'connected' : 'disconnected' }));

// 取得所有可用工具
app.get('/api/tools', async (c) => {
    if (!mcpManager) {
        return c.json({ error: 'MCP Manager not initialized' }, 500);
    }

    const tools = mcpManager.listAllTools();
    return c.json({ tools });
});

// 呼叫工具
app.post('/api/tools/:server/:tool', async (c) => {
    if (!mcpManager) {
        return c.json({ error: 'MCP Manager not initialized' }, 500);
    }

    const { server, tool } = c.req.param();
    const args = await c.req.json();

    try {
        const result = await mcpManager.callTool(server, tool, args);
        return c.json({ success: true, result });
    } catch (error) {
        return c.json({
            success: false,
            error: error instanceof Error ? error.message : String(error)
        }, 500);
    }
});

// ============================================
// SLO Workflow API
// ============================================

// 分析 K8s YAML 並生成初始 SLO 建議
app.post('/api/slo/analyze', async (c) => {
    if (!mcpManager) {
        return c.json({ error: 'MCP Manager not initialized' }, 500);
    }

    try {
        const { yamlContent } = await c.req.json();

        // 呼叫 MCP SLO Server 的 analyze_k8s_manifests 工具
        const result = await mcpManager.callTool('slo', 'analyze_k8s_manifests', {
            manifests: yamlContent,
        });

        return c.json({ success: true, result });
    } catch (error) {
        console.error('[API] Error analyzing YAML:', error);
        return c.json({
            success: false,
            error: error instanceof Error ? error.message : String(error)
        }, 500);
    }
});

// AI 協助調整 SLO
app.post('/api/slo/refine', async (c) => {
    if (!mcpManager) {
        return c.json({ error: 'MCP Manager not initialized' }, 500);
    }

    try {
        const { currentSlos, feedback, serviceName } = await c.req.json();

        // 呼叫 MCP SLO Server 的 recommend_slos 工具，帶入用戶反饋
        const result = await mcpManager.callTool('slo', 'recommend_slos', {
            service_name: serviceName,
            service_type: 'api', // 預設為 API 服務
            user_feedback: feedback,
            current_slos: JSON.stringify(currentSlos),
        });

        return c.json({ success: true, result });
    } catch (error) {
        console.error('[API] Error refining SLOs:', error);
        return c.json({
            success: false,
            error: error instanceof Error ? error.message : String(error)
        }, 500);
    }
});

// 生成 Prometheus Rules 和 Grafana Dashboard
app.post('/api/slo/generate', async (c) => {
    if (!mcpManager) {
        return c.json({ error: 'MCP Manager not initialized' }, 500);
    }

    try {
        const { slos, serviceName } = await c.req.json();

        // 呼叫 MCP SLO Server 的 generate_prometheus_rules 工具
        const prometheusResult = await mcpManager.callTool('slo', 'generate_prometheus_rules', {
            slos: JSON.stringify(slos),
            service_name: serviceName,
        });

        // 呼叫 MCP SLO Server 的 generate_grafana_dashboard 工具
        const grafanaResult = await mcpManager.callTool('slo', 'generate_grafana_dashboard', {
            slos: JSON.stringify(slos),
            service_name: serviceName,
        });

        return c.json({
            success: true,
            result: {
                prometheusRules: prometheusResult,
                grafanaDashboard: grafanaResult,
            }
        });
    } catch (error) {
        console.error('[API] Error generating configs:', error);
        return c.json({
            success: false,
            error: error instanceof Error ? error.message : String(error)
        }, 500);
    }
});

// ============================================
// Metrics Explorer API
// ============================================

// 自然語言查詢 Prometheus
app.post('/api/metrics/query', async (c) => {
    if (!mcpManager) {
        return c.json({ error: 'MCP Manager not initialized' }, 500);
    }

    try {
        const { query } = await c.req.json();

        // 呼叫 MCP Metrics Server 的 translate_nl_to_promql 工具
        const translateResult = await mcpManager.callTool('metrics', 'translate_nl_to_promql', {
            query: query,
        });

        return c.json({ success: true, result: translateResult });
    } catch (error) {
        console.error('[API] Error translating query:', error);
        return c.json({
            success: false,
            error: error instanceof Error ? error.message : String(error)
        }, 500);
    }
});

// AI 診斷分析
app.post('/api/metrics/diagnose', async (c) => {
    if (!mcpManager) {
        return c.json({ error: 'MCP Manager not initialized' }, 500);
    }

    try {
        const { metricsData, context } = await c.req.json();

        // 呼叫 MCP Metrics Server 的 analyze_metrics_health 工具
        const result = await mcpManager.callTool('metrics', 'analyze_metrics_health', {
            metrics_data: JSON.stringify(metricsData),
            context: context || 'general health check',
        });

        return c.json({ success: true, result });
    } catch (error) {
        console.error('[API] Error diagnosing:', error);
        return c.json({
            success: false,
            error: error instanceof Error ? error.message : String(error)
        }, 500);
    }
});

// SSE 端點：串流 AI 回應
app.get('/api/stream/analyze', async (c) => {
    return streamSSE(c, async (stream) => {
        await stream.writeSSE({ data: JSON.stringify({ status: 'connected' }) });

        // TODO: 實作實際的 AI 串流
        await stream.writeSSE({ data: JSON.stringify({ status: 'done' }) });
    });
});

// 啟動伺服器
async function main() {
    console.log('🚀 Starting API Gateway...');

    // 初始化 MCP Manager
    mcpManager = new MCPClientManager();

    try {
        await mcpManager.initialize();
        console.log('✅ MCP Manager initialized');
        console.log(`📋 Available tools: ${mcpManager.listAllTools().length}`);
    } catch (error) {
        console.error('⚠️ Warning: Failed to initialize some MCP servers:', error);
        console.log('API will start but some features may not work.');
    }

    const port = parseInt(process.env.API_PORT || '3001');

    serve({
        fetch: app.fetch,
        port,
    });

    console.log(`🌐 API Gateway running at http://localhost:${port}`);
    console.log('');
    console.log('Available endpoints:');
    console.log('  GET  /health              - Health check');
    console.log('  GET  /api/tools           - List all MCP tools');
    console.log('  POST /api/tools/:s/:t     - Call an MCP tool');
    console.log('  POST /api/slo/analyze     - Analyze K8s YAML');
    console.log('  POST /api/slo/refine      - AI refine SLOs');
    console.log('  POST /api/slo/generate    - Generate Prometheus/Grafana configs');
    console.log('  POST /api/metrics/query   - Translate NL to PromQL');
    console.log('  POST /api/metrics/diagnose - AI diagnosis');
}

main().catch(console.error);
