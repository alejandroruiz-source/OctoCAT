import { Type, Static } from '@sinclair/typebox'

export const RejectPurchaseOrderRequest = Type.Object({
  reason: Type.String({ minLength: 1, maxLength: 1000 }),
})
export type RejectPurchaseOrderRequest = Static<typeof RejectPurchaseOrderRequest>

export const ApprovalResponse = Type.Object({
  id: Type.String({ format: 'uuid' }),
  purchaseOrderId: Type.String({ format: 'uuid' }),
  approverId: Type.String({ format: 'uuid' }),
  decision: Type.Union([Type.Literal('APPROVED'), Type.Literal('REJECTED')]),
  reason: Type.Union([Type.String(), Type.Null()]),
  decidedAt: Type.String({ format: 'date-time' }),
})
export type ApprovalResponse = Static<typeof ApprovalResponse>
