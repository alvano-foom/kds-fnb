import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Per-kiosk-device configuration — this is what makes the app "still
 * configurable" rather than hardcoded to one backend/company: a tablet can
 * be pointed at staging vs production, or at a different outlet's company
 * ID, without a rebuild. Persisted so it survives a reload; edited via the
 * Settings modal (see components/organisms/SettingsModal.jsx), reachable
 * any time from the top bar gear icon — including before signing in.
 *
 * apiBaseUrl/apiKey fall back to build-time env vars so a deployment can
 * ship sane defaults and still let a specific device override them.
 */
export const useConfigStore = create(
  persist(
    (set) => ({
      apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api/kds',
      apiKey: import.meta.env.VITE_API_KEY ?? '',
      companyId: import.meta.env.VITE_COMPANY_ID ?? '',
      shift: '',

      setConfig: (patch) => set(patch),
    }),
    { name: 'kitchen_config' },
  ),
)

export function useIsConfigured() {
  return useConfigStore((s) => Boolean(s.apiBaseUrl && s.apiKey && s.companyId))
}
