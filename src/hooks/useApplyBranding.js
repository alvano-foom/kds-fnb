import { useEffect } from 'react'
import { useThemeStore } from '../store/themeStore'

/**
 * Applies the locally-configured brand colors as CSS custom properties at
 * runtime. Unlike outlet name/logo (which come from GET /tenant/config),
 * colors are a frontend-only setting persisted to localStorage via
 * useThemeStore — the browser remembers them like a theme, independent of
 * any backend.
 */
export function useApplyBranding() {
  const primaryColor = useThemeStore((s) => s.primaryColor)
  const secondaryColor = useThemeStore((s) => s.secondaryColor)

  useEffect(() => {
    document.documentElement.style.setProperty('--brand-primary', primaryColor)
  }, [primaryColor])

  useEffect(() => {
    document.documentElement.style.setProperty('--brand-secondary', secondaryColor)
  }, [secondaryColor])
}
