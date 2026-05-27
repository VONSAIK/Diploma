import { Routes, Route, NavLink } from 'react-router-dom'
import ForecastPage from './pages/ForecastPage'
import PortfolioPage from './pages/PortfolioPage'
import SentimentPage from './pages/SentimentPage'
import AdvisorPage from './pages/AdvisorPage'

const navItems = [
  { to: '/',          label: 'Прогноз' },
  { to: '/portfolio', label: 'Портфель' },
  { to: '/sentiment', label: 'Новини' },
  { to: '/advisor',   label: 'AI Радник' },
]

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold text-blue-400">Investment AI</h1>
          <nav className="flex gap-1">
            {navItems.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
        <Routes>
          <Route path="/"          element={<ForecastPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/sentiment" element={<SentimentPage />} />
          <Route path="/advisor"   element={<AdvisorPage />} />
        </Routes>
      </main>
    </div>
  )
}
