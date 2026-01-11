import { Box, Text } from 'ink';

/**
 * Golden Signal 顏色映射
 */
const GOLDEN_SIGNAL_COLORS: Record<string, 'green' | 'yellow' | 'red' | 'blue' | 'magenta' | 'cyan'> = {
    'Latency': 'yellow',
    'Traffic': 'blue',
    'Errors': 'red',
    'Saturation': 'magenta',
    'Availability': 'green',
    'Performance': 'cyan',
    'Reliability': 'green',
};

/**
 * Golden Signal 圖標
 */
const GOLDEN_SIGNAL_ICONS: Record<string, string> = {
    'Latency': '⏱️',
    'Traffic': '📊',
    'Errors': '❌',
    'Saturation': '📈',
    'Availability': '✅',
    'Performance': '🚀',
    'Reliability': '🛡️',
};

interface SLORecommendation {
    id: string;
    name: string;
    description?: string;
    description_zh?: string;
    target: number;
    threshold?: number | string;
    window: string;
    golden_signal: string;
}

interface ResultFormatterProps {
    result: any;
    toolName: string;
}

/**
 * 美化的結果顯示組件
 */
export function ResultFormatter({ result, toolName }: ResultFormatterProps) {
    // 根據不同的工具類型選擇不同的渲染方式

    // SLO Tools
    if (toolName === 'recommend_slos' && result.recommendations) {
        return <SLORecommendationsView recommendations={result.recommendations} />;
    }

    if (toolName === 'analyze_k8s_manifests' && result.slos) {
        return <SLORecommendationsView recommendations={result.slos} />;
    }

    if (toolName === 'track_slo_status' && result.slos) {
        return <SLOStatusView slos={result.slos} stats={result.stats} />;
    }

    // K8s Deployment Tools
    if (toolName === 'scan_repo' && result.success) {
        return <ScanRepoView result={result} />;
    }

    if (toolName === 'analyze_deployment' && result.success) {
        return <AnalyzeDeploymentView result={result} />;
    }

    if (toolName === 'suggest_improvements' && result.success) {
        return <SuggestImprovementsView result={result} />;
    }

    // 預設：美化的 JSON 輸出
    return <DefaultView result={result} />;
}

/**
 * SLO 建議卡片視圖
 */
function SLORecommendationsView({ recommendations }: { recommendations: SLORecommendation[] }) {
    return (
        <Box flexDirection="column">
            <Box marginBottom={1}>
                <Text bold color="green">✅ 找到 {recommendations.length} 個 SLO 建議</Text>
            </Box>

            {recommendations.map((slo) => {
                const color = GOLDEN_SIGNAL_COLORS[slo.golden_signal] || 'white';
                const icon = GOLDEN_SIGNAL_ICONS[slo.golden_signal] || '📌';

                return (
                    <Box
                        key={slo.id}
                        flexDirection="column"
                        borderStyle="round"
                        borderColor={color}
                        padding={1}
                        marginBottom={1}
                    >
                        {/* Header */}
                        <Box>
                            <Text bold color={color}>{icon} {slo.name}</Text>
                            <Text dimColor> ({slo.id})</Text>
                        </Box>

                        {/* Golden Signal Badge */}
                        <Box marginTop={1}>
                            <Text backgroundColor={color} color="black" bold>
                                {` ${slo.golden_signal} `}
                            </Text>
                            <Text dimColor> • 目標: </Text>
                            <Text bold>{slo.target}%</Text>
                            {slo.threshold && (
                                <>
                                    <Text dimColor> • 閾值: </Text>
                                    <Text>{slo.threshold}</Text>
                                </>
                            )}
                            <Text dimColor> • 期間: </Text>
                            <Text>{slo.window}</Text>
                        </Box>

                        {/* Description */}
                        {slo.description_zh && (
                            <Box marginTop={1}>
                                <Text wrap="wrap">{slo.description_zh}</Text>
                            </Box>
                        )}
                        {!slo.description_zh && slo.description && (
                            <Box marginTop={1}>
                                <Text wrap="wrap" dimColor>{slo.description}</Text>
                            </Box>
                        )}
                    </Box>
                );
            })}
        </Box>
    );
}

/**
 * SLO 狀態視圖
 */
function SLOStatusView({ slos, stats }: { slos: any[]; stats: any }) {
    return (
        <Box flexDirection="column">
            {/* Stats Summary */}
            <Box borderStyle="double" borderColor="cyan" padding={1} marginBottom={1}>
                <Text bold>📊 狀態摘要: </Text>
                <Text color="green">達標 {stats.met}</Text>
                <Text> | </Text>
                <Text color="yellow">風險 {stats.atRisk}</Text>
                <Text> | </Text>
                <Text color="red">違反 {stats.violated}</Text>
                <Text> | </Text>
                <Text dimColor>未知 {stats.unknown}</Text>
            </Box>

            {/* SLO List */}
            {slos.map((slo: any) => {
                const statusColor = slo.status === 'met' ? 'green' :
                    slo.status === 'at-risk' ? 'yellow' :
                        slo.status === 'violated' ? 'red' : 'gray';

                return (
                    <Box key={slo.id} marginBottom={1}>
                        <Text color={statusColor}>
                            {slo.status === 'met' ? '✅' :
                                slo.status === 'at-risk' ? '⚠️' :
                                    slo.status === 'violated' ? '❌' : '❓'}
                        </Text>
                        <Text> {slo.name}</Text>
                        <Text dimColor> (目標: {slo.target}%, 預算: {slo.errorBudget}%)</Text>
                    </Box>
                );
            })}
        </Box>
    );
}

/**
 * K8s 資源類型圖標
 */
const K8S_RESOURCE_ICONS: Record<string, string> = {
    'Deployment': '🚀',
    'Service': '🔌',
    'ConfigMap': '⚙️',
    'Secret': '🔐',
    'Ingress': '🌐',
    'StatefulSet': '💾',
    'DaemonSet': '👻',
    'Job': '⚡',
    'CronJob': '⏰',
    'PersistentVolumeClaim': '💿',
    'Namespace': '📁',
    'HorizontalPodAutoscaler': '📈',
};

/**
 * Scan Repo 視圖
 */
function ScanRepoView({ result }: { result: any }) {
    return (
        <Box flexDirection="column">
            {/* Summary */}
            <Box borderStyle="double" borderColor="cyan" padding={1} marginBottom={1}>
                <Text bold color="cyan">📂 Repo 掃描結果</Text>
            </Box>

            {/* AI 摘要 */}
            {result.summary && (
                <Box borderStyle="round" borderColor="green" padding={1} marginBottom={1}>
                    <Box flexDirection="column">
                        <Text bold color="green">🤖 AI 摘要</Text>
                        <Box marginTop={1}>
                            <Text wrap="wrap">{result.summary}</Text>
                        </Box>
                    </Box>
                </Box>
            )}

            {/* 統計資訊 */}
            <Box marginBottom={1}>
                <Text bold>📊 統計: </Text>
                <Text>{result.fileCount} 個檔案</Text>
                <Text dimColor> | </Text>
                <Text>{result.totalResources} 個資源</Text>
            </Box>

            {/* 資源類型統計 */}
            <Box flexDirection="column" marginBottom={1}>
                <Text bold dimColor>資源類型分佈:</Text>
                <Box marginTop={1} flexWrap="wrap">
                    {Object.entries(result.resourcesByKind || {}).map(([kind, count]) => (
                        <Box key={kind} marginRight={2}>
                            <Text>{K8S_RESOURCE_ICONS[kind] || '📦'} </Text>
                            <Text color="yellow">{kind}</Text>
                            <Text dimColor>: </Text>
                            <Text bold>{count as number}</Text>
                        </Box>
                    ))}
                </Box>
            </Box>

            {/* 檔案列表 */}
            <Box flexDirection="column">
                <Text bold dimColor>檔案列表:</Text>
                {(result.files || []).slice(0, 10).map((file: any) => (
                    <Box key={file.path} marginLeft={1}>
                        <Text>📄 {file.path}</Text>
                        <Text dimColor> ({file.resourceCount} 個資源)</Text>
                    </Box>
                ))}
                {(result.files || []).length > 10 && (
                    <Box marginLeft={1}>
                        <Text dimColor>... 還有 {result.files.length - 10} 個檔案</Text>
                    </Box>
                )}
            </Box>
        </Box>
    );
}

/**
 * Analyze Deployment 視圖
 */
function AnalyzeDeploymentView({ result }: { result: any }) {
    return (
        <Box flexDirection="column">
            {/* Header */}
            <Box borderStyle="double" borderColor="blue" padding={1} marginBottom={1}>
                <Text bold color="blue">🔍 部署分析結果</Text>
            </Box>

            {/* Summary */}
            {result.summary && (
                <Box borderStyle="round" borderColor="cyan" padding={1} marginBottom={1}>
                    <Box flexDirection="column">
                        <Text bold color="cyan">📋 摘要</Text>
                        <Box marginTop={1}>
                            <Text wrap="wrap">{result.summary}</Text>
                        </Box>
                    </Box>
                </Box>
            )}

            {/* Architecture */}
            {result.architecture && (
                <Box marginBottom={1}>
                    <Text bold>🏗️ 架構: </Text>
                    <Text wrap="wrap">{result.architecture}</Text>
                </Box>
            )}

            {/* Resources */}
            {result.resources && result.resources.length > 0 && (
                <Box flexDirection="column" marginBottom={1}>
                    <Text bold dimColor>資源清單:</Text>
                    {result.resources.map((r: any, i: number) => (
                        <Box key={i} marginLeft={1}>
                            <Text>{K8S_RESOURCE_ICONS[r.kind] || '📦'} </Text>
                            <Text color="yellow">{r.kind}</Text>
                            <Text>: </Text>
                            <Text bold>{r.name}</Text>
                            {r.description && <Text dimColor> - {r.description}</Text>}
                        </Box>
                    ))}
                </Box>
            )}

            {/* Dependencies */}
            {result.dependencies && result.dependencies.length > 0 && (
                <Box marginBottom={1}>
                    <Text bold>🔗 相依服務: </Text>
                    <Text>{result.dependencies.join(', ')}</Text>
                </Box>
            )}
        </Box>
    );
}

/**
 * 問題嚴重度顏色
 */
const SEVERITY_COLORS: Record<string, 'red' | 'yellow' | 'blue'> = {
    'high': 'red',
    'medium': 'yellow',
    'low': 'blue',
};

const SEVERITY_ICONS: Record<string, string> = {
    'high': '🔴',
    'medium': '🟡',
    'low': '🔵',
};

/**
 * Suggest Improvements 視圖
 */
function SuggestImprovementsView({ result }: { result: any }) {
    return (
        <Box flexDirection="column">
            {/* Header */}
            <Box borderStyle="double" borderColor="magenta" padding={1} marginBottom={1}>
                <Box>
                    <Text bold color="magenta">💡 改進建議</Text>
                    {result.overallScore !== undefined && (
                        <>
                            <Text> | 評分: </Text>
                            <Text bold color={result.overallScore >= 80 ? 'green' : result.overallScore >= 60 ? 'yellow' : 'red'}>
                                {result.overallScore}/100
                            </Text>
                        </>
                    )}
                </Box>
            </Box>

            {/* Summary */}
            {result.summary && (
                <Box marginBottom={1}>
                    <Text wrap="wrap">{result.summary}</Text>
                </Box>
            )}

            {/* Issues */}
            {result.issues && result.issues.length > 0 && (
                <Box flexDirection="column">
                    {result.issues.map((issue: any, i: number) => {
                        const color = SEVERITY_COLORS[issue.severity] || 'yellow';
                        const icon = SEVERITY_ICONS[issue.severity] || '⚠️';

                        return (
                            <Box
                                key={i}
                                flexDirection="column"
                                borderStyle="round"
                                borderColor={color}
                                padding={1}
                                marginBottom={1}
                            >
                                <Box>
                                    <Text>{icon} </Text>
                                    <Text bold color={color}>{issue.title}</Text>
                                    <Text dimColor> [{issue.category}]</Text>
                                </Box>
                                {issue.location && (
                                    <Box marginTop={1}>
                                        <Text dimColor>📍 位置: </Text>
                                        <Text>{issue.location}</Text>
                                    </Box>
                                )}
                                <Box marginTop={1}>
                                    <Text dimColor>問題: </Text>
                                    <Text wrap="wrap">{issue.description}</Text>
                                </Box>
                                <Box marginTop={1}>
                                    <Text dimColor>建議: </Text>
                                    <Text wrap="wrap" color="green">{issue.suggestion}</Text>
                                </Box>
                            </Box>
                        );
                    })}
                </Box>
            )}

            {(!result.issues || result.issues.length === 0) && (
                <Box>
                    <Text color="green">✅ 沒有發現問題！</Text>
                </Box>
            )}
        </Box>
    );
}

/**
 * 預設視圖（美化的 JSON）
 */
function DefaultView({ result }: { result: any }) {
    // 檢查是否有錯誤
    if (result.success === false) {
        return (
            <Box borderStyle="round" borderColor="red" padding={1}>
                <Text color="red">❌ 執行失敗: {result.error || '未知錯誤'}</Text>
            </Box>
        );
    }

    // 成功但沒有特殊格式
    return (
        <Box flexDirection="column">
            <Box marginBottom={1}>
                <Text bold color="green">✅ 執行成功</Text>
            </Box>
            <Box borderStyle="single" borderColor="gray" padding={1}>
                <Text>{JSON.stringify(result, null, 2)}</Text>
            </Box>
        </Box>
    );
}
