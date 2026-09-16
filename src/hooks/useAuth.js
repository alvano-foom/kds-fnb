import { useMutation } from '@tanstack/react-query'
import { login as loginRequest, logout as logoutRequest } from '../api/auth'
import { useAuthStore } from '../store/authStore'
import { useTenantStore } from '../store/tenantStore'

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
  return useMutation({
    mutationFn: () => logoutRequest(refreshToken),
    onSettled: () => {
      signOut()
      clearConfig()
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
