import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use(config => {
  const stored = localStorage.getItem('auth_user')
  if (stored) {
    const { access_token } = JSON.parse(stored)
    config.headers.Authorization = `Bearer ${access_token}`
  }
  return config
})

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('auth_user')
      delete axios.defaults.headers.common['Authorization']
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export interface OHLCVPoint {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface ForecastPoint {
  date: string
  price: number
}

export interface ConfidencePoint {
  date: string
  lower: number
  upper: number
}

export interface ForecastResponse {
  ticker: string
  model: string
  interval: string
  history: OHLCVPoint[]
  predictions: ForecastPoint[]
  confidence_interval: ConfidencePoint[] | null
  metrics: { cv_mape?: number; feature_importance?: Record<string, number> } | null
}

export interface PortfolioRequest {
  tickers: string[]
  risk_tolerance: 'low' | 'medium' | 'high'
  portfolio_value: number
}

export interface PortfolioResponse {
  weights: Record<string, number>
  expected_annual_return: number
  annual_volatility: number
  sharpe_ratio: number
  allocation: Record<string, number>
  leftover_cash: number
  efficient_frontier: { volatility: number; return: number; sharpe: number }[]
}

export interface SentimentResponse {
  ticker: string
  company: string
  signal: 'positive' | 'negative' | 'neutral'
  score: number
  count: number
  breakdown: { positive: number; negative: number; neutral: number }
  articles: {
    title: string
    url: string
    published_at: string
    source: string
    sentiment: string
    confidence: number
  }[]
  note?: string
}

export interface AdvisorRequest {
  portfolio: Record<string, number>
  risk_tolerance: 'low' | 'medium' | 'high'
  portfolio_metrics?: Record<string, number>
  sentiment_signals?: Record<string, string>
  forecast_signals?: Record<string, number>
  question?: string
}

export interface AdvisorResponse {
  recommendation: string
  key_insights: string[]
  risks: string[]
  model: string
}

export const forecastApi = {
  get: (ticker: string, steps: number, model: string, interval: string = '1d') =>
    api.get<ForecastResponse>(`/forecast/${ticker}`, { params: { steps, model, interval } }),
  getLive: (ticker: string, interval: string = '1d') =>
    api.get<OHLCVPoint>(`/forecast/${ticker}/live`, { params: { interval } }),
}

export const portfolioApi = {
  optimize: (data: PortfolioRequest) =>
    api.post<PortfolioResponse>('/portfolio/optimize', data),
}

export interface SavedPortfolio {
  id: number
  name: string
  tickers: string[]
  risk_tolerance: string
  portfolio_value: number
  weights: Record<string, number> | null
  metrics: Record<string, number> | null
  created_at: string
}

export const savedPortfoliosApi = {
  list: () => api.get<SavedPortfolio[]>('/portfolios/'),
  save: (data: {
    name: string
    tickers: string[]
    risk_tolerance: string
    portfolio_value: number
    weights?: Record<string, number>
    metrics?: Record<string, number>
  }) => api.post<SavedPortfolio>('/portfolios/', data),
  delete: (id: number) => api.delete(`/portfolios/${id}`),
}

export const sentimentApi = {
  get: (ticker: string, days: number) =>
    api.get<SentimentResponse>(`/sentiment/${ticker}`, { params: { days } }),
}

export const advisorApi = {
  recommend: (data: AdvisorRequest) =>
    api.post<AdvisorResponse>('/advisor/recommend', data),
}

export interface AdvisorHistoryItem {
  id: number
  portfolio_label: string
  portfolio_weights: Record<string, number>
  risk_tolerance: string
  question: string
  recommendation: string
  key_insights: string[]
  risks: string[]
  model_used: string
  created_at: string
}

export const advisorHistoryApi = {
  list: () => api.get<AdvisorHistoryItem[]>('/advisor/history'),
  deleteOne: (id: number) => api.delete(`/advisor/history/${id}`),
  clearAll: () => api.delete('/advisor/history'),
}

export function extractErrorMessage(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  if (!detail) return fallback
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail.length > 0) {
    const msg = (detail[0] as { msg?: string })?.msg ?? fallback
    // Pydantic v2 prefixes messages with "Value error, " — clean that up
    return msg.replace(/^[Vv]alue error,\s*/i, '')
  }
  return fallback
}

