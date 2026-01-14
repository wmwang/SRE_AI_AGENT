import { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import TextInput from 'ink-text-input';
import { Logo } from './Logo.js';
import { MainMenu } from './MainMenu.js';
import { WelcomePanel } from './WelcomePanel.js';
import { ToolBrowser } from './ToolBrowser.js';
import { ToolPreview } from './ToolPreview.js';
import { ParamForm } from './ParamForm.js';
import { ResultFormatter } from './ResultFormatter.js';
import { SLOWorkflowView } from './SLOWorkflowView.js';
import { MetricsExplorerView } from './MetricsExplorerView.js';
import { LogExplorerView } from './LogExplorerView.js';
import type { MCPToolInfo, MCPClientManager } from '../mcp/manager.js';

interface AppProps {
    onQuery: (query: string) => Promise<void>;
    onExecuteTool: (tool: MCPToolInfo, args: Record<string, any>) => Promise<object>;
    mcpManager: MCPClientManager;
    isProcessing: boolean;
    currentStep?: string;
    response?: string;
    error?: string;
    needsMoreInfo?: boolean;
    missingInfo?: string;
}

type ViewState = 'main_menu' | 'ai_query' | 'tool_browser' | 'tool_preview' | 'param_form' | 'result' | 'slo_workflow' | 'metrics_explorer' | 'log_explorer';

export function App({ onQuery, onExecuteTool, mcpManager, isProcessing, currentStep, response, error, needsMoreInfo, missingInfo: _missingInfo }: AppProps) {
    const [view, setView] = useState<ViewState>('main_menu');
    const [query, setQuery] = useState('');
    const [selectedTool, setSelectedTool] = useState<MCPToolInfo | null>(null);
    const [executionResult, setExecutionResult] = useState<any>(null);

    useEffect(() => {
        if (response) {
            // AI query finished
            setView('result');
        }
    }, [response]);

    // Handle exiting Result view
    useInput((_input, key) => {
        if (view === 'result' && !isProcessing && key.escape) {
            setView('main_menu');
            setQuery('');
            setExecutionResult(null);
        }
    });

    // --- View: Main Menu ---
    if (view === 'main_menu') {
        return (
            <Box flexDirection="column" padding={1}>
                {/* Big 3D Logo */}
                <Logo />

                {/* Welcome Panel - 功能介紹 */}
                <WelcomePanel />

                {/* Menu */}
                <MainMenu onSelectCallback={(value) => {
                    if (value === 'ai') setView('ai_query');
                    if (value === 'slo_workflow') setView('slo_workflow');
                    if (value === 'metrics_explorer') setView('metrics_explorer');
                    if (value === 'log_explorer') setView('log_explorer');
                    if (value === 'tools') setView('tool_browser');
                    if (value === 'exit') process.exit(0);
                }} />
            </Box>
        );
    }


    // --- View: SLO Workflow ---
    if (view === 'slo_workflow') {
        return (
            <SLOWorkflowView
                mcpManager={mcpManager}
                onComplete={(_state) => {
                    // 不切換視圖，讓 SLOWorkflowView 自己顯示完成狀態
                    // 用戶按 ESC 返回時才會觸發 onCancel
                }}
                onCancel={() => setView('main_menu')}
            />
        );
    }

    // --- View: Metrics Explorer ---
    if (view === 'metrics_explorer') {
        return (
            <MetricsExplorerView
                mcpManager={mcpManager}
                onExit={() => setView('main_menu')}
            />
        );
    }

    // --- View: Log Explorer ---
    if (view === 'log_explorer') {
        return (
            <LogExplorerView
                mcpManager={mcpManager}
                onBack={() => setView('main_menu')}
            />
        );
    }

    // --- View: Tool Browser ---
    if (view === 'tool_browser') {
        return (
            <Box flexDirection="column" padding={1}>
                <ToolBrowser
                    tools={mcpManager.listAllTools()}
                    onSelectTool={(tool) => {
                        setSelectedTool(tool);
                        setView('tool_preview');
                    }}
                    onBack={() => setView('main_menu')}
                />
            </Box>
        );
    }

    // --- View: Tool Preview ---
    if (view === 'tool_preview' && selectedTool) {
        return (
            <Box flexDirection="column" padding={1}>
                <ToolPreview
                    tool={selectedTool}
                    onConfirm={() => setView('param_form')}
                    onBack={() => {
                        setSelectedTool(null);
                        setView('tool_browser');
                    }}
                />
            </Box>
        );
    }

    // --- View: Parameter Form ---
    if (view === 'param_form' && selectedTool) {
        return (
            <Box flexDirection="column" padding={1}>
                <Box marginBottom={1}>
                    <Text bold color="yellow">🛠️  設定參數: {selectedTool.name}</Text>
                    <Text dimColor>{selectedTool.description}</Text>
                </Box>
                <ParamForm
                    tool={selectedTool}
                    onSubmit={async (args) => {
                        setView('result'); // Switch to result view to show spinner
                        try {
                            const result = await onExecuteTool(selectedTool, args);
                            setExecutionResult(result);
                        } catch (err) {
                            // Error handling handled by props usually, but here we invoke directly?
                            // Actually better to handle via prop function which updates app state
                            const result = await onExecuteTool(selectedTool, args);
                            setExecutionResult(result);
                        }
                    }}
                    onCancel={() => {
                        setSelectedTool(null);
                        setView('tool_browser');
                    }}
                />
            </Box>
        );
    }

    // --- View: AI Query (Original) ---
    if (view === 'ai_query') {
        const handleSubmit = async () => {
            if (query.trim() && !isProcessing) {
                await onQuery(query);
                setQuery(''); // Clear input, wait for effect to switch to Result
            }
        };

        return (
            <Box flexDirection="column" padding={1}>
                <Box borderStyle="double" borderColor="cyan" padding={1} marginBottom={1}>
                    <Text bold color="cyan">🤖 SRE AI Agent - 自然語言模式</Text>
                </Box>

                {!isProcessing && !response && (
                    <Box flexDirection="column">
                        <Box marginBottom={1}>
                            <Text color="green">&gt; </Text>
                            <TextInput
                                value={query}
                                onChange={setQuery}
                                onSubmit={handleSubmit}
                                placeholder="輸入您的查詢... (例如: 查詢 SLO 狀態)"
                            />
                        </Box>
                        <Text dimColor>按 Esc 返回主選單</Text>
                    </Box>
                )}

                {/* Hidden navigation handler */}
                {view === 'ai_query' && <NavigationHandler onEscape={() => setView('main_menu')} />}

                {/* Show processing/result handled below */}
                {isProcessing && renderProcessing(currentStep)}
                {error && renderError(error)}
            </Box>
        );
    }

    // --- View: Result (Shared) ---
    if (view === 'result') {
        return (
            <Box flexDirection="column" padding={1}>
                {isProcessing ? (
                    renderProcessing(currentStep)
                ) : (
                    <Box flexDirection="column">
                        {error ? (
                            <Box borderStyle="round" borderColor="red" padding={1} marginBottom={1}>
                                <Text color="red">❌ 錯誤: {error}</Text>
                            </Box>
                        ) : response ? (
                            // AI Query result
                            <Box borderStyle="round" borderColor="green" padding={1} marginBottom={1}>
                                <Box flexDirection="column">
                                    <Text bold color="green">✅ AI 回應：</Text>
                                    <Text>{response}</Text>
                                </Box>
                            </Box>
                        ) : executionResult ? (
                            // Tool execution result - use ResultFormatter
                            <ResultFormatter
                                result={executionResult}
                                toolName={selectedTool?.name || ''}
                            />
                        ) : (
                            <Text dimColor>無結果</Text>
                        )}

                        {/* 如果需要更多資訊，顯示輸入框 */}
                        {needsMoreInfo && !isProcessing && (
                            <Box flexDirection="column" marginTop={1}>
                                <Box borderStyle="single" borderColor="yellow" padding={1} marginBottom={1}>
                                    <Text color="yellow">💬 請補充資訊：</Text>
                                </Box>
                                <Box>
                                    <Text color="green">&gt; </Text>
                                    <TextInput
                                        value={query}
                                        onChange={setQuery}
                                        onSubmit={async () => {
                                            if (query.trim()) {
                                                await onQuery(query);
                                                setQuery('');
                                            }
                                        }}
                                        placeholder="輸入補充資訊..."
                                    />
                                </Box>
                            </Box>
                        )}

                        <Box marginTop={1}>
                            <Text dimColor>按 Esc 返回主選單</Text>
                        </Box>
                    </Box>
                )}
            </Box>
        );
    }

    return null;
}

function renderProcessing(step?: string) {
    return (
        <Box flexDirection="column" marginY={1}>
            <Box marginBottom={1}>
                <Text color="yellow"><Spinner type="dots" /></Text>
                <Text color="yellow"> 正在處理...</Text>
            </Box>
            {step && <Box marginLeft={2}><Text dimColor>• {step}</Text></Box>}
        </Box>
    );
}

function renderError(error: string) {
    return (
        <Box borderStyle="round" borderColor="red" padding={1} marginY={1}>
            <Text color="red">❌ 錯誤: {error}</Text>
        </Box>
    );
}

// Helper component for navigation to avoid hook rules violation
function NavigationHandler({ onEscape }: { onEscape: () => void }) {
    useInput((_, key) => {
        if (key.escape) onEscape();
    });
    return null;
}

