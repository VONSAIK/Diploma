import { useState } from 'react'
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts'
import { forecastApi, ForecastResponse } from '../services/api'
import { useAsync } from '../hooks/useAsync'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'
import AssetSelector from '../components/ui/AssetSelector'

const DAILY_STEPS  = [7, 14, 30, 60, 90]
const HOURLY_STEPS = [12, 24, 48]

const MODEL_INFO: Record<string, { label: string; desc: string; color: string }> = {
  arima:    { label: 'ARIMA',           desc: 'Статистична модель часового ряду. Аналізує автокореляцію минулих цін. Краще для 7-14 днів.', color: '#f59e0b' },
  xgboost:  { label: 'XGBoost (ML)',    desc: 'Machine Learning — градієнтний бустинг на 18 технічних індикаторах (RSI, MACD, Bollinger Bands тощо).', color: '#10b981' },
  lstm:     { label: 'LSTM (Deep Learning)', desc: 'Рекурентна нейронна мережа. Вчиться на послідовностях цін, запам\'ятовує довгострокові патерни.', color: '#8b5cf6' },
}

export default function ForecastPage() {
  const [ticker, setTicker]     = useState('AAPL')
  const [steps, setSteps]       = useState(30)
  const [model, setModel]       = useState<'arima' | 'lstm' | 'xgboost'>('arima')
  const [interval, setInterval] = useState<'1d' | '1h'>('1d')
  const { data, loading, error, run } = useAsync<ForecastResponse>()

  const isHourly = interval === '1h'

  const handleIntervalChange = (val: '1d' | '1h') => {
    setInterval(val)
    if (val === '1h' && model !== 'arima') setModel('arima')
    setSteps(val === '1h' ? 24 : 30)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    run(forecastApi.get(ticker.toUpperCase(), steps, model, interval))
  }

  // Об'єднуємо реальну історію + прогноз на одному графіку
  const chartData = data ? [
    ...data.history.map(p => ({
      date: p.date,
      actual: p.price,
      forecast: undefined as number | undefined,
      lower: undefined as number | undefined,
      upper: undefined as number | undefined,
    })),
    ...data.predictions.map((p, i) => ({
      date: p.date,
      actual: undefined as number | undefined,
      forecast: p.price,
      lower: data.confidence_interval?.[i]?.lower,
      upper: data.confidence_interval?.[i]?.upper,
    })),
  ] : []

  // Дата розподілу між реальними і прогнозними даними
  const splitDate = data?.history[data.history.length - 1]?.date

  const formatXTick = (val: string) =>
    isHourly ? val.slice(11, 16) : val.slice(5)

  const modelInfo = MODEL_INFO[model]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Прогноз цін акцій</h1>
        <p className="text-gray-400 text-sm mt-1">ML-прогноз з відображенням реальної історії та майбутнього тренду</p>
      </div>

      {/* Форма */}
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <AssetSelector value={ticker} onChange={setTicker} />

            <div>
              <label className="block text-xs text-gray-400 mb-1">Інтервал</label>
              <div className="flex rounded-lg overflow-hidden border border-gray-700">
                {(['1d', '1h'] as const).map(iv => (
                  <button key={iv} type="button" onClick={() => handleIntervalChange(iv)}
                    className={`px-3 py-2 text-sm font-medium transition-colors ${interval === iv ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                    {iv === '1d' ? 'Денний' : 'Погодинний'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">{isHourly ? 'Годин' : 'Днів'}</label>
              <select value={steps} onChange={e => setSteps(Number(e.target.value))}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                {(isHourly ? HOURLY_STEPS : DAILY_STEPS).map(s => (
                  <option key={s} value={s}>{s} {isHourly ? 'год' : 'дн'}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Модель</label>
              <select value={model} onChange={e => setModel(e.target.value as 'arima' | 'lstm' | 'xgboost')}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                <option value="arima">ARIMA — статистична</option>
                {!isHourly && <option value="xgboost">XGBoost — ML</option>}
                {!isHourly && <option value="lstm">LSTM — Deep Learning</option>}
              </select>
            </div>

            <button type="submit" disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">
              {loading ? 'Обробка...' : 'Прогноз'}
            </button>
          </div>


          {/* Пояснення поточної моделі */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-3">
            <span className="text-xs font-semibold" style={{ color: modelInfo.color }}>
              {modelInfo.label}
            </span>
            <span className="text-xs text-gray-400 ml-2">{modelInfo.desc}</span>
          </div>
        </form>
      </Card>

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg px-4 py-3 text-red-400 text-sm">{error}</div>
      )}

      {loading && (
        <div className="space-y-2">
          <Spinner />
          <p className="text-center text-gray-500 text-sm">
            {model === 'xgboost' ? 'XGBoost тренується на технічних індикаторах...'
              : model === 'lstm' ? 'LSTM навчається на часовому ряді...'
              : 'ARIMA аналізує часовий ряд...'}
          </p>
        </div>
      )}

      {data && (
        <>
          <Card title={`${data.ticker} · ${MODEL_INFO[data.model]?.label} · Остання ціна: $${data.history[data.history.length - 1]?.price}`}>
            {/* Легенда пояснення */}
            <div className="flex gap-4 mb-4 text-xs text-gray-400">
              <span className="flex items-center gap-1.5">
                <span className="w-6 h-0.5 bg-gray-300 inline-block rounded" />
                Реальна ціна (останні {isHourly ? '48 год' : '60 днів'})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-6 h-0.5 inline-block rounded" style={{ background: MODEL_INFO[data.model]?.color }} />
                Прогноз ML ({steps} {isHourly ? 'годин' : 'днів'})
              </span>
              {data.confidence_interval && (
                <span className="flex items-center gap-1.5">
                  <span className="w-6 h-0.5 bg-blue-700 inline-block rounded opacity-60" />
                  Довірчий інтервал 80%
                </span>
              )}
            </div>

            <ResponsiveContainer width="100%" height={380}>
              <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                  tickFormatter={formatXTick}
                  interval={Math.floor(chartData.length / 8)}
                />
                <YAxis
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                  domain={['auto', 'auto']}
                  tickFormatter={v => `$${v}`}
                />
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                  labelStyle={{ color: '#6b7280', fontSize: 11 }}
                  formatter={(val: number, name: string) => {
                    const labels: Record<string, string> = {
                      actual: 'Реальна', forecast: 'Прогноз', upper: 'Верхня межа', lower: 'Нижня межа'
                    }
                    return [`$${val?.toFixed(2)}`, labels[name] || name]
                  }}
                />
                {/* Вертикальна лінія розділу реальне/прогноз */}
                {splitDate && (
                  <ReferenceLine x={splitDate} stroke="#374151" strokeDasharray="4 2"
                    label={{ value: 'Сьогодні', fill: '#6b7280', fontSize: 10, position: 'top' }} />
                )}
                {/* Довірчий інтервал */}
                {data.confidence_interval && (
                  <>
                    <Line dataKey="upper" stroke="#1d4ed8" strokeWidth={1} dot={false} strokeDasharray="3 2" legendType="none" />
                    <Line dataKey="lower" stroke="#1d4ed8" strokeWidth={1} dot={false} strokeDasharray="3 2" legendType="none" />
                  </>
                )}
                {/* Реальна ціна */}
                <Line dataKey="actual" stroke="#d1d5db" strokeWidth={1.5} dot={false} connectNulls={false} legendType="none" />
                {/* Прогноз */}
                <Line
                  dataKey="forecast"
                  stroke={MODEL_INFO[data.model]?.color || '#3b82f6'}
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                  legendType="none"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </Card>

          {data.metrics && (
            <Card title="Метрики ML моделі">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.metrics.cv_mape !== undefined && (
                  <div className="bg-gray-800 rounded-lg p-4">
                    <div className="text-xs text-gray-400 mb-1">Cross-Validation MAPE</div>
                    <div className="text-2xl font-bold text-green-400">
                      {(data.metrics.cv_mape as number).toFixed(2)}%
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Середня абсолютна похибка на 5-fold TimeSeriesSplit. Чим менше — тим краще.
                    </div>
                  </div>
                )}
                {data.metrics.feature_importance && (
                  <div className="bg-gray-800 rounded-lg p-4">
                    <div className="text-xs text-gray-400 mb-3">Важливість ознак (Feature Importance)</div>
                    {Object.entries(data.metrics.feature_importance as Record<string, number>)
                      .slice(0, 6)
                      .map(([feat, imp]) => (
                        <div key={feat} className="flex items-center gap-2 mb-1.5">
                          <div className="text-xs text-gray-300 w-28 truncate">{feat}</div>
                          <div className="flex-1 bg-gray-700 rounded-full h-1.5">
                            <div className="bg-green-500 h-1.5 rounded-full"
                              style={{ width: `${Math.min(imp * 100, 100).toFixed(0)}%` }} />
                          </div>
                          <div className="text-xs text-gray-400 w-10 text-right">
                            {(imp * 100).toFixed(1)}%
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
