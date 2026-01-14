import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { useState, useEffect } from 'react';
import type { MCPClientManager } from '../mcp/manager.js';
import { LogExplorerWorkflow } from '../workflows/log-explorer/index.js';
import type { LogExplorerState, LogEntry } from '../workflows/log-explorer/state.js';
import { TIME_RANGES, LOG_LEVELS } from '../workflows/log-explorer/state.js';

interface LogExplorerViewProps {
    mcpManager: MCPClientManager;
    onBack: () => void;
}

// ==================== 子元件 ====================

/**
 * 搜尋列
 */
function SearchBar({
    value,
    onChange,
    onSubmit,
    isLoading,
    isSearchMode,
}: {
    value: string;
    onChange: (v: string) => void;
    onSubmit: (v: string) => void;
    isLoading: boolean;
    isSearchMode: boolean;
}) {
    if (isLoading) {
        return (
            <Box>
                <Text color="gray">🔍 查詢: </Text>
                <Text color="yellow"><Spinner type="dots" /> 搜尋中...</Text>
            </Box>
        );
    }

    if (!isSearchMode) {
        return (
            <Box>
                <Text color="gray">🔍 查詢: </Text>
                <Text color="gray" dimColor>按 </Text>
                <Text color="cyan">/</Text>
                <Text color="gray" dimColor> 開始輸入搜尋條件...</Text>
            </Box>
        );
    }

    return (
        <Box>
            <Text color="cyan">🔍 查詢: </Text>
            <TextInput
                value={value}
                onChange={onChange}
                onSubmit={onSubmit}
                placeholder="輸入自然語言或 Lucene 查詢..."
                focus={true}
            />
            <Text color="gray" dimColor> (Enter提交, ESC取消)</Text>
        </Box>
    );
}

/**
 * 過濾器面板：時間範圍 + 日誌等級
 */
function FilterPanel({
    timeRange,
    levelFilter,
}: {
    timeRange: string;
    levelFilter: string[];
}) {
    return (
        <Box flexDirection="column" marginBottom={1}>
            {/* 時間範圍 */}
            <Box>
                <Text color="gray">⏱️ 時間: </Text>
                {TIME_RANGES.map((tr, idx) => (
                    <Box key={tr.value} marginRight={1}>
                        <Text
                            color={timeRange === tr.value ? 'cyan' : 'gray'}
                            bold={timeRange === tr.value}
                        >
                            [{idx + 1}] {tr.label}
                        </Text>
                    </Box>
                ))}
            </Box>

            {/* 日誌等級 */}
            <Box marginTop={1}>
                <Text color="gray">📊 等級: </Text>
                {LOG_LEVELS.map((level) => {
                    const isActive = levelFilter.length === 0 || levelFilter.includes(level);
                    const colors: Record<string, string> = {
                        ERROR: 'red',
                        WARN: 'yellow',
                        INFO: 'blue',
                        DEBUG: 'gray',
                        TRACE: 'gray',
                    };
                    return (
                        <Box key={level} marginRight={1}>
                            <Text
                                color={isActive ? colors[level] : 'gray'}
                                dimColor={!isActive}
                            >
                                {level}
                            </Text>
                        </Box>
                    );
                })}
                <Text dimColor> (按 e/w/i/d/t 切換)</Text>
            </Box>
        </Box>
    );
}

/**
 * 日誌列表
 */
function LogList({
    logs,
    selectedIndex,
    total,
    page,
    pageSize,
}: {
    logs: LogEntry[];
    selectedIndex: number;
    total: number;
    page: number;
    pageSize: number;
}) {
    if (logs.length === 0) {
        return (
            <Box borderStyle="round" borderColor="gray" padding={1} justifyContent="center">
                <Text color="gray" dimColor>暫無日誌資料，請執行搜尋</Text>
            </Box>
        );
    }

    const startIdx = page * pageSize;
    const endIdx = Math.min(startIdx + pageSize, logs.length);
    const displayLogs = logs.slice(startIdx, endIdx);

    return (
        <Box flexDirection="column" borderStyle="round" borderColor="blue" padding={1}>
            <Box marginBottom={1}>
                <Text bold color="cyan">📋 日誌列表</Text>
                <Text color="gray"> ({total} 筆，顯示 {startIdx + 1}-{endIdx})</Text>
            </Box>

            {displayLogs.map((log, idx) => {
                const globalIdx = startIdx + idx;
                const isSelected = globalIdx === selectedIndex;
                const levelColors: Record<string, string> = {
                    ERROR: 'red',
                    WARN: 'yellow',
                    INFO: 'blue',
                    DEBUG: 'gray',
                    TRACE: 'gray',
                };

                return (
                    <Box
                        key={globalIdx}
                        flexDirection="column"
                        marginBottom={1}
                        paddingLeft={1}
                        borderStyle={isSelected ? 'single' : undefined}
                        borderColor={isSelected ? 'yellow' : undefined}
                    >
                        <Box>
                            <Text color={isSelected ? 'yellow' : 'white'}>
                                {isSelected ? '▶ ' : '  '}
                            </Text>
                            <Text color={levelColors[log.level] || 'gray'} bold>
                                [{log.level}]
                            </Text>
                            <Text dimColor> {log.timestamp}</Text>
                        </Box>
                        {log.service && (
                            <Text dimColor>    {log.service} {log.pod ? `(${log.pod})` : ''}</Text>
                        )}
                        <Text wrap="truncate">
                            {'    '}{isSelected ? log.message : log.message.substring(0, 100) + (log.message.length > 100 ? '...' : '')}
                        </Text>
                        {isSelected && log.stack && (
                            <Box flexDirection="column" marginTop={1} marginLeft={4}>
                                <Text color="red" dimColor>Stack Trace:</Text>
                                <Text color="gray" dimColor>{log.stack.substring(0, 300)}...</Text>
                            </Box>
                        )}
                    </Box>
                );
            })}

            <Box marginTop={1}>
                <Text dimColor>
                    [↑/↓] 導航  [PgUp/PgDn] 翻頁  第 {page + 1}/{Math.ceil(logs.length / pageSize)} 頁
                </Text>
            </Box>
        </Box>
    );
}

/**
 * AI 分析面板
 */
function AIAnalysisPanel({
    aiAnalysis,
    isAnalyzing,
    analysisType,
}: {
    aiAnalysis: LogExplorerState['aiAnalysis'];
    isAnalyzing: boolean;
    analysisType?: 'summarizing' | 'analyzing';
}) {
    if (isAnalyzing) {
        const message = analysisType === 'summarizing'
            ? '正在生成摘要...'
            : '正在分析錯誤模式...';
        return (
            <Box borderStyle="round" borderColor="cyan" padding={1}>
                <Text color="cyan">
                    <Spinner type="dots" /> {message}
                </Text>
            </Box>
        );
    }

    if (!aiAnalysis?.summary && (!aiAnalysis?.patterns || aiAnalysis.patterns.length === 0)) {
        return (
            <Box borderStyle="round" borderColor="gray" padding={1} justifyContent="center">
                <Text color="gray" dimColor>
                    🤖 按 [s] 生成摘要  [a] 分析錯誤模式
                </Text>
            </Box>
        );
    }

    return (
        <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1}>
            <Text bold color="cyan">🤖 AI 分析結果</Text>

            {/* 摘要 */}
            {aiAnalysis?.summary && (
                <Box flexDirection="column" marginTop={1}>
                    <Text bold color="green">📝 摘要：</Text>
                    <Text>{aiAnalysis.summary.summary}</Text>

                    {aiAnalysis.summary.keyFindings.length > 0 && (
                        <Box flexDirection="column" marginTop={1}>
                            <Text bold>關鍵發現：</Text>
                            {aiAnalysis.summary.keyFindings.map((finding, idx) => (
                                <Text key={idx} color="yellow">  • {finding}</Text>
                            ))}
                        </Box>
                    )}

                    {aiAnalysis.summary.errorCount > 0 && (
                        <Box marginTop={1}>
                            <Text color="red">
                                ⚠️ 錯誤數量: {aiAnalysis.summary.errorCount}
                            </Text>
                        </Box>
                    )}
                </Box>
            )}

            {/* 錯誤模式 */}
            {aiAnalysis?.patterns && aiAnalysis.patterns.length > 0 && (
                <Box flexDirection="column" marginTop={1}>
                    <Text bold color="yellow">⚠️ 錯誤模式分析：</Text>
                    {aiAnalysis.patterns.slice(0, 3).map((pattern, idx) => (
                        <Box key={idx} flexDirection="column" marginTop={1} marginLeft={1}>
                            <Text bold>{pattern.pattern}</Text>
                            <Text>
                                嚴重度: <Text color={pattern.severity === 'critical' ? 'red' : 'yellow'}>{pattern.severity}</Text>
                            </Text>
                            <Text dimColor>{pattern.description}</Text>
                            {pattern.recommendations.length > 0 && (
                                <Text color="green">  💡 {pattern.recommendations[0]}</Text>
                            )}
                        </Box>
                    ))}
                    {aiAnalysis.patterns.length > 3 && (
                        <Text dimColor>  ... 還有 {aiAnalysis.patterns.length - 3} 個模式</Text>
                    )}
                </Box>
            )}
        </Box>
    );
}

/**
 * 快捷鍵列
 */
function HotkeyBar() {
    return (
        <Box borderStyle="single" borderColor="gray" paddingX={1}>
            <Text color="gray">快捷鍵: </Text>
            <Text color="cyan">[/]</Text><Text color="gray"> 搜尋 </Text>
            <Text color="cyan">[1-5]</Text><Text color="gray"> 時間 </Text>
            <Text color="cyan">[e/w/i/d/t]</Text><Text color="gray"> 等級 </Text>
            <Text color="cyan">[a]</Text><Text color="gray"> 錯誤分析 </Text>
            <Text color="cyan">[s]</Text><Text color="gray"> 摘要 </Text>
            <Text color="cyan">[r]</Text><Text color="gray"> 刷新 </Text>
            <Text color="cyan">[q/Esc]</Text><Text color="gray"> 返回</Text>
        </Box>
    );
}

// ==================== 主元件 ====================

/**
 * Log Explorer View - 完整版
 * 
 * 功能：搜尋、過濾、瀏覽、AI 分析
 */
export function LogExplorerView({ mcpManager, onBack }: LogExplorerViewProps) {
    const [workflow] = useState(() => new LogExplorerWorkflow(mcpManager));
    const [state, setState] = useState<LogExplorerState>(workflow.getState());

    // UI 狀態
    const [query, setQuery] = useState('');
    const [selectedLogIndex, setSelectedLogIndex] = useState(0);
    const [currentPage, setCurrentPage] = useState(0);
    const [levelFilter, setLevelFilter] = useState<string[]>([]);
    const [isSearchMode, setIsSearchMode] = useState(false);

    const pageSize = 8;

    useEffect(() => {
        workflow.onStateUpdate(setState);

        // 初始搜尋（載入最近的日誌）
        workflow.search({});

        return () => {
            // Clean up
        };
    }, [workflow]);

    // 鍵盤處理
    useInput((input, key) => {
        // 搜尋模式中，只處理 ESC 取消
        if (isSearchMode) {
            if (key.escape) {
                setIsSearchMode(false);
                setQuery('');
            }
            // 其他按鍵由 TextInput 處理
            return;
        }

        // ESC 或 q 返回
        if (key.escape || input === 'q') {
            onBack();
            return;
        }

        // 防止載入中操作
        if (state.mode === 'searching' || state.isAnalyzing) return;

        // / 進入搜尋模式
        if (input === '/') {
            setIsSearchMode(true);
            return;
        }

        // 時間範圍快捷鍵 1-5
        if (['1', '2', '3', '4', '5'].includes(input)) {
            const idx = parseInt(input) - 1;
            const duration = TIME_RANGES[idx]?.value;
            if (duration) {
                workflow.updateTimeRange(duration);
                workflow.search({});
            }
            return;
        }

        // 等級過濾快捷鍵
        const levelKeys: Record<string, string> = { e: 'ERROR', w: 'WARN', i: 'INFO', d: 'DEBUG', t: 'TRACE' };
        if (levelKeys[input]) {
            const level = levelKeys[input];
            setLevelFilter(prev => {
                const newFilter = prev.includes(level)
                    ? prev.filter(l => l !== level)
                    : [...prev, level];
                // 更新 workflow 過濾器
                workflow.updateFilters({ level: newFilter.length > 0 ? newFilter : undefined });
                return newFilter;
            });
            return;
        }

        // s 摘要
        if (input === 's') {
            workflow.summarize();
            return;
        }

        // a 錯誤分析
        if (input === 'a') {
            workflow.analyzePatterns();
            return;
        }

        // r 刷新
        if (input === 'r') {
            workflow.search({});
            return;
        }

        // 上下鍵導航日誌
        if (key.upArrow) {
            setSelectedLogIndex(prev => {
                const newIdx = Math.max(0, prev - 1);
                // 自動翻頁
                if (newIdx < currentPage * pageSize) {
                    setCurrentPage(p => Math.max(0, p - 1));
                }
                return newIdx;
            });
            return;
        }

        if (key.downArrow) {
            setSelectedLogIndex(prev => {
                const newIdx = Math.min(state.results.length - 1, prev + 1);
                // 自動翻頁
                if (newIdx >= (currentPage + 1) * pageSize) {
                    setCurrentPage(p => p + 1);
                }
                return newIdx;
            });
            return;
        }

        // Page Up / Page Down
        if (key.pageUp) {
            setCurrentPage(p => Math.max(0, p - 1));
            return;
        }

        if (key.pageDown) {
            const maxPage = Math.ceil(state.results.length / pageSize) - 1;
            setCurrentPage(p => Math.min(maxPage, p + 1));
            return;
        }
    });

    // 處理搜尋提交
    const handleSearchSubmit = async (value: string) => {
        // 提交後退出搜尋模式
        setIsSearchMode(false);

        if (!value.trim()) {
            workflow.search({});
            return;
        }

        // 判斷是否為自然語言查詢
        const isNaturalLanguage = /[\u4e00-\u9fff]/.test(value) ||
            value.includes('最近') ||
            value.includes('過去') ||
            value.includes('錯誤') ||
            value.includes('找');

        if (isNaturalLanguage) {
            await workflow.nlQuery(value);
        } else {
            await workflow.search({ query: value });
        }

        setQuery('');
        setSelectedLogIndex(0);
        setCurrentPage(0);
    };

    return (
        <Box flexDirection="column" padding={1}>
            {/* ═══════════════════════════════════════════════════════════ */}
            {/* HEADER                                                      */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <Box marginBottom={1} borderStyle="double" borderColor="cyan" paddingX={1}>
                <Text bold color="cyan">🔍 Log Explorer</Text>
                <Text color="gray"> - 日誌搜尋與 AI 分析</Text>
                {(state.mode !== 'idle' || state.isAnalyzing) && (
                    <Text color="yellow"> | <Spinner type="dots" /> {state.currentStep}</Text>
                )}
            </Box>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* 搜尋與過濾區                                                  */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <Box flexDirection="column" marginBottom={1}>
                <SearchBar
                    value={query}
                    onChange={setQuery}
                    onSubmit={handleSearchSubmit}
                    isLoading={state.mode === 'searching'}
                    isSearchMode={isSearchMode}
                />

                <Box marginTop={1}>
                    <FilterPanel
                        timeRange={state.timeRange.duration}
                        levelFilter={levelFilter}
                    />
                </Box>
            </Box>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* 結果統計                                                     */}
            {/* ═══════════════════════════════════════════════════════════ */}
            {state.total > 0 && (
                <Box marginBottom={1}>
                    <Text>
                        找到 <Text bold color="green">{state.total}</Text> 筆日誌
                        （顯示 {state.results.length} 筆，耗時 {state.took}ms）
                    </Text>
                </Box>
            )}

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* 日誌列表                                                     */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <LogList
                logs={state.results}
                selectedIndex={selectedLogIndex}
                total={state.total}
                page={currentPage}
                pageSize={pageSize}
            />

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* AI 分析面板                                                  */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <Box marginTop={1}>
                <AIAnalysisPanel
                    aiAnalysis={state.aiAnalysis}
                    isAnalyzing={state.isAnalyzing}
                    analysisType={state.mode === 'summarizing' ? 'summarizing' : 'analyzing'}
                />
            </Box>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* 錯誤訊息                                                     */}
            {/* ═══════════════════════════════════════════════════════════ */}
            {state.error && (
                <Box marginTop={1}>
                    <Text color="red">❌ 錯誤: {state.error}</Text>
                </Box>
            )}

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* 快捷鍵列                                                     */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <Box marginTop={1}>
                <HotkeyBar />
            </Box>
        </Box>
    );
}
