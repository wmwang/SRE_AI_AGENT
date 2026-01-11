import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';

interface MainMenuProps {
    onSelectCallback: (value: string) => void;
}

export function MainMenu({ onSelectCallback }: MainMenuProps) {
    const items = [
        {
            label: '🤖 自然語言查詢 (AI 助手)',
            value: 'ai',
        },
        {
            label: '🎯 SLO 自動生成精靈',
            value: 'slo_workflow',
        },
        {
            label: '📊 Metrics Explorer (自然語言查詢指標)',
            value: 'metrics_explorer',
        },
        {
            label: '🛠️  瀏覽工具箱 (手動模式)',
            value: 'tools',
        },
        {
            label: '❌ 退出',
            value: 'exit',
        },
    ];

    return (
        <Box flexDirection="column">
            <Box marginBottom={1}>
                <Text bold>請選擇操作模式：</Text>
            </Box>
            <SelectInput
                items={items}
                onSelect={(item) => onSelectCallback(item.value)}
            />
        </Box>
    );
}
