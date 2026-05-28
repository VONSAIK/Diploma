import { useState } from 'react'
import { advisorApi, AdvisorResponse } from '../services/api'
import { useAsync } from '../hooks/useAsync'
import Card from '../components/ui/Card'
import Spinner from '../components/ui/Spinner'

export default function AdvisorPage() {
  const [portfolio, setPortfolio] = useState('AAPL:0.3, MSFT:0.3, GOOGL:0.2, NVDA:0.2')
  const [risk, setRisk] = useState<'low' | 'medium' | 'high'>('medium')
  const [question, setQuestion] = useState('')
  const { data, loading, error, run } = useAsync<AdvisorResponse>()

  const parsePortfolio = (input: string): Record<string, number> => {
    return Object.fromEntries(
      input.split(',').map(p => {
        const [ticker, w] = p.trim().split(':')
        return [ticker.trim().toUpperCase(), parseFloat(w) || 0]
      }).filter(([t, w]) => t && (w as number) > 0)
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const portfolioObj = parsePortfolio(portfolio)
    run(advisorApi.recommend({
      portfolio: portfolioObj,
      risk_tolerance: risk,
      question: question.trim(),
    }))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Радник</h1>
        <p className="text-gray-400 text-sm mt-1">Персональні рекомендації на основі Gemini AI</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Портфель (тікер:вага, ...)</label>
            <input
              value={portfolio}
              onChange={e => setPortfolio(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
              placeholder="AAPL:0.3, MSFT:0.3, GOOGL:0.4"
            />
            <p className="text-xs text-gray-600 mt-1">Суми ваг мають дорівнювати 1.0</p>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Ризик-профіль</label>
            <div className="flex rounded-lg overflow-hidden border border-gray-700 w-fit">
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
            <label className="block text-xs text-gray-400 mb-1">Питання (необов'язково)</label>
            <textarea
              value={question}
              onChange={e => setQuestion(e.target.value)}
              rows={2}
              maxLength={500}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"
              placeholder="Чи варто зараз додати золото до портфеля?"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? 'Аналізую...' : 'Отримати рекомендацію'}
          </button>
        </form>
      </Card>

      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-lg px-4 py-3 text-red-400 text-sm">{error}</div>
      )}

      {loading && (
        <div className="space-y-3">
          <Spinner />
          <p className="text-center text-gray-500 text-sm">Gemini аналізує ваш портфель...</p>
        </div>
      )}

      {data && (
        <div className="space-y-4">
          <Card title="Рекомендація">
            <p className="text-gray-200 leading-relaxed">{data.recommendation}</p>
          </Card>

          {data.key_insights.length > 0 && (
            <Card title="Ключові інсайти">
              <ul className="space-y-2">
                {data.key_insights.map((insight, i) => (
                  <li key={i} className="flex gap-3 text-sm text-gray-300">
                    <span className="text-blue-400 mt-0.5 flex-shrink-0">→</span>
                    {insight}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {data.risks.length > 0 && (
            <Card title="Ризики">
              <ul className="space-y-2">
                {data.risks.map((risk, i) => (
                  <li key={i} className="flex gap-3 text-sm text-gray-300">
                    <span className="text-yellow-400 mt-0.5 flex-shrink-0">⚠</span>
                    {risk}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <div className="flex justify-end">
            <span className={`text-xs px-2 py-1 rounded-md border ${
              data.model.includes('gemini')
                ? 'border-blue-700 text-blue-400 bg-blue-950/30'
                : 'border-gray-700 text-gray-500'
            }`}>
              {data.model.includes('gemini') ? `✦ Powered by ${data.model}` : 'rule-based аналіз'}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
