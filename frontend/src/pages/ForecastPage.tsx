import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocalState } from '../hooks/useLocalState'
import { forecastApi, ForecastResponse, OHLCVPoint } from '../services/api'
import { useAsync } from '../hooks/useAsync'
import AssetSelector from '../components/ui/AssetSelector'
import FinancialChart from '../components/ui/FinancialChart'

const DAILY_STEPS  = [7, 14, 30, 60, 90]
const HOURLY_STEPS = [12, 24, 48]

const MODEL_INFO = {
  xgboost: { label: 'XGBoost', tag: 'Machine Learning',   color: '#6ee7b7' },
  lstm:    { label: 'LSTM',    tag: 'Deep Learning',       color: '#c4b5fd' },
  prophet: { label: 'Prophet', tag: 'Time Series',         color: '#fde68a' },
} as const

export default function ForecastPage() {
  const [ticker, setTicker]     = useLocalState('forecast:ticker', 'AAPL')
  const [steps, setSteps]       = useLocalState('forecast:steps', 30)
  const [model, setModel]       = useLocalState<'lstm' | 'xgboost' | 'prophet'>('forecast:model', 'xgboost')
  const [interval, setInterval] = useLocalState<'1d' | '1h'>('forecast:interval', '1d')
  const [liveBar, setLiveBar]   = useState<OHLCVPoint | null>(null)
  const [showMetrics, setShowMetrics] = useState(false)

  // Measure chart area with ResizeObserver → pass explicit px to FinancialChart
  const chartAreaRef = useRef<HTMLDivElement>(null)
  const [chartDims, setChartDims] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const el = chartAreaRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const r = entries[0]?.contentRect
      if (r && r.width > 0 && r.height > 0) {
        setChartDims({ w: Math.floor(r.width), h: Math.floor(r.height) })
      }
    })
    ro.observe(el)
    // Also read immediately (in case already sized)
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) setChartDims({ w: Math.floor(r.width), h: Math.floor(r.height) })
    return () => ro.disconnect()
  }, [])

  const { data, loading, error, run } = useAsync<ForecastResponse>()

  const isHourly  = interval === '1h'
  const modelInfo = MODEL_INFO[model]

  // Auto-fetch on param change (debounced 700ms for ticker)
  useEffect(() => {
    if (!ticker.trim()) return
    const t = setTimeout(() =>
      run(forecastApi.get(ticker.toUpperCase(), steps, model, interval)), 700)
    return () => clearTimeout(t)
  }, [ticker, steps, model, interval])

  const handleIntervalChange = (val: '1d' | '1h') => {
    setInterval(val)
    setSteps(val === '1h' ? 24 : 30)
    setLiveBar(null)
  }

  const handleLiveUpdate = useCallback((pt: OHLCVPoint) => setLiveBar(pt), [])

  const currentBar   = liveBar ?? data?.history[data.history.length - 1]
  const firstBar     = data?.history[0]
  const lastForecast = data?.predictions[data.predictions.length - 1]

  const pctChange = (currentBar && firstBar?.close)
    ? ((currentBar.close - firstBar.close) / firstBar.close) * 100 : null
  const forecastPct = (lastForecast && currentBar?.close)
    ? ((lastForecast.price - currentBar.close) / currentBar.close) * 100 : null

  return (
    <div className="relative flex flex-col bg-[#0a0a0a]" style={{ height: '100vh' }}>

      {/* ══ TOP BAR: controls ════════════════════════════════════════════════ */}
      <div className="flex-shrink-0 z-30 bg-[#0c0c0c] border-b border-[#161616]">
        <div className="flex flex-wrap items-end gap-3 px-5 py-3">

          <AssetSelector value={ticker} onChange={setTicker} />

          {/* Interval */}
          <div>
            <div className="text-[10px] text-[#333] uppercase tracking-wider mb-1.5">Інтервал</div>
            <div className="flex rounded-lg overflow-hidden border border-[#1e1e1e]">
              {(['1d', '1h'] as const).map(iv => (
                <button key={iv} onClick={() => handleIntervalChange(iv)}
                  className={`px-3 py-2 text-xs font-medium transition-colors ${
                    interval === iv ? 'bg-white text-[#0a0a0a]' : 'bg-[#111] text-[#555] hover:text-white'
                  }`}>
                  {iv === '1d' ? 'Денний' : 'Погодинний'}
                </button>
              ))}
            </div>
          </div>

          {/* Steps */}
          <div>
            <div className="text-[10px] text-[#333] uppercase tracking-wider mb-1.5">
              {isHourly ? 'Годин' : 'Днів'} прогнозу
            </div>
            <select value={steps} onChange={e => setSteps(Number(e.target.value))}
              className="bg-[#111] border border-[#1e1e1e] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#333] h-[36px]">
              {(isHourly ? HOURLY_STEPS : DAILY_STEPS).map(s => (
                <option key={s} value={s}>{s} {isHourly ? 'год' : 'днів'}</option>
              ))}
            </select>
          </div>

          {/* Model toggle */}
          <div>
            <div className="text-[10px] text-[#333] uppercase tracking-wider mb-1.5">ML Модель</div>
            <div className="flex rounded-lg overflow-hidden border border-[#1e1e1e]">
              {(Object.entries(MODEL_INFO) as [string, typeof MODEL_INFO['xgboost']][]).map(([key, info]) => (
                <button key={key}
                  onClick={() => setModel(key as keyof typeof MODEL_INFO)}
                  disabled={key === 'prophet' && interval === '1h'}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-all disabled:opacity-30 ${
                    model === key ? 'bg-white text-[#0a0a0a]' : 'bg-[#111] text-[#555] hover:text-white'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: model === key ? '#0a0a0a' : info.color }}
                  />
                  {info.label}
                </button>
              ))}
            </div>
          </div>

          {/* Refresh */}
          <button
            disabled={loading}
            onClick={() => run(forecastApi.get(ticker.toUpperCase(), steps, model, interval))}
            className="bg-white hover:bg-[#e5e5e5] disabled:opacity-40 text-[#0a0a0a] px-4 py-2 rounded-lg text-xs font-semibold transition-colors h-[36px] whitespace-nowrap"
          >
            {loading ? '⟳ Завантаження...' : '⟳ Оновити'}
          </button>

          {error && (
            <div className="text-[11px] text-[#f87171] bg-[#1a0a0a] border border-[#3a1515] px-3 py-2 rounded-lg h-[36px] flex items-center">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* ══ CHART AREA — ref measures actual px, passed to chart ══════════════ */}
      <div ref={chartAreaRef} className="flex-1 min-h-0 relative overflow-hidden">

        {/* Render chart only when we have real dimensions */}
        {chartDims.h > 0 && (
          <FinancialChart
            key={interval}
            history={data?.history ?? []}
            predictions={data?.predictions ?? []}
            confidenceInterval={data?.confidence_interval}
            forecastColor={modelInfo.color}
            interval={interval}
            ticker={ticker.toUpperCase()}
            width={chartDims.w}
            height={chartDims.h}
            onLiveUpdate={handleLiveUpdate}
          />
        )}

        {/* Loading spinner */}
        {loading && (
          <div className="absolute top-4 right-4 z-20 flex items-center gap-2 pointer-events-none">
            <div className="w-4 h-4 border border-[#333] border-t-[#888] rounded-full animate-spin" />
            <span className="text-[11px] text-[#444]">
              {model === 'xgboost' ? 'XGBoost...' : model === 'lstm' ? 'LSTM...' : 'Prophet...'}
            </span>
          </div>
        )}

        {/* Empty state */}
        {!data && !loading && !error && chartDims.h > 0 && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none">
            <p className="text-[#222] text-sm">Завантаження даних...</p>
          </div>
        )}
      </div>

      {/* ══ BOTTOM BAR: stats ════════════════════════════════════════════════ */}
      <div className="flex-shrink-0 z-30 bg-[#0c0c0c] border-t border-[#161616] px-5 py-2.5">
        {data ? (
          <>
            <div className="flex items-center gap-4 flex-wrap">
              {/* Current price */}
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] text-[#333] uppercase tracking-wider">Ціна</span>
                <span className="text-sm font-semibold font-mono text-white">
                  {currentBar ? `$${currentBar.close.toFixed(2)}` : '—'}
                </span>
                {pctChange != null && (
                  <span className={`text-xs font-mono font-semibold ${pctChange >= 0 ? 'text-[#4ade80]' : 'text-[#f87171]'}`}>
                    {pctChange >= 0 ? '+' : ''}{pctChange.toFixed(2)}%
                  </span>
                )}
              </div>

              <div className="w-px h-4 bg-[#1e1e1e]" />

              {/* Last candle OHLV */}
              {currentBar && (
                <div className="flex items-baseline gap-3 text-[11px] text-[#555]">
                  <span>O <span className="text-[#888] font-mono">{currentBar.open.toFixed(2)}</span></span>
                  <span>H <span className="text-[#4ade80] font-mono">{currentBar.high.toFixed(2)}</span></span>
                  <span>L <span className="text-[#f87171] font-mono">{currentBar.low.toFixed(2)}</span></span>
                  <span>V <span className="text-[#555] font-mono">{currentBar.volume.toLocaleString()}</span></span>
                </div>
              )}

              <div className="w-px h-4 bg-[#1e1e1e]" />

              {/* Forecast */}
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] text-[#333] uppercase tracking-wider">
                  +{steps}{isHourly ? 'г' : 'д'}
                </span>
                <span className="text-sm font-semibold font-mono" style={{ color: modelInfo.color }}>
                  {lastForecast ? `$${lastForecast.price.toFixed(2)}` : '—'}
                </span>
                {forecastPct != null && (
                  <span className={`text-xs font-mono ${forecastPct >= 0 ? 'text-[#4ade80]' : 'text-[#f87171]'}`}>
                    {forecastPct >= 0 ? '+' : ''}{forecastPct.toFixed(2)}%
                  </span>
                )}
              </div>

              {/* CV метрики моделі */}
              {data.metrics?.cv_mape != null && (
                <>
                  <div className="w-px h-4 bg-[#1e1e1e]" />
                  <div className="flex items-baseline gap-3">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[10px] text-[#333] uppercase tracking-wider" title={model === 'xgboost' ? 'Cross-validation MAPE' : 'Validation MAPE'}>
                        MAPE
                      </span>
                      <span className="text-sm font-mono text-white">{(data.metrics as any).cv_mape.toFixed(2)}%</span>
                    </div>
                    {(data.metrics as any).cv_rmse != null && (
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[10px] text-[#333] uppercase tracking-wider">RMSE</span>
                        <span className="text-sm font-mono text-[#888]">${(data.metrics as any).cv_rmse.toFixed(2)}</span>
                      </div>
                    )}
                    {(data.metrics as any).cv_mae != null && (
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[10px] text-[#333] uppercase tracking-wider">MAE</span>
                        <span className="text-sm font-mono text-[#888]">${(data.metrics as any).cv_mae.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Model label + feature importance toggle */}
              <div className="ml-auto flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: modelInfo.color }} />
                <span className="text-[11px] text-[#555]">{modelInfo.label}</span>
                <span className="text-[10px] text-[#2a2a2a] border border-[#1a1a1a] px-1.5 py-0.5 rounded uppercase tracking-wide">
                  {modelInfo.tag}
                </span>
                {(data.metrics as any)?.pretrained && (
                  <span className="text-[10px] text-[#2a4a2a] border border-[#1a3a1a] bg-[#0f1f0f] px-1.5 py-0.5 rounded">
                    pretrained
                  </span>
                )}
                {data.metrics?.feature_importance && (
                  <button
                    onClick={() => setShowMetrics(v => !v)}
                    className="text-[10px] text-[#333] hover:text-white border border-[#1a1a1a] px-2 py-1 rounded transition-colors ml-1"
                  >
                    {showMetrics ? '▼' : '▲'} Важливість ознак
                  </button>
                )}
              </div>
            </div>

            {/* Feature importance (expandable) */}
            {showMetrics && data.metrics?.feature_importance && (
              <div className="mt-2.5 pt-2.5 border-t border-[#141414]">
                <p className="text-[10px] text-[#2a2a2a] mb-2">Внесок технічних індикаторів у рішення моделі (XGBoost feature importance)</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-x-8 gap-y-1.5">
                  {Object.entries(data.metrics.feature_importance as Record<string, number>)
                    .slice(0, 10)
                    .map(([feat, imp]) => (
                      <div key={feat} className="flex items-center gap-2">
                        <span className="text-[10px] text-[#444] w-20 truncate font-mono">{feat}</span>
                        <div className="flex-1 bg-[#141414] rounded-full h-1">
                          <div className="h-1 rounded-full transition-all" style={{
                            width: `${Math.min(imp * 100, 100).toFixed(0)}%`,
                            background: modelInfo.color,
                          }} />
                        </div>
                        <span className="text-[10px] text-[#555] w-8 text-right font-mono">
                          {(imp * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="h-5 flex items-center">
            <span className="text-[11px] text-[#222]">
              {loading ? 'Завантаження даних...' : 'Немає даних'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
