export function computeExtendedPriceCents(quantity: number, unitPriceCents: number): number {
  if (quantity < 1) throw new Error('quantity must be >= 1')
  if (unitPriceCents < 1) throw new Error('unitPriceCents must be >= 1')
  return quantity * unitPriceCents
}

export function computeTotalCents(lineItems: Array<{ extendedPriceCents: number }>): number {
  return lineItems.reduce((sum, item) => sum + item.extendedPriceCents, 0)
}

/** $10,000 approval threshold in cents */
export const APPROVAL_THRESHOLD_CENTS = 1_000_000

export function requiresApproval(totalCents: number): boolean {
  return totalCents >= APPROVAL_THRESHOLD_CENTS
}

/** Compute approval deadline: submittedAt + 24 business hours (simplified as 24 * 60 * 60 * 1000 ms) */
export function computeApprovalDeadline(submittedAtMs: number): Date {
  return new Date(submittedAtMs + 24 * 60 * 60 * 1000)
}
