import { Type, Static } from '@sinclair/typebox'

export const AddLineItemRequest = Type.Object({
  productId: Type.String({ format: 'uuid' }),
  productName: Type.String({ maxLength: 255 }),
  quantity: Type.Integer({ minimum: 1 }),
  unitPriceCents: Type.Integer({ minimum: 1, description: 'Unit price in USD cents' }),
})
export type AddLineItemRequest = Static<typeof AddLineItemRequest>

export const UpdateLineItemRequest = Type.Object({
  quantity: Type.Optional(Type.Integer({ minimum: 1 })),
  unitPriceCents: Type.Optional(Type.Integer({ minimum: 1 })),
})
export type UpdateLineItemRequest = Static<typeof UpdateLineItemRequest>

export const LineItemResponse = Type.Object({
  id: Type.String({ format: 'uuid' }),
  purchaseOrderId: Type.String({ format: 'uuid' }),
  lineNumber: Type.Integer({ minimum: 1 }),
  productId: Type.String({ format: 'uuid' }),
  productName: Type.String(),
  quantity: Type.Integer({ minimum: 1 }),
  unitPriceCents: Type.Integer({ minimum: 1 }),
  extendedPriceCents: Type.Integer({ minimum: 1 }),
})
export type LineItemResponse = Static<typeof LineItemResponse>
