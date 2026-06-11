import type { PurchaseOrderStatus } from '~backend/purchaseOrder'

export const APPROVAL_THRESHOLD_CENTS = 1_000_000

export const LOCK_DURATION_MS = 30 * 60 * 1000

export const STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  AWAITING_APPROVAL: 'Awaiting Approval',
  APPROVED: 'Approved',
  REVISION_REQUIRED: 'Revision Required',
  FULFILLED: 'Fulfilled',
  CANCELLED: 'Cancelled',
}

export type StatusColor = 'gray' | 'blue' | 'amber' | 'green' | 'red' | 'purple' | 'gray-muted'

export const STATUS_COLORS: Record<PurchaseOrderStatus, StatusColor> = {
  DRAFT: 'gray',
  SUBMITTED: 'blue',
  AWAITING_APPROVAL: 'amber',
  APPROVED: 'green',
  REVISION_REQUIRED: 'red',
  FULFILLED: 'purple',
  CANCELLED: 'gray-muted',
}

export const EDITABLE_STATUSES: PurchaseOrderStatus[] = ['DRAFT', 'REVISION_REQUIRED']

export function isEditable(status: PurchaseOrderStatus): boolean {
  return EDITABLE_STATUSES.includes(status)
}

export function requiresApproval(totalCents: number): boolean {
  return totalCents >= APPROVAL_THRESHOLD_CENTS
}
