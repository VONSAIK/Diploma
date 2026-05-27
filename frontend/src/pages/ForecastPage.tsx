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

const DAILY_STEPS  = [7, 14, 30, 60, 90]
const HOURLY_STEPS = [12, 24, 48]

export default function ForecastPage() {
  const [ticker, setTicker]     = useState('AAPL')
  const [steps, setSteps]       = useState(30)
  const [model, setModel]       = useState<'arima' | 'lstm' | 'xgboost'>('arima')
  const [interval, setInterval] = useState<'1d' | '1h'>('1d')
  const { data, loading, error, run } = useAsync<ForecastResponse>()

  const isHourly = interval === '1h'

  const handleIntervalChange = (val: '1d' | '1h') => {
    setInterval(val)
    // xgboost/lstm підтримують лише денний режим
    if (val === '1h' && model !== 'arima') setModel('arima')
    setSteps(val === '1h' ? 24 : 30)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    run(forecastApi.get(ticker.toUpperCase(), steps, model, interval))
  }

  const chartData = data?.predictions.map((p, i) => ({
    date: p.date,
    price: p.price,
    lower: data.confidence_interval?.[i]?.lower,
    upper: data.confidence_interval?.[i]?.upper,
  })) ?? []

  // Форматуємо мітку осі X залежно від інтервалу
  const formatXTick = (val: string) => {
    if (isHourly) return val.slice(11, 16)  // "HH:MM"
    return val.slice(5)                      // "MM-DD"
  }

  const formatTooltipLabel = (label: string) => {
    if (isHourly) return label  // повна дата + час
    return label                // повна дата
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Прогноз цін акцій</h1>
        <p className="text-gray-400 text-sm mt-1">ARIMA · XGBoost · LSTM — денний та погодинний прогноз</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Рядок 1: тікер + інтервал + кроки + модель + кнопка */}
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Тікер</label>
              <input
                value={ticker}
                onChange={e => setTicker(e.target.value.toUpperCase())}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm w-24 focus:outline-none focus:border-blue-500"
                placeholder="AAPL"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Інтервал</label>
              <div className="flex rounded-lg overflow-hidden border border-gray-700">
                {(['1d', '1h'] as const).map(iv => (
                  <button
                    key={iv}
                    type="button"
                    onClick={() => handleIntervalChange(iv)}
                    className={`px-3 py-2 text-sm font-medium transition-colors ${
                      interval === iv
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {iv === '1d' ? 'Денний' : 'Погодинний'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">
                {isHourly ? 'Годин' : 'Днів'}
              </label>
              <select
                value={steps}
                onChange={e => setSteps(Number(e.target.value))}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              >
                {(isHourly ? HOURLY_STEPS : DAILY_STEPS).map(s => (
                  <option key={s} value={s}>
                    {s} {isHourly ? 'год' : 'дн'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Модель</label>
              <select
                value={model}
                onChange={e => setModel(e.target.value as 'arima' | 'lstm' | 'xgboost')}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="arima">ARIMA</option>
                {!isHourly && <option value="xgboost">XGBoost (ML)</option>}
                {!isHourly && <option value="lstm">LSTM (Deep Learning)</option>}
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {loading ? 'Обробка...' : 'Прогноз'}
            </button>
          </div>

          {/* Швидкий вибір тікера */}
          <div className="flex flex-wrap gap-2">
            {POPULAR.map(t => (
              <button
                key={t}
                type="button"
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
        </form>
      </Card>

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg px-4 py-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="space-y-2">
          <Spinner />
          {model === 'xgboost' && (
            <p className="text-center text-gray-500 text-sm">
              XGBoost тренується на технічних індикаторах...
            </p>
          )}
          {model === 'lstm' && (
            <p className="text-center text-gray-500 text-sm">
              LSTM навчається на часовому ряді...
            </p>
          )}
        </div>
      )}

      {data && (
        <>
          <Card title={`${data.ticker} — ${data.model.toUpperCase()} · ${isHourly ? 'Погодинний' : 'Денний'} прогноз · ${steps} ${isHourly ? 'годин' : 'днів'}`}>
            <ResponsiveContainer width="100%" height={360}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                  tickFormatter={formatXTick}
                  interval={isHourly ? 3 : 'preserveStartEnd'}
                />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                  labelStyle={{ color: '#9ca3af' }}
                  labelFormatter={formatTooltipLabel}
                  formatter={(val: number) => [`$${val.toFixed(2)}`, '']}
                />
                <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
                {data.confidence_interval && (
                  <>
                    <Line dataKey="upper" stroke="#1d4ed8" strokeWidth={1} dot={false} strokeDasharray="4 2" name="Верхня межа" />
                    <Line dataKey="lower" stroke="#1d4ed8" strokeWidth={1} dot={false} strokeDasharray="4 2" name="Нижня межа" />
                  </>
                )}
                <Line dataKey="price" stroke="#3b82f6" strokeWidth={2} dot={false} name="Прогноз ціни" />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {data.metrics && (
            <Card title="Метрики ML моделі">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.metrics.cv_mape !== undefined && (
                  <div className="bg-gray-800 rounded-lg p-3">
                    <div className="text-xs text-gray-400 mb-1">Cross-Validation MAPE</div>
                    <div className="text-2xl font-bold text-blue-400">
                      {(data.metrics.cv_mape as number).toFixed(2)}%
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Середня абсолютна похибка — 5-fold TimeSeriesSplit
                    </div>
                  </div>
                )}
                {data.metrics.feature_importance && (
                  <div className="bg-gray-800 rounded-lg p-3">
                    <div className="text-xs text-gray-400 mb-2">Топ ознаки (Feature Importance)</div>
                    {Object.entries(data.metrics.feature_importance as Record<string, number>)
                      .slice(0, 5)
                      .map(([feat, imp]) => (
                        <div key={feat} className="flex items-center gap-2 mb-1">
                          <div className="text-xs text-gray-300 w-28 truncate">{feat}</div>
                          <div className="flex-1 bg-gray-700 rounded-full h-1.5">
                            <div
                              className="bg-blue-500 h-1.5 rounded-full"
                              style={{ width: `${Math.min((imp * 100), 100).toFixed(0)}%` }}
                            />
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
