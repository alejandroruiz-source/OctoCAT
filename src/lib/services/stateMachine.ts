import { type PurchaseOrderStatus } from '../models/purchaseOrder'

export type UserRole = 'BUYER' | 'SUPPLIER' | 'APPROVER'

interface Transition {
  to: PurchaseOrderStatus
  allowedRoles: UserRole[]
}

export const VALID_TRANSITIONS: Record<PurchaseOrderStatus, Transition[]> = {
  DRAFT: [
    { to: 'SUBMITTED', allowedRoles: ['BUYER'] },
    { to: 'AWAITING_APPROVAL', allowedRoles: ['BUYER'] },
    { to: 'CANCELLED', allowedRoles: ['BUYER'] },
  ],
  SUBMITTED: [
    { to: 'FULFILLED', allowedRoles: ['SUPPLIER'] },
  ],
  AWAITING_APPROVAL: [
    { to: 'APPROVED', allowedRoles: ['APPROVER'] },
    { to: 'REVISION_REQUIRED', allowedRoles: ['APPROVER'] },
  ],
  APPROVED: [
    { to: 'FULFILLED', allowedRoles: ['SUPPLIER'] },
  ],
  REVISION_REQUIRED: [
    { to: 'AWAITING_APPROVAL', allowedRoles: ['BUYER'] },
    { to: 'CANCELLED', allowedRoles: ['BUYER'] },
  ],
  FULFILLED: [],
  CANCELLED: [],
}

export class InvalidStatusTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Cannot transition PO from ${from} to ${to}`)
    this.name = 'InvalidStatusTransitionError'
  }
}

export class ForbiddenTransitionError extends Error {
  constructor(role: string, to: string) {
    super(`Role ${role} cannot perform transition to ${to}`)
    this.name = 'ForbiddenTransitionError'
  }
}

export function validateTransition(
  from: PurchaseOrderStatus,
  to: PurchaseOrderStatus,
  actorRole: UserRole,
): void {
  const allowed = VALID_TRANSITIONS[from]
  const transition = allowed.find((t) => t.to === to)
  if (!transition) {
    throw new InvalidStatusTransitionError(from, to)
  }
  if (!transition.allowedRoles.includes(actorRole)) {
    throw new ForbiddenTransitionError(actorRole, to)
  }
}

export function canEdit(status: PurchaseOrderStatus): boolean {
  return status === 'DRAFT' || status === 'REVISION_REQUIRED'
}
