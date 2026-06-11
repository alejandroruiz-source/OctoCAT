import { Type, Static } from '@sinclair/typebox'

export const PurchaseOrderStatus = Type.Union([
  Type.Literal('DRAFT'),
  Type.Literal('SUBMITTED'),
  Type.Literal('AWAITING_APPROVAL'),
  Type.Literal('APPROVED'),
  Type.Literal('FULFILLED'),
  Type.Literal('CANCELLED'),
  Type.Literal('REVISION_REQUIRED'),
])
export type PurchaseOrderStatus = Static<typeof PurchaseOrderStatus>

export const CreatePurchaseOrderRequest = Type.Object({
  supplierId: Type.String({ format: 'uuid' }),
  branchId: Type.String({ format: 'uuid' }),
  expectedDeliveryDate: Type.Optional(Type.String({ format: 'date' })),
  notes: Type.Optional(Type.Union([Type.String({ maxLength: 1000 }), Type.Null()])),
})
export type CreatePurchaseOrderRequest = Static<typeof CreatePurchaseOrderRequest>

export const UpdatePurchaseOrderRequest = Type.Object({
  expectedDeliveryDate: Type.Optional(Type.String({ format: 'date' })),
  notes: Type.Optional(Type.Union([Type.String({ maxLength: 1000 }), Type.Null()])),
})
export type UpdatePurchaseOrderRequest = Static<typeof UpdatePurchaseOrderRequest>

export const SubmitPurchaseOrderRequest = Type.Object({
  expectedDeliveryDate: Type.String({ format: 'date' }),
})
export type SubmitPurchaseOrderRequest = Static<typeof SubmitPurchaseOrderRequest>

export const PurchaseOrderResponse = Type.Object({
  id: Type.String({ format: 'uuid' }),
  poNumber: Type.String(),
  status: PurchaseOrderStatus,
  buyerId: Type.String(),
  branchId: Type.String(),
  supplierId: Type.String(),
  expectedDeliveryDate: Type.Union([Type.String({ format: 'date' }), Type.Null()]),
  totalCents: Type.Integer({ minimum: 0 }),
  notes: Type.Union([Type.String(), Type.Null()]),
  lockedBy: Type.Union([Type.String(), Type.Null()]),
  lockedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  approvalDeadline: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
  submittedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  approvedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  fulfilledAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
})
export type PurchaseOrderResponse = Static<typeof PurchaseOrderResponse>

export const StatusHistoryEntry = Type.Object({
  id: Type.String(),
  purchaseOrderId: Type.String(),
  fromStatus: Type.Union([PurchaseOrderStatus, Type.Null()]),
  toStatus: PurchaseOrderStatus,
  changedById: Type.String(),
  changedAt: Type.String({ format: 'date-time' }),
  note: Type.Union([Type.String(), Type.Null()]),
})
export type StatusHistoryEntry = Static<typeof StatusHistoryEntry>

export const LockResponse = Type.Object({
  lockedBy: Type.String(),
  lockedAt: Type.String({ format: 'date-time' }),
  expiresAt: Type.String({ format: 'date-time' }),
})
export type LockResponse = Static<typeof LockResponse>

export const PurchaseOrderListResponse = Type.Object({
  items: Type.Array(PurchaseOrderResponse),
  total: Type.Integer(),
  page: Type.Integer(),
  limit: Type.Integer(),
})
export type PurchaseOrderListResponse = Static<typeof PurchaseOrderListResponse>
