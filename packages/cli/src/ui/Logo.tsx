import { Box, Text } from 'ink';

/**
 * ASCII Art Logo for AI SRE Agent
 * Unicode block version for terminals with good Unicode support
 */
export function Logo() {
    // 3D Unicode block logo - AI SRE AGENT
    const logoLines = [
        " █████╗ ██╗    ███████╗██████╗ ███████╗     █████╗  ██████╗ ███████╗███╗   ██╗████████╗",
        "██╔══██╗██║    ██╔════╝██╔══██╗██╔════╝    ██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝",
        "███████║██║    ███████╗██████╔╝█████╗      ███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║   ",
        "██╔══██║██║    ╚════██║██╔══██╗██╔══╝      ██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║   ",
        "██║  ██║██║    ███████║██║  ██║███████╗    ██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║   ",
        "╚═╝  ╚═╝╚═╝    ╚══════╝╚═╝  ╚═╝╚══════╝    ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝   ",
    ];

    // Color gradient: Cyan -> Magenta
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

            {/* Tagline */}
            <Box marginTop={1}>
                <Text dimColor>    =====================================================================================================</Text>
            </Box>
            <Box justifyContent="center" width={90}>
                <Text color="yellow">* </Text>
                <Text>Your Intelligent SRE Assistant</Text>
                <Text color="yellow"> *</Text>
            </Box>
            <Box marginBottom={1}>
                <Text dimColor>    =====================================================================================================</Text>
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
            <Box borderStyle="single" borderColor="cyan" padding={1}>
                <Text bold color="cyan">[AI] SRE AGENT</Text>
                <Text> - Your Intelligent SRE Assistant</Text>
            </Box>
        </Box>
    );
}

