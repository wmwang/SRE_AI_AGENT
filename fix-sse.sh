#!/bin/bash
# 快速將 OpenAI API 改為 SSE 模式的腳本

FILE="packages/mcp-metrics-analysis/src/clients/openai.ts"

# 備份
cp "$FILE" "$FILE.bak"

# 將兩處的 response_format 改為 stream: true
perl -i -pe 's/response_format: \{ type: '"'"'json_object'"'"' \},/stream: true,/' "$FILE"

# 將兩處的 const response = 改為 const stream =
perl -i -pe 's/const response = await this\.client\.chat\.completions\.create\(/const stream = await this.client.chat.completions.create(/' "$FILE"

echo "✅ 已將 OpenAI API 改為 SSE 模式"
echo "請手動："
echo "1. 在每個 stream 後加入收集邏輯"
echo "2. 修改日誌記錄"
echo "3. 執行 pnpm --filter @sre-agent/mcp-metrics-analysis build"
