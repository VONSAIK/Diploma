import { useState, useRef, useEffect } from 'react'
import { ASSETS, CATEGORIES, type Category } from '../../data/assets'

interface MultiAssetSelectorProps {
  selected: string[]
  onChange: (tickers: string[]) => void
  max?: number
}

export default function MultiAssetSelector({ selected, onChange, max = 15 }: MultiAssetSelectorProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<Category | 'Всі'>('Всі')
  const ref = useRef<HTMLDivElement>(null)

  const filtered = ASSETS.filter(a => {
    const matchCat = category === 'Всі' || a.category === category
    const q = search.toLowerCase()
    return matchCat && (!q || a.ticker.toLowerCase().includes(q) || a.name.toLowerCase().includes(q))
  })

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggle = (ticker: string) => {
    if (selected.includes(ticker)) {
      onChange(selected.filter(t => t !== ticker))
    } else if (selected.length < max) {
      onChange([...selected, ticker])
    }
  }

  return (
    <div ref={ref} className="relative">
      {/* Обрані активи */}
      <div
        onClick={() => setOpen(v => !v)}
        className="min-h-[42px] flex flex-wrap gap-1.5 bg-gray-800 border border-gray-700 hover:border-gray-500 rounded-lg px-3 py-2 cursor-pointer transition-colors"
      >
        {selected.length === 0 && (
          <span className="text-gray-500 text-sm self-center">Оберіть активи...</span>
        )}
        {selected.map(t => (
          <span key={t}
            className="flex items-center gap-1 bg-blue-900/50 border border-blue-700 text-blue-300 text-xs px-2 py-0.5 rounded-md"
          >
            <span className="font-mono">{t}</span>
            <button type="button" onClick={e => { e.stopPropagation(); toggle(t) }}
              className="text-blue-400 hover:text-white ml-0.5">×</button>
          </span>
        ))}
        <span className="text-gray-600 text-xs self-center ml-auto">
          {selected.length}/{max} ▾
        </span>
      </div>

      {open && (
        <div className="absolute z-50 top-full mt-1 w-full min-w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-gray-800">
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Пошук тікера або назви..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex gap-1 p-2 border-b border-gray-800 overflow-x-auto">
            {(['Всі', ...CATEGORIES] as const).map(cat => (
              <button key={cat} type="button" onClick={() => setCategory(cat as Category | 'Всі')}
                className={`flex-shrink-0 text-xs px-2 py-1 rounded-md transition-colors ${category === cat ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                {cat}
              </button>
            ))}
          </div>
          <div className="max-h-56 overflow-y-auto">
            {filtered.map(asset => {
              const isSelected = selected.includes(asset.ticker)
              return (
                <button key={asset.ticker} type="button" onClick={() => toggle(asset.ticker)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-800 transition-colors text-left ${isSelected ? 'bg-blue-950/30' : ''}`}
                >
                  <span className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center text-xs ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-600'}`}>
                    {isSelected ? '✓' : ''}
                  </span>
                  <span className="font-mono text-blue-400 w-16 flex-shrink-0">{asset.ticker}</span>
                  <span className="text-gray-300 flex-1 truncate">{asset.name}</span>
                  <span className="text-gray-600 text-xs">{asset.category}</span>
                </button>
              )
            })}
          </div>
          {selected.length >= max && (
            <div className="px-3 py-2 text-xs text-yellow-500 border-t border-gray-800">
              Максимум {max} активів
            </div>
          )}
        </div>
      )}
    </div>
  )
}
