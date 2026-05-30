import { useState, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { extractErrorMessage } from '../services/api'

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Паролі не співпадають'); return }
    if (password.length < 6) { setError('Пароль має бути мінімум 6 символів'); return }
    setLoading(true)
    try {
      await register(email, password)
      navigate('/')
    } catch (err: unknown) {
      setError(extractErrorMessage(err, 'Помилка реєстрації'))
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
          <div className="space-y-4 text-[#333333] text-sm">
            <div className="flex items-start gap-3">
              <div className="w-1 h-1 rounded-full bg-[#444444] mt-2 flex-shrink-0" />
              <span>ML-прогнозування цін (ARIMA, XGBoost, LSTM)</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-1 h-1 rounded-full bg-[#444444] mt-2 flex-shrink-0" />
              <span>Оптимізація портфеля за Марковіцем</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-1 h-1 rounded-full bg-[#444444] mt-2 flex-shrink-0" />
              <span>Аналіз новин через FinBERT sentiment</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-1 h-1 rounded-full bg-[#444444] mt-2 flex-shrink-0" />
              <span>AI-рекомендації на базі Gemini 2.5 Flash</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-8">
        <div className="w-full max-w-[360px]">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-white tracking-tight">Реєстрація</h1>
            <p className="text-[#555555] text-sm mt-1.5">Створіть новий акаунт</p>
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
                placeholder="мінімум 6 символів"
              />
            </div>

            <div>
              <label className="block text-xs text-[#555555] mb-1.5 font-medium">Підтвердження пароля</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
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
              {loading ? 'Реєстрація...' : 'Зареєструватись'}
            </button>
          </form>

          <p className="text-center text-[#444444] text-xs mt-6">
            Вже є акаунт?{' '}
            <Link to="/login" className="text-[#888888] hover:text-white transition-colors">
              Увійти
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
