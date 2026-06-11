import { apiFetch } from './client'
import type {
  PurchaseOrderResponse,
  PurchaseOrderListResponse,
  PurchaseOrderStatus,
  StatusHistoryEntry,
  LockResponse,
} from './types'

export interface PODetailResponse extends PurchaseOrderResponse {
  lineItems: import('./types').LineItemResponse[]
  statusHistory: StatusHistoryEntry[]
}

export interface ListParams {
  status?: PurchaseOrderStatus[]
  supplierId?: string
  page?: number
  limit?: number
}

export function list(params: ListParams = {}): Promise<PurchaseOrderListResponse> {
  const qs = new URLSearchParams()
  params.status?.forEach((s) => qs.append('status', s))
  if (params.supplierId) qs.set('supplierId', params.supplierId)
  if (params.page) qs.set('page', String(params.page))
  if (params.limit) qs.set('limit', String(params.limit))
  const query = qs.toString() ? `?${qs.toString()}` : ''
  return apiFetch<PurchaseOrderListResponse>(`/purchase-orders${query}`)
}

export function getById(poId: string): Promise<PODetailResponse> {
  return apiFetch<PODetailResponse>(`/purchase-orders/${poId}`)
}

export function create(input: {
  supplierId: string
  branchId: string
  expectedDeliveryDate?: string
  notes?: string | null
}): Promise<PurchaseOrderResponse> {
  return apiFetch<PurchaseOrderResponse>('/purchase-orders', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function update(poId: string, input: {
  expectedDeliveryDate?: string
  notes?: string | null
}): Promise<PurchaseOrderResponse> {
  return apiFetch<PurchaseOrderResponse>(`/purchase-orders/${poId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function submit(poId: string, expectedDeliveryDate?: string): Promise<PurchaseOrderResponse> {
  return apiFetch<PurchaseOrderResponse>(`/purchase-orders/${poId}/submit`, {
    method: 'POST',
    body: JSON.stringify(expectedDeliveryDate ? { expectedDeliveryDate } : {}),
  })
}

export function cancel(poId: string): Promise<PurchaseOrderResponse> {
  return apiFetch<PurchaseOrderResponse>(`/purchase-orders/${poId}/cancel`, { method: 'POST' })
}

export function fulfill(poId: string): Promise<PurchaseOrderResponse> {
  return apiFetch<PurchaseOrderResponse>(`/purchase-orders/${poId}/fulfill`, { method: 'POST' })
}

export function acquireLock(poId: string): Promise<LockResponse> {
  return apiFetch<LockResponse>(`/purchase-orders/${poId}/lock`, { method: 'POST' })
}

export function releaseLock(poId: string): Promise<void> {
  return apiFetch<void>(`/purchase-orders/${poId}/lock`, { method: 'DELETE' })
}

export function getHistory(poId: string): Promise<StatusHistoryEntry[]> {
  return apiFetch<StatusHistoryEntry[]>(`/purchase-orders/${poId}/history`)
}
