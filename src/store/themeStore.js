import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Brand theme colors — NOT part of the API contract. Unlike TenantConfig
 * (name/logo, which come from the backend and are the same for every
 * visitor of a tenant), color is a purely client-side preference: the
 * browser remembers it in localStorage the same way it would remember a
 * light/dark theme choice, and it's set from the Config screen's color
 * pickers rather than fetched from `/tenant/config`.
 */
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
