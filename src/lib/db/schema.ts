import { sqliteTable, text, integer, real, unique } from 'drizzle-orm/sqlite-core'

// ── Sequences ──────────────────────────────────────────────────────────────────

export const poNumberSequences = sqliteTable('po_number_sequences', {
  year: integer('year').primaryKey(),
  lastSeq: integer('last_seq').notNull().default(0),
})

// ── Purchase Orders ────────────────────────────────────────────────────────────

export const purchaseOrders = sqliteTable('purchase_orders', {
  id: text('id').primaryKey(),
  poNumber: text('po_number').notNull().unique(),
  status: text('status', {
    enum: ['DRAFT', 'SUBMITTED', 'AWAITING_APPROVAL', 'APPROVED', 'FULFILLED', 'CANCELLED', 'REVISION_REQUIRED'],
  }).notNull().default('DRAFT'),
  buyerId: text('buyer_id').notNull(),
  branchId: text('branch_id').notNull(),
  supplierId: text('supplier_id').notNull(),
  expectedDeliveryDate: text('expected_delivery_date'),
  totalCents: integer('total_cents').notNull().default(0),
  notes: text('notes'),
  lockedBy: text('locked_by'),
  lockedAt: integer('locked_at'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  submittedAt: integer('submitted_at'),
  approvedAt: integer('approved_at'),
  fulfilledAt: integer('fulfilled_at'),
})

// ── Line Items ─────────────────────────────────────────────────────────────────

export const lineItems = sqliteTable('line_items', {
  id: text('id').primaryKey(),
  purchaseOrderId: text('purchase_order_id').notNull().references(() => purchaseOrders.id, { onDelete: 'cascade' }),
  lineNumber: integer('line_number').notNull(),
  productId: text('product_id').notNull(),
  productName: text('product_name').notNull(),
  quantity: integer('quantity').notNull(),
  unitPriceCents: integer('unit_price_cents').notNull(),
  extendedPriceCents: integer('extended_price_cents').notNull(),
}, (t) => ({
  uniqPoLine: unique().on(t.purchaseOrderId, t.lineNumber),
}))

// ── Approvals ──────────────────────────────────────────────────────────────────

export const approvals = sqliteTable('approvals', {
  id: text('id').primaryKey(),
  purchaseOrderId: text('purchase_order_id').notNull().references(() => purchaseOrders.id),
  approverId: text('approver_id').notNull(),
  decision: text('decision', { enum: ['APPROVED', 'REJECTED'] }).notNull(),
  reason: text('reason'),
  decidedAt: integer('decided_at').notNull(),
})

// ── PO Status History ──────────────────────────────────────────────────────────

export const poStatusHistory = sqliteTable('po_status_history', {
  id: text('id').primaryKey(),
  purchaseOrderId: text('purchase_order_id').notNull().references(() => purchaseOrders.id),
  fromStatus: text('from_status'),
  toStatus: text('to_status').notNull(),
  changedById: text('changed_by_id').notNull(),
  changedAt: integer('changed_at').notNull(),
  note: text('note'),
})

// ── Notifications (Outbox) ─────────────────────────────────────────────────────

export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  purchaseOrderId: text('purchase_order_id').notNull().references(() => purchaseOrders.id),
  recipientType: text('recipient_type', { enum: ['SUPPLIER', 'APPROVER', 'BUYER'] }).notNull(),
  recipientId: text('recipient_id').notNull(),
  eventType: text('event_type', {
    enum: ['PO_SUBMITTED', 'PO_APPROVED', 'PO_REJECTED', 'PO_ON_HOLD', 'APPROVAL_REQUESTED'],
  }).notNull(),
  payload: text('payload').notNull(),
  status: text('status', { enum: ['PENDING', 'SENT', 'FAILED'] }).notNull().default('PENDING'),
  retryCount: integer('retry_count').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  sentAt: integer('sent_at'),
  lastAttemptAt: integer('last_attempt_at'),
})
