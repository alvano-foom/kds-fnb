import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/atoms/Button'
import { TenantShell } from '@/components/templates/TenantShell'
import { ErrorLog } from '@/components/organisms/ErrorLog'

export function ErrorLogPage() {
  const navigate = useNavigate()

  return (
    <TenantShell
      actions={
        <Button variant="ghost" onClick={() => navigate('/config')}>
          Settings
        </Button>
      }
    >
      <div className="mx-auto max-w-2xl">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Error Log</h2>
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <ErrorLog />
        </div>
      </div>
    </TenantShell>
  )
}
