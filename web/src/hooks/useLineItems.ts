import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as lineItemApi from '../api/lineItems'

export function useAddLineItem(poId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (item: Parameters<typeof lineItemApi.add>[1]) => lineItemApi.add(poId, item),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['purchase-orders', poId] }),
  })
}

export function useUpdateLineItem(poId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ lineItemId, input }: { lineItemId: string; input: Parameters<typeof lineItemApi.update>[2] }) =>
      lineItemApi.update(poId, lineItemId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['purchase-orders', poId] }),
  })
}

export function useRemoveLineItem(poId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (lineItemId: string) => lineItemApi.remove(poId, lineItemId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['purchase-orders', poId] }),
  })
}
