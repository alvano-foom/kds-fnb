import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Access token lives in memory only (never persisted — limits what an XSS
 * payload could exfiltrate from storage). Refresh token + user are
 * persisted so a reload doesn't force a re-login; on reload accessToken
 * starts null and the first API call's 401 triggers a silent refresh
 * (see src/api/client.js) before anything renders behind a route guard.
 */
export const useAuthStore = create(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,

      setTokens: ({ access_token, refresh_token, user }) =>
        set((state) => ({
          accessToken: access_token ?? state.accessToken,
          refreshToken: refresh_token ?? state.refreshToken,
          user: user ?? state.user,
        })),

      signOut: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    {
      name: 'kds_auth',
      partialize: (state) => ({ refreshToken: state.refreshToken, user: state.user }),
    },
  ),
)
