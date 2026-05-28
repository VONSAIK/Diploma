import { useState } from 'react'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { portfolioApi, PortfolioResponse } from '../services/api'
import { useAsync } from '../hooks/useAsync'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import MultiAssetSelector from '../components/ui/MultiAssetSelector'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16']

const PRESETS = [
  { label: 'Tech', tickers: ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'META'] },
  { label: 'ETF Mix', tickers: ['SPY', 'QQQ', 'GLD', 'TLT', 'VNQ'] },
  { label: 'Dividend', tickers: ['JNJ', 'KO', 'PEP', 'PG', 'XOM'] },
  { label: 'Crypto+Tech', tickers: ['AAPL', 'MSFT', 'BTC-USD', 'ETH-USD'] },
]

function Metric({ label, value, sub, color = 'text-white' }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 text-center">
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  )
}

export default function PortfolioPage() {
  const [selected, setSelected] = useState<string[]>(['AAPL', 'MSFT', 'GOOGL', 'NVDA'])
  const [risk, setRisk] = useState<'low' | 'medium' | 'high'>('medium')
  const [value, setValue] = useState(10000)
  const { data, loading, error, run } = useAsync<PortfolioResponse>()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (selected.length < 2) return
    run(portfolioApi.optimize({ tickers: selected, risk_tolerance: risk, portfolio_value: value }))
  }

  const pieData = data
    ? Object.entries(data.weights).map(([name, val]) => ({ name, value: Math.round(val * 100) }))
    : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Оптимізація портфеля</h1>
        <p className="text-gray-400 text-sm mt-1">
          Модель Марковіца — знаходить розподіл активів з максимальним Sharpe Ratio при заданому ризику
        </p>
      </div>

      {/* Пояснення суті */}
      <div className="bg-blue-950/30 border border-blue-800/50 rounded-xl p-4 text-sm text-blue-200">
        <span className="font-semibold text-blue-400">Суть портфельної оптимізації: </span>
        Ти обираєш активи і суму — алгоритм знаходить оптимальний відсоток кожного активу, щоб при заданому ризику отримати максимальну дохідність.
        Sharpe Ratio = дохідність / ризик. Чим він вищий — тим ефективніший портфель.
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Активи (обери 2–15)
            </label>
            <MultiAssetSelector selected={selected} onChange={setSelected} max={15} />
            {/* Пресети */}
            <div className="flex flex-wrap gap-2 mt-2">
              {PRESETS.map(p => (
                <button key={p.label} type="button" onClick={() => setSelected(p.tickers)}
                  className="text-xs px-3 py-1 rounded-md border border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white transition-colors">
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Ризик-профіль</label>
              <div className="flex rounded-lg overflow-hidden border border-gray-700">
                {([
                  { val: 'low', label: 'Консервативний', desc: 'мін. ризик' },
                  { val: 'medium', label: 'Збалансований', desc: 'max Sharpe' },
                  { val: 'high', label: 'Агресивний', desc: 'max дохідність' },
                ] as const).map(r => (
                  <button key={r.val} type="button" onClick={() => setRisk(r.val)}
                    className={`px-3 py-2 text-sm font-medium transition-colors ${risk === r.val ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Сума інвестицій ($)</label>
              <input type="number" value={value} onChange={e => setValue(Number(e.target.value))} min={100}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm w-36 focus:outline-none focus:border-blue-500" />
            </div>

            <button type="submit" disabled={loading || selected.length < 2}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">
              {loading ? 'Оптимізація...' : 'Оптимізувати'}
            </button>
          </div>

          {selected.length < 2 && (
            <p className="text-xs text-yellow-500">Оберіть мінімум 2 активи</p>
          )}
        </form>
      </Card>

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg px-4 py-3 text-red-400 text-sm">{error}</div>
      )}
      {loading && <Spinner />}

      {data && (
        <>
          {/* Метрики */}
          <div className="grid grid-cols-3 gap-3">
            <Metric label="Річна дохідність" value={`${(data.expected_annual_return * 100).toFixed(1)}%`}
              sub="очікувана" color="text-green-400" />
            <Metric label="Волатильність" value={`${(data.annual_volatility * 100).toFixed(1)}%`}
              sub="річний ризик" color="text-yellow-400" />
            <Metric label="Sharpe Ratio" value={data.sharpe_ratio.toFixed(2)}
              sub=">1 добре, >2 відмінно" color="text-blue-400" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Кругова діаграма */}
            <Card title="Оптимальний розподіл">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}
                    label={({ name, value }) => `${name} ${value}%`} labelLine={false}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v}%`}
                    contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </Card>

            {/* Ефективна границя */}
            <Card title="Ефективна границя Марковіца">
              <p className="text-xs text-gray-500 mb-2">
                Кожна точка — можливий портфель. Верхній лівий кут = ідеал (мало ризику, багато дохідності).
              </p>
              <ResponsiveContainer width="100%" height={200}>
                <ScatterChart margin={{ top: 5, right: 20, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="volatility" name="Ризик" type="number"
                    tickFormatter={v => `${(v * 100).toFixed(0)}%`}
                    tick={{ fill: '#9ca3af', fontSize: 10 }}
                    label={{ value: 'Волатильність (ризик)', fill: '#6b7280', fontSize: 10, position: 'insideBottom', offset: -10 }} />
                  <YAxis dataKey="return" name="Дохідність" type="number"
                    tickFormatter={v => `${(v * 100).toFixed(0)}%`}
                    tick={{ fill: '#9ca3af', fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                    formatter={(v: number, n: string) => [`${(v * 100).toFixed(1)}%`, n === 'return' ? 'Дохідність' : 'Ризик']}
                  />
                  <Scatter data={data.efficient_frontier} fill="#3b82f6" fillOpacity={0.7} />
                </ScatterChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Розподіл суми */}
          <Card title={`Як розподілити $${value.toLocaleString()}`}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(data.allocation).map(([ticker, shares], i) => (
                <div key={ticker} className="bg-gray-800 rounded-lg p-3 border-l-2" style={{ borderColor: COLORS[i % COLORS.length] }}>
                  <div className="font-bold" style={{ color: COLORS[i % COLORS.length] }}>{ticker}</div>
                  <div className="text-sm text-gray-300 mt-1">{shares} акцій</div>
                  <div className="text-xs text-gray-500">{((data.weights[ticker] ?? 0) * 100).toFixed(1)}% портфеля</div>
                </div>
              ))}
              <div className="bg-gray-800 rounded-lg p-3">
                <div className="text-gray-400 font-medium">Залишок</div>
                <div className="text-sm text-gray-300 mt-1">${data.leftover_cash.toFixed(2)}</div>
                <div className="text-xs text-gray-500">готівка</div>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
