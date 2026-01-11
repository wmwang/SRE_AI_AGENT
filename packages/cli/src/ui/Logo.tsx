import { Box, Text } from 'ink';

/**
 * ASCII Art Logo for AI Ops Agent
 * 3D-style rendering with gradient colors
 */
export function Logo() {
    // 3D ASCII art logo - AI OPS AGENT
    const logoLines = [
        " █████╗ ██╗    ███████╗██████╗ ███████╗     █████╗  ██████╗ ███████╗███╗   ██╗████████╗",
        "██╔══██╗██║    ██╔════╝██╔══██╗██╔════╝    ██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝",
        "███████║██║    ███████╗██████╔╝█████╗      ███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║   ",
        "██╔══██║██║    ╚════██║██╔══██╗██╔══╝      ██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║   ",
        "██║  ██║██║    ███████║██║  ██║███████╗    ██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║   ",
        "╚═╝  ╚═╝╚═╝    ╚══════╝╚═╝  ╚═╝╚══════╝    ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝   ",
    ];

    // Color gradient logic: Cyan (#00FFFF) -> Blue (#0000FF) -> Magenta (#FF00FF)
    // We want a solid feel, so we use a smooth gradient
    const startColor = { r: 0, g: 255, b: 255 }; // Cyan
    const endColor = { r: 255, g: 0, b: 255 };   // Magenta

    const getGradientColor = (step: number, totalSteps: number) => {
        const r = Math.round(startColor.r + (endColor.r - startColor.r) * (step / (totalSteps - 1)));
        const g = Math.round(startColor.g + (endColor.g - startColor.g) * (step / (totalSteps - 1)));
        const b = Math.round(startColor.b + (endColor.b - startColor.b) * (step / (totalSteps - 1)));
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    };

    return (
        <Box flexDirection="column" marginBottom={1}>
            {/* Logo lines with smooth gradient */}
            {logoLines.map((line, index) => (
                <Text key={index} color={getGradientColor(index, logoLines.length)} bold>
                    {line}
                </Text>
            ))}

            {/* Tagline - 使用相同寬度對齊 */}
            <Box marginTop={1}>
                <Text dimColor>    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</Text>
            </Box>
            <Box>
                <Text>                                        </Text>
                <Text color="yellow">✨ </Text>
                <Text>Your Intelligent SRE Assistant</Text>
                <Text color="yellow"> ✨</Text>
            </Box>
            <Box marginBottom={1}>
                <Text dimColor>    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</Text>
            </Box>
        </Box>
    );
}

/**
 * Compact version for smaller screens
 */
export function LogoCompact() {
    return (
        <Box flexDirection="column" marginBottom={1}>
            <Box borderStyle="double" borderColor="cyan" padding={1}>
                <Text bold color="cyan">🤖 AI SRE AGENT</Text>
                <Text> - Your Intelligent SRE Assistant</Text>
            </Box>
        </Box>
    );
}
