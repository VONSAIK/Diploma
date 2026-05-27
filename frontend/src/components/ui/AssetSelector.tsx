import { useState, useRef, useEffect } from 'react'
import { ASSETS, CATEGORIES, type Category } from '../../data/assets'

interface AssetSelectorProps {
  value: string
  onChange: (ticker: string) => void
}

export default function AssetSelector({ value, onChange }: AssetSelectorProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<Category | 'Всі'>('Всі')
  const ref = useRef<HTMLDivElement>(null)

  const currentAsset = ASSETS.find(a => a.ticker === value)

  const filtered = ASSETS.filter(a => {
    const matchCat = category === 'Всі' || a.category === category
    const q = search.toLowerCase()
    const matchSearch = !q || a.ticker.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
    return matchCat && matchSearch
  })

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const select = (ticker: string) => {
    onChange(ticker)
    setOpen(false)
    setSearch('')
  }

  return (
    <div ref={ref} className="relative">
      <label className="block text-xs text-gray-400 mb-1">Актив</label>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 bg-gray-800 border border-gray-700 hover:border-gray-500 rounded-lg px-3 py-2 text-sm w-52 text-left transition-colors focus:outline-none focus:border-blue-500"
      >
        <span className="flex-1 truncate">
          <span className="font-mono text-blue-400">{value}</span>
          {currentAsset && <span className="text-gray-400 ml-1.5 text-xs">{currentAsset.name}</span>}
        </span>
        <span className="text-gray-500 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
          {/* Пошук */}
          <div className="p-2 border-b border-gray-800">
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Пошук тікера або назви..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Фільтр категорій */}
          <div className="flex gap-1 p-2 border-b border-gray-800 overflow-x-auto">
            {(['Всі', ...CATEGORIES] as const).map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat as Category | 'Всі')}
                className={`flex-shrink-0 text-xs px-2 py-1 rounded-md transition-colors ${
                  category === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Список активів */}
          <div className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="text-center text-gray-500 text-sm py-4">Нічого не знайдено</div>
            ) : (
              filtered.map(asset => (
                <button
                  key={asset.ticker}
                  type="button"
                  onClick={() => select(asset.ticker)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-800 transition-colors text-left ${
                    asset.ticker === value ? 'bg-blue-950/40' : ''
                  }`}
                >
                  <span className="font-mono text-blue-400 w-16 flex-shrink-0">{asset.ticker}</span>
                  <span className="text-gray-300 flex-1 truncate">{asset.name}</span>
                  <span className="text-gray-600 text-xs">{asset.category}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
