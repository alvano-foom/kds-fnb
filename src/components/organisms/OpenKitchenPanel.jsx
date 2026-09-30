import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { openKitchenSession } from '../../api/kitchen'
import { useConfigStore } from '../../store/configStore'
import { useOperatorStore } from '../../store/operatorStore'
import { kitchenSessionQueryKey } from '../../hooks/useKitchenSession'
import { Button } from '../atoms/Button'
import { Input } from '../atoms/Input'

/**
 * Shown once signed in, when nobody has opened the kitchen yet for this
 * company. Only one can be open at a time company-wide — if someone else
 * opens it in the split second before this submits, the 409 response
 * already carries the now-current session, so we just adopt it instead of
 * showing a dead-end error.
 */
export function OpenKitchenPanel() {
  const companyId = useConfigStore((s) => s.companyId)
  const defaultShift = useConfigStore((s) => s.shift)
  const employeeCode = useOperatorStore((s) => s.employeeCode)
  const queryClient = useQueryClient()
  const [shift, setShift] = useState(defaultShift)

  const mutation = useMutation({
    mutationFn: () => openKitchenSession({ companyId, employeeCode, shift }),
    onSuccess: (session) => queryClient.setQueryData(kitchenSessionQueryKey(companyId), session),
    onError: (err) => {
      if (err.code === 'session_already_open' && err.extra?.session) {
        queryClient.setQueryData(kitchenSessionQueryKey(companyId), err.extra.session)
      }
    },
  })

  return (
    <div className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-gray-900">The kitchen isn't open yet</p>
      <p className="text-xs text-gray-500">Opening it starts a shared session for this outlet — anyone can join once it's open.</p>
      <Input value={shift} onChange={(e) => setShift(e.target.value)} placeholder="Shift label (optional), e.g. Shift 1" aria-label="Shift label" />
      {mutation.isError && mutation.error.code !== 'session_already_open' && (
        <p className="rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">{mutation.error.message}</p>
      )}
      <Button type="button" className="w-full" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
        {mutation.isPending ? 'Opening…' : 'Open Kitchen'}
      </Button>
    </div>
  )
}
