import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { cleanup } from '@testing-library/react'
import { server } from './server'
import { useAuthStore } from '../store/authStore'
import { useTenantStore } from '../store/tenantStore'
import { DEFAULT_THEME, useThemeStore } from '../store/themeStore'

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))

afterEach(() => {
  server.resetHandlers()
  cleanup()
  localStorage.clear()
  useAuthStore.setState({ accessToken: null, refreshToken: null, user: null })
  useTenantStore.setState({ companyId: null, companyName: null })
  useThemeStore.setState(DEFAULT_THEME)
})

afterAll(() => server.close())
