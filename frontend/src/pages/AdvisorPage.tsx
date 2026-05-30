import { useState, useEffect } from 'react'
import { advisorApi, AdvisorResponse, AdvisorHistoryItem, advisorHistoryApi, savedPortfoliosApi, SavedPortfolio } from '../services/api'
import { useAsync } from '../hooks/useAsync'
import { useLocalState } from '../hooks/useLocalState'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'

const RISK_LABELS = { low: 'Низький', medium: 'Середній', high: 'Високий' }
const RISK_DESC   = { low: 'консервативний', medium: 'збалансований', high: 'агресивний' }

function HistoryDrawer({
  history,
  loading,
  hasError,
  onRestore,
  onDelete,
  onClear,
  onClose,
}: {
  history: AdvisorHistoryItem[]
  loading: boolean
  hasError: boolean
  onRestore: (item: AdvisorHistoryItem) => void
  onDelete: (id: number) => void
  onClear: () => void
  onClose: () => void
}) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-[380px] max-w-full bg-[#0f0f0f] border-l border-[#1e1e1e] z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e1e1e] flex-shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-white">Історія запитів</h2>
            <p className="text-[11px] text-[#444444] mt-0.5">{history.length} записів</p>
          </div>
          <div className="flex items-center gap-3">
            {history.length > 0 && (
              <button
                onClick={onClear}
                className="text-[11px] text-[#333333] hover:text-[#f87171] transition-colors"
              >
                Очистити
              </button>
            )}
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#1a1a1a] hover:bg-[#222222] text-[#666666] hover:text-white transition-colors text-lg leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {hasError && (
            <div className="mx-4 mt-4 px-3 py-2.5 bg-[#1a0a0a] border border-[#3a1515] rounded-lg text-[11px] text-[#f87171]">
              Не вдалось завантажити. Перезапусти бекенд.
            </div>
          )}

          {!loading && history.length === 0 && !hasError && (
            <div className="flex flex-col items-center justify-center h-48 text-[#333333]">
              <div className="text-3xl mb-3">—</div>
              <div className="text-xs">Ще немає запитів</div>
            </div>
          )}

          <div className="p-3 space-y-2">
            {history.map(item => (
              <div
                key={item.id}
                className="group bg-[#141414] border border-[#1e1e1e] rounded-xl overflow-hidden hover:border-[#2a2a2a] transition-all"
              >
                {/* Item header */}
                <div className="flex items-center justify-between px-3 pt-3 pb-1">
                  <span className="text-[10px] text-[#333333] font-mono">{item.created_at}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
                      item.risk_tolerance === 'high'
                        ? 'border-[#3a2a1a] text-[#f59e0b] bg-[#1a1400]'
                        : item.risk_tolerance === 'low'
                        ? 'border-[#1a2a3a] text-[#60a5fa] bg-[#0f1a2a]'
                        : 'border-[#222222] text-[#666666]'
                    }`}>
                      {RISK_LABELS[item.risk_tolerance as keyof typeof RISK_LABELS]}
                    </span>
                    <button
                      onClick={() => onDelete(item.id)}
                      className="text-[#222222] hover:text-[#f87171] transition-colors text-base leading-none opacity-0 group-hover:opacity-100"
                    >×</button>
                  </div>
                </div>

                {/* Portfolio label */}
                <div className="px-3 pb-2">
                  <div className="text-xs font-medium text-[#888888] truncate">{item.portfolio_label}</div>
                  {item.question && (
                    <div className="text-[11px] text-[#555555] mt-0.5 truncate italic">
                      "{item.question}"
                    </div>
                  )}
                </div>

                {/* Recommendation preview */}
                <div className="px-3 pb-3">
                  <div className="bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg px-3 py-2">
                    <p className="text-[11px] text-[#555555] leading-relaxed line-clamp-3">
                      {item.recommendation}
                    </p>
                  </div>
                </div>

                {/* Insights preview */}
                {item.key_insights?.length > 0 && (
                  <div className="px-3 pb-2 space-y-1">
                    {item.key_insights.slice(0, 2).map((insight, i) => (
                      <div key={i} className="flex gap-2 text-[11px] text-[#444444]">
                        <span className="text-[#333333] flex-shrink-0">→</span>
                        <span className="line-clamp-1">{insight}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Restore button */}
                <div className="px-3 pb-3">
                  <button
                    onClick={() => onRestore(item)}
                    className="w-full text-center text-[11px] text-[#444444] hover:text-white border border-[#1e1e1e] hover:border-[#333333] rounded-lg py-1.5 transition-all"
                  >
                    Відновити параметри →
                  </button>
                </div>

                {/* Model badge */}
                <div className="px-3 pb-3 flex justify-end">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                    item.model_used?.includes('gemini')
                      ? 'border-[#1e1e1e] text-[#333333]'
                      : 'border-[#1a1a1a] text-[#2a2a2a]'
                  }`}>
                    {item.model_used?.includes('gemini') ? `✦ ${item.model_used}` : 'rule-based'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

export default function AdvisorPage() {
  const [risk, setRisk] = useLocalState<'low' | 'medium' | 'high'>('advisor:risk', 'medium')
  const [question, setQuestion] = useState('')
  const { data, loading, error, run } = useAsync<AdvisorResponse>()

  const [savedPortfolios, setSavedPortfolios] = useState<SavedPortfolio[]>([])
  const [activePortfolio, setActivePortfolio] = useState<SavedPortfolio | null>(null)
  const [manualInput, setManualInput] = useState('AAPL:0.3, MSFT:0.3, GOOGL:0.2, NVDA:0.2')
  const [useManual, setUseManual] = useState(false)
  const [history, setHistory] = useState<AdvisorHistoryItem[]>([])
  const [historyError, setHistoryError] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    savedPortfoliosApi.list().then(r => {
      setSavedPortfolios(r.data)
      if (r.data.length > 0) setActivePortfolio(r.data[0])
    }).catch(() => setUseManual(true))

    advisorHistoryApi.list().then(r => setHistory(r.data)).catch(() => setHistoryError(true))
  }, [])

  const parseManual = (input: string): Record<string, number> =>
    Object.fromEntries(
      input.split(',').map(p => {
        const [ticker, w] = p.trim().split(':')
        return [ticker?.trim().toUpperCase(), parseFloat(w) || 0]
      }).filter(([t, w]) => t && (w as number) > 0)
    )

  const getPortfolioWeights = (): Record<string, number> => {
    if (useManual || !activePortfolio) return parseManual(manualInput)
    return activePortfolio.weights ?? {}
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const weights = getPortfolioWeights()
    const metrics = (!useManual && activePortfolio?.metrics) ? activePortfolio.metrics : undefined
    run(advisorApi.recommend({
      portfolio: weights,
      risk_tolerance: risk,
      portfolio_metrics: metrics,
      question: question.trim(),
    })).then(result => {
      if (!result) return
      advisorHistoryApi.list().then(r => setHistory(r.data)).catch(() => {})
    })
  }

  const restoreFromHistory = (item: AdvisorHistoryItem) => {
    setRisk(item.risk_tolerance as 'low' | 'medium' | 'high')
    setQuestion(item.question)
    setShowHistory(false)
  }

  const deleteHistoryItem = async (id: number) => {
    await advisorHistoryApi.deleteOne(id).catch(() => {})
    setHistory(prev => prev.filter(h => h.id !== id))
  }

  const clearHistory = async () => {
    await advisorHistoryApi.clearAll().catch(() => {})
    setHistory([])
  }

  return (
    <div className="space-y-5">
      {/* History drawer (portal-style, rendered in place but positioned fixed) */}
      {showHistory && (
        <HistoryDrawer
          history={history}
          loading={false}
          hasError={historyError}
          onRestore={restoreFromHistory}
          onDelete={deleteHistoryItem}
          onClear={clearHistory}
          onClose={() => setShowHistory(false)}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white tracking-tight">AI Радник</h1>
          <p className="text-[#555555] text-sm mt-1">Персональний аналіз портфеля на основі Gemini 2.5 Flash</p>
        </div>
        <button
          onClick={() => setShowHistory(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#222222] text-[#555555] hover:border-[#333333] hover:text-white text-xs font-medium transition-all"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          Історія
          {history.length > 0 && (
            <span className="bg-[#1e1e1e] text-[#666666] text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-mono leading-none">
              {history.length > 9 ? '9+' : history.length}
            </span>
          )}
        </button>
      </div>

      {/* Form */}
      <Card>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Portfolio selector */}
          <div>
            <label className="block text-[11px] text-[#444444] uppercase tracking-widest mb-2">
              Портфель для аналізу
            </label>
            <div className="flex gap-1.5 mb-3">
              <button
                type="button"
                onClick={() => setUseManual(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  !useManual
                    ? 'bg-white border-white text-[#0a0a0a]'
                    : 'border-[#222222] text-[#444444] hover:border-[#333333] hover:text-[#888888]'
                }`}
              >
                Мої збережені
              </button>
              <button
                type="button"
                onClick={() => setUseManual(true)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  useManual
                    ? 'bg-white border-white text-[#0a0a0a]'
                    : 'border-[#222222] text-[#444444] hover:border-[#333333] hover:text-[#888888]'
                }`}
              >
                Ввести вручну
              </button>
            </div>

            {useManual ? (
              <div>
                <input
                  value={manualInput}
                  onChange={e => setManualInput(e.target.value)}
                  className="w-full bg-[#141414] border border-[#222222] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#444444] font-mono placeholder:text-[#333333]"
                  placeholder="AAPL:0.3, MSFT:0.3, GOOGL:0.4"
                />
                <p className="text-[10px] text-[#333333] mt-1.5">Формат: ТІКЕР:вага, ... (сума ≈ 1.0)</p>
              </div>
            ) : savedPortfolios.length === 0 ? (
              <div className="text-xs text-[#444444] bg-[#0f0f0f] border border-[#1e1e1e] rounded-lg px-4 py-3">
                Збережених портфелів немає.{' '}
                <button type="button" onClick={() => setUseManual(true)} className="text-[#888888] hover:text-white transition-colors underline">
                  Ввести вручну
                </button>
                {' '}або спочатку оптимізуйте портфель.
              </div>
            ) : (
              <div className="space-y-1.5">
                {savedPortfolios.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setActivePortfolio(p)}
                    className={`w-full text-left rounded-lg px-3 py-2.5 border transition-all ${
                      activePortfolio?.id === p.id
                        ? 'border-[#3a3a3a] bg-[#1a1a1a]'
                        : 'border-[#1a1a1a] bg-[#0f0f0f] hover:border-[#2a2a2a]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-white">{p.name}</span>
                      <div className="flex items-center gap-2">
                        {p.metrics?.sharpe_ratio && (
                          <span className="text-[11px] text-[#555555]">Sharpe {p.metrics.sharpe_ratio.toFixed(2)}</span>
                        )}
                        {activePortfolio?.id === p.id && (
                          <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0" />
                        )}
                      </div>
                    </div>
                    <div className="text-[11px] text-[#444444] mt-0.5">
                      {p.tickers.join(', ')} · ${p.portfolio_value.toLocaleString()}
                    </div>
                    {p.weights && (
                      <div className="flex gap-1.5 mt-1.5 flex-wrap">
                        {Object.entries(p.weights).slice(0, 5).map(([t, w]) => (
                          <span key={t} className="text-[10px] bg-[#1e1e1e] border border-[#2a2a2a] px-1.5 py-0.5 rounded text-[#666666]">
                            {t} {(w * 100).toFixed(0)}%
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Risk */}
          <div>
            <label className="block text-[11px] text-[#444444] uppercase tracking-widest mb-2">Ризик-профіль</label>
            <div className="flex rounded-lg overflow-hidden border border-[#222222] w-fit">
              {(['low', 'medium', 'high'] as const).map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRisk(r)}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    risk === r
                      ? 'bg-white text-[#0a0a0a]'
                      : 'bg-[#141414] text-[#555555] hover:text-white'
                  }`}
                >
                  {RISK_LABELS[r]}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-[#333333] mt-1.5">{RISK_DESC[risk]}</p>
          </div>

          {/* Question */}
          <div>
            <label className="block text-[11px] text-[#444444] uppercase tracking-widest mb-2">
              Питання{' '}
              <span className="text-[#222222] normal-case tracking-normal">(необов'язково)</span>
            </label>
            <textarea
              value={question}
              onChange={e => setQuestion(e.target.value)}
              rows={2}
              maxLength={500}
              className="w-full bg-[#141414] border border-[#222222] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#444444] resize-none placeholder:text-[#333333]"
              placeholder="Чи варто зараз додати золото до портфеля?"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-white hover:bg-[#e5e5e5] disabled:opacity-40 text-[#0a0a0a] px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors"
          >
            {loading ? 'Аналізую...' : 'Отримати рекомендацію →'}
          </button>
        </form>
      </Card>

      {error && (
        <div className="bg-[#1a0a0a] border border-[#3a1515] rounded-xl px-4 py-3 text-[#f87171] text-sm">{error}</div>
      )}

      {loading && (
        <div>
          <Spinner />
          <p className="text-center text-[#333333] text-xs -mt-8">Gemini аналізує ваш портфель...</p>
        </div>
      )}

      {data && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-semibold text-white">Результат аналізу</h2>
            <span className={`text-[10px] px-2 py-1 rounded border font-medium ${
              data.model.includes('gemini')
                ? 'border-[#2a2a2a] text-[#888888] bg-[#141414]'
                : 'border-[#1e1e1e] text-[#333333]'
            }`}>
              {data.model.includes('gemini') ? `✦ ${data.model}` : 'rule-based'}
            </span>
          </div>

          {/* Recommendation */}
          <Card>
            <div className="flex items-start gap-3">
              <div className="w-0.5 flex-shrink-0 self-stretch bg-white rounded-full" />
              <p className="text-sm text-[#cccccc] leading-relaxed">{data.recommendation}</p>
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.key_insights.length > 0 && (
              <Card title="Ключові інсайти">
                <ul className="space-y-2.5">
                  {data.key_insights.map((insight, i) => (
                    <li key={i} className="flex gap-3 text-sm text-[#888888] leading-snug">
                      <span className="text-white mt-0.5 flex-shrink-0 text-xs">→</span>
                      {insight}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {data.risks.length > 0 && (
              <Card title="Ризики">
                <ul className="space-y-2.5">
                  {data.risks.map((r, i) => (
                    <li key={i} className="flex gap-3 text-sm text-[#888888] leading-snug">
                      <span className="text-[#f59e0b] mt-0.5 flex-shrink-0 text-xs">!</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
