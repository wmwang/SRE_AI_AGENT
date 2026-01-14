import { Box, Text, useInput } from 'ink';
import { useState, useCallback, useEffect } from 'react';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import Gradient from 'ink-gradient';
import { SLOGeneratorWorkflow, SLOWorkflowState, SLODefinition } from '../workflows/slo-generator/index.js';
import type { MCPClientManager } from '../mcp/manager.js';

/**
 * 打字機效果組件
 */
/**
 * 打字機效果組件
 */
function Typewriter({ text, speed = 20, start = true, onComplete }: { text: string; speed?: number; start?: boolean; onComplete?: () => void }) {
    const [displayedText, setDisplayedText] = useState('');
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (!start) return;

        if (currentIndex < text.length) {
            const timer = setTimeout(() => {
                setDisplayedText(prev => prev + text[currentIndex]);
                setCurrentIndex(prev => prev + 1);
            }, speed);
            return () => clearTimeout(timer);
        } else if (onComplete) {
            // 使用 setTimeout 避免在渲染週期內更新狀態
            const timer = setTimeout(onComplete, 0);
            return () => clearTimeout(timer);
        }
    }, [currentIndex, text, speed, start, onComplete]);

    // 重置當 text 改變時
    useEffect(() => {
        setDisplayedText('');
        setCurrentIndex(0);
    }, [text]);

    if (!start) return <Text></Text>;

    return <Text wrap="wrap">{displayedText}</Text>;
}

interface SLOWorkflowViewProps {
    mcpManager: MCPClientManager;
    onComplete: (state: SLOWorkflowState) => void;
    onCancel: () => void;
}

/**
 * HSL 轉 Hex 輔助函數
 */
function hslToHex(h: number, s: number, l: number) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * 彩虹流光文字組件
 */
function RainbowText({ text, speed = 50 }: { text: string; speed?: number }) {
    const [offset, setOffset] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setOffset(prev => (prev + 5) % 360);
        }, speed);
        return () => clearInterval(timer);
    }, [speed]);

    return (
        <Text>
            {text.split('').map((char, index) => {
                // 讓每個字的顏色稍微錯開，形成波浪
                const hue = (offset - (index * 15)) % 360;
                const color = hslToHex(hue, 90, 60); // 高飽和度，中亮度
                return <Text key={index} color={color}>{char}</Text>;
            })}
        </Text>
    );
}

/**
 * 步驟名稱對照
 */
const STEP_NAMES: Record<string, string> = {
    'input': '📂 輸入 YAML',
    'analyze': '🔍 分析中',
    'review': '📋 審核 SLO',
    'refine': '🔄 修正中',
    'generate': '⚙️ 生成配置',
    'complete': '✅ 完成',
};

/**
 * SLO Workflow 視圖組件
 */
export function SLOWorkflowView({ mcpManager, onComplete, onCancel }: SLOWorkflowViewProps) {
    const [currentStep, setCurrentStep] = useState<SLOWorkflowState['currentStep']>('input');
    const [state, setState] = useState<Partial<SLOWorkflowState>>({});
    const [progressMessage, setProgressMessage] = useState('');
    const [isWaitingInput, setIsWaitingInput] = useState(false);
    const [inputPrompt, setInputPrompt] = useState('');
    const [inputValue, setInputValue] = useState('');
    const [inputResolver, setInputResolver] = useState<((value: string) => void) | null>(null);
    const [isRunning, setIsRunning] = useState(false);

    // 處理 ESC 返回
    useInput((_input, key) => {
        if (key.escape && !isRunning) {
            onCancel();
        }
    });

    // 控制打字機順序：-1=部署分析, 0~N=SLO卡片
    const [animationIndex, setAnimationIndex] = useState(-1);

    // 當步驟變成 review 時，重置動畫
    useEffect(() => {
        if (currentStep === 'review') {
            setAnimationIndex(-1);
        }
    }, [currentStep]);

    // 開始 Workflow
    const startWorkflow = useCallback(async (yamlPath: string) => {
        setIsRunning(true);

        // 設定輸出目錄（與輸入檔案同目錄）
        const path = await import('path');
        const inputDir = path.dirname(yamlPath);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const outputDir = `${inputDir}/slo-output-${timestamp}`;

        const workflow = new SLOGeneratorWorkflow(mcpManager, {
            onStepChange: (step, newState) => {
                setCurrentStep(step);
                setState((prev) => ({ ...prev, ...newState, outputDir }));
            },
            onProgress: (message) => {
                setProgressMessage(message);
            },
            onWaitingForInput: async (prompt) => {
                setInputPrompt(prompt);
                setIsWaitingInput(true);
                setInputValue('');

                return new Promise<string>((resolve) => {
                    setInputResolver(() => resolve);
                });
            },
        });

        const finalState = await workflow.run({
            yamlPath,
            outputPath: `${outputDir}/grafana-dashboard.json`,
        });

        // 自動存檔
        if (!finalState.error && finalState.prometheusRules) {
            try {
                const fs = await import('fs');
                // 建立輸出目錄
                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                }
                // 儲存 Prometheus Rules
                fs.writeFileSync(`${outputDir}/prometheus-rules.yaml`, finalState.prometheusRules, 'utf-8');
                // 儲存 Grafana Dashboard
                if (finalState.grafanaDashboard) {
                    fs.writeFileSync(`${outputDir}/grafana-dashboard.json`, JSON.stringify(finalState.grafanaDashboard, null, 2), 'utf-8');
                }
                // 儲存 SLO 定義
                fs.writeFileSync(`${outputDir}/slos.json`, JSON.stringify(finalState.currentSLOs, null, 2), 'utf-8');
            } catch (e) {
                console.error('Failed to save files:', e);
            }
        }

        setIsRunning(false);
        setState({ ...finalState, outputDir } as any);
        onComplete({ ...finalState, outputDir } as any);
    }, [mcpManager, onComplete]);

    // 處理輸入提交
    const handleInputSubmit = useCallback(() => {
        if (inputResolver) {
            inputResolver(inputValue);
            setInputResolver(null);
            setIsWaitingInput(false);
            setInputValue('');
        }
    }, [inputResolver, inputValue]);

    // 渲染步驟指示器
    const renderStepIndicator = () => {
        const steps = ['input', 'analyze', 'review', 'generate', 'complete'];
        const currentIndex = steps.indexOf(currentStep);

        return (
            <Box marginBottom={1}>
                {steps.map((step, index) => {
                    const isActive = step === currentStep;
                    const isDone = index < currentIndex;
                    const color = isActive ? 'cyan' : isDone ? 'green' : 'gray';

                    return (
                        <Box key={step} marginRight={1}>
                            <Text color={color} bold={isActive}>
                                {isDone ? '✓' : isActive ? '●' : '○'} {STEP_NAMES[step]}
                            </Text>
                            {index < steps.length - 1 && <Text dimColor> → </Text>}
                        </Box>
                    );
                })}
            </Box>
        );
    };

    // 渲染輸入步驟
    const renderInputStep = () => (
        <Box flexDirection="column">
            <Text bold>請輸入 K8s YAML 檔案路徑：</Text>
            <Box marginTop={1}>
                <Text color="cyan">{'> '}</Text>
                <TextInput
                    value={inputValue}
                    onChange={setInputValue}
                    onSubmit={(value) => {
                        if (value.trim()) {
                            startWorkflow(value.trim());
                        }
                    }}
                    placeholder="/path/to/deployment.yaml"
                />
            </Box>
            <Box marginTop={1}>
                <Text dimColor>提示：輸入完整路徑後按 Enter 開始分析</Text>
            </Box>
        </Box>
    );

    // 渲染進度
    const renderProgress = () => (
        <Box flexDirection="column">
            <Text>
                <Text color="green"><Spinner type="dots" /></Text>
                {' '}<RainbowText text={progressMessage} />
            </Text>
            <Box marginTop={1}>
                <Text>
                    <Spinner type="line" /> <Gradient name="morning">AI 正在處理中，請稍候...</Gradient>
                </Text>
            </Box>
        </Box>
    );

    // 渲染 SLO 卡片（緊湊佈局）
    const renderSLOCard = (slo: SLODefinition, index: number) => {
        const signalColors: Record<string, string> = {
            'Latency': 'yellow',
            'Errors': 'red',
            'Availability': 'green',
            'Traffic': 'blue',
            'Saturation': 'magenta',
        };
        const color = signalColors[slo.golden_signal] || 'white';
        const isVisible = index <= animationIndex;
        const isTyping = index === animationIndex;

        if (!isVisible && index > -1) return null; // 完全未顯示

        return (
            <Box
                key={slo.id}
                flexDirection="column"
                borderStyle="round"
                borderColor={color as any}
                paddingX={1}
                paddingY={0}
                marginBottom={1}
            >
                {/* 標題行 */}
                <Box>
                    <Text bold color={color as any}>
                        {index + 1}. {slo.name}
                    </Text>
                </Box>
                {/* 資訊行（合併為單行） */}
                <Box>
                    <Text backgroundColor={color as any} color="black">
                        {` ${slo.golden_signal} `}
                    </Text>
                    <Text dimColor> 目標: </Text>
                    <Text bold>{slo.target}%</Text>
                    {slo.threshold && (
                        <>
                            <Text dimColor> 閾值: </Text>
                            <Text>{slo.threshold}</Text>
                        </>
                    )}
                    <Text dimColor> 期間: </Text>
                    <Text>{slo.window}</Text>
                </Box>
                {/* 描述行 */}
                {slo.description && (
                    <Box>
                        <Text dimColor>
                            {/* 只有在輪到自己 (isTyping) 或已經播放過 (index < animationIndex) 才顯示 */}
                            {/* 如果已經播放過，直接顯示文字（不用打字機）加速渲染 */}
                            {index < animationIndex ? (
                                <Text>{slo.description}</Text>
                            ) : (
                                <Typewriter
                                    text={slo.description}
                                    speed={10}
                                    start={isTyping}
                                    onComplete={() => setAnimationIndex(prev => prev + 1)}
                                />
                            )}
                        </Text>
                    </Box>
                )}
            </Box>
        );
    };

    // 渲染審核步驟
    const renderReviewStep = () => (
        <Box flexDirection="column">
            {/* 部署分析摘要 */}
            {state.deploymentAnalysis && (
                <Box
                    borderStyle="double"
                    borderColor="blue"
                    padding={1}
                    marginBottom={1}
                    flexDirection="column"
                >
                    <Text bold color="blue">📋 部署分析</Text>
                    <Box marginTop={1}>
                        {/* -1 代表播放部署分析 */}
                        {animationIndex > -1 ? (
                            <Text wrap="wrap">{state.deploymentAnalysis.summary}</Text>
                        ) : (
                            <Typewriter
                                text={state.deploymentAnalysis.summary || ''}
                                speed={15}
                                onComplete={() => setAnimationIndex(0)}
                            />
                        )}
                    </Box>
                </Box>
            )}

            {/* SLO 建議列表 */}
            <Box marginBottom={1}>
                <Text bold>💡 建議的 SLO ({state.currentSLOs?.length || 0} 個):</Text>
            </Box>

            {/* 只有當部署分析完成 (animationIndex >= 0) 才開始渲染 SLO 卡片 */}
            {animationIndex >= 0 && state.currentSLOs?.map((slo, index) => renderSLOCard(slo, index))}

            {/* 用戶輸入區 - 只有當所有動畫這完成後才顯示 */}
            {isWaitingInput && animationIndex >= (state.currentSLOs?.length || 0) && (
                <Box flexDirection="column" marginTop={1}>
                    <Text bold color="yellow">{inputPrompt}</Text>
                    <Box marginTop={1}>
                        <Text color="cyan">{'> '}</Text>
                        <TextInput
                            value={inputValue}
                            onChange={setInputValue}
                            onSubmit={handleInputSubmit}
                            placeholder="輸入修改意見，或直接按 Enter 確認"
                        />
                    </Box>
                    <Box marginTop={1}>
                        <Text dimColor>提示：輸入自然語言修改意見（例如：「把 latency 目標改成 200ms」），或直接按 Enter 確認</Text>
                    </Box>
                </Box>
            )}
        </Box>
    );

    // 渲染 ASCII Gauge
    const renderGauge = (value: number): string => {
        // 縮小寬度以確保放入框內：[ bar (30) ] 99.9%
        const width = 30;
        const normalizedValue = Math.min(value, 100);
        const filled = Math.round((normalizedValue / 100) * width);
        const empty = width - filled;
        return `[${'█'.repeat(Math.max(0, filled))}${'░'.repeat(Math.max(0, empty))}] ${value}%`;
    };

    // 渲染 Prometheus Rules 預覽
    const renderPrometheusRulesPreview = () => {
        const rules = state.prometheusRules ? state.prometheusRules.toString().split('\n') : [];
        // 取前 30 行作為預覽
        const previewLines = rules.slice(0, 30);
        if (rules.length > 30) previewLines.push('  ...');

        return (
            <Box flexDirection="column" borderStyle="single" borderColor="yellow" padding={1} width={64}>
                <Box borderStyle="double" borderColor="yellow" justifyContent="center" marginBottom={1}>
                    <Text bold color="yellow"> Prometheus Rules Preview </Text>
                </Box>
                <Box flexDirection="column">
                    {previewLines.length > 0 ? (
                        previewLines.map((line, i) => (
                            <Text key={i} color="white">{line.slice(0, 58)}</Text>
                        ))
                    ) : (
                        <Text dimColor>No rules generated.</Text>
                    )}
                </Box>
            </Box>
        );
    };

    // 渲染 Grafana Dashboard ASCII 預覽
    const renderGrafanaPreview = () => {
        const slos = state.currentSLOs || [];
        const serviceName = state.serviceName || 'Service';

        return (
            // 設定固定寬度 64，移除寬度過寬的問題
            <Box flexDirection="column" borderStyle="single" borderColor="cyan" padding={1} width={64}>
                {/* 標題 */}
                <Box borderStyle="double" borderColor="cyan" justifyContent="center" marginBottom={1}>
                    <Text bold color="cyan"> {serviceName} SLO Dashboard </Text>
                </Box>

                {/* SLO Panels - Vertical Stack */}
                <Box flexDirection="column">
                    {slos.map((slo, i) => (
                        <Box
                            key={i}
                            width="100%"
                            borderStyle="round"
                            borderColor="green"
                            flexDirection="column"
                            paddingX={1}
                            marginBottom={1}
                        >
                            <Box justifyContent="space-between">
                                <Text bold>{i + 1}. {slo.name}</Text>
                                <Text dimColor>Target: {slo.target}%</Text>
                            </Box>
                            <Box marginTop={0}>
                                <Text>{renderGauge(slo.target)}</Text>
                            </Box>
                        </Box>
                    ))}
                </Box>

                {/* Error Budget Panel */}
                <Box
                    borderStyle="round"
                    borderColor="yellow"
                    flexDirection="column"
                    paddingX={1}
                    width="100%"
                >
                    <Text bold>Error Budget Remaining</Text>
                    <Text color="yellow">
                        {'▁▂▃▄▅▆▇█▇▆▅▄▃▄▅▆▇▆▅▄▅▆▇█▇▆▅▄▃▂▁▂▃▄▅▆▇█'.slice(0, 50)}
                    </Text>
                </Box>
            </Box>
        );
    };

    // 渲染完成步驟
    const renderCompleteStep = () => {
        const outputDir = (state as any).outputDir || '';

        // 移除 height={30}，讓內容自動撐開高度
        return (
            <Box flexDirection="column">
                {state.error ? (
                    <Box borderStyle="round" borderColor="red" padding={1}>
                        <Text color="red">❌ 錯誤: {state.error}</Text>
                    </Box>
                ) : (
                    <>
                        <Box borderStyle="double" borderColor="green" padding={1} marginBottom={1}>
                            <Text bold color="green">✅ SLO 配置生成完成！</Text>
                        </Box>

                        {/* 摘要統計 */}
                        <Box flexDirection="column" marginBottom={1}>
                            <Text bold>📊 生成統計:</Text>
                            <Box marginLeft={2} flexDirection="column">
                                <Text>• SLO 定義: {state.currentSLOs?.length || 0} 個</Text>
                                <Text>• Prometheus Rules: {state.prometheusRules ? '已生成' : '無'}</Text>
                                <Text>• Grafana Dashboard: {state.grafanaDashboard ? '已生成' : '無'}</Text>
                            </Box>
                        </Box>

                        {/* 輸出檔案列表 */}
                        <Box flexDirection="column" marginBottom={1}>
                            <Text bold>📁 輸出檔案:</Text>
                            <Box marginLeft={2} flexDirection="column" borderStyle="single" borderColor="cyan" padding={1}>
                                <Text color="cyan">{outputDir}/</Text>
                                <Text>  ├── prometheus-rules.yaml</Text>
                                <Text>  ├── grafana-dashboard.json</Text>
                                <Text>  └── slos.json</Text>
                            </Box>
                        </Box>

                        {/* 預覽區域 */}
                        <Box flexDirection="column">
                            <Text bold>📈 生成結果預覽:</Text>

                            <Box flexDirection="row" marginTop={1}>
                                {/* Prometheus Rules Preview */}
                                <Box>
                                    {renderPrometheusRulesPreview()}
                                </Box>

                                {/* Dashboard Preview */}
                                <Box marginLeft={2}>
                                    {renderGrafanaPreview()}
                                </Box>
                            </Box>
                        </Box>
                    </>
                )}

                <Box marginTop={2}>
                    <Text dimColor>檔案已自動儲存。按 ESC 返回主選單</Text>
                </Box>
            </Box>
        );
    };

    // 根據當前步驟渲染內容
    const renderContent = () => {
        switch (currentStep) {
            case 'input':
                return renderInputStep();
            case 'analyze':
            case 'refine':
            case 'generate':
                return renderProgress();
            case 'review':
                return renderReviewStep();
            case 'complete':
                return renderCompleteStep();
            default:
                return null;
        }
    };

    return (
        <Box flexDirection="column" padding={1}>
            {/* 標題 */}
            <Box borderStyle="double" borderColor="magenta" padding={1} marginBottom={1}>
                <Text bold color="magenta">🎯 SLO 自動生成精靈</Text>
            </Box>

            {/* 步驟指示器 */}
            {renderStepIndicator()}

            {/* 主要內容 */}
            {renderContent()}
        </Box>
    );
}
