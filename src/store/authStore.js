import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Access token stays in memory only to limit XSS exposure; the persisted
 * refresh token restores it via a silent refresh on the first 401.
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
