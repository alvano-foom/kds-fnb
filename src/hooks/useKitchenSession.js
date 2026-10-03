import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  whoami,
  openKitchenSession,
  getKitchenSession,
  createProduction,
  setProductionState,
  closeKitchenSession,
  listShifts,
  getBomPreview,
} from '../api/kitchen'
import { useKitchenSessionStore } from '../store/kitchenSessionStore'
import { useTenantStore } from '../store/tenantStore'

/**
 * Looks up an employee by Kode Absensi and reports whether this
 * company's kitchen is already open (and by whom) — the caller decides
 * what to do with that (offer "continue" instead of trying to open a
 * second session, which the backend would reject with 409
 * session_already_open anyway).
 *
 * Neither this nor openKitchenSession's response echoes back the code
 * that was typed, so the caller is responsible for pairing it with
 * whichever identity the server confirms before writing to the store —
 * see KodeAbsensiGate.
 */
export function useWhoami() {
  const companyId = useTenantStore((s) => s.companyId)
  return useMutation({ mutationFn: (employeeCode) => whoami({ companyId, employeeCode }) })
}

export function useOpenKitchenSession() {
  const companyId = useTenantStore((s) => s.companyId)
  return useMutation({
    mutationFn: ({ employeeCode, shift, shiftId }) => openKitchenSession({ companyId, employeeCode, shift, shiftId }),
  })
}

/**
 * Shift master data (Odoo foom.attendance.shift) for the Open Kitchen
 * form's picker. Deliberately never throws into the UI: until the backend
 * ships /kitchen/shifts (or for a company with no shifts configured) the
 * query just errors/returns [], and the form falls back to its old free-text
 * Shift field instead of blocking anyone from opening the kitchen.
 */
export function useShifts() {
  const companyId = useTenantStore((s) => s.companyId)
  return useQuery({
    queryKey: ['kitchen-shifts', companyId],
    queryFn: () => listShifts({ companyId }),
    enabled: Boolean(companyId),
    select: (data) => data?.shifts ?? [],
    staleTime: 5 * 60_000, // shifts are master data — they change on the order of weeks
    retry: false,
  })
}

/** Default BoM + components for the chosen product — drives the pre-create checklist. Off until a product is picked. */
export function useBomPreview(productId) {
  const companyId = useTenantStore((s) => s.companyId)
  return useQuery({
    queryKey: ['kitchen-bom', companyId, productId],
    queryFn: () => getBomPreview({ companyId, productId }),
    enabled: Boolean(companyId && productId),
    staleTime: 60_000,
    retry: false, // a 409 no_bom is a real answer, not a blip worth retrying
  })
}

export function sessionDetailQueryKey(sessionId) {
  return ['kitchen-session', sessionId]
}

/**
 * The single source of truth for "this session's productions/scraps" —
 * also what keeps the persisted store honest: if the server says this
 * session isn't open any more (closed elsewhere, or simply gone), or the
 * selected company has changed since it was opened, the local copy is
 * cleared instead of leaving the UI stuck believing a session is open
 * that no longer applies.
 */
export function useKitchenSessionDetail() {
  const session = useKitchenSessionStore((s) => s.session)
  const storedCompanyId = useKitchenSessionStore((s) => s.companyId)
  const clear = useKitchenSessionStore((s) => s.clear)
  const companyId = useTenantStore((s) => s.companyId)

  const query = useQuery({
    queryKey: sessionDetailQueryKey(session?.id),
    queryFn: () => getKitchenSession(session.id),
    enabled: Boolean(session?.id),
    refetchOnMount: 'always',
  })

  useEffect(() => {
    if (session && companyId && storedCompanyId && storedCompanyId !== companyId) clear()
  }, [session, companyId, storedCompanyId, clear])

  useEffect(() => {
    if (!session) return
    if (query.isError) clear() // 404, or any other failure to confirm — don't trust a stale local copy
    else if (query.data && query.data.state !== 'open') clear()
  }, [session, query.isError, query.data, clear])

  return query
}

export function useCreateProduction() {
  const queryClient = useQueryClient()
  const companyId = useTenantStore((s) => s.companyId)
  const session = useKitchenSessionStore((s) => s.session)
  return useMutation({
    mutationFn: ({ employeeCode, productId, qty, bomId }) =>
      createProduction({ companyId, employeeCode, productId, qty, bomId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionDetailQueryKey(session?.id) }),
  })
}

export function useSetProductionState() {
  const queryClient = useQueryClient()
  const session = useKitchenSessionStore((s) => s.session)
  return useMutation({
    mutationFn: ({ productionId, employeeCode, action, qty, backorder }) =>
      setProductionState(productionId, { employeeCode, action, qty, backorder }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionDetailQueryKey(session?.id) }),
  })
}

export function useCloseKitchenSession() {
  const clear = useKitchenSessionStore((s) => s.clear)
  const session = useKitchenSessionStore((s) => s.session)
  return useMutation({
    mutationFn: ({ employeeCode, scraps, cancelPending, force }) =>
      closeKitchenSession(session.id, { employeeCode, scraps, cancelPending, force }),
    onSuccess: () => clear(),
  })
}
