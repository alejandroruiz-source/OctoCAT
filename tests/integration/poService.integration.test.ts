import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { createDb, type DrizzleDB } from '../../src/lib/db/client'
import { runMigrations } from '../../src/lib/db/migrate'
import * as schema from '../../src/lib/db/schema'

// Services — imported as if fully implemented. Tests that call poService.submit()
// will fail red until that function is implemented (TDD mandate, tasks.md §II).
import * as poService from '../../src/lib/services/poService'
import * as lineItemService from '../../src/lib/services/lineItemService'
import * as approvalService from '../../src/lib/services/approvalService'

// ── Constants ──────────────────────────────────────────────────────────────────

const APPROVAL_THRESHOLD_CENTS = 1_000_000 // $10,000

const BUYER_ID = 'buyer-user-001'
const BUYER_ROLE = 'BUYER' as const
const SUPPLIER_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
const SUPPLIER_ROLE = 'SUPPLIER' as const
const APPROVER_ID = 'approver-user-001'
const APPROVER_ROLE = 'APPROVER' as const
const BRANCH_ID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901'

const BASE_PO_INPUT = {
  buyerId: BUYER_ID,
  supplierId: SUPPLIER_ID,
  branchId: BRANCH_ID,
}

const SAMPLE_PRODUCT = {
  productId: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
  productName: 'Widget Pro',
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Create a draft PO and return its id. */
function makeDraftPO(db: DrizzleDB): string {
  const po = poService.create(db, BASE_PO_INPUT)
  return po.id
}

/** Add a line item to a PO and return the line item id. */
function addItem(
  db: DrizzleDB,
  poId: string,
  quantity: number,
  unitPriceCents: number,
): string {
  const item = lineItemService.add(db, poId, {
    ...SAMPLE_PRODUCT,
    quantity,
    unitPriceCents,
  }, BUYER_ID)
  return item.id
}

/** Submit a PO with a future delivery date. */
function submitPO(db: DrizzleDB, poId: string): void {
  poService.submit(db, poId, BUYER_ID, BUYER_ROLE, '2027-01-15')
}

/** Get current PO record from the DB. */
function getPO(db: DrizzleDB, poId: string) {
  return db.select().from(schema.purchaseOrders).where(eq(schema.purchaseOrders.id, poId)).get()
}

/** Get all notifications for a PO. */
function getNotifications(db: DrizzleDB, poId: string) {
  return db
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.purchaseOrderId, poId))
    .all()
}

// ── Setup ──────────────────────────────────────────────────────────────────────

let db: DrizzleDB

beforeEach(() => {
  db = createDb(':memory:')
  runMigrations(db)
})

// ── Test Suite ─────────────────────────────────────────────────────────────────

describe('poService integration', () => {

  // 1. create() ─────────────────────────────────────────────────────────────

  it('create() inserts a PO in DRAFT with PO-YYYY-NNNNNN number format', () => {
    const po = poService.create(db, BASE_PO_INPUT)

    expect(po.status).toBe('DRAFT')
    expect(po.totalCents).toBe(0)
    expect(po.poNumber).toMatch(/^PO-\d{4}-\d{6}$/)
    expect(po.buyerId).toBe(BUYER_ID)

    const currentYear = new Date().getFullYear().toString()
    expect(po.poNumber).toContain(`PO-${currentYear}`)
  })

  // 2. add line item ─────────────────────────────────────────────────────────

  it('add line item computes extendedPriceCents and updates PO totalCents', () => {
    const poId = makeDraftPO(db)

    const item = lineItemService.add(db, poId, {
      ...SAMPLE_PRODUCT,
      quantity: 3,
      unitPriceCents: 50000,
    }, BUYER_ID)

    expect(item.extendedPriceCents).toBe(150000) // 3 * 50000

    const po = getPO(db, poId)
    expect(po?.totalCents).toBe(150000)
  })

  // 3. update line item ──────────────────────────────────────────────────────

  it('update line item recalculates extendedPriceCents and totalCents', () => {
    const poId = makeDraftPO(db)
    const itemId = addItem(db, poId, 3, 50000)

    lineItemService.update(db, poId, itemId, { quantity: 5, unitPriceCents: 20000 }, BUYER_ID)

    const item = db.select().from(schema.lineItems).where(eq(schema.lineItems.id, itemId)).get()
    expect(item?.extendedPriceCents).toBe(100000) // 5 * 20000

    const po = getPO(db, poId)
    expect(po?.totalCents).toBe(100000)
  })

  // 4. delete line item ──────────────────────────────────────────────────────

  it('delete line item recalculates totalCents to 0 when last item removed', () => {
    const poId = makeDraftPO(db)
    const itemId = addItem(db, poId, 2, 75000)

    const poBefore = getPO(db, poId)
    expect(poBefore?.totalCents).toBe(150000)

    lineItemService.remove(db, poId, itemId, BUYER_ID)

    const po = getPO(db, poId)
    expect(po?.totalCents).toBe(0)

    const items = db
      .select()
      .from(schema.lineItems)
      .where(eq(schema.lineItems.purchaseOrderId, poId))
      .all()
    expect(items).toHaveLength(0)
  })

  // 5. cancel() ─────────────────────────────────────────────────────────────

  it('cancel() transitions status to CANCELLED and records history entry', () => {
    const poId = makeDraftPO(db)

    poService.cancel(db, poId, BUYER_ID, BUYER_ROLE)

    const po = getPO(db, poId)
    expect(po?.status).toBe('CANCELLED')

    const history = db
      .select()
      .from(schema.poStatusHistory)
      .where(eq(schema.poStatusHistory.purchaseOrderId, poId))
      .orderBy(schema.poStatusHistory.changedAt)
      .all()

    const cancelEntry = history.find((h) => h.toStatus === 'CANCELLED')
    expect(cancelEntry).toBeDefined()
    expect(cancelEntry?.fromStatus).toBe('DRAFT')
    expect(cancelEntry?.changedById).toBe(BUYER_ID)
  })

  // 6. Lock: acquire, conflict, release ──────────────────────────────────────

  it('acquireLock() sets locked_by on the PO', () => {
    const poId = makeDraftPO(db)

    poService.acquireLock(db, poId, BUYER_ID)

    const po = getPO(db, poId)
    expect(po?.lockedBy).toBe(BUYER_ID)
    expect(po?.lockedAt).toBeGreaterThan(0)
  })

  it('acquireLock() throws PO_LOCKED when a different user tries to acquire an active lock', () => {
    const poId = makeDraftPO(db)

    poService.acquireLock(db, poId, BUYER_ID)

    expect(() => {
      poService.acquireLock(db, poId, 'other-buyer-999')
    }).toThrow()

    // The error thrown must carry PO_LOCKED in its message or code
    try {
      poService.acquireLock(db, poId, 'other-buyer-999')
    } catch (err) {
      expect((err as Error).message).toMatch(/PO_LOCKED|locked/i)
    }
  })

  it('releaseLock() clears the lock fields', () => {
    const poId = makeDraftPO(db)

    poService.acquireLock(db, poId, BUYER_ID)
    poService.releaseLock(db, poId, BUYER_ID)

    const po = getPO(db, poId)
    expect(po?.lockedBy).toBeNull()
    expect(po?.lockedAt).toBeNull()
  })

  // 7. submit() low-value → SUBMITTED + supplier notification ───────────────
  // NOTE: poService.submit() is not yet implemented (T039). Tests fail red until then.

  it('submit() routes low-value PO to SUBMITTED and queues PO_SUBMITTED notification for SUPPLIER', () => {
    const poId = makeDraftPO(db)
    // 5 * 100 = 500 cents — well below the $10,000 threshold
    addItem(db, poId, 5, 100)

    submitPO(db, poId)

    const po = getPO(db, poId)
    expect(po?.status).toBe('SUBMITTED')

    const notifs = getNotifications(db, poId)
    const supplierNotif = notifs.find(
      (n) => n.recipientType === 'SUPPLIER' && n.eventType === 'PO_SUBMITTED',
    )
    expect(supplierNotif).toBeDefined()
    expect(supplierNotif?.status).toBe('PENDING')
  })

  // 8. submit() high-value → AWAITING_APPROVAL + APPROVAL_REQUESTED notification

  it('submit() routes high-value PO (total >= 1M cents) to AWAITING_APPROVAL', () => {
    const poId = makeDraftPO(db)
    // 10 * 200000 = 2,000,000 cents ($20,000) — above threshold
    addItem(db, poId, 10, 200000)

    submitPO(db, poId)

    const po = getPO(db, poId)
    expect(po?.status).toBe('AWAITING_APPROVAL')
    expect(po?.totalCents).toBeGreaterThanOrEqual(APPROVAL_THRESHOLD_CENTS)

    const notifs = getNotifications(db, poId)
    const approvalNotif = notifs.find((n) => n.eventType === 'APPROVAL_REQUESTED')
    expect(approvalNotif).toBeDefined()
    expect(approvalNotif?.status).toBe('PENDING')
  })

  // 9. approve() ────────────────────────────────────────────────────────────

  it('approve() transitions to APPROVED, records approval row, and queues PO_APPROVED supplier notification', () => {
    const poId = makeDraftPO(db)
    addItem(db, poId, 10, 200000)
    submitPO(db, poId)

    approvalService.approve(db, poId, APPROVER_ID, APPROVER_ROLE)

    const po = getPO(db, poId)
    expect(po?.status).toBe('APPROVED')
    expect(po?.approvedAt).toBeGreaterThan(0)

    const approvalRows = db
      .select()
      .from(schema.approvals)
      .where(eq(schema.approvals.purchaseOrderId, poId))
      .all()
    expect(approvalRows).toHaveLength(1)
    expect(approvalRows[0].decision).toBe('APPROVED')
    expect(approvalRows[0].approverId).toBe(APPROVER_ID)

    const notifs = getNotifications(db, poId)
    const approvedNotif = notifs.find((n) => n.eventType === 'PO_APPROVED')
    expect(approvedNotif).toBeDefined()
    expect(approvedNotif?.recipientType).toBe('SUPPLIER')
    expect(approvedNotif?.status).toBe('PENDING')
  })

  // 10. reject() ────────────────────────────────────────────────────────────

  it('reject() transitions to REVISION_REQUIRED and queues 2 notifications (buyer PO_REJECTED + supplier PO_ON_HOLD)', () => {
    const poId = makeDraftPO(db)
    addItem(db, poId, 10, 200000)
    submitPO(db, poId)

    approvalService.reject(db, poId, APPROVER_ID, APPROVER_ROLE, 'Budget exceeded.')

    const po = getPO(db, poId)
    expect(po?.status).toBe('REVISION_REQUIRED')

    const notifs = getNotifications(db, poId)
    const rejectionRelatedNotifs = notifs.filter(
      (n) => n.eventType === 'PO_REJECTED' || n.eventType === 'PO_ON_HOLD',
    )
    expect(rejectionRelatedNotifs).toHaveLength(2)

    const buyerNotif = rejectionRelatedNotifs.find((n) => n.recipientType === 'BUYER')
    expect(buyerNotif?.eventType).toBe('PO_REJECTED')
    expect(buyerNotif?.status).toBe('PENDING')

    const supplierNotif = rejectionRelatedNotifs.find((n) => n.recipientType === 'SUPPLIER')
    expect(supplierNotif?.eventType).toBe('PO_ON_HOLD')
    expect(supplierNotif?.status).toBe('PENDING')
  })

  // 11. resubmit from REVISION_REQUIRED → AWAITING_APPROVAL ─────────────────

  it('submit() from REVISION_REQUIRED transitions back to AWAITING_APPROVAL', () => {
    const poId = makeDraftPO(db)
    addItem(db, poId, 10, 200000)
    submitPO(db, poId)
    approvalService.reject(db, poId, APPROVER_ID, APPROVER_ROLE, 'Please revise quantities.')

    // Buyer resubmits from REVISION_REQUIRED
    submitPO(db, poId)

    const po = getPO(db, poId)
    expect(po?.status).toBe('AWAITING_APPROVAL')
  })

  // 12. fulfill() ───────────────────────────────────────────────────────────

  it('fulfill() transitions a SUBMITTED PO to FULFILLED', () => {
    const poId = makeDraftPO(db)
    addItem(db, poId, 5, 100)
    submitPO(db, poId)

    poService.fulfill(db, poId, SUPPLIER_ID, SUPPLIER_ROLE)

    const po = getPO(db, poId)
    expect(po?.status).toBe('FULFILLED')
    expect(po?.fulfilledAt).toBeGreaterThan(0)
  })

  it('fulfill() transitions an APPROVED PO to FULFILLED', () => {
    const poId = makeDraftPO(db)
    addItem(db, poId, 10, 200000)
    submitPO(db, poId)
    approvalService.approve(db, poId, APPROVER_ID, APPROVER_ROLE)

    poService.fulfill(db, poId, SUPPLIER_ID, SUPPLIER_ROLE)

    const po = getPO(db, poId)
    expect(po?.status).toBe('FULFILLED')
    expect(po?.fulfilledAt).toBeGreaterThan(0)
  })

  it('fulfill() throws for a DRAFT PO (invalid status transition)', () => {
    const poId = makeDraftPO(db)

    expect(() => {
      poService.fulfill(db, poId, SUPPLIER_ID, SUPPLIER_ROLE)
    }).toThrow()
  })

  // 13. getHistory() ─────────────────────────────────────────────────────────

  it('getHistory() returns all transitions in chronological order', () => {
    const poId = makeDraftPO(db)
    poService.cancel(db, poId, BUYER_ID, BUYER_ROLE)

    const history = poService.getHistory(db, poId)

    expect(Array.isArray(history)).toBe(true)
    expect(history.length).toBeGreaterThanOrEqual(2)

    // First entry: initial DRAFT creation (null → DRAFT)
    expect(history[0].toStatus).toBe('DRAFT')
    expect(history[0].fromStatus).toBeNull()

    // Last entry: CANCELLED transition
    const cancelEntry = history[history.length - 1]
    expect(cancelEntry.toStatus).toBe('CANCELLED')
    expect(cancelEntry.fromStatus).toBe('DRAFT')
  })

  it('getHistory() returns complete history across a full approval lifecycle', () => {
    const poId = makeDraftPO(db)
    addItem(db, poId, 10, 200000)
    submitPO(db, poId)                                                             // DRAFT → AWAITING_APPROVAL
    approvalService.reject(db, poId, APPROVER_ID, APPROVER_ROLE, 'Revise totals.') // → REVISION_REQUIRED
    submitPO(db, poId)                                                             // → AWAITING_APPROVAL
    approvalService.approve(db, poId, APPROVER_ID, APPROVER_ROLE)                  // → APPROVED
    poService.fulfill(db, poId, SUPPLIER_ID, SUPPLIER_ROLE)                        // → FULFILLED

    const history = poService.getHistory(db, poId)

    // Minimum 6 rows: DRAFT creation + 5 transitions
    expect(history.length).toBeGreaterThanOrEqual(6)

    const statuses = history.map((h) => h.toStatus)
    expect(statuses).toContain('DRAFT')
    expect(statuses).toContain('AWAITING_APPROVAL')
    expect(statuses).toContain('REVISION_REQUIRED')
    expect(statuses).toContain('APPROVED')
    expect(statuses).toContain('FULFILLED')

    // Verify chronological ordering
    for (let i = 1; i < history.length; i++) {
      const prev = new Date(history[i - 1].changedAt).getTime()
      const curr = new Date(history[i].changedAt).getTime()
      expect(curr).toBeGreaterThanOrEqual(prev)
    }
  })
})
