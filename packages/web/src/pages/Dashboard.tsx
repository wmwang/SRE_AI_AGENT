import { Target, LineChart, Wrench, Sparkles, FileSearch } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'

const features = [
    {
        title: 'SLO Workflow',
        description: '從 K8s YAML 自動生成 SLO、Prometheus Rules 和 Grafana Dashboard',
        icon: Target,
        to: '/slo',
        gradient: 'from-blue-500 to-cyan-500',
    },
    {
        title: 'Metrics Explorer',
        description: '使用自然語言查詢 Prometheus，獲得 AI 驅動的診斷分析',
        icon: LineChart,
        to: '/metrics',
        gradient: 'from-green-500 to-emerald-500',
    },
    {
        title: 'Log Explorer',
        description: '搜尋日誌並使用 AI 進行智慧分析與錯誤模式識別',
        icon: FileSearch,
        to: '/logs',
        gradient: 'from-orange-500 to-amber-500',
    },
    {
        title: 'Tool Browser',
        description: '瀏覽和測試所有可用的 MCP 工具',
        icon: Wrench,
        to: '/tools',
        gradient: 'from-purple-500 to-pink-500',
    },
]

export function Dashboard() {
    const [apiStatus, setApiStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')

    useEffect(() => {
        const checkHealth = async () => {
            try {
                const res = await fetch('/api/tools', { method: 'GET' })
                if (res.ok) {
                    setApiStatus('connected')
                } else {
                    setApiStatus('disconnected')
                }
            } catch {
                setApiStatus('disconnected')
            }
        }

        // 初次檢測
        checkHealth()

        // 每 5 秒檢測一次
        const interval = setInterval(checkHealth, 5000)
        return () => clearInterval(interval)
    }, [])

    const statusInfo = {
        connecting: { text: '連線中...', color: 'bg-yellow-500' },
        connected: { text: '已連線', color: 'bg-green-500' },
        disconnected: { text: '未連線', color: 'bg-red-500' },
    }

    return (
        <div className="p-8">
            {/* Header */}
            <div className="text-center mb-12">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[hsl(var(--secondary))] text-sm mb-4">
                    <Sparkles className="w-4 h-4 text-[hsl(var(--primary))]" />
                    <span>Powered by AI + MCP</span>
                </div>
                <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                    SRE AI Agent
                </h1>
                <p className="text-lg text-[hsl(var(--muted-foreground))] max-w-2xl mx-auto">
                    智慧化的 SRE 助手，幫助您自動生成 SLO、分析指標、優化系統可靠性
                </p>
            </div>

            {/* Feature Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
                {features.map((feature) => (
                    <Link
                        key={feature.to}
                        to={feature.to}
                        className="group relative overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 transition-all hover:border-[hsl(var(--primary))] hover:shadow-lg hover:shadow-[hsl(var(--primary))]/10"
                    >
                        <div className={`inline-flex p-3 rounded-lg bg-gradient-to-br ${feature.gradient} mb-4`}>
                            <feature.icon className="w-6 h-6 text-white" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2 group-hover:text-[hsl(var(--primary))] transition-colors">
                            {feature.title}
                        </h3>
                        <p className="text-[hsl(var(--muted-foreground))]">
                            {feature.description}
                        </p>
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ backgroundImage: `linear-gradient(to right, var(--tw-gradient-stops))` }} />
                    </Link>
                ))}
            </div>

            {/* Status */}
            <div className="mt-12 text-center">
                <div className="inline-flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                    <span className={`w-2 h-2 rounded-full ${statusInfo[apiStatus].color} ${apiStatus === 'connecting' ? 'animate-pulse' : ''}`} />
                    API Gateway: {statusInfo[apiStatus].text}
                </div>
            </div>
        </div>
    )
}

