import { useState } from 'react'
import { sentimentApi, SentimentResponse } from '../services/api'
import { useAsync } from '../hooks/useAsync'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Spinner from '../components/ui/Spinner'
import AssetSelector from '../components/ui/AssetSelector'

const SIGNALS = {
  positive: { label: 'Позитивний', color: 'text-green-400', bar: 'bg-green-500' },
  negative: { label: 'Негативний', color: 'text-red-400', bar: 'bg-red-500' },
  neutral:  { label: 'Нейтральний', color: 'text-gray-400', bar: 'bg-gray-500' },
}

export default function SentimentPage() {
  const [ticker, setTicker] = useState('AAPL')
  const [days, setDays] = useState(7)
  const { data, loading, error, run } = useAsync<SentimentResponse>()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    run(sentimentApi.get(ticker.toUpperCase(), days))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Аналіз новин</h1>
        <p className="text-gray-400 text-sm mt-1">FinBERT — sentiment analysis фінансових новин</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end">
          <AssetSelector value={ticker} onChange={setTicker} />
          <div>
            <label className="block text-xs text-gray-400 mb-1">За останні</label>
            <select
              value={days}
              onChange={e => setDays(Number(e.target.value))}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            >
              {[3, 7, 14, 30].map(d => <option key={d} value={d}>{d} днів</option>)}
            </select>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? 'Аналіз...' : 'Аналізувати'}
          </button>
        </form>
      </Card>

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg px-4 py-3 text-red-400 text-sm">{error}</div>
      )}

      {loading && <Spinner />}

      {data && (
        <>
          <Card>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xl font-bold">{data.ticker}</div>
                <div className="text-gray-400 text-sm">{data.company}</div>
              </div>
              <div className="text-right">
                <div className={`text-2xl font-bold ${SIGNALS[data.signal].color}`}>
                  {SIGNALS[data.signal].label}
                </div>
                <div className="text-gray-400 text-sm">Score: {data.score.toFixed(3)}</div>
              </div>
            </div>

            {data.breakdown && (
              <div className="mt-4 space-y-2">
                {(['positive', 'negative', 'neutral'] as const).map(s => {
                  const count = data.breakdown[s]
                  const pct = data.count > 0 ? Math.round((count / data.count) * 100) : 0
                  return (
                    <div key={s} className="flex items-center gap-3">
                      <div className="w-20 text-xs text-gray-400">{SIGNALS[s].label}</div>
                      <div className="flex-1 bg-gray-800 rounded-full h-2">
                        <div className={`${SIGNALS[s].bar} h-2 rounded-full`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="text-xs text-gray-400 w-12 text-right">{count} ({pct}%)</div>
                    </div>
                  )
                })}
              </div>
            )}

            {data.note && (
              <div className="mt-3 text-xs text-gray-500 italic">{data.note}</div>
            )}
          </Card>

          {data.articles.length > 0 && (
            <Card title="Новини">
              <div className="space-y-3">
                {data.articles.map((a, i) => (
                  <div key={i} className="flex gap-3 p-3 bg-gray-800 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium hover:text-blue-400 transition-colors line-clamp-2"
                      >
                        {a.title}
                      </a>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">{a.source}</span>
                        <span className="text-xs text-gray-600">{a.published_at.slice(0, 10)}</span>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
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
