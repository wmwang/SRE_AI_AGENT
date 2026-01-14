#!/usr/bin/env node

/**
 * K8s Deployment MCP Server Integration Test
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testK8sDeploymentServer() {
    console.log('🚀 Starting K8s Deployment MCP Server Test...\n');

    // Create MCP Client
    const client = new Client(
        {
            name: 'test-client',
            version: '1.0.0',
        },
        {
            capabilities: {},
        }
    );

    // Connect to Server
    const transport = new StdioClientTransport({
        command: 'node',
        args: [join(__dirname, '../dist/index.js')],
        env: process.env as Record<string, string>,
    });

    await client.connect(transport);
    console.log('✅ Connected to K8s Deployment Server\n');

    try {
        // Test 1: List Tools
        console.log('📋 Test 1: List Tools');
        console.log('─'.repeat(50));
        const toolsList = await client.listTools();
        console.log(`Found ${toolsList.tools.length} tools:`);
        toolsList.tools.forEach((tool, index) => {
            console.log(`  ${index + 1}. ${tool.name}`);
        });
        console.log('');

        // Test 2: Analyze Deployment
        console.log('📋 Test 2: analyze_deployment');
        console.log('─'.repeat(50));

        const yamlPath = join(__dirname, '../test-data/demo-app.yaml');
        const yamlContent = readFileSync(yamlPath, 'utf-8');

        console.log('Reading test YAML:', yamlPath);
        console.log('Calling analyze_deployment...\n');

        const analyzeResult = await client.callTool({
            name: 'analyze_deployment',
            arguments: {
                yaml: yamlContent,
            },
        });

        const resultText = (analyzeResult.content[0] as any).text;
        console.log('Result:');
        console.log(resultText);

        try {
            JSON.parse(resultText);
            console.log('\n✅ Valid JSON response');
        } catch (e) {
            console.error('\n❌ Invalid JSON response');
        }

    } catch (error) {
        console.error('❌ Test Failed:', error);
        throw error;
    } finally {
        await client.close();
        console.log('\n✅ Connection Closed');
    }
}

testK8sDeploymentServer().catch((error) => {
    console.error('Test execution failed:', error);
    process.exit(1);
});
