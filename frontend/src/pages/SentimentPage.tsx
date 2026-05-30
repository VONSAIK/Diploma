import { useState } from 'react'
import { sentimentApi, SentimentResponse } from '../services/api'
import { useAsync } from '../hooks/useAsync'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Spinner from '../components/ui/Spinner'
import AssetSelector from '../components/ui/AssetSelector'

const SIGNALS = {
  positive: { label: 'Позитивний', color: '#4ade80', bar: '#4ade80', bg: '#0f2a1a', border: '#1a4a2a' },
  negative: { label: 'Негативний', color: '#f87171', bar: '#f87171', bg: '#2a0f0f', border: '#4a1a1a' },
  neutral:  { label: 'Нейтральний', color: '#666666', bar: '#444444', bg: '#141414', border: '#1e1e1e' },
}

const SCORE_LABELS = [
  { threshold: 0.6,  label: 'Сильно позитивний' },
  { threshold: 0.2,  label: 'Помірно позитивний' },
  { threshold: -0.2, label: 'Нейтральний' },
  { threshold: -0.6, label: 'Помірно негативний' },
  { threshold: -1,   label: 'Сильно негативний' },
]

function getScoreLabel(score: number) {
  return SCORE_LABELS.find(s => score >= s.threshold)?.label ?? 'Негативний'
}

export default function SentimentPage() {
  const [ticker, setTicker] = useState('AAPL')
  const [days, setDays] = useState(7)
  const { data, loading, error, run } = useAsync<SentimentResponse>()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    run(sentimentApi.get(ticker.toUpperCase(), days))
  }

  const signal = data ? SIGNALS[data.signal] : null
  const scorePercent = data ? Math.round(((data.score + 1) / 2) * 100) : 50

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-white tracking-tight">Аналіз новин</h1>
        <p className="text-[#555555] text-sm mt-1">FinBERT — нейромережа для sentiment analysis фінансових текстів</p>
      </div>

      {/* Controls */}
      <Card>
        <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end">
          <AssetSelector value={ticker} onChange={setTicker} />
          <div>
            <label className="block text-[11px] text-[#444444] uppercase tracking-wider mb-1.5">За останні</label>
            <select
              value={days}
              onChange={e => setDays(Number(e.target.value))}
              className="bg-[#141414] border border-[#222222] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#444444]"
            >
              {[3, 7, 14, 30].map(d => <option key={d} value={d}>{d} днів</option>)}
            </select>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-white hover:bg-[#e5e5e5] disabled:opacity-40 text-[#0a0a0a] px-5 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            {loading ? 'Аналіз...' : 'Аналізувати →'}
          </button>
        </form>
      </Card>

      {error && (
        <div className="bg-[#1a0a0a] border border-[#3a1515] rounded-xl px-4 py-3 text-[#f87171] text-sm">{error}</div>
      )}
      {loading && <Spinner />}

      {data && signal && (
        <>
          {/* Main result card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Signal */}
            <div
              className="md:col-span-2 rounded-xl p-5"
              style={{ background: signal.bg, border: `1px solid ${signal.border}` }}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="text-2xl font-bold text-white">{data.ticker}</div>
                  <div className="text-sm text-[#555555] mt-0.5">{data.company}</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold" style={{ color: signal.color }}>{signal.label}</div>
                  <div className="text-xs text-[#444444] mt-0.5">{getScoreLabel(data.score)}</div>
                </div>
              </div>

              {/* Score bar */}
              <div className="mb-3">
                <div className="flex justify-between text-[10px] text-[#333333] mb-1">
                  <span>Негативний</span>
                  <span>Score: {data.score.toFixed(3)}</span>
                  <span>Позитивний</span>
                </div>
                <div className="h-2 bg-[#1a1a1a] rounded-full overflow-hidden relative">
                  <div
                    className="absolute top-0 bottom-0 w-2 rounded-full transition-all"
                    style={{ left: `${Math.max(0, Math.min(98, scorePercent))}%`, background: signal.color }}
                  />
                </div>
              </div>

              {/* Breakdown bars */}
              {data.breakdown && (
                <div className="space-y-2 mt-4">
                  {(['positive', 'negative', 'neutral'] as const).map(s => {
                    const count = data.breakdown[s]
                    const pct = data.count > 0 ? Math.round((count / data.count) * 100) : 0
                    return (
                      <div key={s} className="flex items-center gap-3">
                        <div className="w-20 text-[11px]" style={{ color: SIGNALS[s].color }}>{SIGNALS[s].label}</div>
                        <div className="flex-1 bg-[#1a1a1a] rounded-full h-1.5">
                          <div className="h-1.5 rounded-full transition-all"
                            style={{ width: `${pct}%`, background: SIGNALS[s].bar }} />
                        </div>
                        <div className="text-[11px] text-[#444444] w-16 text-right font-mono">{count} ({pct}%)</div>
                      </div>
                    )
                  })}
                </div>
              )}

              {data.note && (
                <div className="mt-3 text-[11px] text-[#444444] italic">{data.note}</div>
              )}
            </div>

            {/* Stats */}
            <div className="space-y-3">
              <div className="bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl p-4">
                <div className="text-[10px] text-[#333333] uppercase tracking-widest mb-1">Кількість новин</div>
                <div className="text-3xl font-bold text-white">{data.count}</div>
                <div className="text-[11px] text-[#444444] mt-1">за {days} днів</div>
              </div>
              <div className="bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl p-4">
                <div className="text-[10px] text-[#333333] uppercase tracking-widest mb-1">Confidence Score</div>
                <div className="text-3xl font-bold" style={{ color: signal.color }}>
                  {Math.abs(data.score).toFixed(2)}
                </div>
                <div className="text-[11px] text-[#444444] mt-1">|-1 негативний · +1 позитивний|</div>
              </div>
              <div className="bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl p-4">
                <div className="text-[10px] text-[#333333] uppercase tracking-widest mb-2">Розподіл</div>
                {data.breakdown && (['positive', 'negative', 'neutral'] as const).map(s => (
                  <div key={s} className="flex justify-between text-[11px] mb-1">
                    <span style={{ color: SIGNALS[s].color }}>{SIGNALS[s].label}</span>
                    <span className="text-[#444444] font-mono">
                      {data.count > 0 ? Math.round((data.breakdown[s] / data.count) * 100) : 0}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Articles */}
          {data.articles.length > 0 && (
            <Card title={`Новини (${data.articles.length})`}>
              <div className="space-y-2">
                {data.articles.map((a, i) => (
                  <div key={i} className="flex gap-4 px-4 py-3 bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl hover:border-[#2a2a2a] transition-colors">
                    <div className="flex-1 min-w-0">
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-white hover:text-[#cccccc] transition-colors line-clamp-2 leading-snug"
                      >
                        {a.title}
                      </a>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-[11px] text-[#444444]">{a.source}</span>
                        <span className="text-[#222222]">·</span>
                        <span className="text-[11px] text-[#333333]">{a.published_at.slice(0, 10)}</span>
                      </div>
                    </div>
                    <div className="flex-shrink-0 pt-0.5">
                      <Badge variant={a.sentiment as 'positive' | 'negative' | 'neutral'}>
                        {a.confidence.toFixed(2)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
