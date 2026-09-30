import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { openSession } from '../../api/session'
import { useSessionStore } from '../../store/sessionStore'
import { Button } from '../atoms/Button'
import { Input } from '../atoms/Input'

/**
 * Requirement #1: opening a session validates the employee's Kode Absensi
 * server-side. This form only ever sends the code the person typed — it
 * never lets the client assert who they are beyond that.
 */
export function OpenSessionForm() {
  const [code, setCode] = useState('')
  const setSession = useSessionStore((s) => s.setSession)

  const mutation = useMutation({
    mutationFn: () => openSession(code.trim()),
    onSuccess: (data) => setSession(data),
  })

  function handleSubmit(e) {
    e.preventDefault()
    if (!code.trim()) return
    mutation.mutate()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="block text-sm font-medium text-gray-700" htmlFor="att-code">
        Kode Absensi
      </label>
      <Input
        id="att-code"
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="e.g. F102345"
        aria-label="Kode Absensi"
      />
      {mutation.isError && (
        <p className="rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">
          {mutation.error?.message || 'Could not open a session.'}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={mutation.isPending || !code.trim()}>
        {mutation.isPending ? 'Opening…' : 'Open Session'}
      </Button>
    </form>
  )
}
