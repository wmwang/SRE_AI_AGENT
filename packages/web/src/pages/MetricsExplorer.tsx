import { useState } from 'react'
import { Search, Loader2, Sparkles } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

// Mock data for demo
const mockData = [
    { time: '00:00', value: 45 },
    { time: '00:05', value: 52 },
    { time: '00:10', value: 48 },
    { time: '00:15', value: 61 },
    { time: '00:20', value: 55 },
    { time: '00:25', value: 67 },
    { time: '00:30', value: 72 },
    { time: '00:35', value: 65 },
    { time: '00:40', value: 58 },
    { time: '00:45', value: 63 },
]

export function MetricsExplorer() {
    const [query, setQuery] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [showResults, setShowResults] = useState(false)

    const handleSearch = async () => {
        if (!query.trim()) return
        setIsLoading(true)
        // TODO: Call API
        setTimeout(() => {
            setIsLoading(false)
            setShowResults(true)
        }, 1500)
    }

    return (
        <div className="p-8">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Metrics Explorer</h1>
                <p className="text-[hsl(var(--muted-foreground))]">
                    使用自然語言查詢 Prometheus 指標，獲得 AI 驅動的診斷分析
                </p>
            </div>

            {/* Search Bar */}
            <div className="relative mb-8">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[hsl(var(--muted-foreground))]" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="輸入自然語言查詢，例如：過去 1 小時 payment-service 的 CPU 使用率"
                    className="w-full pl-12 pr-4 py-4 rounded-xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] text-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-transparent"
                />
                <button
                    onClick={handleSearch}
                    disabled={isLoading}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2 rounded-lg bg-[hsl(var(--primary))] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : '查詢'}
                </button>
            </div>

            {/* Quick Suggestions */}
            {!showResults && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {[
                        '系統 CPU 使用率',
                        '記憶體用量趨勢',
                        'HTTP 請求延遲',
                        '錯誤率分析',
                    ].map((suggestion) => (
                        <button
                            key={suggestion}
                            onClick={() => {
                                setQuery(suggestion)
                                handleSearch()
                            }}
                            className="p-4 rounded-lg bg-[hsl(var(--card))] border border-[hsl(var(--border))] text-left hover:border-[hsl(var(--primary))] transition-colors"
                        >
                            <p className="text-sm text-[hsl(var(--muted-foreground))]">快速查詢</p>
                            <p className="font-medium">{suggestion}</p>
                        </button>
                    ))}
                </div>
            )}

            {/* Results */}
            {showResults && (
                <div className="space-y-6">
                    {/* Chart */}
                    <div className="border border-[hsl(var(--border))] rounded-xl bg-[hsl(var(--card))] p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-semibold">查詢結果</h3>
                                <p className="text-sm text-[hsl(var(--muted-foreground))] font-mono">
                                    rate(process_cpu_seconds_total[5m]) * 100
                                </p>
                            </div>
                            <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-sm">
                                健康
                            </span>
                        </div>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={mockData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                    <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" />
                                    <YAxis stroke="hsl(var(--muted-foreground))" />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'hsl(var(--card))',
                                            border: '1px solid hsl(var(--border))',
                                            borderRadius: '8px'
                                        }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="value"
                                        stroke="hsl(var(--primary))"
                                        strokeWidth={2}
                                        dot={false}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* AI Diagnosis */}
                    <div className="border border-[hsl(var(--border))] rounded-xl bg-[hsl(var(--card))] p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Sparkles className="w-5 h-5 text-[hsl(var(--primary))]" />
                            <h3 className="text-lg font-semibold">AI 診斷</h3>
                        </div>
                        <div className="space-y-4">
                            <p className="text-[hsl(var(--muted-foreground))]">
                                根據過去 1 小時的數據分析，CPU 使用率呈現穩定趨勢，平均值為 58%，最高峰值 72%。
                            </p>
                            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                                <p className="text-green-400 font-medium">✓ 系統運行正常</p>
                                <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
                                    目前 CPU 使用率在健康範圍內，無需特別關注。
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
