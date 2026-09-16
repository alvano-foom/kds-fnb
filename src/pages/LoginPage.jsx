import { useNavigate } from 'react-router-dom'
import { AuthLayout } from '../components/templates/AuthLayout'
import { LoginForm } from '../components/organisms/LoginForm'
import { useTenantConfig } from '../hooks/useTenantConfig'

export function LoginPage() {
  const navigate = useNavigate()
  const tenantConfig = useTenantConfig()

  return (
    <AuthLayout
      title={tenantConfig.data?.name ?? 'Kitchen Display'}
      subtitle="Sign in with your Odoo account"
      logoUrl={tenantConfig.data?.logo_url}
    >
      <LoginForm onSuccess={() => navigate('/config', { replace: true })} />
    </AuthLayout>
  )
}
