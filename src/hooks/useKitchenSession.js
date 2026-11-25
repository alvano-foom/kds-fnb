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
} from '@/api/kitchen'
import { attendanceLogin, listAttendanceShifts } from '@/api/attendance'
import { useKitchenSessionStore } from '@/store/kitchenSessionStore'
import { useTenantStore } from '@/store/tenantStore'
import { syncStoreStock } from '@/lib/storeStockSync'

/** The response doesn't echo the Attendance Code back, so the caller must store it with the employee. */
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

/** Logs in to foom_attendance and reads the shift list; the token is used once and not kept. */
export function useLoadShifts() {
  return useMutation({
    mutationFn: async ({ code, pin }) => {
      const { token } = await attendanceLogin({ code, pin })
      return listAttendanceShifts({ token })
    },
  })
}

/** Keyed by qty because the server does the scaling. */
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

/** Pass null to keep it disabled until the row is expanded. */
export function useProductionComponents(productionId) {
  return useQuery({
    queryKey: productionComponentsQueryKey(productionId),
    queryFn: () => getProductionComponents(productionId),
    enabled: Boolean(productionId),
    retry: false,
  })
}

/** Also refreshes the session detail, whose scraps list drives "needs scrap". */
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

/** Also clears the persisted session if the server says it's no longer open or the company changed. */
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
    if (query.isError) clear() // can't confirm it, so don't trust the local copy
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
    onSuccess: (production) => {
      if (production?.state === 'done') syncStoreStock(production)
      return queryClient.invalidateQueries({ queryKey: sessionDetailQueryKey(session?.id) })
    },
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
