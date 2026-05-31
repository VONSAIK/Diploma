import { useEffect } from 'react'
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import ForecastPage from './pages/ForecastPage'
import PortfolioPage from './pages/PortfolioPage'
import SentimentPage from './pages/SentimentPage'
import AdvisorPage from './pages/AdvisorPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'

function IconForecast() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  )
}

function IconPortfolio() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  )
}

function IconNews() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  )
}

function IconAdvisor() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4l3 3" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

const navItems = [
  { to: '/',          label: 'Прогноз',  icon: <IconForecast /> },
  { to: '/portfolio', label: 'Портфель', icon: <IconPortfolio /> },
  { to: '/sentiment', label: 'Новини',   icon: <IconNews /> },
  { to: '/advisor',   label: 'AI Радник', icon: <IconAdvisor /> },
]

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const location = useLocation()
  if (isLoading) return null
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  return <>{children}</>
}

function Sidebar() {
  const { user, logout } = useAuth()

  return (
    <aside className="fixed inset-y-0 left-0 w-[220px] flex flex-col bg-[#0f0f0f] border-r border-[#1a1a1a] z-40">
      {/* Logo */}
      <div className="h-[60px] flex items-center px-5 border-b border-[#1a1a1a] flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-white rounded-md flex items-center justify-center flex-shrink-0">
            <span className="text-black text-[9px] font-black tracking-tight leading-none">INV</span>
          </div>
          <span className="font-semibold text-[13px] text-white tracking-tight">Investment AI</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-px overflow-y-auto">
        <p className="text-[10px] text-[#333333] uppercase tracking-widest px-3 pt-1 pb-2 font-medium">
          Навігація
        </p>
        {navItems.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all ${
                isActive
                  ? 'bg-white text-[#0a0a0a]'
                  : 'text-[#555555] hover:text-[#cccccc] hover:bg-[#181818]'
              }`
            }
          >
            <span className="w-4 h-4 flex-shrink-0">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="px-3 pb-4 flex-shrink-0">
        <div className="px-3 py-3 rounded-lg bg-[#141414] border border-[#1e1e1e]">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-[#2a2a2a] flex items-center justify-center flex-shrink-0">
              <span className="text-[10px] text-[#888888] font-medium uppercase">
                {user?.email?.[0] ?? '?'}
              </span>
            </div>
            <div className="text-[11px] text-[#666666] truncate">{user?.email}</div>
          </div>
          <button
            onClick={logout}
            className="text-[11px] text-[#3a3a3a] hover:text-[#888888] transition-colors"
          >
            Вийти →
          </button>
        </div>
      </div>
    </aside>
  )
}

function PageWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-6xl mx-auto px-8 py-8 w-full">{children}</div>
  )
}

const PAGE_TITLES: Record<string, string> = {
  '/':          'Прогноз — Investment AI',
  '/portfolio': 'Портфель — Investment AI',
  '/sentiment': 'Новини — Investment AI',
  '/advisor':   'AI Радник — Investment AI',
}

function PageTitleSync() {
  const { pathname } = useLocation()
  useEffect(() => {
    document.title = PAGE_TITLES[pathname] ?? 'Investment AI'
  }, [pathname])
  return null
}

function Layout() {
  return (
    <div className="flex h-screen bg-[#0a0a0a] overflow-hidden">
      <PageTitleSync />
      <Sidebar />
      <main className="ml-[220px] flex-1 overflow-auto">
        <Routes>
          {/* Forecast: full-bleed, no wrapper */}
          <Route path="/" element={<ForecastPage />} />
          {/* Rest: centred with max-width */}
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/sentiment" element={<SentimentPage />} />
          <Route path="/advisor"   element={<AdvisorPage />} />
          <Route path="*" element={
            <div className="flex flex-col items-center justify-center h-screen text-center">
              <div className="text-7xl font-bold text-[#1a1a1a] mb-4 tracking-tight">404</div>
              <div className="text-[#444444] mb-6 text-sm">Сторінку не знайдено</div>
              <a href="/" className="text-[#888888] hover:text-white text-sm transition-colors">← На головну</a>
            </div>
          } />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login"    element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/*" element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        } />
      </Routes>
    </AuthProvider>
  )
}
