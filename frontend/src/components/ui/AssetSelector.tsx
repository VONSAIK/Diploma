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
    return matchCat && (!q || a.ticker.toLowerCase().includes(q) || a.name.toLowerCase().includes(q))
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
      <label className="block text-[11px] text-[#444444] uppercase tracking-wider mb-1.5">Актив</label>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 bg-[#141414] border border-[#222222] hover:border-[#333333] rounded-lg px-3 py-2 text-sm w-52 text-left transition-colors focus:outline-none focus:border-[#444444]"
      >
        <span className="flex-1 truncate">
          <span className="font-mono text-white text-sm">{value}</span>
          {currentAsset && (
            <span className="text-[#444444] ml-1.5 text-xs">{currentAsset.name}</span>
          )}
        </span>
        <span className="text-[#333333] text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 w-80 bg-[#111111] border border-[#222222] rounded-xl shadow-2xl overflow-hidden">
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
          <div className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="text-center text-[#333333] text-sm py-6">Нічого не знайдено</div>
            ) : (
              filtered.map(asset => (
                <button
                  key={asset.ticker}
                  type="button"
                  onClick={() => select(asset.ticker)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors text-left ${
                    asset.ticker === value
                      ? 'bg-[#1a1a1a]'
                      : 'hover:bg-[#161616]'
                  }`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    asset.ticker === value ? 'bg-white' : 'bg-transparent'
                  }`} />
                  <span className={`font-mono w-14 flex-shrink-0 text-xs ${
                    asset.ticker === value ? 'text-white' : 'text-[#666666]'
                  }`}>{asset.ticker}</span>
                  <span className={`flex-1 truncate ${
                    asset.ticker === value ? 'text-white' : 'text-[#888888]'
                  }`}>{asset.name}</span>
                  <span className="text-[#2a2a2a] text-[10px]">{asset.category}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
