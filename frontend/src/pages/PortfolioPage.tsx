import { useState } from 'react'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from 'recharts'
import { portfolioApi, PortfolioResponse } from '../services/api'
import { useAsync } from '../hooks/useAsync'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16']

const PRESETS = [
  { label: 'Tech', tickers: 'AAPL, MSFT, GOOGL, NVDA, META' },
  { label: 'ETF Mix', tickers: 'SPY, QQQ, VNQ, GLD, TLT' },
  { label: 'Dividend', tickers: 'JNJ, KO, PEP, PG, XOM' },
]

function Metric({ label, value, color = 'text-white' }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-gray-800 rounded-lg p-3 text-center">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
    </div>
  )
}

export default function PortfolioPage() {
  const [tickersInput, setTickersInput] = useState('AAPL, MSFT, GOOGL, NVDA')
  const [risk, setRisk] = useState<'low' | 'medium' | 'high'>('medium')
  const [value, setValue] = useState(10000)
  const { data, loading, error, run } = useAsync<PortfolioResponse>()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const tickers = tickersInput.split(',').map(t => t.trim().toUpperCase()).filter(Boolean)
    run(portfolioApi.optimize({ tickers, risk_tolerance: risk, portfolio_value: value }))
  }

  const pieData = data
    ? Object.entries(data.weights).map(([name, value]) => ({ name, value: Math.round(value * 100) }))
    : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Оптимізація портфеля</h1>
        <p className="text-gray-400 text-sm mt-1">Модель Марковіца — максимізація Sharpe Ratio</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Тікери (через кому)</label>
            <input
              value={tickersInput}
              onChange={e => setTickersInput(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              placeholder="AAPL, MSFT, GOOGL"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {PRESETS.map(p => (
              <button
                key={p.label}
                type="button"
                onClick={() => setTickersInput(p.tickers)}
                className="text-xs px-3 py-1 rounded-md border border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Ризик-профіль</label>
              <div className="flex rounded-lg overflow-hidden border border-gray-700">
                {(['low', 'medium', 'high'] as const).map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRisk(r)}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      risk === r ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {{ low: 'Низький', medium: 'Середній', high: 'Високий' }[r]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Сума ($)</label>
              <input
                type="number"
                value={value}
                onChange={e => setValue(Number(e.target.value))}
                min={100}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm w-32 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {loading ? 'Оптимізація...' : 'Оптимізувати'}
            </button>
          </div>
        </form>
      </Card>

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg px-4 py-3 text-red-400 text-sm">{error}</div>
      )}

      {loading && <Spinner />}

      {data && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Metric
              label="Річна дохідність"
              value={`${(data.expected_annual_return * 100).toFixed(1)}%`}
              color="text-green-400"
            />
            <Metric
              label="Волатильність"
              value={`${(data.annual_volatility * 100).toFixed(1)}%`}
              color="text-yellow-400"
            />
            <Metric
              label="Sharpe Ratio"
              value={data.sharpe_ratio.toFixed(2)}
              color="text-blue-400"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card title="Розподіл портфеля">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name} ${value}%`}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v}%`} contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </Card>

            <Card title="Ефективна границя">
              <ResponsiveContainer width="100%" height={240}>
                <ScatterChart margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="volatility" name="Ризик" tickFormatter={v => `${(v * 100).toFixed(0)}%`} tick={{ fill: '#9ca3af', fontSize: 11 }} label={{ value: 'Волатильність', fill: '#6b7280', fontSize: 11, position: 'insideBottom', offset: -2 }} />
                  <YAxis dataKey="return" name="Дохідність" tickFormatter={v => `${(v * 100).toFixed(0)}%`} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }} formatter={(v: number, n: string) => [`${(v * 100).toFixed(1)}%`, n]} />
                  <Scatter data={data.efficient_frontier} fill="#3b82f6" fillOpacity={0.7} />
                </ScatterChart>
              </ResponsiveContainer>
            </Card>
          </div>

          <Card title={`Розподіл $${value.toLocaleString()}`}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(data.allocation).map(([ticker, shares]) => (
                <div key={ticker} className="bg-gray-800 rounded-lg p-3">
                  <div className="font-bold text-blue-400">{ticker}</div>
                  <div className="text-sm text-gray-300">{shares} акцій</div>
                  <div className="text-xs text-gray-500">{((data.weights[ticker] ?? 0) * 100).toFixed(1)}%</div>
                </div>
              ))}
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="font-bold text-gray-400">Залишок</div>
                <div className="text-sm text-gray-300">${data.leftover_cash.toFixed(2)}</div>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
