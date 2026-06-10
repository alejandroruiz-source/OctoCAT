import { eq, sql, and, desc, asc, inArray, not } from 'drizzle-orm'
import * as schema from '../db/schema'
import { type DrizzleDB } from '../db/client'
import {
  validateTransition,
  canEdit,
  type UserRole,
} from './stateMachine'
import {
  requiresApproval,
  computeApprovalDeadline,
} from './pricing'
import { v4 as uuidv4 } from 'uuid'
import { type PurchaseOrderStatus } from '../models/purchaseOrder'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CreatePOInput {
  supplierId: string
  branchId: string
  buyerId: string
  expectedDeliveryDate?: string | null
  notes?: string | null
}

export interface UpdatePOInput {
  notes?: string | null
  expectedDeliveryDate?: string | null
}

export interface ListPOsInput {
  userId: string
  role: UserRole
  status?: string[]
  supplierId?: string
  page?: number
  limit?: number
}

export interface LineItemRow {
  id: string
  purchaseOrderId: string
  lineNumber: number
  productId: string
  productName: string
  quantity: number
  unitPriceCents: number
  extendedPriceCents: number
}

export interface POResponse {
  id: string
  poNumber: string
  status: PurchaseOrderStatus
  buyerId: string
  branchId: string
  supplierId: string
  expectedDeliveryDate: string | null
  totalCents: number
  notes: string | null
  lockedBy: string | null
  lockedAt: string | null
  approvalDeadline: string | null
  createdAt: string
  updatedAt: string
  submittedAt: string | null
  approvedAt: string | null
  fulfilledAt: string | null
  lineItems?: LineItemRow[]
  statusHistory?: HistoryEntry[]
}

export interface LockResult {
  lockedBy: string
  lockedAt: string
  expiresAt: string
}

export interface HistoryEntry {
  id: string
  purchaseOrderId: string
  fromStatus: PurchaseOrderStatus | null
  toStatus: PurchaseOrderStatus
  changedById: string
  changedAt: string
  note: string | null
}

export interface ListResult {
  items: POResponse[]
  total: number
  page: number
  limit: number
}

// ── Constants ──────────────────────────────────────────────────────────────────

const LOCK_DURATION_MS = 1_800_000 // 30 minutes

// ── Helpers ────────────────────────────────────────────────────────────────────

export function isLockExpired(lockedAt: number | null | undefined): boolean {
  if (lockedAt == null) return true
  return lockedAt < Date.now() - LOCK_DURATION_MS
}

export function formatPoResponse(
  po: typeof schema.purchaseOrders.$inferSelect,
  lineItems?: (typeof schema.lineItems.$inferSelect)[],
  history?: (typeof schema.poStatusHistory.$inferSelect)[],
): POResponse {
  let approvalDeadline: string | null = null
  if (po.status === 'AWAITING_APPROVAL' && po.submittedAt != null) {
    approvalDeadline = computeApprovalDeadline(po.submittedAt).toISOString()
  }

  const result: POResponse = {
    id: po.id,
    poNumber: po.poNumber,
    status: po.status as PurchaseOrderStatus,
    buyerId: po.buyerId,
    branchId: po.branchId,
    supplierId: po.supplierId,
    expectedDeliveryDate: po.expectedDeliveryDate ?? null,
    totalCents: po.totalCents,
    notes: po.notes ?? null,
    lockedBy: po.lockedBy ?? null,
    lockedAt: po.lockedAt != null ? new Date(po.lockedAt).toISOString() : null,
    approvalDeadline,
    createdAt: new Date(po.createdAt).toISOString(),
    updatedAt: new Date(po.updatedAt).toISOString(),
    submittedAt: po.submittedAt != null ? new Date(po.submittedAt).toISOString() : null,
    approvedAt: po.approvedAt != null ? new Date(po.approvedAt).toISOString() : null,
    fulfilledAt: po.fulfilledAt != null ? new Date(po.fulfilledAt).toISOString() : null,
  }

  if (lineItems !== undefined) {
    result.lineItems = lineItems
  }

  if (history !== undefined) {
    result.statusHistory = history.map((row) => ({
      id: row.id,
      purchaseOrderId: row.purchaseOrderId,
      fromStatus: (row.fromStatus ?? null) as PurchaseOrderStatus | null,
      toStatus: row.toStatus as PurchaseOrderStatus,
      changedById: row.changedById,
      changedAt: new Date(row.changedAt).toISOString(),
      note: row.note ?? null,
    }))
  }

  return result
}

export function recordStatusHistory(
  db: DrizzleDB,
  poId: string,
  fromStatus: string | null,
  toStatus: string,
  changedById: string,
  note?: string | null,
): void {
  db.insert(schema.poStatusHistory).values({
    id: uuidv4(),
    purchaseOrderId: poId,
    fromStatus: fromStatus ?? null,
    toStatus,
    changedById,
    changedAt: Date.now(),
    note: note ?? null,
  }).run()
}

export interface QueueNotificationInput {
  purchaseOrderId: string
  recipientType: 'SUPPLIER' | 'APPROVER' | 'BUYER'
  recipientId: string
  eventType: 'PO_SUBMITTED' | 'PO_APPROVED' | 'PO_REJECTED' | 'PO_ON_HOLD' | 'APPROVAL_REQUESTED'
  payload: Record<string, unknown>
}

export function queueNotification(db: DrizzleDB, input: QueueNotificationInput): void {
  db.insert(schema.notifications).values({
    id: uuidv4(),
    purchaseOrderId: input.purchaseOrderId,
    recipientType: input.recipientType,
    recipientId: input.recipientId,
    eventType: input.eventType,
    payload: JSON.stringify(input.payload),
    status: 'PENDING',
    retryCount: 0,
    createdAt: Date.now(),
    sentAt: null,
    lastAttemptAt: null,
  }).run()
}

// ── PO Number Generation ───────────────────────────────────────────────────────

export function generatePoNumber(db: DrizzleDB, year: number): string {
  // Insert row with lastSeq=0 if it doesn't exist yet
  db.insert(schema.poNumberSequences)
    .values({ year, lastSeq: 0 })
    .onConflictDoNothing()
    .run()

  // Atomically increment
  db.update(schema.poNumberSequences)
    .set({ lastSeq: sql`${schema.poNumberSequences.lastSeq} + 1` })
    .where(eq(schema.poNumberSequences.year, year))
    .run()

  // Read back the new value
  const row = db
    .select({ lastSeq: schema.poNumberSequences.lastSeq })
    .from(schema.poNumberSequences)
    .where(eq(schema.poNumberSequences.year, year))
    .get()

  if (!row) {
    throw new Error('Failed to generate PO number sequence')
  }

  const seq = String(row.lastSeq).padStart(6, '0')
  return `PO-${year}-${seq}`
}

// ── Create ─────────────────────────────────────────────────────────────────────

export function create(db: DrizzleDB, input: CreatePOInput): POResponse {
  const now = Date.now()
  const year = new Date(now).getFullYear()
  const id = uuidv4()
  const poNumber = generatePoNumber(db, year)

  db.insert(schema.purchaseOrders).values({
    id,
    poNumber,
    status: 'DRAFT',
    buyerId: input.buyerId,
    branchId: input.branchId,
    supplierId: input.supplierId,
    expectedDeliveryDate: input.expectedDeliveryDate ?? null,
    totalCents: 0,
    notes: input.notes ?? null,
    lockedBy: null,
    lockedAt: null,
    createdAt: now,
    updatedAt: now,
    submittedAt: null,
    approvedAt: null,
    fulfilledAt: null,
  }).run()

  recordStatusHistory(db, id, null, 'DRAFT', input.buyerId)

  const po = db
    .select()
    .from(schema.purchaseOrders)
    .where(eq(schema.purchaseOrders.id, id))
    .get()

  if (!po) {
    throw new Error('PO_NOT_FOUND')
  }

  return formatPoResponse(po)
}

// ── Get By ID ──────────────────────────────────────────────────────────────────

export function getById(
  db: DrizzleDB,
  poId: string,
  userId: string,
  role: UserRole,
): POResponse | null {
  const po = db
    .select()
    .from(schema.purchaseOrders)
    .where(eq(schema.purchaseOrders.id, poId))
    .get()

  if (!po) return null

  // Role-based visibility
  if (role === 'BUYER' && po.buyerId !== userId) return null
  if (role === 'SUPPLIER') {
    if (po.supplierId !== userId) return null
    if (po.status === 'DRAFT') return null
  }
  // APPROVER sees all

  const items = db
    .select()
    .from(schema.lineItems)
    .where(eq(schema.lineItems.purchaseOrderId, poId))
    .all()

  const history = db
    .select()
    .from(schema.poStatusHistory)
    .where(eq(schema.poStatusHistory.purchaseOrderId, poId))
    .orderBy(asc(schema.poStatusHistory.changedAt))
    .all()

  return formatPoResponse(po, items, history)
}

// ── List ───────────────────────────────────────────────────────────────────────

export function list(db: DrizzleDB, input: ListPOsInput): ListResult {
  const page = input.page ?? 1
  const limit = input.limit ?? 20
  const offset = (page - 1) * limit

  // Build where conditions based on role
  const conditions: ReturnType<typeof eq>[] = []

  if (input.role === 'BUYER') {
    conditions.push(eq(schema.purchaseOrders.buyerId, input.userId))
  } else if (input.role === 'SUPPLIER') {
    conditions.push(eq(schema.purchaseOrders.supplierId, input.userId))
    conditions.push(not(eq(schema.purchaseOrders.status, 'DRAFT')) as ReturnType<typeof eq>)
  }
  // APPROVER: no restriction

  if (input.supplierId) {
    conditions.push(eq(schema.purchaseOrders.supplierId, input.supplierId))
  }

  if (input.status && input.status.length > 0) {
    conditions.push(
      inArray(schema.purchaseOrders.status, input.status as PurchaseOrderStatus[]) as unknown as ReturnType<typeof eq>,
    )
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  // Count total
  const countResult = db
    .select({ count: sql<number>`count(*)` })
    .from(schema.purchaseOrders)
    .where(whereClause)
    .get()

  const total = countResult?.count ?? 0

  // Fetch page
  const rows = db
    .select()
    .from(schema.purchaseOrders)
    .where(whereClause)
    .orderBy(desc(schema.purchaseOrders.createdAt))
    .limit(limit)
    .offset(offset)
    .all()

  return {
    items: rows.map((po) => formatPoResponse(po)),
    total,
    page,
    limit,
  }
}

// ── Update ─────────────────────────────────────────────────────────────────────

export function update(
  db: DrizzleDB,
  poId: string,
  input: UpdatePOInput,
  userId: string,
  role: UserRole,
): POResponse {
  const po = db
    .select()
    .from(schema.purchaseOrders)
    .where(eq(schema.purchaseOrders.id, poId))
    .get()

  if (!po) {
    const err = new Error('PO not found') as Error & { code: string }
    err.code = 'PO_NOT_FOUND'
    throw err
  }

  if (po.buyerId !== userId) {
    throw new Error('Only the buyer can update this PO')
  }

  if (!canEdit(po.status as PurchaseOrderStatus)) {
    throw new Error(`PO in status ${po.status} cannot be edited`)
  }

  // Check lock: if locked by another user and lock is not expired, deny
  if (po.lockedBy != null && po.lockedBy !== userId && !isLockExpired(po.lockedAt)) {
    const err = new Error('PO is locked by another user') as Error & { code: string }
    err.code = 'PO_LOCKED'
    throw err
  }

  const now = Date.now()
  const updates: Partial<typeof schema.purchaseOrders.$inferInsert> = {
    updatedAt: now,
  }

  if (input.notes !== undefined) updates.notes = input.notes
  if (input.expectedDeliveryDate !== undefined) updates.expectedDeliveryDate = input.expectedDeliveryDate

  db.update(schema.purchaseOrders)
    .set(updates)
    .where(eq(schema.purchaseOrders.id, poId))
    .run()

  const updated = db
    .select()
    .from(schema.purchaseOrders)
    .where(eq(schema.purchaseOrders.id, poId))
    .get()

  if (!updated) {
    const err = new Error('PO not found after update') as Error & { code: string }
    err.code = 'PO_NOT_FOUND'
    throw err
  }

  return formatPoResponse(updated)
}

// ── Cancel ─────────────────────────────────────────────────────────────────────

export function cancel(
  db: DrizzleDB,
  poId: string,
  userId: string,
  role: UserRole,
): POResponse {
  const po = db
    .select()
    .from(schema.purchaseOrders)
    .where(eq(schema.purchaseOrders.id, poId))
    .get()

  if (!po) {
    const err = new Error('PO not found') as Error & { code: string }
    err.code = 'PO_NOT_FOUND'
    throw err
  }

  if (po.buyerId !== userId) {
    throw new Error('Only the buyer can cancel this PO')
  }

  validateTransition(po.status as PurchaseOrderStatus, 'CANCELLED', role)

  const now = Date.now()

  db.update(schema.purchaseOrders)
    .set({ status: 'CANCELLED', updatedAt: now })
    .where(eq(schema.purchaseOrders.id, poId))
    .run()

  recordStatusHistory(db, poId, po.status, 'CANCELLED', userId)

  const updated = db
    .select()
    .from(schema.purchaseOrders)
    .where(eq(schema.purchaseOrders.id, poId))
    .get()

  if (!updated) {
    const err = new Error('PO not found after cancel') as Error & { code: string }
    err.code = 'PO_NOT_FOUND'
    throw err
  }

  return formatPoResponse(updated)
}

// ── Lock ───────────────────────────────────────────────────────────────────────

export function acquireLock(db: DrizzleDB, poId: string, userId: string): LockResult {
  // Use a transaction for atomicity
  return db.transaction((tx) => {
    const po = tx
      .select()
      .from(schema.purchaseOrders)
      .where(eq(schema.purchaseOrders.id, poId))
      .get()

    if (!po) {
      const err = new Error('PO not found') as Error & { code: string }
      err.code = 'PO_NOT_FOUND'
      throw err
    }

    if (!canEdit(po.status as PurchaseOrderStatus)) {
      throw new Error(`PO in status ${po.status} cannot be locked`)
    }

    // If locked by another user with a non-expired lock, deny
    if (
      po.lockedBy != null &&
      po.lockedBy !== userId &&
      !isLockExpired(po.lockedAt)
    ) {
      const err = new Error('PO is locked by another user') as Error & { code: string }
      err.code = 'PO_LOCKED'
      throw err
    }

    const now = Date.now()

    tx.update(schema.purchaseOrders)
      .set({ lockedBy: userId, lockedAt: now, updatedAt: now })
      .where(eq(schema.purchaseOrders.id, poId))
      .run()

    return {
      lockedBy: userId,
      lockedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + LOCK_DURATION_MS).toISOString(),
    }
  })
}

export function releaseLock(db: DrizzleDB, poId: string, userId: string): void {
  const po = db
    .select()
    .from(schema.purchaseOrders)
    .where(eq(schema.purchaseOrders.id, poId))
    .get()

  if (!po) return // idempotent — nothing to release

  // Release if locked by this user OR if the lock is expired
  if (po.lockedBy === userId || isLockExpired(po.lockedAt)) {
    db.update(schema.purchaseOrders)
      .set({ lockedBy: null, lockedAt: null, updatedAt: Date.now() })
      .where(eq(schema.purchaseOrders.id, poId))
      .run()
  }
}

// ── Fulfill ────────────────────────────────────────────────────────────────────

export function fulfill(
  db: DrizzleDB,
  poId: string,
  userId: string,
  role: UserRole,
): POResponse {
  const po = db
    .select()
    .from(schema.purchaseOrders)
    .where(eq(schema.purchaseOrders.id, poId))
    .get()

  if (!po) {
    const err = new Error('PO not found') as Error & { code: string }
    err.code = 'PO_NOT_FOUND'
    throw err
  }

  validateTransition(po.status as PurchaseOrderStatus, 'FULFILLED', role)

  if (po.supplierId !== userId) {
    throw new Error('Only the supplier can fulfill this PO')
  }

  const now = Date.now()

  db.update(schema.purchaseOrders)
    .set({ status: 'FULFILLED', fulfilledAt: now, updatedAt: now })
    .where(eq(schema.purchaseOrders.id, poId))
    .run()

  recordStatusHistory(db, poId, po.status, 'FULFILLED', userId)

  const updated = db
    .select()
    .from(schema.purchaseOrders)
    .where(eq(schema.purchaseOrders.id, poId))
    .get()

  if (!updated) {
    const err = new Error('PO not found after fulfill') as Error & { code: string }
    err.code = 'PO_NOT_FOUND'
    throw err
  }

  return formatPoResponse(updated)
}

// ── Submit ─────────────────────────────────────────────────────────────────────

export function submit(
  db: DrizzleDB,
  poId: string,
  userId: string,
  role: UserRole,
  expectedDeliveryDate?: string,
): POResponse {
  const po = db
    .select()
    .from(schema.purchaseOrders)
    .where(eq(schema.purchaseOrders.id, poId))
    .get()

  if (!po) {
    const err = new Error('PO not found') as Error & { code: string }
    err.code = 'PO_NOT_FOUND'
    throw err
  }

  if (po.buyerId !== userId) {
    throw new Error('Only the buyer can submit this PO')
  }

  const items = db
    .select()
    .from(schema.lineItems)
    .where(eq(schema.lineItems.purchaseOrderId, poId))
    .all()

  if (items.length === 0) {
    const err = new Error('PO must have at least one line item') as Error & { code: string }
    err.code = 'NO_LINE_ITEMS'
    throw err
  }

  const deliveryDate = expectedDeliveryDate ?? po.expectedDeliveryDate
  if (!deliveryDate) {
    const err = new Error('Expected delivery date is required before submission') as Error & { code: string }
    err.code = 'MISSING_DELIVERY_DATE'
    throw err
  }

  const targetStatus: PurchaseOrderStatus = requiresApproval(po.totalCents)
    ? 'AWAITING_APPROVAL'
    : 'SUBMITTED'

  validateTransition(po.status as PurchaseOrderStatus, targetStatus, role)

  const now = Date.now()

  db.update(schema.purchaseOrders)
    .set({
      status: targetStatus,
      submittedAt: now,
      updatedAt: now,
      expectedDeliveryDate: deliveryDate,
    })
    .where(eq(schema.purchaseOrders.id, poId))
    .run()

  recordStatusHistory(db, poId, po.status, targetStatus, userId)

  if (targetStatus === 'AWAITING_APPROVAL') {
    queueNotification(db, {
      purchaseOrderId: poId,
      recipientType: 'APPROVER',
      recipientId: 'system',
      eventType: 'APPROVAL_REQUESTED',
      payload: { poNumber: po.poNumber, totalCents: po.totalCents, buyerId: po.buyerId, supplierId: po.supplierId },
    })
  } else {
    queueNotification(db, {
      purchaseOrderId: poId,
      recipientType: 'SUPPLIER',
      recipientId: po.supplierId,
      eventType: 'PO_SUBMITTED',
      payload: { poNumber: po.poNumber, totalCents: po.totalCents, buyerId: po.buyerId, supplierId: po.supplierId },
    })
  }

  const updated = db
    .select()
    .from(schema.purchaseOrders)
    .where(eq(schema.purchaseOrders.id, poId))
    .get()

  if (!updated) throw new Error('PO_NOT_FOUND')

  return formatPoResponse(updated)
}

// ── History ────────────────────────────────────────────────────────────────────

export function getHistory(db: DrizzleDB, poId: string): HistoryEntry[] {
  const rows = db
    .select()
    .from(schema.poStatusHistory)
    .where(eq(schema.poStatusHistory.purchaseOrderId, poId))
    .orderBy(asc(schema.poStatusHistory.changedAt))
    .all()

  return rows.map((row) => ({
    id: row.id,
    purchaseOrderId: row.purchaseOrderId,
    fromStatus: (row.fromStatus ?? null) as PurchaseOrderStatus | null,
    toStatus: row.toStatus as PurchaseOrderStatus,
    changedById: row.changedById,
    changedAt: new Date(row.changedAt).toISOString(),
    note: row.note ?? null,
  }))
}
