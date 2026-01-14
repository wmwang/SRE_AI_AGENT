import { useState } from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import type { MCPToolInfo } from '../mcp/manager.js';

interface ToolBrowserProps {
    tools: MCPToolInfo[];
    onSelectTool: (tool: MCPToolInfo) => void;
    onBack: () => void;
}

// 類別配色和圖標
const CATEGORY_STYLES: Record<string, { emoji: string; color: string; bgColor?: string }> = {
    'SLO Management': { emoji: '🎯', color: 'magenta' },
    'Metrics Analysis': { emoji: '📊', color: 'cyan' },
    'K8s Deployment': { emoji: '☸️', color: 'blue' },
    'default': { emoji: '🔧', color: 'white' },
};

export function ToolBrowser({ tools, onSelectTool, onBack }: ToolBrowserProps) {
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    // Group tools by server (category)
    const categories = Array.from(new Set(tools.map((t) => t.serverName)));

    // 計算每個類別的工具數量
    const getCategoryToolCount = (category: string) => {
        return tools.filter((t) => t.serverName === category).length;
    };

    // 取得類別樣式
    const getCategoryStyle = (category: string) => {
        return CATEGORY_STYLES[category] || CATEGORY_STYLES['default'];
    };

    // Category selection handler
    const handleCategorySelect = (item: { value: string }) => {
        if (item.value === 'back') {
            onBack();
        } else {
            setSelectedCategory(item.value);
        }
    };

    // Tool selection handler
    const handleToolSelect = (item: { value: string }) => {
        if (item.value === 'back') {
            setSelectedCategory(null);
        } else {
            const tool = tools.find((t) => t.name === item.value && t.serverName === selectedCategory);
            if (tool) onSelectTool(tool);
        }
    };

    // 1. Category Selection View (美化版)
    if (!selectedCategory) {
        const items = [
            ...categories.map((c) => {
                const style = getCategoryStyle(c);
                const count = getCategoryToolCount(c);
                return {
                    label: `${style?.emoji || '🔧'} ${c} (${count} 工具)`,
                    value: c,
                };
            }),
            { label: '⬅️ 返回主選單', value: 'back' },
        ];

        return (
            <Box flexDirection="column" padding={1}>
                {/* 標題 */}
                <Box borderStyle="double" borderColor="cyan" padding={1} marginBottom={1}>
                    <Text bold color="cyan">🔧 MCP 工具瀏覽器</Text>
                </Box>

                {/* 說明 */}
                <Box marginBottom={1}>
                    <Text dimColor>選擇一個類別以查看可用的工具</Text>
                </Box>

                {/* 類別列表 */}
                <Box flexDirection="column">
                    <Box marginBottom={1}>
                        <Text bold>📁 可用類別：</Text>
                    </Box>
                    <SelectInput items={items} onSelect={handleCategorySelect} />
                </Box>

                {/* 統計資訊 */}
                <Box marginTop={1} borderStyle="single" borderColor="gray" padding={1}>
                    <Text dimColor>
                        總計：{categories.length} 個類別，{tools.length} 個工具
                    </Text>
                </Box>
            </Box>
        );
    }

    // 2. Tool Selection View (美化版)
    const categoryTools = tools.filter((t) => t.serverName === selectedCategory);
    const style = getCategoryStyle(selectedCategory);

    const items = [
        ...categoryTools.map((t) => ({
            label: `🔹 ${t.name}`,
            value: t.name,
        })),
        { label: '⬅️ 返回類別列表', value: 'back' },
    ];

    return (
        <Box flexDirection="column" padding={1}>
            {/* 類別標題 */}
            <Box borderStyle="double" borderColor={(style?.color || 'white') as any} padding={1} marginBottom={1}>
                <Text bold color={(style?.color || 'white') as any}>
                    {style?.emoji || '🔧'} {selectedCategory}
                </Text>
            </Box>

            {/* 工具列表 */}
            <Box flexDirection="column">
                <Box marginBottom={1}>
                    <Text bold>
                        可用工具 ({categoryTools.length})：
                    </Text>
                </Box>
                <SelectInput items={items} onSelect={handleToolSelect} />
            </Box>

            {/* 提示 */}
            <Box marginTop={1}>
                <Text dimColor>💡 選擇工具以查看詳細資訊</Text>
            </Box>
        </Box>
    );
}
