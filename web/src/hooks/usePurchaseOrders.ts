import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as poApi from '../api/purchaseOrders'
import type { ListParams } from '../api/purchaseOrders'

export function usePoList(params: ListParams = {}) {
  const isApprovalQueue = params.status?.includes('AWAITING_APPROVAL')
  return useQuery({
    queryKey: ['purchase-orders', params],
    queryFn: () => poApi.list(params),
    refetchInterval: isApprovalQueue ? 10_000 : 30_000,
  })
}

export function usePoDetail(poId: string) {
  return useQuery({
    queryKey: ['purchase-orders', poId],
    queryFn: () => poApi.getById(poId),
    refetchInterval: 10_000,
    enabled: !!poId,
  })
}

export function useCreatePo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: poApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['purchase-orders'] }),
  })
}

export function useUpdatePo(poId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: Parameters<typeof poApi.update>[1]) => poApi.update(poId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders', poId] })
    },
  })
}

export function useCancelPo(poId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => poApi.cancel(poId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders', poId] })
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
    },
  })
}

export function useSubmitPo(poId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (expectedDeliveryDate?: string) => poApi.submit(poId, expectedDeliveryDate),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders', poId] })
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
    },
  })
}

export function useFulfillPo(poId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => poApi.fulfill(poId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders', poId] })
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
    },
  })
}

export function useLockPo(poId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => poApi.acquireLock(poId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['purchase-orders', poId] }),
  })
}

export function useReleaseLock(poId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => poApi.releaseLock(poId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['purchase-orders', poId] }),
  })
}
