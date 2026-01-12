/**
 * WelcomePanel - 功能介紹面板
 * 
 * 在主選單顯示 2 欄式的功能說明，幫助用戶快速了解 AI SRE Agent 能做什麼
 */

import { Box, Text, useStdout } from 'ink';

interface FeatureItem {
    icon: string;
    title: string;
    description: string;
}

const features: FeatureItem[] = [
    {
        icon: '1.',
        title: 'SLO Workflow',
        description: 'K8s YAML → AI recommends SLO → Generate Prometheus Rules',
    },
    {
        icon: '2.',
        title: 'Metrics Explorer',
        description: 'Natural Language → PromQL → Prometheus → Chart + AI Diagnosis',
    },
    {
        icon: '3.',
        title: 'Tool Browser',
        description: 'Directly invoke 21 MCP Tools (SLO/Metrics/K8s)',
    },
    {
        icon: '4.',
        title: 'AI Query',
        description: 'LangGraph Agent auto-selects tools for complex tasks',
    },
];

export function WelcomePanel() {
    const { stdout } = useStdout();
    const termWidth = stdout?.columns || 80;

    // Logo ASCII art 寬度約 90 字元，限制 WelcomePanel 寬度對齊
    const maxWidth = Math.min(termWidth, 90);

    // 根據終端寬度決定顯示方式
    const showTwoColumns = maxWidth >= 70;

    return (
        <Box flexDirection="column" marginBottom={1} width={maxWidth}>
            {/* 功能說明框 */}
            <Box
                flexDirection="column"
                borderStyle="round"
                borderColor="gray"
                paddingX={1}
            >
                {/* Header */}
                <Box marginBottom={1}>
                    <Text color="gray">
                        <Text color="cyan">[?]</Text> What can this AI Agent do:
                    </Text>
                </Box>

                {/* 功能列表 */}
                {showTwoColumns ? (
                    // 2 欄式佈局
                    <Box flexDirection="column">
                        <Box>
                            <Box width="50%">
                                <FeatureCard feature={features[0]!} />
                            </Box>
                            <Box width="50%">
                                <FeatureCard feature={features[1]!} />
                            </Box>
                        </Box>
                        <Box>
                            <Box width="50%">
                                <FeatureCard feature={features[2]!} />
                            </Box>
                            <Box width="50%">
                                <FeatureCard feature={features[3]!} />
                            </Box>
                        </Box>
                    </Box>
                ) : (
                    // 單欄式佈局（窄終端）
                    <Box flexDirection="column">
                        {features.map((f, i) => (
                            <FeatureCard key={i} feature={f} />
                        ))}
                    </Box>
                )}

                {/* Quick Start Tip */}
                <Box marginTop={1}>
                    <Text color="gray">
                        <Text color="yellow">[*]</Text> Try:
                        <Text color="cyan"> SLO Workflow </Text>
                        with deployment.yaml, or
                        <Text color="cyan"> Metrics Explorer </Text>
                        query "API error rate"
                    </Text>
                </Box>
            </Box>
        </Box>
    );
}

function FeatureCard({ feature }: { feature: FeatureItem }) {
    return (
        <Box marginRight={2} marginBottom={0}>
            <Text>
                <Text>{feature.icon}</Text>
                <Text bold color="white"> {feature.title}</Text>
                <Text color="gray"> - {feature.description}</Text>
            </Text>
        </Box>
    );
}
