import { useState } from 'react'
import { useLogin } from '../../hooks/useAuth'
import { FormField } from '../molecules/FormField'
import { Input } from '../atoms/Input'
import { Button } from '../atoms/Button'
import { Spinner } from '../atoms/Spinner'

export function LoginForm({ onSuccess }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const login = useLogin()

  function handleSubmit(event) {
    event.preventDefault()
    login.mutate({ email, password }, { onSuccess })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField label="Email" htmlFor="email">
        <Input
          id="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </FormField>
      <FormField label="Password" htmlFor="password">
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </FormField>

      {/* Generic message on purpose — never reveals which field was wrong. */}
      {login.isError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Incorrect email or password.</p>
      )}

      <Button type="submit" className="w-full" disabled={login.isPending}>
        {login.isPending && <Spinner className="h-4 w-4" />}
        Log in
      </Button>
    </form>
  )
}
