import { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import * as asciichart from 'asciichart';

// 從 workflow 匯入狀態類型
import type { MetricsExplorerState, MetricsSeries } from '../workflows/metrics-explorer/state.js';
import { MetricsExplorerWorkflow } from '../workflows/metrics-explorer/index.js';

// ==================== 子組件 ====================

/**
 * 查詢建議輪播
 */
function HintsCarousel({
    hints,
    onSelect,
    isFocused
}: {
    hints: MetricsExplorerState['metricHints'];
    onSelect: (hint: { text: string; promql: string }) => void;
    isFocused: boolean;
}) {
    const [selectedCategory, setSelectedCategory] = useState(0);
    const [selectedHint, setSelectedHint] = useState(0);

    // 使用 isActive 選項控制是否接收按鍵事件
    useInput((_input, key) => {
        if (key.leftArrow) {
            setSelectedCategory(prev => Math.max(0, prev - 1));
            setSelectedHint(0);
        } else if (key.rightArrow) {
            setSelectedCategory(prev => Math.min(hints.length - 1, prev + 1));
            setSelectedHint(0);
        } else if (key.upArrow) {
            const category = hints[selectedCategory];
            if (category) {
                setSelectedHint(prev => Math.max(0, prev - 1));
            }
        } else if (key.downArrow) {
            const category = hints[selectedCategory];
            if (category) {
                setSelectedHint(prev => Math.min(category.suggestions.length - 1, prev + 1));
            }
        } else if (key.return) {
            const category = hints[selectedCategory];
            const hint = category?.suggestions[selectedHint];
            console.error('[DEBUG HintsCarousel] Enter pressed, hint:', JSON.stringify(hint));
            if (hint) {
                onSelect({ text: hint.text, promql: hint.promql });
            }
        }
    }, { isActive: isFocused });

    if (!hints.length) return null;

    return (
        <Box flexDirection="column" marginBottom={1}>
            <Text bold color={isFocused ? "cyan" : "gray"}>
                💡 快速查詢建議 {isFocused ? "(← → 切換類別, ↑ ↓ Enter 選擇)" : "(按 Tab 切換焦點)"}
            </Text>
            <Box marginTop={1}>
                {hints.map((category, i) => (
                    <Box key={i} marginRight={2}>
                        <Text
                            color={i === selectedCategory ? (isFocused ? 'yellow' : 'gray') : 'gray'}
                            bold={i === selectedCategory}
                        >
                            {category.category}
                        </Text>
                    </Box>
                ))}
            </Box>
            <Box flexDirection="column" marginTop={1} marginLeft={2}>
                {hints[selectedCategory]?.suggestions.map((suggestion, i) => (
                    <Text key={i} color={i === selectedHint && isFocused ? 'green' : 'white'}>
                        {i === selectedHint && isFocused ? '▶ ' : '  '}
                        {suggestion.text}
                    </Text>
                ))}
            </Box>
        </Box>
    );
}


/**
 * ASCII 圖表渲染
 */
function MetricsChart({
    data,
    timeRange
}: {
    data: MetricsSeries[];
    timeRange: { start: number; end: number; duration: string };
}) {
    if (!data.length || !data[0]?.values.length) {
        return (
            <Box borderStyle="round" padding={1}>
                <Text color="gray">暫無數據</Text>
            </Box>
        );
    }

    // 取第一個 series 的值繪製圖表
    const values = data[0].values;

    // 確保有足夠的數據點
    if (values.length < 2) {
        return (
            <Box borderStyle="round" padding={1}>
                <Text color="gray">數據點不足以繪製圖表</Text>
            </Box>
        );
    }

    let chart: string;
    try {
        chart = asciichart.plot(values, {
            height: 8,
            colors: [asciichart.blue],
        });
    } catch {
        chart = '圖表渲染失敗';
    }

    // 計算統計資訊
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const latest = values[values.length - 1];

    return (
        <Box flexDirection="column" borderStyle="round" padding={1}>
            <Text bold color="cyan">📈 指標圖表 ({timeRange.duration})</Text>
            <Box marginTop={1}>
                <Text>{chart}</Text>
            </Box>
            <Box marginTop={1} flexDirection="row" gap={2}>
                <Text color="gray">最小: <Text color="cyan">{min.toFixed(2)}</Text></Text>
                <Text color="gray">最大: <Text color="cyan">{max.toFixed(2)}</Text></Text>
                <Text color="gray">平均: <Text color="cyan">{avg.toFixed(2)}</Text></Text>
                <Text color="gray">最新: <Text color="green">{latest?.toFixed(2)}</Text></Text>
            </Box>
            {data.length > 1 && (
                <Text color="yellow" dimColor>+{data.length - 1} 個其他時間序列（顯示第一個）</Text>
            )}
        </Box>
    );
}

/**
 * AI 診斷面板
 */
function DiagnosisPanel({
    health,
    diagnosis
}: {
    health: MetricsExplorerState['healthStatus'];
    diagnosis: MetricsExplorerState['diagnosis'];
}) {
    if (!diagnosis) return null;

    const healthColors = {
        healthy: 'green',
        warning: 'yellow',
        critical: 'red',
        unknown: 'gray',
    } as const;

    const healthEmojis = {
        healthy: '✅',
        warning: '⚠️',
        critical: '🚨',
        unknown: '❓',
    };

    return (
        <Box flexDirection="column" borderStyle="round" padding={1} borderColor={healthColors[health]}>
            <Text bold color={healthColors[health]}>
                {healthEmojis[health]} AI 診斷結果：{health.toUpperCase()}
            </Text>

            <Box marginTop={1}>
                <Text>{diagnosis.summary}</Text>
            </Box>

            {diagnosis.findings.length > 0 && (
                <Box flexDirection="column" marginTop={1}>
                    <Text bold color="cyan">發現：</Text>
                    {diagnosis.findings.map((finding, i) => (
                        <Box key={i} marginLeft={1}>
                            <Text color={finding.severity === 'critical' ? 'red' : finding.severity === 'warning' ? 'yellow' : 'gray'}>
                                • {finding.message}
                            </Text>
                        </Box>
                    ))}
                </Box>
            )}

            {diagnosis.trend && (
                <Box marginTop={1}>
                    <Text color="gray">
                        趨勢: <Text color="cyan">{diagnosis.trend.direction}</Text> ({diagnosis.trend.changeRate})
                    </Text>
                </Box>
            )}

            {diagnosis.recommendations.length > 0 && (
                <Box flexDirection="column" marginTop={1}>
                    <Text bold color="green">建議：</Text>
                    {diagnosis.recommendations.map((rec, i) => (
                        <Box key={i} marginLeft={1}>
                            <Text color="white">• {rec}</Text>
                        </Box>
                    ))}
                </Box>
            )}
        </Box>
    );
}

// ==================== 主組件 ====================

interface MetricsExplorerViewProps {
    mcpManager: any; // 實際類型從 mcp 模組匯入
    onExit: () => void;
}

export function MetricsExplorerView({ mcpManager, onExit }: MetricsExplorerViewProps) {
    const { exit: _exit } = useApp();
    const [state, setState] = useState<MetricsExplorerState | null>(null);
    const [workflow, setWorkflow] = useState<MetricsExplorerWorkflow | null>(null);
    const [query, setQuery] = useState('');
    const [hintsMode, setHintsMode] = useState(true); // true = 焦點在建議區, false = 焦點在輸入框

    // 初始化 workflow
    useEffect(() => {
        const wf = new MetricsExplorerWorkflow(mcpManager);
        setWorkflow(wf);

        // 訂閱狀態變化
        const unsubscribe = wf.subscribe(newState => {
            setState(newState);
        });

        // 初始化探索
        wf.initialize();

        return () => {
            unsubscribe();
        };
    }, [mcpManager]);

    // 全域鍵盤處理（總是可用）
    useInput((input, key) => {
        if (state && !state.isLoading) {
            // Tab 鍵切換焦點
            if (key.tab) {
                setHintsMode(prev => !prev);
            }
            // Ctrl+R 或單純 R（無輸入時）刷新
            else if (key.ctrl && input === 'r' && state.promql) {
                workflow?.refresh();
            }
            // Ctrl+D 或單純 D（無輸入時）診斷
            else if (key.ctrl && input === 'd' && state.metricsData.length > 0) {
                workflow?.diagnose();
            }
            // Ctrl+Q 或 Escape 返回
            else if ((key.ctrl && input === 'q') || key.escape) {
                onExit();
            }
        }
    });

    // 處理查詢提交
    const handleSubmit = async (value: string) => {
        if (!value.trim() || !workflow) return;
        setQuery('');
        await workflow.query(value);
    };

    // 處理建議選擇（直接執行 PromQL，不需要翻譯）
    const handleHintSelect = async (hint: { text: string; promql: string }) => {
        if (!workflow) return;
        console.error('[DEBUG] handleHintSelect called with hint:', JSON.stringify(hint));
        if (!hint.promql) {
            console.error('[DEBUG] ERROR: hint.promql is empty!');
            return;
        }
        await workflow.executePromQL(hint.promql, hint.text);
    };

    if (!state) {
        return (
            <Box padding={1}>
                <Text color="cyan">
                    <Spinner type="dots" /> 正在初始化 Metrics Explorer...
                </Text>
            </Box>
        );
    }

    return (
        <Box flexDirection="column" padding={1}>
            {/* ═══════════════════════════════════════════════════════════ */}
            {/* HEADER                                                      */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <Box marginBottom={1} borderStyle="double" borderColor="cyan" paddingX={1}>
                <Text bold color="cyan">📊 Metrics Explorer</Text>
                <Text color="gray"> - 自然語言查詢 Prometheus 指標</Text>
                {state.isLoading && (
                    <Text color="yellow"> | <Spinner type="dots" /> {state.currentStep}</Text>
                )}
            </Box>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* 輸入區：Hints + Input                                        */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <Box flexDirection="column" marginBottom={1}>
                {/* 查詢建議 */}
                {state.metricHints.length > 0 && !state.isLoading && (
                    <HintsCarousel hints={state.metricHints} onSelect={handleHintSelect} isFocused={hintsMode} />
                )}

                {/* 輸入框 */}
                {!state.isLoading && (
                    <Box>
                        <Text color={hintsMode ? "gray" : "cyan"}>🔍 查詢{hintsMode ? '' : ' (輸入模式)'}: </Text>
                        <TextInput
                            value={query}
                            onChange={setQuery}
                            onSubmit={handleSubmit}
                            placeholder="輸入自然語言或按 Tab 選擇上方建議..."
                            focus={!hintsMode}
                        />
                    </Box>
                )}

                {/* 當前查詢 */}
                {state.promql && (
                    <Box marginTop={1}>
                        <Text color="gray">📋 </Text>
                        <Text color="cyan">{state.queryExplanation || state.promql}</Text>
                        <Text color="green"> ({(state.translationConfidence * 100).toFixed(0)}%)</Text>
                    </Box>
                )}
            </Box>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* 圖表區：Chart (總是顯示框架)                                   */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <Box borderStyle="round" borderColor={state.metricsData.length > 0 ? "blue" : "gray"} marginBottom={1}>
                {state.metricsData.length > 0 && !state.isLoading ? (
                    <Box flexDirection="column" padding={1}>
                        <MetricsChart data={state.metricsData} timeRange={state.timeRange} />
                    </Box>
                ) : (
                    <Box padding={2} justifyContent="center">
                        <Text color="gray" dimColor>
                            {state.isLoading ? '載入中...' : '📈 選擇查詢後在此顯示圖表'}
                        </Text>
                    </Box>
                )}
            </Box>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* 診斷區：AI Diagnosis (總是顯示框架)                            */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <Box
                borderStyle="round"
                borderColor={state.diagnosis ? (state.healthStatus === 'healthy' ? 'green' : state.healthStatus === 'warning' ? 'yellow' : 'gray') : 'gray'}
                marginBottom={1}
            >
                {state.isDiagnosing ? (
                    <Box padding={1} justifyContent="center">
                        <Text color="yellow">
                            <Spinner type="dots" /> 正在進行 AI 診斷...
                        </Text>
                    </Box>
                ) : state.diagnosis ? (
                    <Box flexDirection="column" padding={1}>
                        <DiagnosisPanel health={state.healthStatus} diagnosis={state.diagnosis} />
                    </Box>
                ) : (
                    <Box padding={1} justifyContent="center">
                        <Text color="gray" dimColor>
                            {state.metricsData.length > 0 ? '🔬 按 Ctrl+D 執行 AI 診斷' : '🔬 AI 診斷結果會顯示在此'}
                        </Text>
                    </Box>
                )}
            </Box>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* 錯誤訊息                                                     */}
            {/* ═══════════════════════════════════════════════════════════ */}
            {state.error && (
                <Box marginBottom={1}>
                    <Text color="red">❌ {state.error}</Text>
                </Box>
            )}

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* 快捷鍵列 (總是顯示)                                            */}
            {/* ═══════════════════════════════════════════════════════════ */}
            <Box borderStyle="single" borderColor="gray" paddingX={1}>
                <Text color="gray">快捷鍵: </Text>
                <Text color="cyan">[Ctrl+R]</Text><Text color="gray"> 刷新 </Text>
                <Text color="cyan">[Ctrl+D]</Text><Text color="gray"> AI診斷 </Text>
                <Text color="cyan">[Esc]</Text><Text color="gray"> 返回</Text>
            </Box>
        </Box>
    );
}

export default MetricsExplorerView;
