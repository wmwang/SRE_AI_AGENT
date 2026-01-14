import { useState, useEffect } from 'react'
import { Search, Loader2, Sparkles, AlertTriangle, Clock, Filter, FileText } from 'lucide-react'

// 時間範圍選項
const TIME_RANGES = [
    { label: '15 分鐘', value: '15m', seconds: 15 * 60 },
    { label: '1 小時', value: '1h', seconds: 60 * 60 },
    { label: '6 小時', value: '6h', seconds: 6 * 60 * 60 },
    { label: '24 小時', value: '24h', seconds: 24 * 60 * 60 },
    { label: '7 天', value: '7d', seconds: 7 * 24 * 60 * 60 },
]

// 日誌等級
const LOG_LEVELS = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE']

// 日誌等級顏色
const LEVEL_COLORS: Record<string, string> = {
    ERROR: 'text-red-400 bg-red-500/20',
    WARN: 'text-yellow-400 bg-yellow-500/20',
    INFO: 'text-blue-400 bg-blue-500/20',
    DEBUG: 'text-gray-400 bg-gray-500/20',
    TRACE: 'text-gray-500 bg-gray-600/20',
}

interface LogEntry {
    timestamp: string
    level: string
    message: string
    service?: string
    pod?: string
    namespace?: string
}

interface LogSummary {
    summary: string
    keyFindings: string[]
    errorCount: number
}

interface ErrorPattern {
    pattern: string
    severity: string
    description: string
    recommendations: string[]
}

const API_BASE = 'http://localhost:3001'

export function LogExplorer() {
    const [query, setQuery] = useState('')
    const [selectedTimeRange, setSelectedTimeRange] = useState('1h')
    const [selectedLevels, setSelectedLevels] = useState<string[]>([])

    const [isSearching, setIsSearching] = useState(false)
    const [isAnalyzing, setIsAnalyzing] = useState(false)

    const [logs, setLogs] = useState<LogEntry[]>([])
    const [total, setTotal] = useState(0)
    const [summary, setSummary] = useState<LogSummary | null>(null)
    const [patterns, setPatterns] = useState<ErrorPattern[]>([])
    const [error, setError] = useState<string | null>(null)

    // 計算時間範圍
    const getTimeRange = () => {
        const now = Math.floor(Date.now() / 1000)
        const range = TIME_RANGES.find(t => t.value === selectedTimeRange)
        const seconds = range?.seconds || 3600
        return { start: now - seconds, end: now }
    }

    // 搜尋日誌
    const handleSearch = async () => {
        setIsSearching(true)
        setError(null)

        try {
            const response = await fetch(`${API_BASE}/api/logs/search`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query,
                    timeRange: getTimeRange(),
                    filters: selectedLevels.length > 0 ? { level: selectedLevels } : {},
                    size: 100,
                }),
            })

            const data = await response.json()
            if (data.success && data.result) {
                setLogs(data.result.hits || [])
                setTotal(data.result.total || 0)
            } else {
                setError(data.error || '搜尋失敗')
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : '網路錯誤')
        } finally {
            setIsSearching(false)
        }
    }

    // AI 摘要
    const handleSummarize = async () => {
        setIsAnalyzing(true)
        setError(null)

        try {
            const response = await fetch(`${API_BASE}/api/logs/summarize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query,
                    timeRange: getTimeRange(),
                }),
            })

            const data = await response.json()
            if (data.success && data.result) {
                setSummary({
                    summary: data.result.summary || '',
                    keyFindings: data.result.keyFindings || [],
                    errorCount: data.result.errorCount || 0,
                })
            } else {
                setError(data.error || 'AI 摘要失敗')
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : '網路錯誤')
        } finally {
            setIsAnalyzing(false)
        }
    }

    // AI 錯誤分析
    const handleAnalyze = async () => {
        setIsAnalyzing(true)
        setError(null)

        try {
            const response = await fetch(`${API_BASE}/api/logs/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    timeRange: getTimeRange(),
                    minOccurrences: 1,
                }),
            })

            const data = await response.json()
            if (data.success && data.result) {
                setPatterns(data.result.patterns || [])
            } else {
                setError(data.error || 'AI 分析失敗')
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : '網路錯誤')
        } finally {
            setIsAnalyzing(false)
        }
    }

    // 切換日誌等級
    const toggleLevel = (level: string) => {
        setSelectedLevels(prev =>
            prev.includes(level)
                ? prev.filter(l => l !== level)
                : [...prev, level]
        )
    }

    // 初始載入
    useEffect(() => {
        handleSearch()
    }, [])

    return (
        <div className="p-8">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Log Explorer</h1>
                <p className="text-[hsl(var(--muted-foreground))]">
                    搜尋日誌並使用 AI 進行智慧分析
                </p>
            </div>

            {/* Search Bar */}
            <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[hsl(var(--muted-foreground))]" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="輸入搜尋關鍵字或 Lucene 查詢語法..."
                    className="w-full pl-12 pr-4 py-4 rounded-xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] text-lg focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-transparent"
                />
                <button
                    onClick={handleSearch}
                    disabled={isSearching}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2 rounded-lg bg-[hsl(var(--primary))] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                    {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : '搜尋'}
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4 mb-6">
                {/* Time Range */}
                <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                    <div className="flex gap-1">
                        {TIME_RANGES.map((range) => (
                            <button
                                key={range.value}
                                onClick={() => setSelectedTimeRange(range.value)}
                                className={`px-3 py-1 rounded-lg text-sm transition-colors ${selectedTimeRange === range.value
                                        ? 'bg-[hsl(var(--primary))] text-white'
                                        : 'bg-[hsl(var(--card))] border border-[hsl(var(--border))] hover:border-[hsl(var(--primary))]'
                                    }`}
                            >
                                {range.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Log Levels */}
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                    <div className="flex gap-1">
                        {LOG_LEVELS.map((level) => (
                            <button
                                key={level}
                                onClick={() => toggleLevel(level)}
                                className={`px-3 py-1 rounded-lg text-sm transition-colors ${selectedLevels.includes(level)
                                        ? LEVEL_COLORS[level]
                                        : 'bg-[hsl(var(--card))] border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]'
                                    }`}
                            >
                                {level}
                            </button>
                        ))}
                    </div>
                </div>

                {/* AI Actions */}
                <div className="flex gap-2 ml-auto">
                    <button
                        onClick={handleSummarize}
                        disabled={isAnalyzing}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[hsl(var(--card))] border border-[hsl(var(--border))] hover:border-[hsl(var(--primary))] transition-colors"
                    >
                        {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                        AI 摘要
                    </button>
                    <button
                        onClick={handleAnalyze}
                        disabled={isAnalyzing}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[hsl(var(--card))] border border-[hsl(var(--border))] hover:border-[hsl(var(--primary))] transition-colors"
                    >
                        {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                        錯誤分析
                    </button>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="mb-6 p-4 rounded-lg bg-red-500/20 border border-red-500/50 text-red-400">
                    ❌ {error}
                </div>
            )}

            {/* Results Count */}
            {total > 0 && (
                <div className="mb-4 text-[hsl(var(--muted-foreground))]">
                    找到 <span className="text-[hsl(var(--primary))] font-bold">{total}</span> 筆日誌
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Log List */}
                <div className="lg:col-span-2 space-y-3">
                    {logs.length === 0 && !isSearching ? (
                        <div className="p-8 text-center text-[hsl(var(--muted-foreground))] border border-[hsl(var(--border))] rounded-xl">
                            暫無日誌資料
                        </div>
                    ) : (
                        logs.map((log, idx) => (
                            <div
                                key={idx}
                                className="p-4 rounded-xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] hover:border-[hsl(var(--primary))] transition-colors"
                            >
                                <div className="flex items-center gap-3 mb-2">
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${LEVEL_COLORS[log.level] || 'bg-gray-500/20 text-gray-400'}`}>
                                        {log.level}
                                    </span>
                                    <span className="text-sm text-[hsl(var(--muted-foreground))]">
                                        {log.timestamp}
                                    </span>
                                    {log.service && (
                                        <span className="text-sm text-[hsl(var(--primary))]">
                                            {log.service}
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm font-mono break-all">
                                    {log.message}
                                </p>
                            </div>
                        ))
                    )}
                </div>

                {/* AI Analysis Panel */}
                <div className="space-y-4">
                    {/* Summary */}
                    {summary && (
                        <div className="p-4 rounded-xl bg-[hsl(var(--card))] border border-[hsl(var(--border))]">
                            <div className="flex items-center gap-2 mb-3">
                                <Sparkles className="w-5 h-5 text-[hsl(var(--primary))]" />
                                <h3 className="font-semibold">AI 摘要</h3>
                            </div>
                            <p className="text-sm text-[hsl(var(--muted-foreground))] mb-3">
                                {summary.summary}
                            </p>
                            {summary.keyFindings.length > 0 && (
                                <div className="space-y-1">
                                    <p className="text-sm font-medium">關鍵發現：</p>
                                    {summary.keyFindings.map((finding, idx) => (
                                        <p key={idx} className="text-sm text-yellow-400">• {finding}</p>
                                    ))}
                                </div>
                            )}
                            {summary.errorCount > 0 && (
                                <p className="mt-2 text-sm text-red-400">
                                    ⚠️ 錯誤數量: {summary.errorCount}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Error Patterns */}
                    {patterns.length > 0 && (
                        <div className="p-4 rounded-xl bg-[hsl(var(--card))] border border-[hsl(var(--border))]">
                            <div className="flex items-center gap-2 mb-3">
                                <AlertTriangle className="w-5 h-5 text-yellow-400" />
                                <h3 className="font-semibold">錯誤模式分析</h3>
                            </div>
                            <div className="space-y-3">
                                {patterns.map((pattern, idx) => (
                                    <div key={idx} className="p-3 rounded-lg bg-[hsl(var(--background))]">
                                        <p className="font-medium text-sm mb-1">{pattern.pattern}</p>
                                        <p className="text-xs text-[hsl(var(--muted-foreground))] mb-2">
                                            {pattern.description}
                                        </p>
                                        {pattern.recommendations.length > 0 && (
                                            <p className="text-xs text-green-400">
                                                💡 {pattern.recommendations[0]}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Empty State */}
                    {!summary && patterns.length === 0 && (
                        <div className="p-6 text-center rounded-xl bg-[hsl(var(--card))] border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]">
                            <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-50" />
                            <p>點擊「AI 摘要」或「錯誤分析」獲取智慧洞察</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
