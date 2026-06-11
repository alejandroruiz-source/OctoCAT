import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as approvalApi from '../api/approvals'
import { usePoList } from './usePurchaseOrders'

export function useApprovalQueue() {
  return usePoList({ status: ['AWAITING_APPROVAL'], limit: 100 })
}

export function useApprovePo(poId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => approvalApi.approve(poId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders', poId] })
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
    },
  })
}

export function useRejectPo(poId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (reason: string) => approvalApi.reject(poId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-orders', poId] })
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
    },
  })
}
