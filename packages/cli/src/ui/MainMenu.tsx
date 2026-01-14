import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';

interface MainMenuProps {
    onSelectCallback: (value: string) => void;
}

export function MainMenu({ onSelectCallback }: MainMenuProps) {
    const items = [
        {
            label: '[1] AI Query - Natural Language Assistant',
            value: 'ai',
        },
        {
            label: '[2] SLO Workflow - Generate SLO from K8s YAML',
            value: 'slo_workflow',
        },
        {
            label: '[3] Metrics Explorer - Query Prometheus',
            value: 'metrics_explorer',
        },
        {
            label: '[4] Log Explorer - Search & Analyze Logs',
            value: 'log_explorer',
        },
        {
            label: '[5] Tool Browser - Browse MCP Tools',
            value: 'tools',
        },
        {
            label: '[x] Exit',
            value: 'exit',
        },
    ];

    return (
        <Box flexDirection="column">
            <Box marginBottom={1}>
                <Text bold>Select Mode:</Text>
            </Box>
            <SelectInput
                items={items}
                onSelect={(item) => onSelectCallback(item.value)}
            />
        </Box>
    );
}
