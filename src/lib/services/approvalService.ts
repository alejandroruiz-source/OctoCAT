import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { type DrizzleDB } from '../../lib/db/client'
import * as schema from '../db/schema'
import {
  validateTransition,
  ForbiddenTransitionError,
  type UserRole,
} from './stateMachine'

// ── Types ──────────────────────────────────────────────────────────────────────

interface InsertNotificationInput {
  purchaseOrderId: string
  recipientType: 'SUPPLIER' | 'APPROVER' | 'BUYER'
  recipientId: string
  eventType: 'PO_SUBMITTED' | 'PO_APPROVED' | 'PO_REJECTED' | 'PO_ON_HOLD' | 'APPROVAL_REQUESTED'
  payload: string
  status: 'PENDING' | 'SENT' | 'FAILED'
  retryCount: number
  createdAt: number
}

// ── Helper ─────────────────────────────────────────────────────────────────────

function insertNotification(db: DrizzleDB, input: InsertNotificationInput): void {
  db.insert(schema.notifications).values({
    id: uuidv4(),
    purchaseOrderId: input.purchaseOrderId,
    recipientType: input.recipientType,
    recipientId: input.recipientId,
    eventType: input.eventType,
    payload: input.payload,
    status: input.status,
    retryCount: input.retryCount,
    createdAt: input.createdAt,
  }).run()
}

// ── approve ────────────────────────────────────────────────────────────────────

export function approve(
  db: DrizzleDB,
  poId: string,
  approverId: string,
  role: UserRole,
) {
  if (role !== 'APPROVER') {
    throw new ForbiddenTransitionError(role, 'APPROVED')
  }

  const po = db.select().from(schema.purchaseOrders).where(eq(schema.purchaseOrders.id, poId)).get()
  if (!po) {
    throw new Error('PO_NOT_FOUND')
  }

  validateTransition(po.status, 'APPROVED', 'APPROVER')

  const now = Date.now()

  const approval = {
    id: uuidv4(),
    purchaseOrderId: poId,
    approverId,
    decision: 'APPROVED' as const,
    reason: null,
    decidedAt: now,
  }

  db.insert(schema.approvals).values(approval).run()

  db.update(schema.purchaseOrders)
    .set({ status: 'APPROVED', approvedAt: now, updatedAt: now })
    .where(eq(schema.purchaseOrders.id, poId))
    .run()

  db.insert(schema.poStatusHistory).values({
    id: uuidv4(),
    purchaseOrderId: poId,
    fromStatus: po.status,
    toStatus: 'APPROVED',
    changedById: approverId,
    changedAt: now,
  }).run()

  insertNotification(db, {
    purchaseOrderId: poId,
    recipientType: 'SUPPLIER',
    recipientId: po.supplierId,
    eventType: 'PO_APPROVED',
    payload: JSON.stringify({
      poNumber: po.poNumber,
      totalCents: po.totalCents,
      buyerId: po.buyerId,
      supplierId: po.supplierId,
    }),
    status: 'PENDING',
    retryCount: 0,
    createdAt: now,
  })

  return approval
}

// ── reject ─────────────────────────────────────────────────────────────────────

export function reject(
  db: DrizzleDB,
  poId: string,
  approverId: string,
  role: UserRole,
  reason: string,
) {
  if (role !== 'APPROVER') {
    throw new ForbiddenTransitionError(role, 'REVISION_REQUIRED')
  }

  if (typeof reason !== 'string' || reason.trim() === '') {
    throw new Error('REASON_REQUIRED')
  }

  const po = db.select().from(schema.purchaseOrders).where(eq(schema.purchaseOrders.id, poId)).get()
  if (!po) {
    throw new Error('PO_NOT_FOUND')
  }

  validateTransition(po.status, 'REVISION_REQUIRED', 'APPROVER')

  const now = Date.now()

  const approval = {
    id: uuidv4(),
    purchaseOrderId: poId,
    approverId,
    decision: 'REJECTED' as const,
    reason,
    decidedAt: now,
  }

  db.insert(schema.approvals).values(approval).run()

  db.update(schema.purchaseOrders)
    .set({ status: 'REVISION_REQUIRED', updatedAt: now })
    .where(eq(schema.purchaseOrders.id, poId))
    .run()

  db.insert(schema.poStatusHistory).values({
    id: uuidv4(),
    purchaseOrderId: poId,
    fromStatus: po.status,
    toStatus: 'REVISION_REQUIRED',
    changedById: approverId,
    changedAt: now,
    note: reason,
  }).run()

  insertNotification(db, {
    purchaseOrderId: poId,
    recipientType: 'BUYER',
    recipientId: po.buyerId,
    eventType: 'PO_REJECTED',
    payload: JSON.stringify({
      poNumber: po.poNumber,
      reason,
      buyerId: po.buyerId,
      supplierId: po.supplierId,
    }),
    status: 'PENDING',
    retryCount: 0,
    createdAt: now,
  })

  insertNotification(db, {
    purchaseOrderId: poId,
    recipientType: 'SUPPLIER',
    recipientId: po.supplierId,
    eventType: 'PO_ON_HOLD',
    payload: JSON.stringify({
      poNumber: po.poNumber,
      reason,
    }),
    status: 'PENDING',
    retryCount: 0,
    createdAt: now,
  })

  return approval
}
