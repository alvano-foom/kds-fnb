import { useNavigate } from 'react-router-dom'
import { AppShell } from '../components/templates/AppShell'
import { ErrorLog } from '../components/organisms/ErrorLog'
import { Button } from '../components/atoms/Button'
import { useTenantConfig } from '../hooks/useTenantConfig'
import { useLogout } from '../hooks/useAuth'

export function ErrorLogPage() {
  const navigate = useNavigate()
  const logout = useLogout()
  const tenantConfig = useTenantConfig()

  return (
    <AppShell
      title={tenantConfig.data?.name ?? 'Kitchen Display'}
      logoUrl={tenantConfig.data?.logo_url}
      rightSlot={
        <>
          <Button variant="ghost" onClick={() => navigate('/config')}>
            Settings
          </Button>
          <Button variant="ghost" onClick={() => logout.mutate()}>
            Log out
          </Button>
        </>
      }
    >
      <div className="mx-auto max-w-2xl">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Error Log</h2>
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <ErrorLog />
        </div>
      </div>
    </AppShell>
  )
}
