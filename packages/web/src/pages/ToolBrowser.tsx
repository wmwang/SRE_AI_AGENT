import { useState, useEffect } from 'react'
import { Loader2, ChevronRight, Play } from 'lucide-react'

interface Tool {
    name: string
    description: string
    serverId: string
    serverName: string
    inputSchema?: object
}

export function ToolBrowser() {
    const [tools, setTools] = useState<Tool[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [selectedTool, setSelectedTool] = useState<Tool | null>(null)

    useEffect(() => {
        // Fetch tools from API
        fetch('/api/tools')
            .then(res => res.json())
            .then(data => {
                setTools(data.tools || [])
                setIsLoading(false)
            })
            .catch(() => {
                // Mock data for demo
                setTools([
                    { name: 'analyze_k8s_manifests', description: '分析 K8s manifests 並建議 SLO', serverId: 'slo', serverName: 'SLO Management' },
                    { name: 'recommend_slos', description: '基於服務特性推薦 SLO', serverId: 'slo', serverName: 'SLO Management' },
                    { name: 'track_slo_status', description: '追蹤 SLO 達成狀態', serverId: 'slo', serverName: 'SLO Management' },
                    { name: 'query_metrics', description: '查詢 Prometheus 即時指標', serverId: 'metrics', serverName: 'Metrics Analysis' },
                    { name: 'translate_nl_to_promql', description: '將自然語言轉換為 PromQL', serverId: 'metrics', serverName: 'Metrics Analysis' },
                    { name: 'analyze_metrics_health', description: 'AI 分析指標健康度', serverId: 'metrics', serverName: 'Metrics Analysis' },
                ])
                setIsLoading(false)
            })
    }, [])

    // Group tools by server
    const groupedTools = tools.reduce((acc, tool) => {
        const key = tool.serverName
        if (!acc[key]) acc[key] = []
        acc[key].push(tool)
        return acc
    }, {} as Record<string, Tool[]>)

    return (
        <div className="p-8">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Tool Browser</h1>
                <p className="text-[hsl(var(--muted-foreground))]">
                    瀏覽和測試所有可用的 MCP 工具
                </p>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-[hsl(var(--primary))]" />
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Tool List */}
                    <div className="space-y-6">
                        {Object.entries(groupedTools).map(([serverName, serverTools]) => (
                            <div key={serverName} className="border border-[hsl(var(--border))] rounded-xl bg-[hsl(var(--card))] overflow-hidden">
                                <div className="px-4 py-3 bg-[hsl(var(--secondary))] border-b border-[hsl(var(--border))]">
                                    <h3 className="font-semibold">{serverName}</h3>
                                    <p className="text-sm text-[hsl(var(--muted-foreground))]">{serverTools.length} 個工具</p>
                                </div>
                                <div className="divide-y divide-[hsl(var(--border))]">
                                    {serverTools.map((tool) => (
                                        <button
                                            key={`${tool.serverId}.${tool.name}`}
                                            onClick={() => setSelectedTool(tool)}
                                            className={`w-full px-4 py-3 text-left flex items-center justify-between hover:bg-[hsl(var(--secondary))] transition-colors ${selectedTool?.name === tool.name ? 'bg-[hsl(var(--secondary))]' : ''
                                                }`}
                                        >
                                            <div>
                                                <p className="font-mono text-sm text-[hsl(var(--primary))]">{tool.name}</p>
                                                <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">{tool.description}</p>
                                            </div>
                                            <ChevronRight className="w-5 h-5 text-[hsl(var(--muted-foreground))]" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Tool Detail */}
                    <div className="border border-[hsl(var(--border))] rounded-xl bg-[hsl(var(--card))] p-6 h-fit sticky top-8">
                        {selectedTool ? (
                            <div className="space-y-6">
                                <div>
                                    <p className="text-sm text-[hsl(var(--muted-foreground))] mb-1">{selectedTool.serverName}</p>
                                    <h2 className="text-xl font-bold font-mono text-[hsl(var(--primary))]">{selectedTool.name}</h2>
                                    <p className="text-[hsl(var(--muted-foreground))] mt-2">{selectedTool.description}</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2">參數 (JSON)</label>
                                    <textarea
                                        placeholder="{}"
                                        className="w-full h-32 p-3 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                                        defaultValue="{}"
                                    />
                                </div>

                                <button className="w-full py-3 rounded-lg bg-[hsl(var(--primary))] text-white font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                                    <Play className="w-5 h-5" />
                                    執行工具
                                </button>
                            </div>
                        ) : (
                            <div className="text-center py-12 text-[hsl(var(--muted-foreground))]">
                                <p>選擇一個工具來查看詳情</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
