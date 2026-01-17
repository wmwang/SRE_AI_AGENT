import { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import type { MCPToolInfo } from '../mcp/manager.js';
import * as fs from 'fs';
import * as path from 'path';

interface ParamFormProps {
    tool: MCPToolInfo;
    onSubmit: (args: Record<string, any>) => void;
    onCancel: () => void;
}

// JSON Schema property type
interface JSONSchemaProperty {
    type?: string;
    description?: string;
    enum?: string[];
    default?: any;
}

// JSON Schema object type
interface JSONSchemaObject {
    type: 'object';
    properties?: Record<string, JSONSchemaProperty>;
    required?: string[];
}

// Fields that should accept file paths
const FILE_INPUT_FIELDS = ['manifests', 'yaml', 'config', 'file'];

// Parse JSON Schema to get fields
function parseJSONSchema(schema: any): {
    fields: string[];
    properties: Record<string, JSONSchemaProperty>;
    required: string[];
} {
    if (!schema) {
        return { fields: [], properties: {}, required: [] };
    }

    if (schema.type === 'object' && schema.properties) {
        const jsonSchema = schema as JSONSchemaObject;
        return {
            fields: Object.keys(jsonSchema.properties || {}),
            properties: jsonSchema.properties || {},
            required: jsonSchema.required || [],
        };
    }

    if (schema.schema && schema.schema.type === 'object') {
        return parseJSONSchema(schema.schema);
    }

    if (typeof schema === 'object') {
        const props = schema.properties || schema;
        if (typeof props === 'object' && !Array.isArray(props)) {
            const fields = Object.keys(props).filter(k =>
                typeof props[k] === 'object' &&
                (props[k].type || props[k].description)
            );
            if (fields.length > 0) {
                return {
                    fields,
                    properties: props,
                    required: schema.required || [],
                };
            }
        }
    }

    return { fields: [], properties: {}, required: [] };
}

// Check if a field should accept file path
function isFileInputField(fieldName: string): boolean {
    return FILE_INPUT_FIELDS.some(f => fieldName.toLowerCase().includes(f));
}

// Read file content
function readFileContent(filePath: string): string | null {
    try {
        const resolvedPath = path.resolve(filePath);
        if (fs.existsSync(resolvedPath)) {
            return fs.readFileSync(resolvedPath, 'utf-8');
        }
        return null;
    } catch (error) {
        return null;
    }
}

export function ParamForm({ tool, onSubmit, onCancel }: ParamFormProps) {
    const [formValues, setFormValues] = useState<Record<string, any>>({});
    const [fieldIndex, setFieldIndex] = useState(0);
    const [initialized, setInitialized] = useState(false);
    const [fileError, setFileError] = useState<string | null>(null);

    // Parse JSON Schema
    const { fields, properties, required } = parseJSONSchema(tool.inputSchema);

    useEffect(() => {
        // Debug logs removed to prevent Windows flicker
        setInitialized(true);
    }, []);

    useEffect(() => {
        if (initialized && fields.length === 0) {
            onSubmit({});
        }
    }, [initialized, fields.length]);

    if (!initialized) {
        return <Text>載入中...</Text>;
    }

    if (fields.length === 0) {
        return <Text>無需參數，正在執行...</Text>;
    }

    const fieldName = fields[fieldIndex];
    if (!fieldName) {
        return <Text>載入中...</Text>;
    }

    const fieldDef = properties[fieldName] || {};
    const description = fieldDef.description || '';
    const isRequired = required.includes(fieldName);
    const isEnum = Array.isArray(fieldDef.enum) && fieldDef.enum.length > 0;
    const enumValues = fieldDef.enum || [];
    const isFileField = isFileInputField(fieldName);

    const handleNext = (value: any) => {
        setFileError(null);
        let finalValue = value;

        // If this is a file field, try to read the file
        if (isFileField && value && typeof value === 'string' && value.trim()) {
            const fileContent = readFileContent(value.trim());
            if (fileContent) {
                finalValue = fileContent;
            } else if (fs.existsSync(value.trim())) {
                // File exists but couldn't read
                setFileError(`無法讀取檔案: ${value}`);
                return;
            } else {
                // Not a valid path, use as raw content
                finalValue = value;
            }
        }

        const newValues = { ...formValues, [fieldName]: finalValue };
        setFormValues(newValues);

        if (fieldIndex < fields.length - 1) {
            setFieldIndex(fieldIndex + 1);
        } else {
            const finalArgs: Record<string, any> = {};
            Object.entries(newValues).forEach(([k, v]) => {
                if (v !== '' && v !== undefined) {
                    finalArgs[k] = v;
                }
            });
            onSubmit(finalArgs);
        }
    };

    return (
        <Box flexDirection="column">
            <Box borderStyle="round" borderColor="blue" padding={1} flexDirection="column">
                <Text bold color="cyan">【 參數 {fieldIndex + 1}/{fields.length}: {fieldName} 】</Text>
                <Text dimColor>{description} {isRequired ? '*必填' : '(選填)'}</Text>

                {/* Special hint for file fields */}
                {isFileField && (
                    <Box marginTop={1}>
                        <Text color="yellow">💡 提示: 可輸入檔案路徑 (如 ./guestbook.yaml)，系統會自動讀取內容</Text>
                    </Box>
                )}

                {/* Error message */}
                {fileError && (
                    <Box marginTop={1}>
                        <Text color="red">❌ {fileError}</Text>
                    </Box>
                )}

                <Box marginTop={1}>
                    {isEnum ? (
                        <SelectInput
                            items={enumValues.map((v: string) => ({ label: v, value: v }))}
                            onSelect={(item) => handleNext(item.value)}
                        />
                    ) : (
                        <Box>
                            <Text color="green">&gt; </Text>
                            <TextInput
                                value={formValues[fieldName] || ''}
                                onChange={(val) => setFormValues({ ...formValues, [fieldName]: val })}
                                onSubmit={handleNext}
                                placeholder={isFileField ? "輸入檔案路徑..." : (isRequired ? "輸入值..." : "按 Enter 跳過")}
                            />
                        </Box>
                    )}
                </Box>
            </Box>
            <Box marginTop={1}>
                <Text dimColor>已設定: {Object.keys(formValues).join(', ') || '(無)'}</Text>
            </Box>
            <Text dimColor>按 Ctrl+C 取消</Text>
            {/* Suppress unused variable warning */}
            <Box display="none"><Text>{String(typeof onCancel)}</Text></Box>
        </Box>
    );
}
