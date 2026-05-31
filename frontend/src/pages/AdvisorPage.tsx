import { useState, useEffect, useRef } from 'react'
import {
  advisorApi, AdvisorResponse, AdvisorHistoryItem,
  advisorHistoryApi, savedPortfoliosApi, SavedPortfolio,
  forecastApi, sentimentApi,
} from '../services/api'
import { useAsync } from '../hooks/useAsync'
import { useLocalState } from '../hooks/useLocalState'

const RISK_LABELS = { low: 'Низький', medium: 'Середній', high: 'Високий' }

const QUICK_QUESTIONS = [
  'Чи варто зараз ребалансувати портфель?',
  'Оціни ризик мого портфеля',
  'Які позиції найслабші?',
  'Рекомендації на наступні 3 місяці',
  'Чи достатня диверсифікація?',
  'Де найбільша концентрація ризику?',
]

interface SessionResult {
  id: number
  question: string
  model: string
  recommendation: string
  key_insights: string[]
  risks: string[]
}

interface MLSignals {
  forecast: Record<string, number>   // ticker → % зміни за 30д
  sentiment: Record<string, string>  // ticker → positive|negative|neutral
}

function HistoryDrawer({
  history, hasError, onRestore, onDelete, onClear, onClose,
}: {
  history: AdvisorHistoryItem[]
  hasError: boolean
  onRestore: (item: AdvisorHistoryItem) => void
  onDelete: (id: number) => void
  onClear: () => void
  onClose: () => void
}) {
  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[380px] max-w-full bg-[#0f0f0f] border-l border-[#1e1e1e] z-50 flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e1e1e] flex-shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-white">Вся історія</h2>
            <p className="text-[11px] text-[#444] mt-0.5">{history.length} записів</p>
          </div>
          <div className="flex items-center gap-3">
            {history.length > 0 && (
              <button onClick={onClear} className="text-[11px] text-[#333] hover:text-[#f87171] transition-colors">
                Очистити
              </button>
            )}
            <button onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#1a1a1a] hover:bg-[#222] text-[#666] hover:text-white transition-colors text-lg leading-none">
              ×
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {hasError && (
            <div className="mx-4 mt-4 px-3 py-2.5 bg-[#1a0a0a] border border-[#3a1515] rounded-lg text-[11px] text-[#f87171]">
              Не вдалось завантажити. Перезапусти бекенд.
            </div>
          )}
          {history.length === 0 && !hasError && (
            <div className="flex flex-col items-center justify-center h-48 text-[#333]">
              <div className="text-3xl mb-3">—</div>
              <div className="text-xs">Ще немає запитів</div>
            </div>
          )}
          <div className="p-3 space-y-2">
            {history.map(item => (
              <div key={item.id}
                className="group bg-[#141414] border border-[#1e1e1e] rounded-xl overflow-hidden hover:border-[#2a2a2a] transition-all">
                <div className="flex items-center justify-between px-3 pt-3 pb-1">
                  <span className="text-[10px] text-[#333] font-mono">{item.created_at}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${
                      item.risk_tolerance === 'high' ? 'border-[#3a2a1a] text-[#f59e0b] bg-[#1a1400]'
                        : item.risk_tolerance === 'low' ? 'border-[#1a2a3a] text-[#60a5fa] bg-[#0f1a2a]'
                        : 'border-[#222] text-[#666]'
                    }`}>
                      {RISK_LABELS[item.risk_tolerance as keyof typeof RISK_LABELS]}
                    </span>
                    <button onClick={() => onDelete(item.id)}
                      className="text-[#222] hover:text-[#f87171] transition-colors text-base leading-none opacity-0 group-hover:opacity-100">
                      ×
                    </button>
                  </div>
                </div>
                <div className="px-3 pb-2">
                  <div className="text-xs font-medium text-[#888] truncate">{item.portfolio_label}</div>
                  {item.question && (
                    <div className="text-[11px] text-[#555] mt-0.5 truncate italic">"{item.question}"</div>
                  )}
                </div>
                <div className="px-3 pb-3">
                  <p className="text-[11px] text-[#555] leading-relaxed line-clamp-2">{item.recommendation}</p>
                </div>
                <div className="px-3 pb-3">
                  <button onClick={() => onRestore(item)}
                    className="w-full text-center text-[11px] text-[#444] hover:text-white border border-[#1e1e1e] hover:border-[#333] rounded-lg py-1.5 transition-all">
                    Відновити →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

function ResultCard({ result, isLatest }: { result: SessionResult; isLatest: boolean }) {
  const [open, setOpen] = useState(isLatest)
  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${
      isLatest ? 'border-[#2a2a2a] bg-[#0f0f0f]' : 'border-[#1a1a1a] bg-[#0a0a0a]'
    }`}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#111] transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {isLatest && <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80] flex-shrink-0" />}
          <span className="text-xs font-medium text-white truncate">
            {result.question || 'Загальний аналіз портфеля'}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
            result.model.includes('gemini')
              ? 'border-[#2a2a2a] text-[#555]'
              : 'border-[#1a1a1a] text-[#333]'
          }`}>
            {result.model.includes('gemini') ? `✦ ${result.model}` : 'rule-based'}
          </span>
          <span className="text-[#444] text-xs">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-[#141414]">
          <div className="flex items-start gap-3 pt-3">
            <div className="w-0.5 self-stretch bg-white rounded-full flex-shrink-0" />
            <p className="text-sm text-[#ccc] leading-relaxed">{result.recommendation}</p>
          </div>

          {(result.key_insights.length > 0 || result.risks.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {result.key_insights.length > 0 && (
                <div className="bg-[#141414] rounded-lg p-3">
                  <div className="text-[10px] text-[#444] uppercase tracking-widest mb-2">Інсайти</div>
                  <ul className="space-y-2">
                    {result.key_insights.map((ins, i) => (
                      <li key={i} className="flex gap-2 text-[11px] text-[#888] leading-snug">
                        <span className="text-white flex-shrink-0">→</span>{ins}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.risks.length > 0 && (
                <div className="bg-[#141414] rounded-lg p-3">
                  <div className="text-[10px] text-[#444] uppercase tracking-widest mb-2">Ризики</div>
                  <ul className="space-y-2">
                    {result.risks.map((r, i) => (
                      <li key={i} className="flex gap-2 text-[11px] text-[#888] leading-snug">
                        <span className="text-[#f59e0b] flex-shrink-0">!</span>{r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const SENTIMENT_ICON: Record<string, string> = {
  positive: '↑',
  negative: '↓',
  neutral:  '–',
}
const SENTIMENT_COLOR: Record<string, string> = {
  positive: 'text-[#4ade80]',
  negative: 'text-[#f87171]',
  neutral:  'text-[#555]',
}

export default function AdvisorPage() {
  const [risk, setRisk] = useLocalState<'low' | 'medium' | 'high'>('advisor:risk', 'medium')
  const [question, setQuestion] = useState('')
  const { loading, error, run } = useAsync<AdvisorResponse>()

  const [savedPortfolios, setSavedPortfolios] = useState<SavedPortfolio[]>([])
  const [activePortfolio, setActivePortfolio] = useState<SavedPortfolio | null>(null)
  const [manualInput, setManualInput] = useState('AAPL:0.3, MSFT:0.3, GOOGL:0.2, NVDA:0.2')
  const [useManual, setUseManual] = useState(false)
  const [history, setHistory] = useState<AdvisorHistoryItem[]>([])
  const [historyError, setHistoryError] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const [sessionResults, setSessionResults] = useState<SessionResult[]>([])
  const resultIdRef = useRef(0)
  const feedRef = useRef<HTMLDivElement>(null)

  const [signals, setSignals] = useState<MLSignals | null>(null)
  const [loadingSignals, setLoadingSignals] = useState(false)

  useEffect(() => {
    savedPortfoliosApi.list().then(r => {
      setSavedPortfolios(r.data)
      if (r.data.length > 0) setActivePortfolio(r.data[0])
    }).catch(() => setUseManual(true))
    advisorHistoryApi.list().then(r => setHistory(r.data)).catch(() => setHistoryError(true))
  }, [])

  // Очищаємо сигнали при зміні портфеля
  useEffect(() => { setSignals(null) }, [activePortfolio, useManual, manualInput])

  const parseManual = (input: string): Record<string, number> =>
    Object.fromEntries(
      input.split(',').flatMap(p => {
        const [ticker, w] = p.trim().split(':')
        const weight = parseFloat(w)
        if (!ticker?.trim() || !weight) return []
        return [[ticker.trim().toUpperCase(), weight]]
      })
    )

  const getWeights = (): Record<string, number> =>
    useManual || !activePortfolio ? parseManual(manualInput) : (activePortfolio.weights ?? {})

  const handleLoadSignals = async () => {
    const weights = getWeights()
    const tickers = Object.keys(weights)
    if (tickers.length === 0) return

    setLoadingSignals(true)
    setSignals(null)

    const forecastResults = await Promise.allSettled(
      tickers.map(t => forecastApi.get(t, 30, 'xgboost', '1d'))
    )
    const sentimentResults = await Promise.allSettled(
      tickers.map(t => sentimentApi.get(t, 7))
    )

    const forecastSignals: Record<string, number> = {}
    const sentimentSignals: Record<string, string> = {}

    tickers.forEach((ticker, i) => {
      const fRes = forecastResults[i]
      if (fRes.status === 'fulfilled') {
        const hist = fRes.value.data.history
        const preds = fRes.value.data.predictions
        if (hist.length > 0 && preds.length > 0) {
          const currentPrice = hist[hist.length - 1].close
          const lastPred = preds[preds.length - 1].price
          forecastSignals[ticker] = ((lastPred - currentPrice) / currentPrice) * 100
        }
      }
      const sRes = sentimentResults[i]
      if (sRes.status === 'fulfilled') {
        sentimentSignals[ticker] = sRes.value.data.signal
      }
    })

    setSignals({ forecast: forecastSignals, sentiment: sentimentSignals })
    setLoadingSignals(false)
  }

  const handleSubmit = (q?: string) => {
    const finalQ = (q ?? question).trim()
    const weights = getWeights()
    const metrics = (!useManual && activePortfolio?.metrics) ? activePortfolio.metrics : undefined
    run(advisorApi.recommend({
      portfolio: weights,
      risk_tolerance: risk,
      portfolio_metrics: metrics,
      sentiment_signals: signals?.sentiment,
      forecast_signals:  signals?.forecast,
      question: finalQ,
    })).then(result => {
      if (!result) return
      const newResult: SessionResult = {
        id: ++resultIdRef.current,
        question: finalQ,
        model: result.model,
        recommendation: result.recommendation,
        key_insights: result.key_insights,
        risks: result.risks,
      }
      setSessionResults(prev => [newResult, ...prev])
      if (q) setQuestion('')
      advisorHistoryApi.list().then(r => setHistory(r.data)).catch(() => {})
      setTimeout(() => feedRef.current?.scrollTo({ top: 0, behavior: 'smooth' }), 100)
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
    <div className="h-full flex flex-col overflow-hidden bg-[#0a0a0a]">

      {showHistory && (
        <HistoryDrawer
          history={history} hasError={historyError}
          onRestore={restoreFromHistory} onDelete={deleteHistoryItem}
          onClear={clearHistory} onClose={() => setShowHistory(false)}
        />
      )}

      {/* Top bar */}
      <div className="flex-shrink-0 border-b border-[#161616] bg-[#0c0c0c] px-5 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-white">AI Радник</h1>
          <p className="text-[11px] text-[#444] mt-0.5">Персональний аналіз портфеля на основі Gemini 2.5 Flash</p>
        </div>
        <button
          onClick={() => setShowHistory(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#222] text-[#555] hover:border-[#333] hover:text-white text-xs font-medium transition-all"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          Вся історія
          {history.length > 0 && (
            <span className="bg-[#1e1e1e] text-[#555] text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-mono leading-none">
              {history.length > 9 ? '9+' : history.length}
            </span>
          )}
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Left panel: form ── */}
        <div className="w-[340px] flex-shrink-0 border-r border-[#161616] overflow-y-auto p-4 space-y-4">

          {/* Portfolio source toggle */}
          <div>
            <label className="block text-[10px] text-[#444] uppercase tracking-widest mb-2">Портфель</label>
            <div className="flex gap-1 mb-3">
              {[
                { id: false, label: 'Збережені' },
                { id: true,  label: 'Вручну' },
              ].map(({ id, label }) => (
                <button key={String(id)} type="button" onClick={() => setUseManual(id)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    useManual === id
                      ? 'bg-white border-white text-[#0a0a0a]'
                      : 'border-[#1e1e1e] text-[#444] hover:border-[#333] hover:text-[#888]'
                  }`}>
                  {label}
                </button>
              ))}
            </div>

            {useManual ? (
              <div>
                <input
                  value={manualInput} onChange={e => setManualInput(e.target.value)}
                  className="w-full bg-[#111] border border-[#1e1e1e] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#333] font-mono placeholder:text-[#333]"
                  placeholder="AAPL:0.3, MSFT:0.3, GOOGL:0.4"
                />
                <p className="text-[10px] text-[#333] mt-1">ТІКЕР:вага, ... (сума ≈ 1.0)</p>
              </div>
            ) : savedPortfolios.length === 0 ? (
              <div className="text-xs text-[#444] bg-[#0f0f0f] border border-[#1e1e1e] rounded-lg px-3 py-3">
                Збережених портфелів немає.{' '}
                <button type="button" onClick={() => setUseManual(true)} className="text-[#888] hover:text-white underline transition-colors">
                  Ввести вручну
                </button>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-0.5">
                {savedPortfolios.map(p => (
                  <button key={p.id} type="button" onClick={() => setActivePortfolio(p)}
                    className={`w-full text-left rounded-lg px-3 py-2.5 border transition-all ${
                      activePortfolio?.id === p.id
                        ? 'border-[#3a3a3a] bg-[#1a1a1a]'
                        : 'border-[#1a1a1a] bg-[#0f0f0f] hover:border-[#2a2a2a]'
                    }`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-white truncate">{p.name}</span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {p.metrics?.sharpe_ratio && (
                          <span className="text-[10px] text-[#555] font-mono">
                            S {(p.metrics.sharpe_ratio as number).toFixed(2)}
                          </span>
                        )}
                        {activePortfolio?.id === p.id && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </div>
                    <div className="text-[10px] text-[#444] mt-0.5 truncate">
                      {p.tickers.slice(0, 4).join(', ')}{p.tickers.length > 4 ? ` +${p.tickers.length - 4}` : ''}
                    </div>
                    {p.weights && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {Object.entries(p.weights).slice(0, 4).map(([t, w]) => (
                          <span key={t} className="text-[9px] bg-[#1e1e1e] border border-[#2a2a2a] px-1 py-0.5 rounded text-[#555] font-mono">
                            {t} {((w as number) * 100).toFixed(0)}%
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ML Signals */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[10px] text-[#444] uppercase tracking-widest">ML Сигнали</label>
              {signals && (
                <button
                  onClick={() => setSignals(null)}
                  className="text-[10px] text-[#333] hover:text-[#f87171] transition-colors"
                >
                  очистити
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleLoadSignals}
              disabled={loadingSignals || Object.keys(getWeights()).length === 0}
              className="w-full border border-[#1e1e1e] hover:border-[#333] text-[#444] hover:text-white disabled:opacity-40 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-2"
            >
              {loadingSignals ? (
                <>
                  <div className="w-3 h-3 border border-[#333] border-t-[#888] rounded-full animate-spin" />
                  Завантаження...
                </>
              ) : (
                <>⟳ Отримати прогноз + сентимент</>
              )}
            </button>

            {signals && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Object.entries(signals.forecast).map(([ticker, pct]) => {
                  const sent = signals.sentiment[ticker]
                  return (
                    <div key={ticker}
                      className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border border-[#1e1e1e] bg-[#0f0f0f] font-mono">
                      <span className="text-[#777]">{ticker}</span>
                      <span className={pct >= 0 ? 'text-[#4ade80]' : 'text-[#f87171]'}>
                        {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
                      </span>
                      {sent && (
                        <span className={SENTIMENT_COLOR[sent] ?? 'text-[#555]'}>
                          {SENTIMENT_ICON[sent] ?? '–'}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {signals && (
              <p className="text-[9px] text-[#333] mt-1.5 leading-relaxed">
                Прогноз XGBoost за 30 дн · сентимент FinBERT за 7 дн
              </p>
            )}
          </div>

          {/* Risk */}
          <div>
            <label className="block text-[10px] text-[#444] uppercase tracking-widest mb-2">Ризик-профіль</label>
            <div className="flex rounded-lg overflow-hidden border border-[#1e1e1e]">
              {(['low', 'medium', 'high'] as const).map(r => (
                <button key={r} type="button" onClick={() => setRisk(r)}
                  className={`flex-1 py-2 text-xs font-medium transition-colors ${
                    risk === r ? 'bg-white text-[#0a0a0a]' : 'bg-[#111] text-[#555] hover:text-white'
                  }`}>
                  {RISK_LABELS[r]}
                </button>
              ))}
            </div>
          </div>

          {/* Question */}
          <div>
            <label className="block text-[10px] text-[#444] uppercase tracking-widest mb-2">
              Питання <span className="text-[#222] normal-case tracking-normal">(необов'язково)</span>
            </label>
            <textarea
              value={question} onChange={e => setQuestion(e.target.value)}
              rows={3} maxLength={500}
              onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSubmit() }}
              className="w-full bg-[#111] border border-[#1e1e1e] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#333] resize-none placeholder:text-[#333]"
              placeholder="Чи варто зараз ребалансувати?"
            />
            <p className="text-[9px] text-[#222] mt-1">Ctrl+Enter — надіслати</p>
          </div>

          {/* Submit */}
          <button
            onClick={() => handleSubmit()}
            disabled={loading}
            className="w-full bg-white hover:bg-[#e5e5e5] disabled:opacity-40 text-[#0a0a0a] py-2.5 rounded-lg text-sm font-semibold transition-colors"
          >
            {loading ? 'Аналізую...' : 'Отримати рекомендацію →'}
          </button>

          {error && (
            <div className="bg-[#1a0a0a] border border-[#3a1515] rounded-xl px-3 py-2 text-[#f87171] text-xs">{error}</div>
          )}
        </div>

        {/* ── Right panel: results ── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Quick questions */}
          <div className="flex-shrink-0 border-b border-[#161616] px-5 py-3">
            <div className="text-[10px] text-[#333] uppercase tracking-widest mb-2">Швидкі запитання</div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_QUESTIONS.map(q => (
                <button
                  key={q}
                  onClick={() => handleSubmit(q)}
                  disabled={loading}
                  className="text-[11px] px-3 py-1.5 rounded-lg border border-[#1e1e1e] text-[#444] hover:border-[#333] hover:text-[#aaa] disabled:opacity-40 transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Results feed */}
          <div ref={feedRef} className="flex-1 overflow-y-auto p-5 space-y-3">

            {loading && (
              <div className="flex items-center gap-3 px-4 py-3 bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl">
                <div className="w-4 h-4 border border-[#333] border-t-[#888] rounded-full animate-spin flex-shrink-0" />
                <span className="text-[11px] text-[#444]">Gemini аналізує ваш портфель...</span>
              </div>
            )}

            {sessionResults.map((result, i) => (
              <ResultCard key={result.id} result={result} isLatest={i === 0} />
            ))}

            {sessionResults.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="text-7xl font-bold text-[#111] mb-4">✦</div>
                <p className="text-[#333] text-sm">Результати аналізу з'являться тут</p>
                <p className="text-[#222] text-xs mt-1 max-w-xs">
                  Оберіть портфель, завантажте ML-сигнали і отримайте персональні рекомендації від AI
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
