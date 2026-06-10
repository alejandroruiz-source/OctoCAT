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

const SUPPLIER_HEADERS = {
  'x-test-user-id': 'supplier-1',
  'x-test-user-role': 'SUPPLIER',
}

const APPROVER_HEADERS = {
  'x-test-user-id': 'approver-1',
  'x-test-user-role': 'APPROVER',
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

const FUTURE_DATE = '2027-01-15'

async function createTestApp(): Promise<FastifyInstance> {
  const db = createDb(':memory:')
  runMigrations(db)
  return buildApp(db, { auth: { testMode: true } })
}

async function createPO(app: FastifyInstance): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/purchase-orders',
    headers: BUYER_HEADERS,
    payload: VALID_PO_BODY,
  })
  const body = JSON.parse(res.body)
  return body.id
}

async function addLineItem(app: FastifyInstance, poId: string, overrides?: object): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: `/api/v1/purchase-orders/${poId}/line-items`,
    headers: BUYER_HEADERS,
    payload: { ...VALID_LINE_ITEM_BODY, ...overrides },
  })
  const body = JSON.parse(res.body)
  return body.id
}

// ── Test Suite ─────────────────────────────────────────────────────────────────

describe('Purchase Orders Contract', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = await createTestApp()
  })

  // ── POST /api/v1/purchase-orders ───────────────────────────────────────────

  describe('POST /api/v1/purchase-orders', () => {
    it('returns 201 with DRAFT PO shape', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/purchase-orders',
        headers: BUYER_HEADERS,
        payload: VALID_PO_BODY,
      })

      expect(response.statusCode).toBe(201)

      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('id')
      expect(body).toHaveProperty('poNumber')
      expect(body.status).toBe('DRAFT')
      expect(body.totalCents).toBe(0)
      expect(typeof body.id).toBe('string')
      expect(body.poNumber).toMatch(/^PO-\d{4}-\d{6}$/)
    })
  })

  // ── GET /api/v1/purchase-orders ────────────────────────────────────────────

  describe('GET /api/v1/purchase-orders', () => {
    it('returns 200 with paginated list shape', async () => {
      await createPO(app)

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/purchase-orders',
        headers: BUYER_HEADERS,
      })

      expect(response.statusCode).toBe(200)

      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('items')
      expect(body).toHaveProperty('total')
      expect(body).toHaveProperty('page')
      expect(body).toHaveProperty('limit')
      expect(Array.isArray(body.items)).toBe(true)
      expect(typeof body.total).toBe('number')
      expect(typeof body.page).toBe('number')
      expect(typeof body.limit).toBe('number')
    })
  })

  // ── GET /api/v1/purchase-orders/:poId ─────────────────────────────────────

  describe('GET /api/v1/purchase-orders/:poId', () => {
    it('returns 200 with lineItems and statusHistory arrays', async () => {
      const poId = await createPO(app)

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/purchase-orders/${poId}`,
        headers: BUYER_HEADERS,
      })

      expect(response.statusCode).toBe(200)

      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('id', poId)
      expect(Array.isArray(body.lineItems)).toBe(true)
      expect(Array.isArray(body.statusHistory)).toBe(true)
    })

    it('returns 404 for unknown PO id', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/purchase-orders/00000000-0000-0000-0000-000000000000',
        headers: BUYER_HEADERS,
      })

      expect(response.statusCode).toBe(404)
    })
  })

  // ── PATCH /api/v1/purchase-orders/:poId ───────────────────────────────────

  describe('PATCH /api/v1/purchase-orders/:poId', () => {
    it('returns 200 with updated notes', async () => {
      const poId = await createPO(app)

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/purchase-orders/${poId}`,
        headers: BUYER_HEADERS,
        payload: { notes: 'Please deliver to loading dock B.' },
      })

      expect(response.statusCode).toBe(200)

      const body = JSON.parse(response.body)
      expect(body.notes).toBe('Please deliver to loading dock B.')
    })
  })

  // ── POST /api/v1/purchase-orders/:poId/cancel ─────────────────────────────

  describe('POST /api/v1/purchase-orders/:poId/cancel', () => {
    it('returns 200 with status CANCELLED', async () => {
      const poId = await createPO(app)

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/purchase-orders/${poId}/cancel`,
        headers: BUYER_HEADERS,
      })

      expect(response.statusCode).toBe(200)

      const body = JSON.parse(response.body)
      expect(body.status).toBe('CANCELLED')
    })
  })

  // ── POST /api/v1/purchase-orders/:poId/lock ───────────────────────────────

  describe('POST /api/v1/purchase-orders/:poId/lock', () => {
    it('returns 200 with lock response shape', async () => {
      const poId = await createPO(app)

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/purchase-orders/${poId}/lock`,
        headers: BUYER_HEADERS,
      })

      expect(response.statusCode).toBe(200)

      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('lockedBy')
      expect(body).toHaveProperty('lockedAt')
      expect(body).toHaveProperty('expiresAt')
      expect(body.lockedBy).toBe('buyer-1')
    })
  })

  // ── DELETE /api/v1/purchase-orders/:poId/lock ─────────────────────────────

  describe('DELETE /api/v1/purchase-orders/:poId/lock', () => {
    it('returns 204 after releasing lock', async () => {
      const poId = await createPO(app)

      await app.inject({
        method: 'POST',
        url: `/api/v1/purchase-orders/${poId}/lock`,
        headers: BUYER_HEADERS,
      })

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/purchase-orders/${poId}/lock`,
        headers: BUYER_HEADERS,
      })

      expect(response.statusCode).toBe(204)
    })
  })

  // ── POST /api/v1/purchase-orders/:poId/submit ─────────────────────────────

  describe('POST /api/v1/purchase-orders/:poId/submit', () => {
    it('returns 200 and changes status when PO has line items and deliveryDate', async () => {
      const poId = await createPO(app)
      await addLineItem(app, poId)

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/purchase-orders/${poId}/submit`,
        headers: BUYER_HEADERS,
        payload: { expectedDeliveryDate: FUTURE_DATE },
      })

      expect(response.statusCode).toBe(200)

      const body = JSON.parse(response.body)
      expect(['SUBMITTED', 'AWAITING_APPROVAL']).toContain(body.status)
    })

    it('returns 422 when PO has no line items', async () => {
      const poId = await createPO(app)

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/purchase-orders/${poId}/submit`,
        headers: BUYER_HEADERS,
        payload: { expectedDeliveryDate: FUTURE_DATE },
      })

      expect(response.statusCode).toBe(422)
    })

    it('returns 422 when expectedDeliveryDate is missing', async () => {
      const poId = await createPO(app)
      await addLineItem(app, poId)

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/purchase-orders/${poId}/submit`,
        headers: BUYER_HEADERS,
        payload: {},
      })

      expect(response.statusCode).toBe(422)
    })
  })

  // ── POST /api/v1/purchase-orders/:poId/fulfill ────────────────────────────

  describe('POST /api/v1/purchase-orders/:poId/fulfill', () => {
    it('returns 200 with FULFILLED status for supplier after submit', async () => {
      const poId = await createPO(app)
      await addLineItem(app, poId)

      await app.inject({
        method: 'POST',
        url: `/api/v1/purchase-orders/${poId}/submit`,
        headers: BUYER_HEADERS,
        payload: { expectedDeliveryDate: FUTURE_DATE },
      })

      // Fulfill requires the PO to be SUBMITTED (low-value) or APPROVED
      // Use a low-value line item so it goes to SUBMITTED directly
      const fulfillResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/purchase-orders/${poId}/fulfill`,
        headers: {
          'x-test-user-id': VALID_PO_BODY.supplierId,
          'x-test-user-role': 'SUPPLIER',
        },
      })

      expect(fulfillResponse.statusCode).toBe(200)

      const body = JSON.parse(fulfillResponse.body)
      expect(body.status).toBe('FULFILLED')
    })

    it('returns 403 for buyer role attempting to fulfill', async () => {
      const poId = await createPO(app)
      await addLineItem(app, poId)

      await app.inject({
        method: 'POST',
        url: `/api/v1/purchase-orders/${poId}/submit`,
        headers: BUYER_HEADERS,
        payload: { expectedDeliveryDate: FUTURE_DATE },
      })

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/purchase-orders/${poId}/fulfill`,
        headers: BUYER_HEADERS,
      })

      expect(response.statusCode).toBe(403)
    })
  })

  // ── GET /api/v1/purchase-orders/:poId/history ─────────────────────────────

  describe('GET /api/v1/purchase-orders/:poId/history', () => {
    it('returns 200 with array of history entries', async () => {
      const poId = await createPO(app)

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/purchase-orders/${poId}/history`,
        headers: BUYER_HEADERS,
      })

      expect(response.statusCode).toBe(200)

      const body = JSON.parse(response.body)
      expect(Array.isArray(body)).toBe(true)
      expect(body.length).toBeGreaterThanOrEqual(1)

      const firstEntry = body[0]
      expect(firstEntry).toHaveProperty('id')
      expect(firstEntry).toHaveProperty('purchaseOrderId', poId)
      expect(firstEntry).toHaveProperty('toStatus')
      expect(firstEntry).toHaveProperty('changedById')
      expect(firstEntry).toHaveProperty('changedAt')
    })
  })
})
