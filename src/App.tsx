import { useMemo, useState } from 'react'
import { PRODUCTS } from './data/products'
import type { Category } from './types'
import CampusPicker from './components/CampusPicker'
import SearchBox from './components/SearchBox'
import CategoryButtons from './components/CategoryButtons'
import ProductGrid from './components/ProductGrid'

export default function App() {
  const [campus, setCampus] = useState<string>('all')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<Category | 'all'>('all')

  const products = useMemo(() => {
    const q = query.trim().toLowerCase()
    return PRODUCTS.filter((p) => {
      if (campus !== 'all' && p.campus !== campus) return false
      if (category !== 'all' && p.category !== category) return false
      if (q && !(`${p.title} ${p.description}`.toLowerCase().includes(q))) {
        return false
      }
      return true
    })
  }, [campus, query, category])

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-4 py-3">
        <span className="text-lg font-extrabold tracking-tight">
          We<span className="text-emerald-600">mart</span>
        </span>
        <span className="ml-2 hidden text-xs text-slate-500 sm:inline">
          Buy & sell on your campus
        </span>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-4 py-4">
        <CampusPicker value={campus} onChange={setCampus} />
        <SearchBox value={query} onChange={setQuery} />
        <CategoryButtons value={category} onChange={setCategory} />
        <p className="text-xs text-slate-500" aria-live="polite">
          {products.length} {products.length === 1 ? 'item' : 'items'} found
        </p>
        <ProductGrid products={products} />
      </main>

      <footer className="px-4 py-6 text-center text-xs text-slate-400">
        Demo build — sample data only
      </footer>
    </div>
  )
}
