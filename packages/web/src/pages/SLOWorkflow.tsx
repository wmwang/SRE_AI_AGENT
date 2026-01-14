import { useState } from 'react'
import { Upload, FileCode, Loader2, Check, ArrowRight, Download, Copy, CheckCircle, MessageSquare, Sparkles } from 'lucide-react'
import { analyzeSLO, refineSLO, generateSLOConfigs, type SLO } from '../lib/api'

type Step = 'upload' | 'analyzing' | 'review' | 'refining' | 'generating' | 'complete'

export function SLOWorkflow() {
    const [step, setStep] = useState<Step>('upload')
    const [yamlContent, setYamlContent] = useState('')
    const [slos, setSlos] = useState<SLO[]>([])
    const [prometheusRules, setPrometheusRules] = useState('')
    const [grafanaDashboard, setGrafanaDashboard] = useState('')
    const [activeTab, setActiveTab] = useState<'prometheus' | 'grafana'>('prometheus')
    const [copied, setCopied] = useState(false)
    const [feedback, setFeedback] = useState('')
    const [isRefining, setIsRefining] = useState(false)
    const [refinementHistory, setRefinementHistory] = useState<string[]>([])
    const [serviceName, setServiceName] = useState('')
    const [_error, setError] = useState<string | null>(null)
    const [useApi, _setUseApi] = useState(true) // 是否使用 API，false 時使用本地 fallback

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            const reader = new FileReader()
            reader.onload = (event) => {
                setYamlContent(event.target?.result as string)
            }
            reader.readAsText(file)
        }
    }

    const startAnalysis = async () => {
        setStep('analyzing')
        setError(null)

        // 從 YAML 內容推斷服務名稱 (用於 fallback)
        const serviceNameMatch = yamlContent.match(/name:\s*["']?([a-zA-Z0-9-]+)["']?/)
        const inferredName = serviceNameMatch?.[1] || 'my-service'

        if (useApi) {
            try {
                const response = await analyzeSLO(yamlContent)
                if (response.success && response.result) {
                    setServiceName(response.result.serviceName || inferredName)
                    setSlos(response.result.slos || [])
                    setStep('review')
                    return
                }
            } catch (err) {
                console.warn('[SLO] API 分析失敗，使用本地 fallback:', err)
                // 繼續使用 fallback
            }
        }

        // Fallback: 本地生成 SLO 建議
        setServiceName(inferredName)
        setSlos([
            { name: `${inferredName} 可用性`, target: '99.9%', signal: 'Availability' },
            { name: `${inferredName} 延遲`, target: 'P99 < 200ms', signal: 'Latency' },
            { name: `${inferredName} 錯誤率`, target: '< 1%', signal: 'Error Rate' },
        ])
        setStep('review')
    }

    const refineSlos = async () => {
        if (!feedback.trim()) return

        setIsRefining(true)
        setRefinementHistory(prev => [...prev, feedback])

        // 先嘗試使用 API
        if (useApi) {
            try {
                const response = await refineSLO(slos, feedback, serviceName)
                if (response.success && response.result?.slos) {
                    setSlos(response.result.slos)
                    setFeedback('')
                    setIsRefining(false)
                    return
                }
            } catch (err) {
                console.warn('[SLO] API 調整失敗，使用本地 fallback:', err)
            }
        }

        // Fallback: 本地智能匹配邏輯
        const fb = feedback.trim()
        let newSlos = [...slos]
        let hasChanges = false

        // 智能匹配：嘗試理解用戶意圖
        // 1. 先尋找數字
        const numberMatch = fb.match(/(\d+\.?\d*)/g)
        const numbers = numberMatch ? numberMatch.map(n => parseFloat(n)) : []

        // 2. 識別 SLO 類型關鍵字
        const mentionsAvailability = /可用性|availability|uptime|sla/i.test(fb)
        const mentionsLatency = /延遲|latency|回應|response|ms|毫秒/i.test(fb)
        const mentionsError = /錯誤|error|失敗|fail/i.test(fb)
        const mentionsAdd = /新增|加入|add|增加|添加/i.test(fb)
        const mentionsRemove = /移除|刪除|remove|不需要|去掉/i.test(fb)
        const mentionsHigher = /提高|增加|更高|higher|increase/i.test(fb)
        const mentionsLower = /降低|減少|更低|lower|decrease|更快|faster/i.test(fb)

        // 處理可用性
        if (mentionsAvailability) {
            if (numbers.length > 0 && numbers[0] >= 90 && numbers[0] <= 100) {
                newSlos = newSlos.map(s => s.signal === 'Availability' ? { ...s, target: `${numbers[0]}%` } : s)
                hasChanges = true
            } else if (mentionsHigher) {
                newSlos = newSlos.map(s => s.signal === 'Availability' ? { ...s, target: '99.99%' } : s)
                hasChanges = true
            }
        }

        // 處理延遲
        if (mentionsLatency) {
            if (numbers.length > 0 && numbers[0] > 0 && numbers[0] <= 10000) {
                newSlos = newSlos.map(s => s.signal === 'Latency' ? { ...s, target: `P99 < ${numbers[0]}ms` } : s)
                hasChanges = true
            } else if (mentionsLower) {
                newSlos = newSlos.map(s => s.signal === 'Latency' ? { ...s, target: 'P99 < 100ms' } : s)
                hasChanges = true
            }
        }

        // 處理錯誤率
        if (mentionsError) {
            if (numbers.length > 0 && numbers[0] >= 0 && numbers[0] <= 100) {
                newSlos = newSlos.map(s => s.signal === 'Error Rate' ? { ...s, target: `< ${numbers[0]}%` } : s)
                hasChanges = true
            } else if (mentionsLower) {
                newSlos = newSlos.map(s => s.signal === 'Error Rate' ? { ...s, target: '< 0.1%' } : s)
                hasChanges = true
            }
        }

        // 處理新增 SLO
        if (mentionsAdd) {
            if (/吞吐|throughput|qps|rps|tps/i.test(fb)) {
                const exists = newSlos.some(s => s.signal === 'Throughput')
                if (!exists) {
                    const throughputValue = numbers.find(n => n >= 100 && n <= 1000000) || 1000
                    newSlos.push({ name: `${serviceName} 吞吐量`, target: `> ${throughputValue} req/s`, signal: 'Throughput' })
                    hasChanges = true
                }
            }
            if (/飽和|saturation|cpu|memory|記憶體|資源/i.test(fb)) {
                const exists = newSlos.some(s => s.signal === 'Saturation')
                if (!exists) {
                    newSlos.push({ name: `${serviceName} 資源飽和度`, target: '< 80%', signal: 'Saturation' })
                    hasChanges = true
                }
            }
        }

        // 處理移除 SLO
        if (mentionsRemove && newSlos.length > 1) {
            if (mentionsLatency) {
                newSlos = newSlos.filter(s => s.signal !== 'Latency')
                hasChanges = true
            } else if (mentionsError) {
                newSlos = newSlos.filter(s => s.signal !== 'Error Rate')
                hasChanges = true
            } else if (/吞吐|throughput/i.test(fb)) {
                newSlos = newSlos.filter(s => s.signal !== 'Throughput')
                hasChanges = true
            }
        }

        // 智能 Fallback：如果沒有明確指定類型，但有數字
        if (!hasChanges && numbers.length > 0) {
            const num = numbers[0]

            // 根據數字大小猜測是什麼
            if (num >= 99 && num <= 100) {
                // 99.xx 很可能是可用性
                newSlos = newSlos.map(s => s.signal === 'Availability' ? { ...s, target: `${num}%` } : s)
                hasChanges = true
            } else if (num >= 50 && num <= 2000) {
                // 50-2000 很可能是延遲 (ms)
                newSlos = newSlos.map(s => s.signal === 'Latency' ? { ...s, target: `P99 < ${num}ms` } : s)
                hasChanges = true
            } else if (num >= 0 && num < 10) {
                // 0-10 很可能是錯誤率 (%)
                newSlos = newSlos.map(s => s.signal === 'Error Rate' ? { ...s, target: `< ${num}%` } : s)
                hasChanges = true
            }
        }

        // 最後的 fallback
        if (!hasChanges) {
            console.log('[Refinement] 無法識別指令，請嘗試：「可用性 99.99」、「延遲 100ms」、「新增吞吐量」')
        }

        setSlos(newSlos)
        setFeedback('')
        setIsRefining(false)
    }

    const generateConfigs = async () => {
        setStep('generating')
        setError(null)

        // 先嘗試使用 API
        if (useApi) {
            try {
                const response = await generateSLOConfigs(slos, serviceName)
                if (response.success && response.result) {
                    setPrometheusRules(response.result.prometheusRules || '')
                    setGrafanaDashboard(response.result.grafanaDashboard || '')
                    setStep('complete')
                    return
                }
            } catch (err) {
                console.warn('[SLO] API 生成失敗，使用本地 fallback:', err)
            }
        }

        // Fallback: 本地生成配置
        const svcName = serviceName || 'my-service'

        const rules = `# Prometheus Recording & Alerting Rules
# Generated by SRE AI Agent

groups:
  - name: "${svcName}_slo_recording_rules"
    rules:
      - record: "slo:${svcName}:availability"
        expr: |
          sum(rate(http_requests_total{service="${svcName}",status!~"5.."}[5m]))
          /
          sum(rate(http_requests_total{service="${svcName}"}[5m]))
        
      - record: "slo:${svcName}:latency_p99"
        expr: |
          histogram_quantile(0.99, 
            sum(rate(http_request_duration_seconds_bucket{service="${svcName}"}[5m])) by (le)
          )
        
      - record: "slo:${svcName}:error_rate"
        expr: |
          sum(rate(http_requests_total{service="${svcName}",status=~"5.."}[5m]))
          /
          sum(rate(http_requests_total{service="${svcName}"}[5m]))

  - name: "${svcName}_slo_alert_rules"
    rules:
      - alert: "SLO_${svcName}_Availability_Breached"
        expr: "slo:${svcName}:availability < 0.999"
        for: "5m"
        labels:
          severity: "warning"
          slo_id: "availability"
        annotations:
          summary: "${svcName} 可用性 SLO 違反"
          description: "可用性目標 99.9%，目前 {{ $value | humanizePercentage }}"

      - alert: "SLO_${svcName}_Latency_Breached"
        expr: "slo:${svcName}:latency_p99 > 0.2"
        for: "5m"
        labels:
          severity: "warning"
          slo_id: "latency"
        annotations:
          summary: "${svcName} 延遲 SLO 違反"
          description: "P99 延遲目標 200ms，目前 {{ $value | humanizeDuration }}"

      - alert: "SLO_${svcName}_ErrorRate_Breached"
        expr: "slo:${svcName}:error_rate > 0.01"
        for: "5m"
        labels:
          severity: "critical"
          slo_id: "error_rate"
        annotations:
          summary: "${svcName} 錯誤率 SLO 違反"
          description: "錯誤率目標 1%，目前 {{ $value | humanizePercentage }}"
`

        // 生成 Grafana Dashboard JSON
        const dashboard = JSON.stringify({
            "title": `${svcName} SLO Dashboard`,
            "uid": `${svcName}-slo`,
            "tags": ["slo", "sre", serviceName],
            "timezone": "browser",
            "schemaVersion": 38,
            "version": 1,
            "panels": [
                {
                    "id": 1,
                    "title": "可用性 (Availability)",
                    "type": "gauge",
                    "gridPos": { "h": 8, "w": 8, "x": 0, "y": 0 },
                    "targets": [{
                        "expr": `slo:${svcName}:availability * 100`,
                        "legendFormat": "可用性 %"
                    }],
                    "fieldConfig": {
                        "defaults": {
                            "thresholds": {
                                "mode": "absolute",
                                "steps": [
                                    { "color": "red", "value": null },
                                    { "color": "yellow", "value": 99 },
                                    { "color": "green", "value": 99.9 }
                                ]
                            },
                            "unit": "percent",
                            "min": 95,
                            "max": 100
                        }
                    }
                },
                {
                    "id": 2,
                    "title": "延遲 P99 (Latency)",
                    "type": "gauge",
                    "gridPos": { "h": 8, "w": 8, "x": 8, "y": 0 },
                    "targets": [{
                        "expr": `slo:${svcName}:latency_p99 * 1000`,
                        "legendFormat": "P99 延遲"
                    }],
                    "fieldConfig": {
                        "defaults": {
                            "thresholds": {
                                "mode": "absolute",
                                "steps": [
                                    { "color": "green", "value": null },
                                    { "color": "yellow", "value": 150 },
                                    { "color": "red", "value": 200 }
                                ]
                            },
                            "unit": "ms",
                            "min": 0,
                            "max": 500
                        }
                    }
                },
                {
                    "id": 3,
                    "title": "錯誤率 (Error Rate)",
                    "type": "gauge",
                    "gridPos": { "h": 8, "w": 8, "x": 16, "y": 0 },
                    "targets": [{
                        "expr": `slo:${svcName}:error_rate * 100`,
                        "legendFormat": "錯誤率 %"
                    }],
                    "fieldConfig": {
                        "defaults": {
                            "thresholds": {
                                "mode": "absolute",
                                "steps": [
                                    { "color": "green", "value": null },
                                    { "color": "yellow", "value": 0.5 },
                                    { "color": "red", "value": 1 }
                                ]
                            },
                            "unit": "percent",
                            "min": 0,
                            "max": 5
                        }
                    }
                },
                {
                    "id": 4,
                    "title": "SLO 趨勢圖",
                    "type": "timeseries",
                    "gridPos": { "h": 10, "w": 24, "x": 0, "y": 8 },
                    "targets": [
                        { "expr": `slo:${svcName}:availability * 100`, "legendFormat": "可用性 %" },
                        { "expr": `slo:${svcName}:error_rate * 100`, "legendFormat": "錯誤率 %" }
                    ]
                }
            ]
        }, null, 2)

        setPrometheusRules(rules)
        setGrafanaDashboard(dashboard)
        setStep('complete')
    }

    const copyToClipboard = (content: string) => {
        navigator.clipboard.writeText(content)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const downloadFile = (content: string, filename: string, type: string) => {
        const blob = new Blob([content], { type })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
    }

    const resetWorkflow = () => {
        setStep('upload')
        setYamlContent('')
        setSlos([])
        setPrometheusRules('')
        setGrafanaDashboard('')
        setActiveTab('prometheus')
        setFeedback('')
        setRefinementHistory([])
    }

    return (
        <div className="p-8 max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">SLO Workflow</h1>
                <p className="text-[hsl(var(--muted-foreground))]">
                    從 Kubernetes YAML 自動生成 SLO 建議、Prometheus Rules 和 Grafana Dashboard
                </p>
            </div>

            {/* Progress Steps */}
            <div className="flex items-center gap-4 mb-8">
                {['上傳 YAML', '分析', '審核 SLO', '完成'].map((label, idx) => {
                    const steps: Step[] = ['upload', 'analyzing', 'review', 'complete']
                    const currentIdx = step === 'generating' ? 3 : steps.indexOf(step)
                    const isActive = currentIdx >= idx
                    const isCurrent = steps[idx] === step || (step === 'generating' && idx === 3)

                    return (
                        <div key={label} className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${isActive
                                ? 'bg-[hsl(var(--primary))] text-white'
                                : 'bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]'
                                } ${isCurrent ? 'ring-2 ring-[hsl(var(--primary))] ring-offset-2 ring-offset-[hsl(var(--background))]' : ''}`}>
                                {step === 'complete' && idx < 4 ? <Check className="w-4 h-4" /> : idx + 1}
                            </div>
                            <span className={isActive ? 'text-[hsl(var(--foreground))]' : 'text-[hsl(var(--muted-foreground))]'}>
                                {label}
                            </span>
                            {idx < 3 && <ArrowRight className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />}
                        </div>
                    )
                })}
            </div>

            {/* Content */}
            <div className="border border-[hsl(var(--border))] rounded-xl bg-[hsl(var(--card))] p-6">
                {step === 'upload' && (
                    <div className="space-y-6">
                        <div className="border-2 border-dashed border-[hsl(var(--border))] rounded-lg p-12 text-center hover:border-[hsl(var(--primary))] transition-colors">
                            <Upload className="w-12 h-12 mx-auto mb-4 text-[hsl(var(--muted-foreground))]" />
                            <p className="text-lg mb-2">拖放 K8s YAML 檔案或點擊上傳</p>
                            <input
                                type="file"
                                accept=".yaml,.yml"
                                onChange={handleFileUpload}
                                className="hidden"
                                id="yaml-upload"
                            />
                            <label
                                htmlFor="yaml-upload"
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[hsl(var(--primary))] text-white cursor-pointer hover:opacity-90 transition-opacity"
                            >
                                <FileCode className="w-4 h-4" />
                                選擇檔案
                            </label>
                        </div>

                        {yamlContent && (
                            <>
                                <div className="bg-[hsl(var(--secondary))] rounded-lg p-4 max-h-64 overflow-auto">
                                    <pre className="text-sm font-mono whitespace-pre-wrap">{yamlContent.slice(0, 1000)}...</pre>
                                </div>
                                <button
                                    onClick={startAnalysis}
                                    className="w-full py-3 rounded-lg bg-[hsl(var(--primary))] text-white font-medium hover:opacity-90 transition-opacity"
                                >
                                    開始分析
                                </button>
                            </>
                        )}
                    </div>
                )}

                {step === 'analyzing' && (
                    <div className="py-12 text-center">
                        <Loader2 className="w-12 h-12 mx-auto mb-4 text-[hsl(var(--primary))] animate-spin" />
                        <p className="text-lg">正在分析 K8s 配置並生成 SLO 建議...</p>
                    </div>
                )}

                {step === 'review' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-semibold">建議的 SLOs</h3>
                            {refinementHistory.length > 0 && (
                                <span className="text-sm text-[hsl(var(--muted-foreground))]">
                                    已調整 {refinementHistory.length} 次
                                </span>
                            )}
                        </div>

                        {/* SLO List */}
                        <div className="space-y-3">
                            {slos.map((slo, idx) => (
                                <div key={`${slo.name}-${idx}`} className="flex items-center justify-between p-4 rounded-lg bg-[hsl(var(--secondary))]">
                                    <div>
                                        <p className="font-medium">{slo.name}</p>
                                        <p className="text-sm text-[hsl(var(--muted-foreground))]">{slo.signal}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-mono text-[hsl(var(--primary))]">{slo.target}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* AI Feedback Section */}
                        <div className="border border-[hsl(var(--border))] rounded-lg p-4 bg-[hsl(var(--card))]">
                            <div className="flex items-center gap-2 mb-3">
                                <Sparkles className="w-5 h-5 text-[hsl(var(--primary))]" />
                                <h4 className="font-medium">AI 協助調整</h4>
                            </div>
                            <p className="text-sm text-[hsl(var(--muted-foreground))] mb-3">
                                輸入您的調整建議，AI 會協助修改 SLO 設定
                            </p>
                            <div className="flex gap-2">
                                <div className="flex-1 relative">
                                    <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                                    <input
                                        type="text"
                                        value={feedback}
                                        onChange={(e) => setFeedback(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && !isRefining && refineSlos()}
                                        placeholder="例：將可用性提高到 99.99%、延遲目標改為 100ms、新增吞吐量 SLO..."
                                        className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-transparent"
                                        disabled={isRefining}
                                    />
                                </div>
                                <button
                                    onClick={refineSlos}
                                    disabled={!feedback.trim() || isRefining}
                                    className="px-4 py-2.5 rounded-lg bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] font-medium hover:bg-[hsl(var(--muted))] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isRefining ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> 調整中...</>
                                    ) : (
                                        '套用'
                                    )}
                                </button>
                            </div>

                            {/* Refinement History */}
                            {refinementHistory.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-[hsl(var(--border))]">
                                    <p className="text-xs text-[hsl(var(--muted-foreground))] mb-2">調整紀錄：</p>
                                    <div className="flex flex-wrap gap-2">
                                        {refinementHistory.map((item, idx) => (
                                            <span key={idx} className="text-xs px-2 py-1 rounded bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]">
                                                {item.length > 30 ? item.slice(0, 30) + '...' : item}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Confirm Button */}
                        <button
                            onClick={generateConfigs}
                            className="w-full py-3 rounded-lg bg-[hsl(var(--primary))] text-white font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                        >
                            <Check className="w-5 h-5" />
                            確認並生成配置
                        </button>
                    </div>
                )}

                {step === 'generating' && (
                    <div className="py-12 text-center">
                        <Loader2 className="w-12 h-12 mx-auto mb-4 text-[hsl(var(--primary))] animate-spin" />
                        <p className="text-lg">正在生成 Prometheus Rules 和 Grafana Dashboard...</p>
                    </div>
                )}

                {step === 'complete' && (
                    <div className="space-y-6">
                        {/* Success Banner */}
                        <div className="flex items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                            <CheckCircle className="w-6 h-6 text-green-500" />
                            <div>
                                <p className="font-semibold text-green-400">配置生成完成！</p>
                                <p className="text-sm text-[hsl(var(--muted-foreground))]">Prometheus Rules 和 Grafana Dashboard 已準備就緒</p>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex gap-2 border-b border-[hsl(var(--border))]">
                            <button
                                onClick={() => setActiveTab('prometheus')}
                                className={`px-4 py-2 font-medium transition-colors ${activeTab === 'prometheus' ? 'text-[hsl(var(--primary))] border-b-2 border-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'}`}
                            >
                                Prometheus Rules
                            </button>
                            <button
                                onClick={() => setActiveTab('grafana')}
                                className={`px-4 py-2 font-medium transition-colors ${activeTab === 'grafana' ? 'text-[hsl(var(--primary))] border-b-2 border-[hsl(var(--primary))]' : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'}`}
                            >
                                Grafana Dashboard
                            </button>
                        </div>

                        {/* Content based on active tab */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-lg font-semibold">
                                    {activeTab === 'prometheus' ? 'Prometheus Rules' : 'Grafana Dashboard'}
                                </h3>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => copyToClipboard(activeTab === 'prometheus' ? prometheusRules : grafanaDashboard)}
                                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[hsl(var(--secondary))] text-sm hover:bg-[hsl(var(--muted))] transition-colors"
                                    >
                                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                        {copied ? '已複製' : '複製'}
                                    </button>
                                    <button
                                        onClick={() => downloadFile(
                                            activeTab === 'prometheus' ? prometheusRules : grafanaDashboard,
                                            activeTab === 'prometheus' ? 'prometheus-rules.yaml' : 'grafana-dashboard.json',
                                            activeTab === 'prometheus' ? 'text/yaml' : 'application/json'
                                        )}
                                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[hsl(var(--primary))] text-white text-sm hover:opacity-90 transition-opacity"
                                    >
                                        <Download className="w-4 h-4" />
                                        下載 {activeTab === 'prometheus' ? 'YAML' : 'JSON'}
                                    </button>
                                </div>
                            </div>
                            <div className="bg-[hsl(var(--secondary))] rounded-lg p-4 max-h-96 overflow-auto">
                                <pre className="text-sm font-mono whitespace-pre text-[hsl(var(--foreground))]">
                                    {activeTab === 'prometheus' ? prometheusRules : grafanaDashboard}
                                </pre>
                            </div>
                        </div>

                        {/* Reset Button */}
                        <button
                            onClick={resetWorkflow}
                            className="w-full py-3 rounded-lg border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] font-medium hover:bg-[hsl(var(--secondary))] transition-colors"
                        >
                            重新開始
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
