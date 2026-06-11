import { describe, it, expect } from 'vitest'
import {
  validateTransition,
  canEdit,
  VALID_TRANSITIONS,
  InvalidStatusTransitionError,
  ForbiddenTransitionError,
} from '../../src/lib/services/stateMachine'

describe('stateMachine', () => {
  describe('validateTransition — valid transitions', () => {
    it('DRAFT → SUBMITTED for BUYER', () => {
      expect(() => validateTransition('DRAFT', 'SUBMITTED', 'BUYER')).not.toThrow()
    })
    it('DRAFT → AWAITING_APPROVAL for BUYER', () => {
      expect(() => validateTransition('DRAFT', 'AWAITING_APPROVAL', 'BUYER')).not.toThrow()
    })
    it('DRAFT → CANCELLED for BUYER', () => {
      expect(() => validateTransition('DRAFT', 'CANCELLED', 'BUYER')).not.toThrow()
    })
    it('SUBMITTED → FULFILLED for SUPPLIER', () => {
      expect(() => validateTransition('SUBMITTED', 'FULFILLED', 'SUPPLIER')).not.toThrow()
    })
    it('AWAITING_APPROVAL → APPROVED for APPROVER', () => {
      expect(() => validateTransition('AWAITING_APPROVAL', 'APPROVED', 'APPROVER')).not.toThrow()
    })
    it('AWAITING_APPROVAL → REVISION_REQUIRED for APPROVER', () => {
      expect(() => validateTransition('AWAITING_APPROVAL', 'REVISION_REQUIRED', 'APPROVER')).not.toThrow()
    })
    it('APPROVED → FULFILLED for SUPPLIER', () => {
      expect(() => validateTransition('APPROVED', 'FULFILLED', 'SUPPLIER')).not.toThrow()
    })
    it('REVISION_REQUIRED → AWAITING_APPROVAL for BUYER', () => {
      expect(() => validateTransition('REVISION_REQUIRED', 'AWAITING_APPROVAL', 'BUYER')).not.toThrow()
    })
    it('REVISION_REQUIRED → CANCELLED for BUYER', () => {
      expect(() => validateTransition('REVISION_REQUIRED', 'CANCELLED', 'BUYER')).not.toThrow()
    })
  })

  describe('validateTransition — invalid transitions', () => {
    it('FULFILLED → any throws InvalidStatusTransitionError', () => {
      expect(() => validateTransition('FULFILLED', 'DRAFT', 'BUYER'))
        .toThrow(InvalidStatusTransitionError)
    })
    it('CANCELLED → any throws InvalidStatusTransitionError', () => {
      expect(() => validateTransition('CANCELLED', 'SUBMITTED', 'BUYER'))
        .toThrow(InvalidStatusTransitionError)
    })
    it('SUBMITTED → APPROVED throws (must go through AWAITING_APPROVAL)', () => {
      expect(() => validateTransition('SUBMITTED', 'APPROVED', 'APPROVER'))
        .toThrow(InvalidStatusTransitionError)
    })
  })

  describe('validateTransition — wrong role', () => {
    it('BUYER cannot approve', () => {
      expect(() => validateTransition('AWAITING_APPROVAL', 'APPROVED', 'BUYER'))
        .toThrow(ForbiddenTransitionError)
    })
    it('APPROVER cannot cancel DRAFT', () => {
      expect(() => validateTransition('DRAFT', 'CANCELLED', 'APPROVER'))
        .toThrow(ForbiddenTransitionError)
    })
    it('BUYER cannot fulfill', () => {
      expect(() => validateTransition('SUBMITTED', 'FULFILLED', 'BUYER'))
        .toThrow(ForbiddenTransitionError)
    })
  })

  describe('canEdit', () => {
    it('returns true for DRAFT', () => expect(canEdit('DRAFT')).toBe(true))
    it('returns true for REVISION_REQUIRED', () => expect(canEdit('REVISION_REQUIRED')).toBe(true))
    it('returns false for SUBMITTED', () => expect(canEdit('SUBMITTED')).toBe(false))
    it('returns false for AWAITING_APPROVAL', () => expect(canEdit('AWAITING_APPROVAL')).toBe(false))
    it('returns false for APPROVED', () => expect(canEdit('APPROVED')).toBe(false))
    it('returns false for FULFILLED', () => expect(canEdit('FULFILLED')).toBe(false))
    it('returns false for CANCELLED', () => expect(canEdit('CANCELLED')).toBe(false))
  })

  describe('VALID_TRANSITIONS completeness', () => {
    it('FULFILLED has no valid transitions (terminal)', () => {
      expect(VALID_TRANSITIONS.FULFILLED).toHaveLength(0)
    })
    it('CANCELLED has no valid transitions (terminal)', () => {
      expect(VALID_TRANSITIONS.CANCELLED).toHaveLength(0)
    })
  })
})
