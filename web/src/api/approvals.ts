import { apiFetch } from './client'
import type { ApprovalResponse } from './types'

export function approve(poId: string): Promise<ApprovalResponse> {
  return apiFetch<ApprovalResponse>(`/purchase-orders/${poId}/approve`, { method: 'POST' })
}

export function reject(poId: string, reason: string): Promise<ApprovalResponse> {
  return apiFetch<ApprovalResponse>(`/purchase-orders/${poId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}
