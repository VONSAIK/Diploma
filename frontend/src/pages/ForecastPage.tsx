import { useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { forecastApi, ForecastResponse } from '../services/api'
import { useAsync } from '../hooks/useAsync'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'

const POPULAR = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN', 'NVDA']

export default function ForecastPage() {
  const [ticker, setTicker] = useState('AAPL')
  const [days, setDays] = useState(30)
  const [model, setModel] = useState<'prophet' | 'lstm'>('prophet')
  const { data, loading, error, run } = useAsync<ForecastResponse>()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    run(forecastApi.get(ticker.toUpperCase(), days, model))
  }

  const chartData = data?.predictions.map((p, i) => ({
    date: p.date,
    price: p.price,
    lower: data.confidence_interval?.[i]?.lower,
    upper: data.confidence_interval?.[i]?.upper,
  })) ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Прогноз цін акцій</h1>
        <p className="text-gray-400 text-sm mt-1">LSTM та Prophet моделі</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Тікер</label>
            <input
              value={ticker}
              onChange={e => setTicker(e.target.value.toUpperCase())}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm w-28 focus:outline-none focus:border-blue-500"
              placeholder="AAPL"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Днів</label>
            <select
              value={days}
              onChange={e => setDays(Number(e.target.value))}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            >
              {[7, 14, 30, 60, 90].map(d => (
                <option key={d} value={d}>{d} днів</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Модель</label>
            <select
              value={model}
              onChange={e => setModel(e.target.value as 'prophet' | 'lstm')}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="prophet">Prophet</option>
              <option value="lstm">LSTM</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? 'Обробка...' : 'Прогноз'}
          </button>
        </form>

        <div className="flex flex-wrap gap-2 mt-3">
          {POPULAR.map(t => (
            <button
              key={t}
              onClick={() => setTicker(t)}
              className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                ticker === t
                  ? 'border-blue-500 text-blue-400 bg-blue-950/40'
                  : 'border-gray-700 text-gray-500 hover:border-gray-500'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </Card>

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading && <Spinner />}

      {data && (
        <Card title={`${data.ticker} — ${data.model.toUpperCase()} прогноз на ${days} днів`}>
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#9ca3af' }}
              />
              <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              {data.confidence_interval && (
                <>
                  <Line dataKey="upper" stroke="#1d4ed8" strokeWidth={1} dot={false} strokeDasharray="4 2" name="Верхня межа" />
                  <Line dataKey="lower" stroke="#1d4ed8" strokeWidth={1} dot={false} strokeDasharray="4 2" name="Нижня межа" />
                </>
              )}
              <Line dataKey="price" stroke="#3b82f6" strokeWidth={2} dot={false} name="Ціна" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  )
}
