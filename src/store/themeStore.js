import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Brand colors: a local, per-browser preference, not part of the API. */
export const DEFAULT_THEME = {
  primaryColor: '#9333ea',
  secondaryColor: '#f97316',
}

export const useThemeStore = create(
  persist(
    (set) => ({
      ...DEFAULT_THEME,
      setColors: (colors) => set(colors),
      resetColors: () => set(DEFAULT_THEME),
    }),
    { name: 'kds_theme' },
  ),
)
