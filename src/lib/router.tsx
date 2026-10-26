import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type AnchorHTMLAttributes,
  type ReactNode,
} from 'react'

/**
 * Micro pathname router (no dependency).
 *
 * V1 was a single page; auth + dashboards need real URLs. Word from AGENTS.md
 * says only add react-router (or similar) once pages beyond home exist — the
 * custom hook below is that stage-2 router without another bundle dependency.
 * Deep links work on the deployed site because `wrangler.toml` serves
 * `not_found_handling = "single-page-application"` (index.html for any path).
 *
 * Email links point at `${origin}/verify?…` and `${origin}/reset-password?…`,
 * so paths (not hash routes) are used throughout.
 */

type Router = {
  path: string
  navigate: (to: string) => void
}

const RouterContext = createContext<Router | null>(null)

export function RouterProvider({ children }: { children: ReactNode }) {
  const [path, setPath] = useState(() => window.location.pathname)

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = useCallback((to: string) => {
    if (window.location.pathname !== to) {
      window.history.pushState({}, '', to)
    }
    setPath(to)
    window.scrollTo(0, 0)
  }, [])

  return (
    <RouterContext.Provider value={{ path, navigate }}>
      {children}
    </RouterContext.Provider>
  )
}

export function useRouter(): Router {
  const ctx = useContext(RouterContext)
  if (!ctx) throw new Error('useRouter must be used inside <RouterProvider>')
  return ctx
}

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }

/** Same-SPA link — renders a real <a> for a11y, intercepts middle clicks no. */
export function Link({ href, onClick, ...rest }: LinkProps) {
  const { navigate } = useRouter()
  return (
    <a
      href={href}
      onClick={(event) => {
        // Modifier clicks (open in new tab etc.) stay native.
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return
        }
        event.preventDefault()
        onClick?.(event)
        navigate(href)
      }}
      {...rest}
    />
  )
}
