import { useEffect, useRef, useState } from 'react'
import type { CategoryRef } from '../types'
import { Icon } from './icons'

/**
 * The Jumia/Jiji-style category bar (THE navigation change).
 *
 * Desktop bar: hovering OR focusing a category opens a dropdown panel with
 * its sub-categories as columns of links plus "See all {category}" — and it
 * also works keyboard-first (click/Enter toggles, Escape closes everything,
 * focus is trap-free). Selecting any entry applies the EXISTING category
 * filter logic (same setFilters call shape the old pill row used).
 * Mobile drawer: accordion categories (rendered inside the header hamburger).
 */

type Handlers = {
  topCategories: CategoryRef[]
  categories: CategoryRef[]
  top: string
  sub: string
  onTop: (categoryId: string) => void
  onSub: (subCategoryId: string) => void
}

type DrawerProps = Handlers & { onNavigate: () => void }

export default function CategoryMenu(props: Handlers) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const barRef = useRef<HTMLDivElement>(null)

  /* Outside click closes the open panel (and Escape does everywhere) */
  useEffect(() => {
    if (openIndex === null) return
    const onDocClick = (event: MouseEvent) => {
      if (!barRef.current?.contains(event.target as Node)) setOpenIndex(null)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenIndex(null)
    }
    document.addEventListener('click', onDocClick)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('click', onDocClick)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [openIndex])

  const tops = props.topCategories

  return (
    <div
      ref={barRef}
      className="hidden border-b border-border bg-cream lg:block"
      onMouseLeave={() => setOpenIndex(null)}
    >
      <nav
        aria-label="Categories"
        className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-2 sm:px-4"
      >
        {tops.map((category, index) => {
          const children = props.categories.filter(
            (sub) => sub.parentCategoryId === category.id,
          )
          const open = openIndex === index
          return (
            <div key={category.id} className="relative">
              <button
                type="button"
                aria-expanded={open}
                aria-haspopup="true"
                className={`flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1.5 text-xs font-semibold text-ink transition-colors duration-150 hover:bg-hover motion-reduce:transition-none sm:text-sm ${
                  props.top === category.id || open ? 'bg-hover' : ''
                }`}
                onMouseEnter={() => setOpenIndex(children.length > 0 ? index : null)}
                onFocus={() => setOpenIndex(children.length > 0 ? index : null)}
                onClick={() => {
                  /* Enter/click applies the existing filter logic; the
                     panel stays open when it has subs to pick from. */
                  props.onTop(category.id)
                  setOpenIndex(children.length > 0 ? index : null)
                }}
              >
                {category.name}
                {children.length > 0 && (
                  <Icon name="chevron" className="h-3 w-3" />
                )}
              </button>

              {open && children.length > 0 && (
                <div
                  className="absolute left-0 top-full z-40 mt-1 w-max min-w-72 max-w-lg rounded-lg border border-border bg-white p-3 shadow-soft"
                  role="menu"
                  aria-label={`${category.name} sub-categories`}
                >
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                    {children.map((sub) => (
                      <button
                        key={sub.id}
                        type="button"
                        role="menuitem"
                        onMouseEnter={() => setOpenIndex(index)}
                        onClick={() => {
                          props.onSub(sub.id)
                          setOpenIndex(null)
                        }}
                        className={`truncate rounded-full px-2.5 py-1.5 text-left text-xs font-medium text-ink transition-colors duration-150 hover:bg-hover motion-reduce:transition-none ${
                          props.sub === sub.id ? 'bg-hover font-bold' : ''
                        }`}
                      >
                        {sub.name}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      props.onTop(category.id)
                      setOpenIndex(null)
                    }}
                    className="mt-2 flex w-full items-center gap-1 border-t border-border px-2 pt-2 text-xs font-bold text-orange-deep hover:text-ink"                  >
                    See all {category.name}
                    <Icon name="arrow" className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </nav>
    </div>
  )
}

/** Mobile accordion variant — rendered inside the header's drawer. */
export function CategoryDrawer(props: DrawerProps) {
  const [openId, setOpenId] = useState<string | null>(null)
  const drawerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') props.onNavigate()
    }
    const node = drawerRef.current
    node?.addEventListener('keydown', onKeyDown)
    return () => node?.removeEventListener('keydown', onKeyDown)
  }, [props])

  return (
    <div ref={drawerRef} className="flex flex-col divide-y divide-border">
      <button
        type="button"
        onClick={() => {
          props.onTop('all')
          props.onSub('all')
          props.onNavigate()
        }}
        className="flex items-center justify-between px-4 py-3 text-sm font-bold text-ink transition-colors duration-150 hover:bg-hover"
      >
        All categories
        <Icon name="chevron" className="h-4 w-4" />
      </button>
      {props.topCategories.map((category) => {
        const children = props.categories.filter(
          (sub) => sub.parentCategoryId === category.id,
        )
        const open = openId === category.id
        return (
          <div key={category.id}>
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpenId(open ? null : category.id)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-bold text-ink transition-colors duration-150 hover:bg-hover"
            >
              {category.name}
              <Icon name="chevron" className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
              <div className="flex flex-col gap-0.5 bg-hover/60 px-4 pb-3">
                {children.map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => {
                      props.onSub(sub.id)
                      props.onNavigate()
                    }}
                    className="rounded-full px-2 py-1.5 text-left text-xs font-medium text-ink transition-colors duration-150 hover:bg-hover"
                  >
                    {sub.name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    props.onTop(category.id)
                    props.onNavigate()
                  }}
                  className="flex items-center gap-1 px-2 py-1.5 text-left text-xs font-bold text-orange-deep"
                >
                  See all {category.name}
                  <Icon name="arrow" className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
