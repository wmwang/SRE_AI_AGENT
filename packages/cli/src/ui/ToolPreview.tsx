import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import type { MCPToolInfo } from '../mcp/manager.js';

interface ToolPreviewProps {
    tool: MCPToolInfo;
    onConfirm: () => void;
    onBack: () => void;
}

// JSON Schema property type
interface JSONSchemaProperty {
    type?: string;
    description?: string;
    enum?: string[];
}

// Parse JSON Schema
function parseSchema(schema: any): {
    fields: string[];
    properties: Record<string, JSONSchemaProperty>;
    required: string[];
} {
    if (!schema) return { fields: [], properties: {}, required: [] };

    if (schema.type === 'object' && schema.properties) {
        return {
            fields: Object.keys(schema.properties),
            properties: schema.properties,
            required: schema.required || [],
        };
    }

    return { fields: [], properties: {}, required: [] };
}

// Check if field likely needs file input
function isFileField(name: string): boolean {
    return ['manifests', 'yaml', 'config', 'file'].some(f =>
        name.toLowerCase().includes(f)
    );
}

export function ToolPreview({ tool, onConfirm, onBack }: ToolPreviewProps) {
    const { fields, properties, required } = parseSchema(tool.inputSchema);

    const menuItems = [
        { label: '✅ 開始填寫參數', value: 'confirm' },
        { label: '⬅️ 返回工具列表', value: 'back' },
    ];

    return (
        <Box flexDirection="column" padding={1}>
            {/* Tool Header */}
            <Box borderStyle="double" borderColor="cyan" padding={1} marginBottom={1}>
                <Box flexDirection="column">
                    <Text bold color="cyan">🛠️  {tool.name}</Text>
                    <Text dimColor>{tool.description}</Text>
                </Box>
            </Box>

            {/* Parameters List */}
            <Box flexDirection="column" marginBottom={1}>
                <Text bold underline>需要輸入的參數：</Text>
                <Box marginTop={1} flexDirection="column">
                    {fields.length === 0 ? (
                        <Text dimColor>  (無需參數)</Text>
                    ) : (
                        fields.map((fieldName, index) => {
                            const prop = properties[fieldName] || {};
                            const isReq = required.includes(fieldName);
                            const isFile = isFileField(fieldName);
                            const isEnum = Array.isArray(prop.enum);

                            return (
                                <Box key={fieldName} marginLeft={1}>
                                    <Text>
                                        {index + 1}. <Text bold>{fieldName}</Text>
                                        {isReq ? <Text color="red"> *必填</Text> : <Text dimColor> (選填)</Text>}
                                    </Text>
                                    <Text dimColor>
                                        {' - '}{prop.description || '無說明'}
                                        {isFile && <Text color="yellow"> [可輸入檔案路徑]</Text>}
                                        {isEnum && <Text color="blue"> [選單]</Text>}
                                    </Text>
                                </Box>
                            );
                        })
                    )}
                </Box>
            </Box>

            {/* Action Menu */}
            <Box marginTop={1}>
                <SelectInput
                    items={menuItems}
                    onSelect={(item) => {
                        if (item.value === 'confirm') onConfirm();
                        if (item.value === 'back') onBack();
                    }}
                />
            </Box>
        </Box>
    );
}
