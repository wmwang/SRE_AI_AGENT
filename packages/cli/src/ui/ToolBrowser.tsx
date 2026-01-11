import { useState } from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import type { MCPToolInfo } from '../mcp/manager.js';

interface ToolBrowserProps {
    tools: MCPToolInfo[];
    onSelectTool: (tool: MCPToolInfo) => void;
    onBack: () => void;
}

export function ToolBrowser({ tools, onSelectTool, onBack }: ToolBrowserProps) {
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

    // Group tools by server (category)
    const categories = Array.from(new Set(tools.map((t) => t.serverName)));

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

    // 1. Category Selection View
    if (!selectedCategory) {
        const items = [
            ...categories.map((c) => ({ label: c, value: c })),
            { label: '⬅️ 返回主選單', value: 'back' },
        ];

        return (
            <Box flexDirection="column">
                <Box marginBottom={1}>
                    <Text bold>選擇工具類別：</Text>
                </Box>
                <SelectInput items={items} onSelect={handleCategorySelect} />
            </Box>
        );
    }

    // 2. Tool Selection View
    const categoryTools = tools.filter((t) => t.serverName === selectedCategory);
    const items = [
        ...categoryTools.map((t) => ({ label: t.name, value: t.name })),
        { label: '⬅️ 返回類別列表', value: 'back' },
    ];

    return (
        <Box flexDirection="column">
            <Box marginBottom={1}>
                <Text bold>選擇工具 ({selectedCategory})：</Text>
            </Box>
            <SelectInput
                items={items}
                onSelect={handleToolSelect}
                onHighlight={() => {
                    // Show description when highlighted? (Needs state)
                }}
            />
            {/* Show description for the list context would be nice, but simple list first */}
        </Box>
    );
}
