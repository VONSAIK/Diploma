import { useState, useEffect, useMemo } from 'react'
import { useLocalState } from '../hooks/useLocalState'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { portfolioApi, PortfolioResponse, savedPortfoliosApi, SavedPortfolio } from '../services/api'
import { useAsync } from '../hooks/useAsync'
import MultiAssetSelector from '../components/ui/MultiAssetSelector'
import { ASSETS } from '../data/assets'

const PIE_COLORS = [
  '#f5f5f5', '#6ee7b7', '#c4b5fd', '#fde68a', '#fca5a5',
  '#93c5fd', '#d4d4d4', '#86efac', '#f9a8d4', '#a5f3fc',
]

const PRESETS = [
  { label: 'Tech',      tickers: ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'META'] },
  { label: 'ETF Mix',   tickers: ['SPY', 'QQQ', 'GLD', 'TLT', 'VNQ'] },
  { label: 'Dividend',  tickers: ['JNJ', 'KO', 'PEP', 'PG', 'XOM'] },
  { label: 'Global',    tickers: ['SPY', 'EEM', 'ASML', 'TSM', 'NVO'] },
  { label: 'Crypto',    tickers: ['BTC-USD', 'ETH-USD', 'SOL-USD', 'BNB-USD'] },
]

export default function PortfolioPage() {
  const [selected, setSelected] = useLocalState<string[]>('portfolio:tickers', ['AAPL', 'MSFT', 'GOOGL', 'NVDA'])
  const [risk, setRisk] = useLocalState<'low' | 'medium' | 'high'>('portfolio:risk', 'medium')
  const [value, setValue] = useLocalState<number>('portfolio:value', 10000)
  const { data, loading, error, run } = useAsync<PortfolioResponse>()

  const [saved, setSaved] = useState<SavedPortfolio[]>([])
  const [saveName, setSaveName] = useState('')
  const [saveLoading, setSaveLoading] = useState(false)

  useEffect(() => {
    savedPortfoliosApi.list().then(r => setSaved(r.data)).catch(() => {})
  }, [])

  const handleOptimize = () => {
    if (selected.length < 2) return
    run(portfolioApi.optimize({ tickers: selected, risk_tolerance: risk, portfolio_value: value }))
  }

  const handleSave = async () => {
    if (!data || !saveName.trim()) return
    setSaveLoading(true)
    try {
      const res = await savedPortfoliosApi.save({
        name: saveName.trim(), tickers: selected,
        risk_tolerance: risk, portfolio_value: value,
        weights: data.weights,
        metrics: {
          expected_annual_return: data.expected_annual_return,
          annual_volatility: data.annual_volatility,
          sharpe_ratio: data.sharpe_ratio,
        },
      })
      setSaved(prev => [res.data, ...prev])
      setSaveName('')
    } catch {}
    finally { setSaveLoading(false) }
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

  const sectorBreakdown = useMemo(() => {
    if (!data) return []
    const map: Record<string, number> = {}
    for (const [ticker, weight] of Object.entries(data.weights)) {
      const cat = ASSETS.find(a => a.ticker === ticker)?.category ?? 'Інше'
      map[cat] = (map[cat] ?? 0) + weight
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1])
      .map(([cat, w]) => ({ cat, pct: Math.round(w * 100) }))
  }, [data])

  const riskConfig = {
    low:    { label: 'Консерв.', color: '#60a5fa' },
    medium: { label: 'Збаланс.', color: '#888' },
    high:   { label: 'Агрес.',   color: '#f59e0b' },
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#0a0a0a]">

      {/* Top bar */}
      <div className="flex-shrink-0 border-b border-[#161616] bg-[#0c0c0c] px-5 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-white">Оптимізація портфеля</h1>
          <p className="text-[11px] text-[#444] mt-0.5">Модель Марковіца — максимізація Sharpe Ratio при заданому ризику</p>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-[#333]">
          {selected.length} активів обрано
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Left sidebar ── */}
        <div className="w-[272px] flex-shrink-0 border-r border-[#161616] flex flex-col overflow-hidden bg-[#0a0a0a]">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">

            {/* Assets */}
            <div>
              <label className="block text-[10px] text-[#444] uppercase tracking-widest mb-2">
                Активи <span className="text-[#2a2a2a]">(2–15)</span>
              </label>
              <MultiAssetSelector selected={selected} onChange={setSelected} max={15} />
              <div className="flex flex-wrap gap-1 mt-2">
                {PRESETS.map(p => (
                  <button key={p.label} type="button" onClick={() => setSelected(p.tickers)}
                    className="text-[10px] px-2 py-1 rounded border border-[#1e1e1e] text-[#444] hover:border-[#333] hover:text-[#888] transition-colors">
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Risk */}
            <div>
              <label className="block text-[10px] text-[#444] uppercase tracking-widest mb-2">Ризик-профіль</label>
              <div className="grid grid-cols-3 gap-1">
                {(['low', 'medium', 'high'] as const).map(r => (
                  <button key={r} type="button" onClick={() => setRisk(r)}
                    className={`py-2 text-[11px] font-medium rounded-lg border transition-all ${
                      risk === r
                        ? 'bg-white border-white text-[#0a0a0a]'
                        : 'border-[#1e1e1e] text-[#444] hover:text-white hover:border-[#333]'
                    }`}>
                    {riskConfig[r].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Value */}
            <div>
              <label className="block text-[10px] text-[#444] uppercase tracking-widest mb-2">Сума ($)</label>
              <input
                type="number" value={value}
                onChange={e => setValue(Number(e.target.value))} min={100}
                className="w-full bg-[#111] border border-[#1e1e1e] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#333]"
              />
            </div>

            {/* Submit */}
            <button
              onClick={handleOptimize}
              disabled={loading || selected.length < 2}
              className="w-full bg-white hover:bg-[#e5e5e5] disabled:opacity-40 text-[#0a0a0a] py-2.5 rounded-lg text-sm font-semibold transition-colors"
            >
              {loading ? 'Обчислення...' : 'Оптимізувати →'}
            </button>
            {selected.length < 2 && (
              <p className="text-[10px] text-[#f87171]">Мінімум 2 активи</p>
            )}

            {/* Save section */}
            {data && (
              <div className="pt-3 border-t border-[#161616]">
                <label className="block text-[10px] text-[#444] uppercase tracking-widest mb-2">Зберегти результат</label>
                <div className="flex gap-2">
                  <input
                    value={saveName}
                    onChange={e => setSaveName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSave()}
                    placeholder="Назва портфеля..."
                    className="flex-1 bg-[#111] border border-[#1e1e1e] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#333] placeholder:text-[#333]"
                  />
                  <button
                    onClick={handleSave}
                    disabled={saveLoading || !saveName.trim()}
                    className="border border-[#2a2a2a] hover:border-[#444] text-[#555] hover:text-white disabled:opacity-40 px-3 py-1.5 rounded-lg text-xs transition-colors"
                  >
                    {saveLoading ? '...' : '↓'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Saved list */}
          {saved.length > 0 && (
            <div className="border-t border-[#161616] max-h-[220px] flex flex-col">
              <div className="px-4 py-2 flex items-center justify-between flex-shrink-0 bg-[#0c0c0c]">
                <span className="text-[10px] text-[#444] uppercase tracking-widest">Збережені</span>
                <span className="text-[10px] text-[#2a2a2a] font-mono">{saved.length}</span>
              </div>
              <div className="overflow-y-auto px-3 pb-3 space-y-1.5">
                {saved.map(p => (
                  <div key={p.id} className="group flex items-start gap-2 p-2.5 bg-[#0f0f0f] border border-[#1a1a1a] rounded-lg hover:border-[#2a2a2a] transition-colors">
                    <button
                      onClick={() => { setSelected(p.tickers); setRisk(p.risk_tolerance as 'low' | 'medium' | 'high'); setValue(p.portfolio_value) }}
                      className="text-left flex-1 min-w-0"
                    >
                      <div className="text-xs font-medium text-white truncate">{p.name}</div>
                      <div className="text-[10px] text-[#444] mt-0.5">
                        {p.tickers.slice(0, 3).join(', ')}{p.tickers.length > 3 ? ` +${p.tickers.length - 3}` : ''}
                      </div>
                      {p.metrics?.sharpe_ratio != null && (
                        <div className="text-[10px] text-[#555] mt-0.5 font-mono">Sharpe {(p.metrics.sharpe_ratio as number).toFixed(2)}</div>
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="text-[#222] hover:text-[#f87171] transition-colors opacity-0 group-hover:opacity-100 text-base leading-none mt-0.5 flex-shrink-0"
                    >×</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Main content ── */}
        <div className="flex-1 overflow-y-auto p-6">

          {error && (
            <div className="bg-[#1a0a0a] border border-[#3a1515] rounded-xl px-4 py-3 text-[#f87171] text-sm mb-5">{error}</div>
          )}

          {loading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-6 h-6 border border-[#333] border-t-[#888] rounded-full animate-spin mx-auto mb-3" />
                <p className="text-[#333] text-xs">Запуск оптимізатора Марковіца...</p>
              </div>
            </div>
          )}

          {!data && !loading && !error && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="text-7xl font-bold text-[#111] mb-4">◈</div>
              <p className="text-[#333] text-sm">Оберіть активи і натисніть «Оптимізувати»</p>
              <p className="text-[#222] text-xs mt-1">Алгоритм знайде оптимальні ваги для максимального Sharpe Ratio</p>
            </div>
          )}

          {data && !loading && (
            <div className="space-y-5">

              {/* Metrics row */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  {
                    label: 'Річна дохідність',
                    value: `${(data.expected_annual_return * 100).toFixed(1)}%`,
                    sub: 'очікувана (annualized)',
                    color: data.expected_annual_return > 0.08 ? '#4ade80' : '#f87171',
                  },
                  {
                    label: 'Волатильність',
                    value: `${(data.annual_volatility * 100).toFixed(1)}%`,
                    sub: 'річний ризик (σ)',
                    color: '#fff',
                  },
                  {
                    label: 'Sharpe Ratio',
                    value: data.sharpe_ratio.toFixed(2),
                    sub: '> 1 добре  ·  > 2 відмінно',
                    color: data.sharpe_ratio > 1 ? '#4ade80' : '#f87171',
                  },
                ].map(m => (
                  <div key={m.label} className="bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl p-4">
                    <div className="text-[10px] text-[#444] uppercase tracking-widest mb-2">{m.label}</div>
                    <div className="text-2xl font-semibold font-mono" style={{ color: m.color }}>{m.value}</div>
                    <div className="text-[10px] text-[#333] mt-1">{m.sub}</div>
                  </div>
                ))}
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* Allocation pie */}
                <div className="bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl p-5">
                  <div className="text-xs font-medium text-white mb-4">Оптимальний розподіл</div>
                  <div className="flex gap-5 items-center">
                    <div className="flex-shrink-0">
                      <ResponsiveContainer width={150} height={150}>
                        <PieChart>
                          <Pie data={pieData} dataKey="value" cx="50%" cy="50%"
                            outerRadius={68} innerRadius={28} paddingAngle={2}>
                            {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Pie>
                          <Tooltip
                            formatter={(v: number) => `${v}%`}
                            contentStyle={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 11 }}
                            labelStyle={{ color: '#aaa' }}
                            itemStyle={{ color: '#e5e5e5' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      {pieData.map((item, i) => (
                        <div key={item.name} className="flex items-center gap-2.5">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-[11px] text-[#777] flex-1 font-mono truncate">{item.name}</span>
                          <div className="w-16 bg-[#141414] rounded-full h-1 flex-shrink-0">
                            <div className="h-1 rounded-full" style={{ width: `${item.value}%`, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          </div>
                          <span className="text-[11px] text-white font-mono w-7 text-right flex-shrink-0">{item.value}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Markowitz frontier */}
                <div className="bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl p-5">
                  <div className="text-xs font-medium text-white mb-1">Ефективна границя Марковіца</div>
                  <p className="text-[10px] text-[#333] mb-3">↖ ідеал: менше ризику → більше дохідності</p>
                  <ResponsiveContainer width="100%" height={172}>
                    <ScatterChart margin={{ top: 5, right: 10, left: 0, bottom: 18 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                      <XAxis dataKey="volatility" type="number" domain={['auto', 'auto']}
                        tickFormatter={v => `${(v * 100).toFixed(0)}%`}
                        tick={{ fill: '#444', fontSize: 10 }} axisLine={{ stroke: '#1e1e1e' }} tickLine={false}
                        label={{ value: 'Волатильність', fill: '#333', fontSize: 10, position: 'insideBottom', offset: -10 }} />
                      <YAxis dataKey="return" type="number" domain={['auto', 'auto']}
                        tickFormatter={v => `${(v * 100).toFixed(0)}%`}
                        tick={{ fill: '#444', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ background: '#111', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 11 }}
                        labelStyle={{ color: '#aaa' }}
                        itemStyle={{ color: '#e5e5e5' }}
                        formatter={(v: number, n: string) => [`${(v * 100).toFixed(1)}%`, n === 'return' ? 'Дохідність' : 'Ризик']}
                      />
                      <Scatter data={data.efficient_frontier} fill="#6ee7b7" fillOpacity={0.7} />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Sector breakdown */}
              {sectorBreakdown.length > 1 && (
                <div className="bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl p-5">
                  <div className="text-xs font-medium text-white mb-4">Розподіл за секторами</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5">
                    {sectorBreakdown.map(({ cat, pct }) => (
                      <div key={cat} className="flex items-center gap-3">
                        <div className="w-28 text-[11px] text-[#555] truncate">{cat}</div>
                        <div className="flex-1 bg-[#141414] rounded-full h-1.5">
                          <div className="h-1.5 rounded-full bg-[#6ee7b7] transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="text-[11px] text-[#888] font-mono w-8 text-right">{pct}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Allocation table */}
              <div className="bg-[#0f0f0f] border border-[#1e1e1e] rounded-xl p-5">
                <div className="text-xs font-medium text-white mb-4">
                  Розподіл ${value.toLocaleString()} по активах
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {Object.entries(data.allocation).map(([ticker, shares], i) => (
                    <div key={ticker} className="bg-[#141414] rounded-xl p-3 border border-[#1e1e1e]">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="font-semibold text-sm text-white font-mono">{ticker}</span>
                      </div>
                      <div className="text-[11px] text-[#888]">{shares} од.</div>
                      <div className="text-[10px] text-[#555] mt-0.5">
                        {((data.weights[ticker] ?? 0) * 100).toFixed(1)}%
                        {' '}·{' '}
                        ${Math.round((data.weights[ticker] ?? 0) * value).toLocaleString()}
                      </div>
                    </div>
                  ))}
                  {data.leftover_cash > 0 && (
                    <div className="bg-[#141414] rounded-xl p-3 border border-[#1e1e1e] opacity-40">
                      <div className="font-semibold text-sm text-[#555]">Залишок</div>
                      <div className="text-[11px] text-[#444] mt-1 font-mono">${data.leftover_cash.toFixed(2)}</div>
                      <div className="text-[10px] text-[#333] mt-0.5">готівка</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
