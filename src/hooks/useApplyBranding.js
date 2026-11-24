import { useEffect } from 'react'
import { useThemeStore } from '@/store/themeStore'

/** Applies the stored brand colors as CSS custom properties. */
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
