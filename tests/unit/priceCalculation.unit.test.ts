import { describe, it, expect } from 'vitest'
import {
  computeExtendedPriceCents,
  computeTotalCents,
  requiresApproval,
  APPROVAL_THRESHOLD_CENTS,
  computeApprovalDeadline,
} from '../../src/lib/services/pricing'

describe('pricing', () => {
  describe('computeExtendedPriceCents', () => {
    it('multiplies quantity by unitPriceCents', () => {
      expect(computeExtendedPriceCents(10, 5000)).toBe(50000)
    })
    it('handles single unit', () => {
      expect(computeExtendedPriceCents(1, 150000)).toBe(150000)
    })
    it('handles large quantities', () => {
      expect(computeExtendedPriceCents(100, 150000)).toBe(15_000_000)
    })
    it('throws for zero quantity', () => {
      expect(() => computeExtendedPriceCents(0, 5000)).toThrow()
    })
    it('throws for negative quantity', () => {
      expect(() => computeExtendedPriceCents(-1, 5000)).toThrow()
    })
    it('throws for zero unitPriceCents', () => {
      expect(() => computeExtendedPriceCents(5, 0)).toThrow()
    })
  })

  describe('computeTotalCents', () => {
    it('returns 0 for empty array', () => {
      expect(computeTotalCents([])).toBe(0)
    })
    it('sums single item', () => {
      expect(computeTotalCents([{ extendedPriceCents: 50000 }])).toBe(50000)
    })
    it('sums multiple items', () => {
      expect(computeTotalCents([
        { extendedPriceCents: 50000 },
        { extendedPriceCents: 150000 },
        { extendedPriceCents: 800000 },
      ])).toBe(1_000_000)
    })
  })

  describe('requiresApproval', () => {
    it(`returns false below ${APPROVAL_THRESHOLD_CENTS} cents`, () => {
      expect(requiresApproval(999_999)).toBe(false)
    })
    it(`returns true at exactly ${APPROVAL_THRESHOLD_CENTS} cents ($10,000)`, () => {
      expect(requiresApproval(1_000_000)).toBe(true)
    })
    it('returns true above threshold', () => {
      expect(requiresApproval(15_000_000)).toBe(true)
    })
    it('returns false for zero', () => {
      expect(requiresApproval(0)).toBe(false)
    })
  })

  describe('computeApprovalDeadline', () => {
    it('returns 24 hours after submittedAt', () => {
      const submittedAt = new Date('2026-06-10T10:00:00Z').getTime()
      const deadline = computeApprovalDeadline(submittedAt)
      expect(deadline.toISOString()).toBe('2026-06-11T10:00:00.000Z')
    })
  })
})
