import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { whoami } from '../../api/kitchen'
import { useConfigStore } from '../../store/configStore'
import { useOperatorStore } from '../../store/operatorStore'
import { kitchenSessionQueryKey } from '../../hooks/useKitchenSession'
import { Button } from '../atoms/Button'
import { Input } from '../atoms/Input'

/** Requirement #1: validates the Kode Absensi server-side before anything else can happen. */
export function SignInForm() {
  const companyId = useConfigStore((s) => s.companyId)
  const setOperator = useOperatorStore((s) => s.setOperator)
  const queryClient = useQueryClient()
  const [code, setCode] = useState('')

  const mutation = useMutation({
    mutationFn: () => whoami({ companyId, employeeCode: code.trim() }),
    onSuccess: (data) => {
      setOperator({ employeeCode: code.trim(), employee: data.employee })
      // We already have the freshest "is the kitchen open" answer — seed the
      // query cache with it instead of firing a second identical request.
      queryClient.setQueryData(kitchenSessionQueryKey(companyId), data.open_session)
    },
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
        <p className="rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">{mutation.error.message}</p>
      )}
      <Button type="submit" className="w-full" disabled={mutation.isPending || !code.trim()}>
        {mutation.isPending ? 'Checking…' : 'Sign In'}
      </Button>
    </form>
  )
}
