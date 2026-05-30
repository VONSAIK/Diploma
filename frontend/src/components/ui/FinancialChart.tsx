/**
 * FinancialChart — lightweight-charts v5
 * Simplified approach: explicit pixel width/height passed from parent.
 * This avoids all CSS flex/absolute sizing ambiguity.
 */
import { useRef, useEffect, useState, useCallback } from 'react'
import {
  createChart,
  CrosshairMode,
  ColorType,
  LineStyle,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
} from 'lightweight-charts'
import type { OHLCVPoint, ForecastPoint, ConfidencePoint } from '../../services/api'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Convert backend date string to lightweight-charts Time.
 * Daily: return "YYYY-MM-DD" string directly — lc accepts it natively, no NaN risk.
 * Hourly: parse "YYYY-MM-DD HH:MM" components manually — avoids browser Date() quirks.
 */
function toTime(dateStr: string, hourly: boolean): string | number {
  if (!hourly) {
    // "2025-05-30" — return as-is, lc treats it as a business day
    return dateStr.slice(0, 10)
  }
  // "2025-05-30 14:00" or "2025-05-30" (XGBoost/LSTM predictions have no time part)
  const [datePart, timePart = '00:00'] = dateStr.split(' ')
  const [y, m, d]  = datePart.split('-').map(Number)
  const [hr, min]  = timePart.split(':').map(Number)
  return Math.floor(new Date(y, m - 1, d, hr, min, 0).getTime() / 1000)
}

function fmtTs(raw: unknown, hourly: boolean): string {
  if (!hourly) return String(raw)          // raw is already "YYYY-MM-DD"
  const d = new Date((raw as number) * 1000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Crosshair {
  time?: string; open?: number; high?: number; low?: number
  close?: number; forecast?: number; isUp?: boolean
}

export interface FinancialChartProps {
  history: OHLCVPoint[]
  predictions: ForecastPoint[]
  confidenceInterval?: ConfidencePoint[] | null
  forecastColor?: string
  interval: '1d' | '1h'
  ticker: string
  width: number
  height: number
  onLiveUpdate?: (pt: OHLCVPoint) => void
}

const RANGES = [
  { label: '1Т', days: 7 }, { label: '1М', days: 30 },
  { label: '3М', days: 90 }, { label: '6М', days: 180 }, { label: '1Р', days: 365 },
]

// ─── Component ───────────────────────────────────────────────────────────────

export default function FinancialChart({
  history, predictions, confidenceInterval,
  forecastColor = '#e5e5e5', interval, ticker,
  width, height, onLiveUpdate,
}: FinancialChartProps) {
  const hourly      = interval === '1h'
  const hourlyRef   = useRef(hourly)
  hourlyRef.current = hourly

  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef     = useRef<ReturnType<typeof createChart> | null>(null)
  const candleRef    = useRef<any>(null)
  const volRef       = useRef<any>(null)
  const fcRef        = useRef<any>(null)
  const upperRef     = useRef<any>(null)
  const lowerRef     = useRef<any>(null)
  const readyRef     = useRef(false)
  const pendingRef   = useRef<{ h: OHLCVPoint[]; p: ForecastPoint[]; ci: typeof confidenceInterval } | null>(null)

  const [ch, setCh]               = useState<Crosshair>({})
  const [activeRange, setRange]   = useState<number | null>(null)
  const [pulse, setPulse]         = useState(false)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null)

  // ─── Write data ───────────────────────────────────────────────────────────
  const applyData = useCallback((h: OHLCVPoint[], p: ForecastPoint[], ci: ConfidencePoint[]|null|undefined, hr: boolean) => {
    if (!h.length) return

    // Guard: if data format doesn't match the expected interval mode, skip.
    // Hourly dates contain a space ("2025-05-30 14:00"), daily don't ("2025-05-30").
    const dataIsHourly = h[0].date.includes(' ')
    if (dataIsHourly !== hr) return   // old data from previous interval — ignore

    candleRef.current?.setData(h.map(pt => ({ time: toTime(pt.date, hr), open: pt.open, high: pt.high, low: pt.low, close: pt.close })))
    volRef.current?.setData(h.map(pt => ({ time: toTime(pt.date, hr), value: pt.volume, color: pt.close >= pt.open ? '#1a3025' : '#301a1a' })))
    fcRef.current?.setData(p.map(pt => ({ time: toTime(pt.date, hr), value: pt.price })))
    if (ci?.length) {
      upperRef.current?.setData(ci.map(pt => ({ time: toTime(pt.date, hr), value: pt.upper })))
      lowerRef.current?.setData(ci.map(pt => ({ time: toTime(pt.date, hr), value: pt.lower })))
    } else {
      upperRef.current?.setData([])
      lowerRef.current?.setData([])
    }
    chartRef.current?.timeScale().fitContent()
    setRange(null)
  }, [])

  // ─── Init chart ONCE with explicit px dimensions ──────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el || !width || !height) return

    console.log(`[Chart] init ${width}×${height}`)

    const chart = createChart(el, {
      width,
      height,
      layout: {
        background: { type: ColorType.Solid, color: '#0a0a0a' },
        textColor: '#555555',
        fontSize: 11,
        fontFamily: 'Inter, system-ui, sans-serif',
      },
      grid: { vertLines: { color: '#141414' }, horzLines: { color: '#141414' } },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#2a2a2a', style: LineStyle.Solid, width: 1, labelBackgroundColor: '#111' },
        horzLine: { color: '#2a2a2a', style: LineStyle.Solid, width: 1, labelBackgroundColor: '#111' },
      },
      rightPriceScale: { borderColor: '#1a1a1a', scaleMargins: { top: 0.06, bottom: 0.22 } },
      leftPriceScale:  { visible: false },
      timeScale: { borderColor: '#1a1a1a', timeVisible: hourlyRef.current, secondsVisible: false, rightOffset: 8 },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true },
      handleScale:  { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
    })

    const candle = chart.addSeries(CandlestickSeries, {
      upColor: '#4ade80', downColor: '#f87171',
      borderUpColor: '#4ade80', borderDownColor: '#f87171',
      wickUpColor: '#4ade80', wickDownColor: '#f87171',
    })

    const vol = chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: '' })
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })

    const fc = chart.addSeries(LineSeries, {
      color: forecastColor, lineWidth: 2, lineStyle: LineStyle.Dashed,
      crosshairMarkerVisible: true, crosshairMarkerRadius: 4,
      lastValueVisible: true, priceLineVisible: false,
    })
    const upper = chart.addSeries(LineSeries, { color: '#252525', lineWidth: 1, lineStyle: LineStyle.SparseDotted, crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false })
    const lower = chart.addSeries(LineSeries, { color: '#252525', lineWidth: 1, lineStyle: LineStyle.SparseDotted, crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false })

    chartRef.current = chart; candleRef.current = candle; volRef.current = vol
    fcRef.current = fc; upperRef.current = upper; lowerRef.current = lower
    readyRef.current = true

    chart.subscribeCrosshairMove(param => {
      if (!param.time || !param.point) { setCh({}); return }
      const cd = param.seriesData.get(candle) as any
      const fd = param.seriesData.get(fc) as any
      if (cd) setCh({ time: fmtTs(param.time, hourlyRef.current), open: cd.open, high: cd.high, low: cd.low, close: cd.close, isUp: cd.close >= cd.open, forecast: fd?.value })
      else if (fd) setCh({ time: fmtTs(param.time, hourlyRef.current), forecast: fd.value })
      else setCh({})
    })

    if (pendingRef.current) {
      const { h, p, ci } = pendingRef.current
      applyData(h, p, ci, hourlyRef.current)
      pendingRef.current = null
    }

    return () => {
      chart.remove()
      chartRef.current = candleRef.current = volRef.current =
        fcRef.current = upperRef.current = lowerRef.current = null
      readyRef.current = false
    }
  }, []) // eslint-disable-line

  // Resize when parent changes dimensions
  useEffect(() => {
    if (chartRef.current && width && height) {
      chartRef.current.applyOptions({ width, height })
    }
  }, [width, height])

  // Sync data
  useEffect(() => {
    if (!readyRef.current) { pendingRef.current = { h: history, p: predictions, ci: confidenceInterval }; return }
    applyData(history, predictions, confidenceInterval, hourly)
  }, [history, predictions, confidenceInterval, hourly, applyData])

  // Sync interval display
  useEffect(() => { chartRef.current?.applyOptions({ timeScale: { timeVisible: hourly } }) }, [hourly])

  // Sync forecast color
  useEffect(() => { fcRef.current?.applyOptions({ color: forecastColor }) }, [forecastColor])

  // Live polling
  const doLive = useCallback((pt: OHLCVPoint) => {
    const t = toTime(pt.date, hourlyRef.current)
    candleRef.current?.update({ time: t, open: pt.open, high: pt.high, low: pt.low, close: pt.close })
    volRef.current?.update({ time: t, value: pt.volume, color: pt.close >= pt.open ? '#1a3025' : '#301a1a' })
    setPulse(true); setUpdatedAt(new Date()); onLiveUpdate?.(pt)
    setTimeout(() => setPulse(false), 600)
  }, [onLiveUpdate])

  useEffect(() => {
    if (!ticker) return
    const id = setInterval(async () => {
      try { const r = await fetch(`/api/forecast/${ticker}/live?interval=${interval}`); if (r.ok) doLive(await r.json()) } catch {}
    }, 30_000)
    return () => clearInterval(id)
  }, [ticker, interval, doLive])

  const applyRange = (days: number, idx: number) => {
    if (!chartRef.current) return
    const now = Math.floor(Date.now() / 1000)
    chartRef.current.timeScale().setVisibleRange({ from: now - days * 86400, to: now } as any)
    setRange(idx)
  }

  const lastBar  = history[history.length - 1]
  const firstBar = history[0]
  const pct = (lastBar && firstBar?.close) ? ((lastBar.close - firstBar.close) / firstBar.close) * 100 : null

  return (
    <div style={{ position: 'relative', width, height }}>

      {/* Canvas */}
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      {/* OHLCV top-left */}
      <div style={{ position: 'absolute', top: 8, left: 12, zIndex: 10 }} className="flex items-center gap-3 flex-wrap pointer-events-none select-none">
        {ch.time ? (
          <>
            <span className="text-[10px] text-[#444] font-mono">{ch.time}</span>
            {ch.open != null && (<>
              <span className="text-[11px] text-[#555]">O <span className="font-mono text-[#ccc]">{ch.open.toFixed(2)}</span></span>
              <span className="text-[11px] text-[#555]">H <span className="font-mono text-[#4ade80]">{ch.high?.toFixed(2)}</span></span>
              <span className="text-[11px] text-[#555]">L <span className="font-mono text-[#f87171]">{ch.low?.toFixed(2)}</span></span>
              <span className="text-[11px] text-[#555]">C <span className={`font-mono ${ch.isUp ? 'text-[#4ade80]' : 'text-[#f87171]'}`}>{ch.close?.toFixed(2)}</span></span>
            </>)}
            {ch.forecast != null && <span className="text-[11px] text-[#555]">ML <span className="font-mono" style={{ color: forecastColor }}>{ch.forecast.toFixed(2)}</span></span>}
          </>
        ) : lastBar ? (
          <>
            <span className="text-sm font-semibold text-white font-mono">${lastBar.close.toFixed(2)}</span>
            {pct != null && <span className={`text-xs font-semibold font-mono ${pct >= 0 ? 'text-[#4ade80]' : 'text-[#f87171]'}`}>{pct >= 0 ? '+' : ''}{pct.toFixed(2)}%</span>}
            <span className="flex items-center gap-1 text-[10px] text-[#333]">
              <span className={`w-1.5 h-1.5 rounded-full transition-all ${pulse ? 'bg-[#4ade80] scale-150' : 'bg-[#252525]'}`} />
              {updatedAt ? `${Math.round((Date.now() - updatedAt.getTime()) / 1000)}с` : 'live'}
            </span>
          </>
        ) : null}
      </div>

      {/* Range buttons top-right */}
      <div style={{ position: 'absolute', top: 6, right: 12, zIndex: 10 }} className="flex gap-0.5">
        {RANGES.map((r, i) => (
          <button key={r.label} onClick={() => applyRange(r.days, i)}
            className={`px-2 py-1 text-[11px] rounded font-medium transition-colors ${activeRange === i ? 'bg-white text-[#0a0a0a]' : 'text-[#444] hover:text-white hover:bg-[#1a1a1a]'}`}>
            {r.label}
          </button>
        ))}
        <button onClick={() => { chartRef.current?.timeScale().fitContent(); setRange(null) }}
          className="px-2 py-1 text-[11px] rounded text-[#333] hover:text-white hover:bg-[#1a1a1a] transition-colors">
          Все
        </button>
      </div>

      {/* Legend bottom-left */}
      <div style={{ position: 'absolute', bottom: 40, left: 12, zIndex: 10 }} className="flex items-center gap-4 pointer-events-none select-none">
        <span className="flex items-center gap-1 text-[10px] text-[#2a2a2a]"><span className="w-2 h-2 bg-[#4ade80] rounded-sm"/>Зростання</span>
        <span className="flex items-center gap-1 text-[10px] text-[#2a2a2a]"><span className="w-2 h-2 bg-[#f87171] rounded-sm"/>Падіння</span>
        <span className="flex items-center gap-1 text-[10px] text-[#2a2a2a]"><span className="w-5 border-b-2 border-dashed" style={{ borderColor: forecastColor }}/>ML прогноз</span>
      </div>
    </div>
  )
}
