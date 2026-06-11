import { describe, it, expect, beforeEach } from 'vitest'
import { buildApp } from '../../src/api/app'
import { createDb } from '../../src/lib/db/client'
import { runMigrations } from '../../src/lib/db/migrate'
import type { FastifyInstance } from 'fastify'

// ── Helpers ────────────────────────────────────────────────────────────────────

const SUPPLIER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

const BUYER_HEADERS = {
  'x-test-user-id': 'buyer-1',
  'x-test-user-role': 'BUYER',
}

const APPROVER_HEADERS = {
  'x-test-user-id': 'approver-1',
  'x-test-user-role': 'APPROVER',
}

const VALID_PO_BODY = {
  supplierId: SUPPLIER_ID,
  branchId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
}

// A line item priced high enough that total (quantity=10, unitPrice=1_500_000)
// = 15_000_000 cents ($150,000) — well above the $10,000 approval threshold.
const HIGH_VALUE_LINE_ITEM = {
  productId: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
  productName: 'Enterprise Server Rack',
  quantity: 10,
  unitPriceCents: 1_500_000, // $15,000 per unit → $150,000 total
}

// A low-value line item that stays under the approval threshold.
const LOW_VALUE_LINE_ITEM = {
  productId: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
  productName: 'Office Pen',
  quantity: 2,
  unitPriceCents: 100, // $1 per unit → $2 total
}

async function createTestApp(): Promise<FastifyInstance> {
  const db = createDb(':memory:')
  runMigrations(db)
  return buildApp(db, { auth: { testMode: true } })
}

/** Creates a PO, adds the given line item, and submits it. Returns the PO id. */
async function createAndSubmitPO(
  app: FastifyInstance,
  lineItemBody: object,
): Promise<string> {
  // Create PO
  const createRes = await app.inject({
    method: 'POST',
    url: '/api/v1/purchase-orders',
    headers: BUYER_HEADERS,
    payload: VALID_PO_BODY,
  })
  const poId = JSON.parse(createRes.body).id

  // Add line item
  await app.inject({
    method: 'POST',
    url: `/api/v1/purchase-orders/${poId}/line-items`,
    headers: BUYER_HEADERS,
    payload: lineItemBody,
  })

  // Submit
  await app.inject({
    method: 'POST',
    url: `/api/v1/purchase-orders/${poId}/submit`,
    headers: BUYER_HEADERS,
    payload: { expectedDeliveryDate: '2027-01-15' },
  })

  return poId
}

// ── Test Suite ─────────────────────────────────────────────────────────────────

describe('Approvals Contract', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = await createTestApp()
  })

  // ── POST /api/v1/purchase-orders/:poId/approve ────────────────────────────

  describe('POST /api/v1/purchase-orders/:poId/approve', () => {
    it('returns 200 with decision=APPROVED for AWAITING_APPROVAL PO', async () => {
      const poId = await createAndSubmitPO(app, HIGH_VALUE_LINE_ITEM)

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/purchase-orders/${poId}/approve`,
        headers: APPROVER_HEADERS,
      })

      expect(response.statusCode).toBe(200)

      const body = JSON.parse(response.body)
      expect(body.decision).toBe('APPROVED')
    })

    it('returns 403 when a BUYER attempts to approve', async () => {
      const poId = await createAndSubmitPO(app, HIGH_VALUE_LINE_ITEM)

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/purchase-orders/${poId}/approve`,
        headers: BUYER_HEADERS,
      })

      expect(response.statusCode).toBe(403)
    })

    it('returns 409 when the PO is not in AWAITING_APPROVAL status', async () => {
      // Low-value PO goes to SUBMITTED, not AWAITING_APPROVAL
      const poId = await createAndSubmitPO(app, LOW_VALUE_LINE_ITEM)

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/purchase-orders/${poId}/approve`,
        headers: APPROVER_HEADERS,
      })

      expect(response.statusCode).toBe(409)
    })
  })

  // ── POST /api/v1/purchase-orders/:poId/reject ─────────────────────────────

  describe('POST /api/v1/purchase-orders/:poId/reject', () => {
    it('returns 200 with decision=REJECTED and the rejection reason', async () => {
      const poId = await createAndSubmitPO(app, HIGH_VALUE_LINE_ITEM)

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/purchase-orders/${poId}/reject`,
        headers: APPROVER_HEADERS,
        payload: { reason: 'Budget exceeded for Q1.' },
      })

      expect(response.statusCode).toBe(200)

      const body = JSON.parse(response.body)
      expect(body.decision).toBe('REJECTED')
      expect(body.reason).toBe('Budget exceeded for Q1.')
    })

    it('returns 400 when no reason is provided', async () => {
      const poId = await createAndSubmitPO(app, HIGH_VALUE_LINE_ITEM)

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/purchase-orders/${poId}/reject`,
        headers: APPROVER_HEADERS,
        payload: {},
      })

      expect(response.statusCode).toBe(400)
    })

    it('returns 403 when a BUYER attempts to reject', async () => {
      const poId = await createAndSubmitPO(app, HIGH_VALUE_LINE_ITEM)

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/purchase-orders/${poId}/reject`,
        headers: BUYER_HEADERS,
        payload: { reason: 'I changed my mind.' },
      })

      expect(response.statusCode).toBe(403)
    })
  })

  // ── High-value PO routing ──────────────────────────────────────────────────

  describe('High-value PO approval routing', () => {
    it('routes a PO with total >= 1,000,000 cents to AWAITING_APPROVAL on submit', async () => {
      const poId = await createAndSubmitPO(app, HIGH_VALUE_LINE_ITEM)

      const detailRes = await app.inject({
        method: 'GET',
        url: `/api/v1/purchase-orders/${poId}`,
        headers: BUYER_HEADERS,
      })

      expect(detailRes.statusCode).toBe(200)
      const body = JSON.parse(detailRes.body)
      expect(body.status).toBe('AWAITING_APPROVAL')
      // quantity=10, unitPriceCents=1_500_000 → total = 15_000_000 cents
      expect(body.totalCents).toBe(15_000_000)
    })
  })
})
