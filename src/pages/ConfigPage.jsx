import { useNavigate } from 'react-router-dom'
import { AppShell } from '../components/templates/AppShell'
import { ConfigForm } from '../components/organisms/ConfigForm'
import { Button } from '../components/atoms/Button'
import { useLogout } from '../hooks/useAuth'
import { useTenantConfig } from '../hooks/useTenantConfig'

export function ConfigPage() {
  const navigate = useNavigate()
  const logout = useLogout()
  const tenantConfig = useTenantConfig()

  return (
    <AppShell
      title={tenantConfig.data?.name ?? 'Kitchen Display'}
      logoUrl={tenantConfig.data?.logo_url}
      rightSlot={
        <Button variant="ghost" onClick={() => logout.mutate()}>
          Log out
        </Button>
      }
    >
      <div className="mx-auto max-w-md">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Kitchen Configuration</h2>
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <ConfigForm onSaved={() => navigate('/board', { replace: true })} />
        </div>
      </div>
    </AppShell>
  )
}
