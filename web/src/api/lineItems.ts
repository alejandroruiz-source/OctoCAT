import { apiFetch } from './client'
import type { LineItemResponse } from './types'

export function add(poId: string, item: {
  productId: string
  productName: string
  quantity: number
  unitPriceCents: number
}): Promise<LineItemResponse> {
  return apiFetch<LineItemResponse>(`/purchase-orders/${poId}/line-items`, {
    method: 'POST',
    body: JSON.stringify(item),
  })
}

export function update(poId: string, lineItemId: string, input: {
  quantity?: number
  unitPriceCents?: number
}): Promise<LineItemResponse> {
  return apiFetch<LineItemResponse>(`/purchase-orders/${poId}/line-items/${lineItemId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function remove(poId: string, lineItemId: string): Promise<void> {
  return apiFetch<void>(`/purchase-orders/${poId}/line-items/${lineItemId}`, { method: 'DELETE' })
}
