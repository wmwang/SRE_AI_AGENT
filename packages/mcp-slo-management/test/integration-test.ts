#!/usr/bin/env node

/**
 * SLO Management Server 測試腳本
 * 
 * 這個腳本會建立一個 MCP client 並測試所有的 tools
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testSLOManagementServer() {
    console.log('🚀 開始測試 SLO Management MCP Server...\n');

    // 建立 MCP Client
    const client = new Client(
        {
            name: 'test-client',
            version: '1.0.0',
        },
        {
            capabilities: {},
        }
    );

    // 連接到 Server
    const transport = new StdioClientTransport({
        command: 'node',
        args: [join(__dirname, '../dist/index.js')],
        env: process.env as Record<string, string>,
    });

    await client.connect(transport);
    console.log('✅ 已連接到 SLO Management Server\n');

    try {
        // 測試 1: 列出所有 tools
        console.log('📋 測試 1: 列出所有可用的 tools');
        console.log('─'.repeat(50));
        const toolsList = await client.listTools();
        console.log(`找到 ${toolsList.tools.length} 個 tools:`);
        toolsList.tools.forEach((tool, index) => {
            console.log(`  ${index + 1}. ${tool.name}`);
            console.log(`     ${tool.description}`);
        });
        console.log('');

        // 測試 2: analyze_k8s_manifests
        console.log('📋 測試 2: analyze_k8s_manifests');
        console.log('─'.repeat(50));

        const manifestPath = join(__dirname, '../test-data/guestbook.yaml');
        const manifests = readFileSync(manifestPath, 'utf-8');

        console.log('讀取測試 manifest:', manifestPath);
        console.log('呼叫 analyze_k8s_manifests...\n');

        const analyzeResult = await client.callTool({
            name: 'analyze_k8s_manifests',
            arguments: {
                manifests,
                serviceId: 'guestbook-service',
            },
        });

        const analyzeParsed = JSON.parse((analyzeResult.content[0] as any).text);
        console.log('結果:');
        console.log(JSON.stringify(analyzeParsed, null, 2));
        console.log('');

        if (analyzeParsed.success) {
            console.log(`✅ 成功分析並建立 ${analyzeParsed.slosCount} 個 SLO\n`);

            // 測試 3: track_slo_status
            console.log('📋 測試 3: track_slo_status');
            console.log('─'.repeat(50));

            const trackResult = await client.callTool({
                name: 'track_slo_status',
                arguments: {
                    serviceId: 'guestbook-service',
                },
            });

            const trackParsed = JSON.parse((trackResult.content[0] as any).text);
            console.log('結果:');
            console.log(JSON.stringify(trackParsed, null, 2));
            console.log('');

            // 測試 4: calculate_error_budget (使用第一個 SLO)
            if (analyzeParsed.slos && analyzeParsed.slos.length > 0) {
                const sloId = analyzeParsed.slos[0].id;

                console.log('📋 測試 4: calculate_error_budget');
                console.log('─'.repeat(50));
                console.log(`測試 SLO ID: ${sloId}\n`);

                const budgetResult = await client.callTool({
                    name: 'calculate_error_budget',
                    arguments: {
                        sloId,
                    },
                });

                const budgetParsed = JSON.parse((budgetResult.content[0] as any).text);
                console.log('結果:');
                console.log(JSON.stringify(budgetParsed, null, 2));
                console.log('');
            }

            // 測試 5: recommend_slos
            console.log('📋 測試 5: recommend_slos');
            console.log('─'.repeat(50));

            const recommendResult = await client.callTool({
                name: 'recommend_slos',
                arguments: {
                    serviceType: 'web',
                    description: 'Frontend web application',
                },
            });

            const recommendParsed = JSON.parse((recommendResult.content[0] as any).text);
            console.log('結果:');
            console.log(JSON.stringify(recommendParsed, null, 2));
            console.log('');

            // 測試 6: generate_slo_report
            console.log('📋 測試 6: generate_slo_report');
            console.log('─'.repeat(50));

            const reportResult = await client.callTool({
                name: 'generate_slo_report',
                arguments: {
                    serviceId: 'guestbook-service',
                    period: '30d',
                },
            });

            const reportParsed = JSON.parse((reportResult.content[0] as any).text);
            console.log('結果:');
            console.log(JSON.stringify(reportParsed, null, 2));
            console.log('');

            console.log('🎉 所有測試完成！');
        }
    } catch (error) {
        console.error('❌ 測試失敗:', error);
        throw error;
    } finally {
        await client.close();
        console.log('\n✅ 已關閉連接');
    }
}

// 執行測試
testSLOManagementServer().catch((error) => {
    console.error('測試執行失敗:', error);
    process.exit(1);
});
