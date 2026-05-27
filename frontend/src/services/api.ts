import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

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
  get: (ticker: string, days: number, model: string) =>
    api.get<ForecastResponse>(`/forecast/${ticker}`, { params: { days, model } }),
}

export const portfolioApi = {
  optimize: (data: PortfolioRequest) =>
    api.post<PortfolioResponse>('/portfolio/optimize', data),
}

export const sentimentApi = {
  get: (ticker: string, days: number) =>
    api.get<SentimentResponse>(`/sentiment/${ticker}`, { params: { days } }),
}

export const advisorApi = {
  recommend: (data: AdvisorRequest) =>
    api.post<AdvisorResponse>('/advisor/recommend', data),
}
