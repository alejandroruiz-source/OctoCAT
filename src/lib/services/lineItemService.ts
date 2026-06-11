import { eq, sql, and } from 'drizzle-orm'
import * as schema from '../db/schema'
import { type DrizzleDB } from '../db/client'
import { canEdit } from './stateMachine'
import {
  computeExtendedPriceCents,
  computeTotalCents,
} from './pricing'
import { isLockExpired } from './poService'
import { v4 as uuidv4 } from 'uuid'
import { type PurchaseOrderStatus } from '../models/purchaseOrder'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AddLineItemInput {
  productId: string
  productName: string
  quantity: number
  unitPriceCents: number
}

export interface UpdateLineItemInput {
  quantity?: number
  unitPriceCents?: number
}

export type LineItemRow = typeof schema.lineItems.$inferSelect

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Sum all extendedPriceCents for the PO and update purchase_orders.totalCents.
 */
export function recalculatePOTotal(db: DrizzleDB, poId: string): number {
  const items = db
    .select({ extendedPriceCents: schema.lineItems.extendedPriceCents })
    .from(schema.lineItems)
    .where(eq(schema.lineItems.purchaseOrderId, poId))
    .all()

  const totalCents = computeTotalCents(items)

  db.update(schema.purchaseOrders)
    .set({ totalCents, updatedAt: Date.now() })
    .where(eq(schema.purchaseOrders.id, poId))
    .run()

  return totalCents
}

/**
 * Shared guard: verify PO exists, is editable, buyer matches, and not locked by another user.
 */
function assertCanEditPO(
  db: DrizzleDB,
  poId: string,
  userId: string,
): typeof schema.purchaseOrders.$inferSelect {
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
    throw new Error('Only the buyer can modify line items on this PO')
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

  return po
}

// ── Add Line Item ──────────────────────────────────────────────────────────────

export function add(
  db: DrizzleDB,
  poId: string,
  input: AddLineItemInput,
  userId: string,
): LineItemRow {
  assertCanEditPO(db, poId, userId)

  const extendedPriceCents = computeExtendedPriceCents(input.quantity, input.unitPriceCents)

  // Get next lineNumber: MAX(lineNumber) + 1 or 1
  const maxResult = db
    .select({ maxLine: sql<number | null>`MAX(${schema.lineItems.lineNumber})` })
    .from(schema.lineItems)
    .where(eq(schema.lineItems.purchaseOrderId, poId))
    .get()

  const lineNumber = maxResult?.maxLine != null ? maxResult.maxLine + 1 : 1

  const id = uuidv4()

  db.insert(schema.lineItems).values({
    id,
    purchaseOrderId: poId,
    lineNumber,
    productId: input.productId,
    productName: input.productName,
    quantity: input.quantity,
    unitPriceCents: input.unitPriceCents,
    extendedPriceCents,
  }).run()

  // Atomically recalculate and update PO total
  recalculatePOTotal(db, poId)

  const inserted = db
    .select()
    .from(schema.lineItems)
    .where(eq(schema.lineItems.id, id))
    .get()

  if (!inserted) {
    throw new Error('Line item not found after insert')
  }

  return inserted
}

// ── Update Line Item ───────────────────────────────────────────────────────────

export function update(
  db: DrizzleDB,
  poId: string,
  lineItemId: string,
  input: UpdateLineItemInput,
  userId: string,
): LineItemRow {
  assertCanEditPO(db, poId, userId)

  // Fetch the existing line item
  const existing = db
    .select()
    .from(schema.lineItems)
    .where(
      and(
        eq(schema.lineItems.id, lineItemId),
        eq(schema.lineItems.purchaseOrderId, poId),
      ),
    )
    .get()

  if (!existing) {
    const err = new Error('Line item not found') as Error & { code: string }
    err.code = 'LINE_ITEM_NOT_FOUND'
    throw err
  }

  const newQuantity = input.quantity ?? existing.quantity
  const newUnitPriceCents = input.unitPriceCents ?? existing.unitPriceCents
  const newExtendedPriceCents = computeExtendedPriceCents(newQuantity, newUnitPriceCents)

  db.update(schema.lineItems)
    .set({
      quantity: newQuantity,
      unitPriceCents: newUnitPriceCents,
      extendedPriceCents: newExtendedPriceCents,
    })
    .where(
      and(
        eq(schema.lineItems.id, lineItemId),
        eq(schema.lineItems.purchaseOrderId, poId),
      ),
    )
    .run()

  // Recalculate PO total
  recalculatePOTotal(db, poId)

  const updated = db
    .select()
    .from(schema.lineItems)
    .where(eq(schema.lineItems.id, lineItemId))
    .get()

  if (!updated) {
    const err = new Error('Line item not found after update') as Error & { code: string }
    err.code = 'LINE_ITEM_NOT_FOUND'
    throw err
  }

  return updated
}

// ── Delete Line Item ───────────────────────────────────────────────────────────

export function remove(
  db: DrizzleDB,
  poId: string,
  lineItemId: string,
  userId: string,
): void {
  assertCanEditPO(db, poId, userId)

  const existing = db
    .select()
    .from(schema.lineItems)
    .where(
      and(
        eq(schema.lineItems.id, lineItemId),
        eq(schema.lineItems.purchaseOrderId, poId),
      ),
    )
    .get()

  if (!existing) {
    const err = new Error('Line item not found') as Error & { code: string }
    err.code = 'LINE_ITEM_NOT_FOUND'
    throw err
  }

  db.delete(schema.lineItems)
    .where(
      and(
        eq(schema.lineItems.id, lineItemId),
        eq(schema.lineItems.purchaseOrderId, poId),
      ),
    )
    .run()

  // Recalculate PO total after deletion
  recalculatePOTotal(db, poId)
}
