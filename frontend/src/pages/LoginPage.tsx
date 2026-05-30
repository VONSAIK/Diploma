import { useState, FormEvent } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { extractErrorMessage } from '../services/api'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (err: unknown) {
      setError(extractErrorMessage(err, 'Помилка входу'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-[#0a0a0a]">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] bg-[#0f0f0f] border-r border-[#1a1a1a] p-12 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-white rounded-md flex items-center justify-center">
            <span className="text-black text-[9px] font-black tracking-tight">INV</span>
          </div>
          <span className="font-semibold text-[13px] text-white">Investment AI</span>
        </div>
        <div>
          <blockquote className="text-[#444444] text-sm leading-relaxed mb-4">
            "ML-система аналізу фінансових ринків — прогнозування, оптимізація портфеля та AI-рекомендації в одному місці."
          </blockquote>
          <div className="flex gap-1 mt-8">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="w-8 h-1 rounded-full bg-[#1e1e1e]" />
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-8">
        <div className="w-full max-w-[360px]">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-white tracking-tight">Вхід</h1>
            <p className="text-[#555555] text-sm mt-1.5">Увійдіть до свого акаунту</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-[#555555] mb-1.5 font-medium">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full bg-[#111111] border border-[#222222] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#444444] placeholder:text-[#333333] transition-colors"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-xs text-[#555555] mb-1.5 font-medium">Пароль</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full bg-[#111111] border border-[#222222] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#444444] placeholder:text-[#333333] transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="bg-[#1a0a0a] border border-[#3a1515] rounded-lg px-3 py-2.5 text-[#f87171] text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white hover:bg-[#e5e5e5] disabled:opacity-40 text-[#0a0a0a] py-2.5 rounded-lg text-sm font-semibold transition-colors mt-2"
            >
              {loading ? 'Вхід...' : 'Увійти'}
            </button>
          </form>

          <p className="text-center text-[#444444] text-xs mt-6">
            Немає акаунту?{' '}
            <Link to="/register" className="text-[#888888] hover:text-white transition-colors">
              Зареєструватись
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
