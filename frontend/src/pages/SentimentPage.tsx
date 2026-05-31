import { useState, useEffect } from 'react'
import { useLocalState } from '../hooks/useLocalState'
import { sentimentApi, SentimentResponse } from '../services/api'
import { useAsync } from '../hooks/useAsync'
import Badge from '../components/ui/Badge'
import AssetSelector from '../components/ui/AssetSelector'

const SIGNALS = {
  positive: { label: 'Позитивний', color: '#4ade80', bar: '#4ade80', bg: '#0a1f12', border: '#1a3a22' },
  negative: { label: 'Негативний', color: '#f87171', bar: '#f87171', bg: '#1f0a0a', border: '#3a1a1a' },
  neutral:  { label: 'Нейтральний', color: '#888888', bar: '#444444', bg: '#111111', border: '#1e1e1e' },
}

const SCORE_LABELS = [
  { threshold: 0.6,  label: 'Сильно позитивний' },
  { threshold: 0.2,  label: 'Помірно позитивний' },
  { threshold: -0.2, label: 'Нейтральний' },
  { threshold: -0.6, label: 'Помірно негативний' },
  { threshold: -1.1, label: 'Сильно негативний' },
]

type Filter = 'all' | 'positive' | 'negative' | 'neutral'

export default function SentimentPage() {
  const [ticker, setTicker] = useLocalState('sentiment:ticker', 'AAPL')
  const [days, setDays] = useLocalState('sentiment:days', 7)
  const [filter, setFilter] = useState<Filter>('all')
  const { data, loading, error, run } = useAsync<SentimentResponse>()

  // Auto-fetch on ticker/days change (debounced)
  useEffect(() => {
    if (!ticker.trim()) return
    const t = setTimeout(() => run(sentimentApi.get(ticker.toUpperCase(), days)), 700)
    return () => clearTimeout(t)
  }, [ticker, days])

  const signal = data ? SIGNALS[data.signal] : null
  const scorePercent = data ? Math.round(((data.score + 1) / 2) * 100) : 50

  const filteredArticles = (data?.articles ?? []).filter(a =>
    filter === 'all' || a.sentiment === filter
  )

  const counts = {
    all: data?.articles.length ?? 0,
    positive: data?.articles.filter(a => a.sentiment === 'positive').length ?? 0,
    negative: data?.articles.filter(a => a.sentiment === 'negative').length ?? 0,
    neutral:  data?.articles.filter(a => a.sentiment === 'neutral').length ?? 0,
  }

  const scoreLabel = data
    ? (SCORE_LABELS.find(s => data.score >= s.threshold)?.label ?? 'Негативний')
    : ''

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#0a0a0a]">

      {/* Top bar */}
      <div className="flex-shrink-0 border-b border-[#161616] bg-[#0c0c0c] px-5 py-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-shrink-0">
            <div className="text-sm font-semibold text-white">Аналіз новин</div>
            <div className="text-[11px] text-[#444] mt-0.5">FinBERT — нейромережа для аналізу тональності фінансових текстів</div>
          </div>

          <div className="flex flex-wrap items-end gap-3 ml-4">
            <AssetSelector value={ticker} onChange={setTicker} />

            <div>
              <label className="block text-[10px] text-[#444] uppercase tracking-wider mb-1.5">За останні</label>
              <div className="flex rounded-lg overflow-hidden border border-[#1e1e1e]">
                {[3, 7, 14, 30].map(d => (
                  <button key={d} onClick={() => setDays(d)}
                    className={`px-3 py-2 text-xs font-medium transition-colors ${
                      days === d ? 'bg-white text-[#0a0a0a]' : 'bg-[#111] text-[#555] hover:text-white'
                    }`}>
                    {d}д
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => run(sentimentApi.get(ticker.toUpperCase(), days))}
              disabled={loading}
              className="bg-white hover:bg-[#e5e5e5] disabled:opacity-40 text-[#0a0a0a] px-4 py-2 rounded-lg text-xs font-semibold transition-colors h-[34px]"
            >
              {loading ? 'Аналіз...' : '↻ Оновити'}
            </button>
          </div>

          {error && (
            <div className="text-[11px] text-[#f87171] bg-[#1a0a0a] border border-[#3a1515] px-3 py-2 rounded-lg">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Left panel: summary ── */}
        <div className="w-[300px] flex-shrink-0 border-r border-[#161616] overflow-y-auto p-4 space-y-4">

          {!data && !loading && (
            <div className="flex flex-col items-center justify-center h-48 text-[#2a2a2a]">
              <div className="text-5xl mb-3">◎</div>
              <div className="text-xs text-center leading-relaxed">
                Оберіть тікер — аналіз<br />запуститься автоматично
              </div>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <div className="w-5 h-5 border border-[#333] border-t-[#888] rounded-full animate-spin" />
              <div className="text-[11px] text-[#333]">FinBERT аналізує новини...</div>
            </div>
          )}

          {data && signal && (
            <>
              {/* Signal card */}
              <div className="rounded-xl p-4" style={{ background: signal.bg, border: `1px solid ${signal.border}` }}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-2xl font-bold text-white font-mono">{data.ticker}</div>
                    <div className="text-[11px] text-[#555] mt-0.5">{data.company}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold" style={{ color: signal.color }}>{signal.label}</div>
                    <div className="text-[10px] text-[#444] mt-0.5">{scoreLabel}</div>
                  </div>
                </div>

                {/* Sentiment bar */}
                <div>
                  <div className="flex justify-between text-[9px] text-[#444] mb-1.5">
                    <span>Негатив</span>
                    <span className="font-mono text-[#666]">{data.score.toFixed(3)}</span>
                    <span>Позитив</span>
                  </div>
                  <div className="h-2 bg-[#111] rounded-full overflow-hidden relative">
                    <div className="absolute inset-y-0 w-2.5 rounded-full transition-all" style={{
                      left: `calc(${Math.max(2, Math.min(96, scorePercent))}% - 5px)`,
                      background: signal.color,
                      boxShadow: `0 0 6px ${signal.color}`,
                    }} />
                  </div>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl p-3 text-center">
                  <div className="text-[10px] text-[#333] uppercase tracking-widest mb-1">Новин</div>
                  <div className="text-2xl font-bold text-white font-mono">{data.count}</div>
                  <div className="text-[10px] text-[#444] mt-0.5">за {days}д</div>
                </div>
                <div className="bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl p-3 text-center">
                  <div className="text-[10px] text-[#333] uppercase tracking-widest mb-1">Впевненість</div>
                  <div className="text-2xl font-bold font-mono" style={{ color: signal.color }}>
                    {Math.abs(data.score).toFixed(2)}
                  </div>
                  <div className="text-[10px] text-[#444] mt-0.5">0 → 1</div>
                </div>
              </div>

              {/* Breakdown */}
              {data.breakdown && (
                <div className="bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl p-4">
                  <div className="text-[10px] text-[#444] uppercase tracking-widest mb-3">Розподіл тональності</div>
                  <div className="space-y-3">
                    {(['positive', 'negative', 'neutral'] as const).map(s => {
                      const count = data.breakdown[s]
                      const pct = data.count > 0 ? Math.round((count / data.count) * 100) : 0
                      return (
                        <div key={s}>
                          <div className="flex justify-between text-[10px] mb-1">
                            <span style={{ color: SIGNALS[s].color }}>{SIGNALS[s].label}</span>
                            <span className="text-[#444] font-mono">{count} · {pct}%</span>
                          </div>
                          <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, background: SIGNALS[s].bar }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {data.note && (
                <p className="text-[11px] text-[#444] italic px-1 leading-relaxed">{data.note}</p>
              )}
            </>
          )}
        </div>

        {/* ── Right panel: articles ── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Filter tabs */}
          <div className="flex-shrink-0 border-b border-[#161616] px-4 py-2 flex items-center gap-1">
            {(['all', 'positive', 'negative', 'neutral'] as Filter[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
                  filter === f
                    ? 'bg-white text-[#0a0a0a]'
                    : 'text-[#444] hover:text-white hover:bg-[#141414]'
                }`}
              >
                <span>{f === 'all' ? 'Усі новини' : SIGNALS[f].label}</span>
                <span className={`text-[10px] font-mono px-1 rounded ${
                  filter === f ? 'text-[#555]' : 'text-[#333]'
                }`}>
                  {counts[f]}
                </span>
              </button>
            ))}
          </div>

          {/* Article feed */}
          <div className="flex-1 overflow-y-auto p-4">
            {!data && !loading && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="text-6xl font-bold text-[#1a1a1a] mb-4">◎</div>
                <p className="text-[#333] text-sm">Тут з'являться новини після аналізу</p>
                <p className="text-[#222] text-xs mt-1">Аналіз запускається автоматично при виборі тікера</p>
              </div>
            )}

            {data && filteredArticles.length === 0 && (
              <div className="flex items-center justify-center h-32">
                <p className="text-[#333] text-sm">Новин у цій категорії немає</p>
              </div>
            )}

            {filteredArticles.length > 0 && (
              <div className="space-y-2">
                {filteredArticles.map((a, i) => (
                  <article
                    key={i}
                    className="flex gap-4 px-4 py-3.5 bg-[#0f0f0f] border border-[#1a1a1a] rounded-xl hover:border-[#2a2a2a] transition-colors"
                  >
                    {/* Sentiment stripe */}
                    <div className="w-0.5 self-stretch rounded-full flex-shrink-0"
                      style={{ background: SIGNALS[a.sentiment as keyof typeof SIGNALS]?.color ?? '#444' }} />

                    <div className="flex-1 min-w-0">
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-white hover:text-[#ccc] transition-colors line-clamp-2 leading-snug"
                      >
                        {a.title}
                      </a>
                      <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        <span className="text-[11px] text-[#444] font-medium">{a.source}</span>
                        <span className="text-[#222]">·</span>
                        <span className="text-[11px] text-[#333]">{a.published_at.slice(0, 10)}</span>
                      </div>
                    </div>

                    <div className="flex-shrink-0 pt-0.5">
                      <Badge variant={a.sentiment as 'positive' | 'negative' | 'neutral'}>
                        {a.confidence.toFixed(2)}
                      </Badge>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
