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
      {/* Trigger */}
      <div
        onClick={() => setOpen(v => !v)}
        className="min-h-[42px] flex flex-wrap gap-1.5 bg-[#141414] border border-[#222222] hover:border-[#333333] rounded-lg px-3 py-2 cursor-pointer transition-colors"
      >
        {selected.length === 0 && (
          <span className="text-[#333333] text-sm self-center">Оберіть активи...</span>
        )}
        {selected.map(t => (
          <span
            key={t}
            className="flex items-center gap-1 bg-[#1e1e1e] border border-[#2a2a2a] text-[#cccccc] text-xs px-2 py-0.5 rounded-md"
          >
            <span className="font-mono">{t}</span>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); toggle(t) }}
              className="text-[#555555] hover:text-white ml-0.5 leading-none"
            >×</button>
          </span>
        ))}
        <span className="text-[#333333] text-xs self-center ml-auto select-none">
          {selected.length}/{max} ▾
        </span>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 top-full mt-1 w-full min-w-80 bg-[#111111] border border-[#222222] rounded-xl shadow-2xl overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-[#1a1a1a]">
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Пошук тікера або назви..."
              className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#444444] placeholder:text-[#333333]"
            />
          </div>

          {/* Categories */}
          <div className="flex gap-1 p-2 border-b border-[#1a1a1a] overflow-x-auto">
            {(['Всі', ...CATEGORIES] as const).map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat as Category | 'Всі')}
                className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-md transition-colors font-medium ${
                  category === cat
                    ? 'bg-white text-[#0a0a0a]'
                    : 'bg-[#1a1a1a] text-[#555555] hover:text-white hover:bg-[#222222]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Asset list */}
          <div className="max-h-56 overflow-y-auto">
            {filtered.map(asset => {
              const isSelected = selected.includes(asset.ticker)
              const isDisabled = !isSelected && selected.length >= max
              return (
                <button
                  key={asset.ticker}
                  type="button"
                  onClick={() => !isDisabled && toggle(asset.ticker)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors text-left ${
                    isSelected
                      ? 'bg-[#1a1a1a]'
                      : isDisabled
                      ? 'opacity-30 cursor-not-allowed'
                      : 'hover:bg-[#161616]'
                  }`}
                >
                  {/* Checkbox */}
                  <span className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${
                    isSelected
                      ? 'bg-white border-white'
                      : 'border-[#333333]'
                  }`}>
                    {isSelected && (
                      <svg className="w-2.5 h-2.5 text-[#0a0a0a]" viewBox="0 0 10 10" fill="none">
                        <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </span>
                  <span className="font-mono text-[#888888] w-16 flex-shrink-0 text-xs">{asset.ticker}</span>
                  <span className={`flex-1 truncate text-sm ${isSelected ? 'text-white' : 'text-[#888888]'}`}>
                    {asset.name}
                  </span>
                  <span className="text-[#2a2a2a] text-[10px] flex-shrink-0">{asset.category}</span>
                </button>
              )
            })}
          </div>

          {/* Footer */}
          {selected.length >= max && (
            <div className="px-3 py-2 text-[11px] text-[#f59e0b] border-t border-[#1a1a1a] bg-[#1a1200]">
              Максимум {max} активів обрано
            </div>
          )}
        </div>
      )}
    </div>
  )
}
