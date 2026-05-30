import { useState, useEffect } from 'react'
import { useLocalState } from '../hooks/useLocalState'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { portfolioApi, PortfolioResponse, savedPortfoliosApi, SavedPortfolio } from '../services/api'
import { useAsync } from '../hooks/useAsync'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import MultiAssetSelector from '../components/ui/MultiAssetSelector'

const PIE_COLORS = ['#f5f5f5', '#d4d4d4', '#a3a3a3', '#737373', '#525252', '#6ee7b7', '#c4b5fd', '#fde68a']

const PRESETS = [
  { label: 'Tech',       tickers: ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'META'] },
  { label: 'ETF Mix',    tickers: ['SPY', 'QQQ', 'GLD', 'TLT', 'VNQ'] },
  { label: 'Dividend',   tickers: ['JNJ', 'KO', 'PEP', 'PG', 'XOM'] },
  { label: 'Crypto+Tech',tickers: ['AAPL', 'MSFT', 'BTC-USD', 'ETH-USD'] },
]

function MetricCard({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean }) {
  return (
    <div className="bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl p-4">
      <div className="text-[10px] text-[#444444] uppercase tracking-widest mb-2">{label}</div>
      <div className={`text-2xl font-semibold ${positive === true ? 'text-[#4ade80]' : positive === false ? 'text-[#f87171]' : 'text-white'}`}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-[#333333] mt-1.5">{sub}</div>}
    </div>
  )
}

export default function PortfolioPage() {
  const [selected, setSelected] = useLocalState<string[]>('portfolio:tickers', ['AAPL', 'MSFT', 'GOOGL', 'NVDA'])
  const [risk, setRisk] = useLocalState<'low' | 'medium' | 'high'>('portfolio:risk', 'medium')
  const [value, setValue] = useLocalState<number>('portfolio:value', 10000)
  const { data, loading, error, run } = useAsync<PortfolioResponse>()

  const [saved, setSaved] = useState<SavedPortfolio[]>([])
  const [saveName, setSaveName] = useState('')
  const [saveLoading, setSaveLoading] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    savedPortfoliosApi.list().then(r => setSaved(r.data)).catch(() => {})
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (selected.length < 2) return
    run(portfolioApi.optimize({ tickers: selected, risk_tolerance: risk, portfolio_value: value }))
  }

  const handleSave = async () => {
    if (!data || !saveName.trim()) return
    setSaveLoading(true)
    setSaveError('')
    try {
      const res = await savedPortfoliosApi.save({
        name: saveName.trim(),
        tickers: selected,
        risk_tolerance: risk,
        portfolio_value: value,
        weights: data.weights,
        metrics: {
          expected_annual_return: data.expected_annual_return,
          annual_volatility: data.annual_volatility,
          sharpe_ratio: data.sharpe_ratio,
        },
      })
      setSaved(prev => [res.data, ...prev])
      setSaveName('')
    } catch {
      setSaveError('Не вдалось зберегти')
    } finally {
      setSaveLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await savedPortfoliosApi.delete(id)
      setSaved(prev => prev.filter(p => p.id !== id))
    } catch {}
  }

  const pieData = data
    ? Object.entries(data.weights).map(([name, val]) => ({ name, value: Math.round(val * 100) }))
    : []

  const riskConfig = {
    low:    { label: 'Консервативний', desc: 'мінімум ризику' },
    medium: { label: 'Збалансований',  desc: 'баланс ризику/дохідності' },
    high:   { label: 'Агресивний',     desc: 'максимальна дохідність' },
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-white tracking-tight">Оптимізація портфеля</h1>
        <p className="text-[#555555] text-sm mt-1">
          Модель Марковіца — розподіл активів з максимальним Sharpe Ratio при заданому ризику
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Form */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-[11px] text-[#444444] uppercase tracking-widest mb-2">
                  Активи <span className="text-[#333333]">(2–15)</span>
                </label>
                <MultiAssetSelector selected={selected} onChange={setSelected} max={15} />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {PRESETS.map(p => (
                    <button key={p.label} type="button" onClick={() => setSelected(p.tickers)}
                      className="text-xs px-2.5 py-1 rounded-md border border-[#222222] text-[#444444] hover:border-[#333333] hover:text-[#888888] transition-colors">
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-[#444444] uppercase tracking-widest mb-2">Ризик-профіль</label>
                <div className="flex rounded-lg overflow-hidden border border-[#222222]">
                  {(['low', 'medium', 'high'] as const).map(r => (
                    <button key={r} type="button" onClick={() => setRisk(r)}
                      className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${
                        risk === r
                          ? 'bg-white text-[#0a0a0a]'
                          : 'bg-[#141414] text-[#555555] hover:text-white'
                      }`}>
                      {riskConfig[r].label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-[#333333] mt-1.5 px-0.5">
                  {riskConfig[risk].desc}
                </p>
              </div>

              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="block text-[11px] text-[#444444] uppercase tracking-widest mb-2">Сума ($)</label>
                  <input type="number" value={value} onChange={e => setValue(Number(e.target.value))} min={100}
                    className="bg-[#141414] border border-[#222222] rounded-lg px-3 py-2 text-sm text-white w-36 focus:outline-none focus:border-[#444444]" />
                </div>

                <button type="submit" disabled={loading || selected.length < 2}
                  className="bg-white hover:bg-[#e5e5e5] disabled:opacity-40 text-[#0a0a0a] px-6 py-2 rounded-lg text-sm font-semibold transition-colors">
                  {loading ? 'Оптимізація...' : 'Оптимізувати →'}
                </button>

                {selected.length < 2 && (
                  <span className="text-[11px] text-[#f87171]">Оберіть мінімум 2 активи</span>
                )}
              </div>
            </form>
          </Card>

          {/* Info block */}
          <div className="bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl px-4 py-3">
            <p className="text-xs text-[#444444] leading-relaxed">
              <span className="text-[#666666] font-medium">Принцип: </span>
              Алгоритм знаходить відсоток кожного активу для максимізації Sharpe Ratio.
              Sharpe = дохідність / ризик. Чим вищий — тим ефективніший портфель.
            </p>
          </div>
        </div>

        {/* Saved portfolios */}
        <Card title="Збережені">
          {saved.length === 0 ? (
            <p className="text-xs text-[#333333]">Збережених портфелів немає</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-0.5">
              {saved.map(p => (
                <div key={p.id} className="bg-[#0f0f0f] border border-[#1e1e1e] rounded-lg p-3 flex items-start gap-2">
                  <button onClick={() => {
                    setSelected(p.tickers)
                    setRisk(p.risk_tolerance as 'low' | 'medium' | 'high')
                    setValue(p.portfolio_value)
                  }} className="text-left flex-1 min-w-0">
                    <div className="text-xs font-medium text-white truncate">{p.name}</div>
                    <div className="text-[10px] text-[#444444] mt-0.5">
                      {p.tickers.slice(0, 3).join(', ')}{p.tickers.length > 3 ? '...' : ''} · ${p.portfolio_value.toLocaleString()}
                    </div>
                    {p.metrics?.sharpe_ratio && (
                      <div className="text-[10px] text-[#888888] mt-0.5">Sharpe {p.metrics.sharpe_ratio.toFixed(2)}</div>
                    )}
                  </button>
                  <button onClick={() => handleDelete(p.id)}
                    className="text-[#2a2a2a] hover:text-[#f87171] transition-colors text-lg leading-none flex-shrink-0">
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {error && (
        <div className="bg-[#1a0a0a] border border-[#3a1515] rounded-xl px-4 py-3 text-[#f87171] text-sm">{error}</div>
      )}
      {loading && <Spinner />}

      {data && (
        <>
          {/* Key metrics */}
          <div className="grid grid-cols-3 gap-3">
            <MetricCard
              label="Річна дохідність"
              value={`${(data.expected_annual_return * 100).toFixed(1)}%`}
              sub="очікувана (anualized)"
              positive={data.expected_annual_return > 0.08}
            />
            <MetricCard
              label="Волатильність"
              value={`${(data.annual_volatility * 100).toFixed(1)}%`}
              sub="річний ризик (std dev)"
            />
            <MetricCard
              label="Sharpe Ratio"
              value={data.sharpe_ratio.toFixed(2)}
              sub="> 1 добре · > 2 відмінно"
              positive={data.sharpe_ratio > 1}
            />
          </div>

          {/* Save */}
          <div className="flex items-center gap-3">
            <input
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              placeholder="Назва портфеля..."
              className="flex-1 bg-[#111111] border border-[#222222] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#444444] placeholder:text-[#333333]"
            />
            <button
              onClick={handleSave}
              disabled={saveLoading || !saveName.trim()}
              className="border border-[#2a2a2a] hover:border-[#444444] text-[#666666] hover:text-white disabled:opacity-40 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
            >
              {saveLoading ? 'Збереження...' : 'Зберегти'}
            </button>
            {saveError && <span className="text-[#f87171] text-xs">{saveError}</span>}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Card title="Оптимальний розподіл">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                    label={({ name, value }) => `${name} ${value}%`} labelLine={{ stroke: '#333333' }}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => `${v}%`}
                    contentStyle={{ background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </Card>

            <Card title="Ефективна границя Марковіца">
              <p className="text-[10px] text-[#333333] mb-3">
                Верхній лівий кут = ідеал. Менше ризику → більше дохідності.
              </p>
              <ResponsiveContainer width="100%" height={180}>
                <ScatterChart margin={{ top: 5, right: 10, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                  <XAxis dataKey="volatility" name="Ризик" type="number"
                    domain={['auto', 'auto']}
                    tickFormatter={v => `${(v * 100).toFixed(0)}%`}
                    tick={{ fill: '#444444', fontSize: 10 }}
                    axisLine={{ stroke: '#1e1e1e' }} tickLine={false}
                    label={{ value: 'Волатильність', fill: '#333333', fontSize: 10, position: 'insideBottom', offset: -10 }} />
                  <YAxis dataKey="return" name="Дохідність" type="number"
                    domain={['auto', 'auto']}
                    tickFormatter={v => `${(v * 100).toFixed(0)}%`}
                    tick={{ fill: '#444444', fontSize: 10 }}
                    axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number, n: string) => [`${(v * 100).toFixed(1)}%`, n === 'return' ? 'Дохідність' : 'Ризик']}
                  />
                  <Scatter data={data.efficient_frontier} fill="#e5e5e5" fillOpacity={0.5} />
                </ScatterChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Allocation table */}
          <Card title={`Розподіл $${value.toLocaleString()}`}>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {Object.entries(data.allocation).map(([ticker, shares], i) => (
                <div key={ticker} className="bg-[#0f0f0f] rounded-xl p-3 border-l-2" style={{ borderColor: PIE_COLORS[i % PIE_COLORS.length] }}>
                  <div className="font-semibold text-sm text-white">{ticker}</div>
                  <div className="text-xs text-[#888888] mt-1">{shares} акцій</div>
                  <div className="text-[10px] text-[#444444] mt-0.5">
                    {((data.weights[ticker] ?? 0) * 100).toFixed(1)}% портфеля
                  </div>
                </div>
              ))}
              <div className="bg-[#0f0f0f] rounded-xl p-3">
                <div className="font-semibold text-sm text-[#444444]">Залишок</div>
                <div className="text-xs text-[#888888] mt-1">${data.leftover_cash.toFixed(2)}</div>
                <div className="text-[10px] text-[#333333] mt-0.5">готівка</div>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
