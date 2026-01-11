#!/usr/bin/env node
import { runServer } from './server.js';

runServer().catch((error) => {
    console.error('[K8s Deployment MCP Server] Fatal error:', error);
    process.exit(1);
});
