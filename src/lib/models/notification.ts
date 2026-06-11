import { Type, Static } from '@sinclair/typebox'

export const NotificationEventType = Type.Union([
  Type.Literal('PO_SUBMITTED'),
  Type.Literal('PO_APPROVED'),
  Type.Literal('PO_REJECTED'),
  Type.Literal('PO_ON_HOLD'),
  Type.Literal('APPROVAL_REQUESTED'),
])
export type NotificationEventType = Static<typeof NotificationEventType>

export const NotificationRecipientType = Type.Union([
  Type.Literal('SUPPLIER'),
  Type.Literal('APPROVER'),
  Type.Literal('BUYER'),
])
export type NotificationRecipientType = Static<typeof NotificationRecipientType>

export interface NotificationPayload {
  poNumber: string
  totalCents: number
  buyerId: string
  branchId: string
  supplierId: string
  expectedDeliveryDate: string | null
  eventType: string
  reason?: string
}

export interface PendingNotification {
  id: string
  purchaseOrderId: string
  recipientType: string
  recipientId: string
  eventType: string
  payload: string
  retryCount: number
}
