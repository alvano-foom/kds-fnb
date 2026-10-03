import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  whoami,
  openKitchenSession,
  getKitchenSession,
  createProduction,
  setProductionState,
  closeKitchenSession,
  getBomPreview,
  getProductionComponents,
  createProductionScraps,
} from '../api/kitchen'
import { attendanceLogin, listAttendanceShifts } from '../api/attendance'
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
    mutationFn: ({ employeeCode, shift }) => openKitchenSession({ companyId, employeeCode, shift }),
  })
}

/**
 * Loads the shift list (with each shift's task list) from foom_attendance:
 * logs in with the employee's Kode Absensi + PIN, then reads /shifts with
 * the returned token. The token isn't kept anywhere — one login, one read.
 * Never required: if it fails (wrong PIN, attendance disabled, service
 * down) the Open Kitchen form falls back to its free-text Shift field.
 */
export function useLoadShifts() {
  return useMutation({
    mutationFn: async ({ code, pin }) => {
      const { token } = await attendanceLogin({ code, pin })
      return listAttendanceShifts({ token })
    },
  })
}

/**
 * BoM preview for `qty` of the chosen product — drives the pre-create
 * checklist. Off until a product and a positive qty are set. Keyed by qty
 * because the server does the scaling (exactly like the MO will), so a
 * different qty is a different, cheap, read-only request.
 */
export function useBomPreview(productId, qty) {
  const companyId = useTenantStore((s) => s.companyId)
  const warehouseId = useKitchenSessionStore((s) => s.session?.warehouse_id)
  return useQuery({
    queryKey: ['kitchen-bom', companyId, productId, qty, warehouseId],
    queryFn: () => getBomPreview({ companyId, productId, qty, warehouseId }),
    enabled: Boolean(companyId && productId && qty > 0),
    staleTime: 30_000,
    retry: false, // a 409 no_bom is a real answer, not a blip worth retrying
  })
}

export function productionComponentsQueryKey(productionId) {
  return ['kitchen-production-components', productionId]
}

/** Ingredients of one MO (+ how much of each is already scrapped). Pass null to keep it off until the row is expanded. */
export function useProductionComponents(productionId) {
  return useQuery({
    queryKey: productionComponentsQueryKey(productionId),
    queryFn: () => getProductionComponents(productionId),
    enabled: Boolean(productionId),
    retry: false,
  })
}

/** Records scrap for one MO's ingredients; refreshes that MO's components and the session detail (its scraps list drives "needs scrap"). */
export function useCreateProductionScraps() {
  const queryClient = useQueryClient()
  const session = useKitchenSessionStore((s) => s.session)
  return useMutation({
    mutationFn: ({ productionId, employeeCode, items }) => createProductionScraps(productionId, { employeeCode, items }),
    onSuccess: (_data, { productionId }) => {
      queryClient.invalidateQueries({ queryKey: productionComponentsQueryKey(productionId) })
      queryClient.invalidateQueries({ queryKey: sessionDetailQueryKey(session?.id) })
    },
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
