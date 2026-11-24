import { AppShell } from './AppShell'
import { Button } from '@/components/atoms/Button'
import { useLogout } from '@/hooks/useAuth'
import { useTenantConfig } from '@/hooks/useTenantConfig'

/** AppShell branded with the outlet's name/logo, with a trailing "Log out" button. */
export function TenantShell({ leftSlot, actions, showLogout = true, children }) {
  const tenantConfig = useTenantConfig()
  const logout = useLogout()

  return (
    <AppShell
      title={tenantConfig.data?.name ?? 'Kitchen Display'}
      logoUrl={tenantConfig.data?.logo_url}
      leftSlot={leftSlot}
      rightSlot={
        (actions || showLogout) && (
          <>
            {actions}
            {showLogout && (
              <Button variant="ghost" onClick={() => logout.mutate()}>
                Log out
              </Button>
            )}
          </>
        )
      }
    >
      {children}
    </AppShell>
  )
}
