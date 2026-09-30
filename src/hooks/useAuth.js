import { useMutation } from '@tanstack/react-query'
import { login as loginRequest, logout as logoutRequest } from '../api/auth'
import { useAuthStore } from '../store/authStore'
import { useTenantStore } from '../store/tenantStore'
import { useKitchenSessionStore } from '../store/kitchenSessionStore'

export function useLogin() {
  const setTokens = useAuthStore((s) => s.setTokens)
  return useMutation({
    mutationFn: ({ email, password }) => loginRequest(email, password),
    onSuccess: (data) => setTokens(data),
  })
}

export function useLogout() {
  const refreshToken = useAuthStore((s) => s.refreshToken)
  const signOut = useAuthStore((s) => s.signOut)
  const clearConfig = useTenantStore((s) => s.clearConfig)
  const clearKitchenSession = useKitchenSessionStore((s) => s.clear)
  return useMutation({
    mutationFn: () => logoutRequest(refreshToken),
    onSettled: () => {
      signOut()
      clearConfig()
      // Not necessarily the same person logging back in — don't let the
      // next login inherit "who's attributed to kitchen actions" from
      // whoever was last identified via Kode Absensi on this device.
      clearKitchenSession()
    },
  })
}

/** True if there's a saved session to try — validity is confirmed lazily by the first API call. */
export function useIsAuthenticated() {
  return useAuthStore((s) => Boolean(s.refreshToken))
}

export function useCurrentUser() {
  return useAuthStore((s) => s.user)
}
