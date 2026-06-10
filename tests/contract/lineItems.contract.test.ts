import { describe, it, expect, beforeEach } from 'vitest'
import { buildApp } from '../../src/api/app'
import { createDb } from '../../src/lib/db/client'
import { runMigrations } from '../../src/lib/db/migrate'
import type { FastifyInstance } from 'fastify'

// ── Helpers ────────────────────────────────────────────────────────────────────

const BUYER_HEADERS = {
  'x-test-user-id': 'buyer-1',
  'x-test-user-role': 'BUYER',
}

const VALID_PO_BODY = {
  supplierId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  branchId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
}

const VALID_LINE_ITEM_BODY = {
  productId: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
  productName: 'Widget Pro',
  quantity: 5,
  unitPriceCents: 10000,
}

async function createTestApp(): Promise<FastifyInstance> {
  const db = createDb(':memory:')
  runMigrations(db)
  return buildApp(db, { auth: { testMode: true } })
}

async function createDraftPO(app: FastifyInstance): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/purchase-orders',
    headers: BUYER_HEADERS,
    payload: VALID_PO_BODY,
  })
  return JSON.parse(res.body).id
}

async function addLineItem(
  app: FastifyInstance,
  poId: string,
  overrides?: object,
): Promise<{ id: string; body: ReturnType<typeof JSON.parse> }> {
  const res = await app.inject({
    method: 'POST',
    url: `/api/v1/purchase-orders/${poId}/line-items`,
    headers: BUYER_HEADERS,
    payload: { ...VALID_LINE_ITEM_BODY, ...overrides },
  })
  const body = JSON.parse(res.body)
  return { id: body.id, body }
}

async function submitPO(app: FastifyInstance, poId: string): Promise<void> {
  await app.inject({
    method: 'POST',
    url: `/api/v1/purchase-orders/${poId}/submit`,
    headers: BUYER_HEADERS,
    payload: { expectedDeliveryDate: '2027-01-15' },
  })
}

// ── Test Suite ─────────────────────────────────────────────────────────────────

describe('Line Items Contract', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = await createTestApp()
  })

  // ── POST /api/v1/purchase-orders/:poId/line-items ─────────────────────────

  describe('POST /api/v1/purchase-orders/:poId/line-items', () => {
    it('returns 201 with correct line item shape', async () => {
      const poId = await createDraftPO(app)

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/purchase-orders/${poId}/line-items`,
        headers: BUYER_HEADERS,
        payload: VALID_LINE_ITEM_BODY,
      })

      expect(response.statusCode).toBe(201)

      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('id')
      expect(body.lineNumber).toBe(1)
      expect(body.extendedPriceCents).toBe(
        VALID_LINE_ITEM_BODY.quantity * VALID_LINE_ITEM_BODY.unitPriceCents,
      )
      expect(body.purchaseOrderId).toBe(poId)
    })

    it('assigns sequential lineNumbers for multiple line items', async () => {
      const poId = await createDraftPO(app)

      const res1 = await app.inject({
        method: 'POST',
        url: `/api/v1/purchase-orders/${poId}/line-items`,
        headers: BUYER_HEADERS,
        payload: VALID_LINE_ITEM_BODY,
      })
      const res2 = await app.inject({
        method: 'POST',
        url: `/api/v1/purchase-orders/${poId}/line-items`,
        headers: BUYER_HEADERS,
        payload: { ...VALID_LINE_ITEM_BODY, productName: 'Gadget Deluxe' },
      })

      expect(JSON.parse(res1.body).lineNumber).toBe(1)
      expect(JSON.parse(res2.body).lineNumber).toBe(2)
    })

    it('returns 400 for quantity=0', async () => {
      const poId = await createDraftPO(app)

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/purchase-orders/${poId}/line-items`,
        headers: BUYER_HEADERS,
        payload: { ...VALID_LINE_ITEM_BODY, quantity: 0 },
      })

      expect(response.statusCode).toBe(400)
    })
  })

  // ── PATCH /api/v1/purchase-orders/:poId/line-items/:lineItemId ────────────

  describe('PATCH /api/v1/purchase-orders/:poId/line-items/:lineItemId', () => {
    it('returns 200 with updated extendedPriceCents', async () => {
      const poId = await createDraftPO(app)
      const { id: lineItemId } = await addLineItem(app, poId)

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/purchase-orders/${poId}/line-items/${lineItemId}`,
        headers: BUYER_HEADERS,
        payload: { quantity: 10, unitPriceCents: 2000 },
      })

      expect(response.statusCode).toBe(200)

      const body = JSON.parse(response.body)
      expect(body.extendedPriceCents).toBe(20000) // 10 * 2000
    })

    it('returns 409 when PO is in SUBMITTED status (non-DRAFT)', async () => {
      const poId = await createDraftPO(app)
      const { id: lineItemId } = await addLineItem(app, poId)
      await submitPO(app, poId)

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/purchase-orders/${poId}/line-items/${lineItemId}`,
        headers: BUYER_HEADERS,
        payload: { quantity: 3 },
      })

      expect(response.statusCode).toBe(409)
    })
  })

  // ── DELETE /api/v1/purchase-orders/:poId/line-items/:lineItemId ───────────

  describe('DELETE /api/v1/purchase-orders/:poId/line-items/:lineItemId', () => {
    it('returns 204 for a valid DRAFT PO line item', async () => {
      const poId = await createDraftPO(app)
      const { id: lineItemId } = await addLineItem(app, poId)

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/purchase-orders/${poId}/line-items/${lineItemId}`,
        headers: BUYER_HEADERS,
      })

      expect(response.statusCode).toBe(204)
    })

    it('returns 409 for a line item on a submitted PO', async () => {
      const poId = await createDraftPO(app)
      const { id: lineItemId } = await addLineItem(app, poId)
      await submitPO(app, poId)

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/purchase-orders/${poId}/line-items/${lineItemId}`,
        headers: BUYER_HEADERS,
      })

      expect(response.statusCode).toBe(409)
    })
  })
})
