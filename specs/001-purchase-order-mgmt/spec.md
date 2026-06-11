# Feature Specification: Purchase Order Management System

**Feature Branch**: `001-purchase-order-mgmt`

**Created**: 2026-06-10

**Status**: Draft

**Input**: User description: "Create a Purchase Order management system. Buyers at branches can create purchase orders to suppliers for products. Each PO contains multiple line items with quantities and expected prices. Track PO status (Draft, Submitted, Approved, Fulfilled, Cancelled). Suppliers receive notifications when POs are submitted. Include approval workflow for POs over $10,000."

## User Scenarios & Testing

### User Story 1 - Create and Manage Draft Purchase Orders (Priority: P1)

Buyers at branch locations need to create and manage purchase order drafts before submission. A buyer selects a supplier, adds product line items with quantities and expected prices, and saves the PO in draft status for later editing or submission. This core functionality enables the PO workflow to begin.

**Why this priority**: Essential MVP capability - without the ability to create and manage POs, the entire system cannot function. All other features depend on this.

**Independent Test**: Can be fully tested by creating a draft PO with multiple line items, editing quantities and prices, and verifying the PO persists without external dependencies (no notifications or approvals required).

**Acceptance Scenarios**:

1. **Given** a buyer is authenticated in a branch location, **When** they create a new PO and select a supplier, **Then** a PO in Draft status is created with a unique identifier and the supplier is recorded.
2. **Given** a draft PO exists, **When** a buyer adds a line item with product ID, quantity, and expected unit price, **Then** the line item is saved with calculated extended price (quantity × unit price).
3. **Given** a draft PO with line items, **When** a buyer edits a line item's quantity or price, **Then** the extended price updates automatically and the PO modification timestamp is recorded.
4. **Given** a draft PO, **When** a buyer deletes a line item, **Then** the line item is removed and the PO total recalculates.
5. **Given** a draft PO, **When** a buyer cancels the entire PO, **Then** the PO status changes to Cancelled and no further edits are allowed.

---

### User Story 2 - Submit Purchase Orders and Notify Suppliers (Priority: P1)

Once a buyer finishes editing a draft PO, they must be able to submit it to the supplier. Upon submission, the PO status changes to Submitted and the supplier receives a notification containing PO details. This completes the external communication loop and triggers downstream approval processes.

**Why this priority**: Core MVP requirement - submission and supplier notification are fundamental to the purchase order workflow. Without this, buyers cannot communicate PO intent to suppliers.

**Independent Test**: Can be fully tested by submitting a draft PO and verifying (1) status changes to Submitted, (2) supplier receives a notification with correct PO details, and (3) submitted PO cannot be edited.

**Acceptance Scenarios**:

1. **Given** a draft PO with at least one line item, **When** a buyer submits the PO, **Then** the PO status changes to Submitted and the submission timestamp is recorded.
2. **Given** a PO is submitted, **When** the submission completes, **Then** the supplier receives a notification containing the PO number, total amount, branch name, line items, and delivery expectations.
3. **Given** a submitted PO, **When** a buyer attempts to edit it, **Then** edit operations are rejected and a message indicates the PO is no longer in Draft status.
4. **Given** a submitted PO, **When** the buyer views it, **Then** the PO displays as read-only with all submitted details clearly visible.

---

### User Story 3 - Approval Workflow for High-Value Purchase Orders (Priority: P2)

Purchase orders exceeding $10,000 require manager approval before proceeding to fulfilled status. When a PO over this threshold is submitted, it enters Approved status waiting for approval. An approver reviews the PO details and can approve or reject it. This gate ensures financial controls and prevents unauthorized spending.

**Why this priority**: Important business control and risk mitigation. Supply chain best practices require approval gates for significant purchases, but the system can function without this during initial MVP. This becomes critical as PO volumes increase.

**Independent Test**: Can be fully tested by (1) submitting a PO under $10,000 (should not require approval), (2) submitting a PO over $10,000 (should enter Approved status), and (3) testing approval/rejection workflows independently of fulfillment.

**Acceptance Scenarios**:

1. **Given** a draft PO with total amount under $10,000, **When** submitted, **Then** the PO status becomes Submitted (no approval step required).
2. **Given** a draft PO with total amount $10,000 or greater, **When** submitted, **Then** the PO status becomes "Awaiting Approval" and a notification is sent to designated approvers.
3. **Given** a PO awaiting approval, **When** an approver views it, **Then** they see all PO details, supplier information, and line items with a clear approval/rejection interface.
4. **Given** a PO awaiting approval, **When** an approver approves it, **Then** the status changes to Approved and the supplier is notified of approval.
5. **Given** a PO awaiting approval, **When** an approver rejects it with a reason, **Then** the status changes to Revision Required, the buyer is notified with the rejection reason, and the supplier is notified that the PO is on hold.
6. **Given** a PO in Revision Required status, **When** the buyer edits it and resubmits, **Then** the PO re-enters the approval workflow (status returns to Awaiting Approval) with the updated details.

---

### User Story 4 - Track PO Status and Fulfillment (Priority: P3)

Once a PO is approved (or submitted if under $10,000), buyers and suppliers track its fulfillment progress. The supplier updates the PO status to Fulfilled when goods are delivered, and the buyer can view the complete PO lifecycle including all status changes. This provides visibility into supply chain activity and order completion.

**Why this priority**: Important for operations but less critical than PO creation and submission. The system delivers value without fulfillment tracking in early iterations, and this can be added after core workflows are proven.

**Independent Test**: Can be fully tested independently by (1) approving a PO, (2) updating it to Fulfilled status, (3) viewing status history, without touching other user stories.

**Acceptance Scenarios**:

1. **Given** an approved PO (or submitted PO under $10,000), **When** the supplier marks it as Fulfilled, **Then** the PO status changes to Fulfilled and the fulfillment timestamp is recorded.
2. **Given** any PO, **When** a user views the PO detail page, **Then** a status history timeline displays all status changes with timestamps (Draft → Submitted → [Awaiting Approval → Revision Required → Awaiting Approval (resubmit cycle)] → Approved → Fulfilled, or Cancelled at any terminal point).
3. **Given** a fulfilled PO, **When** a buyer views it, **Then** fulfillment details are displayed (delivery date, received quantity confirmation if applicable).
4. **Given** a PO in any status, **When** a user attempts to view it, **Then** they only see statuses and actions appropriate to their role (buyer, supplier, approver).

---

### Edge Cases

- What happens when a buyer starts creating a PO but closes the browser before saving? (Assumption: Draft is not auto-saved; user must explicitly save).
- What happens if a supplier is deleted after a PO is submitted to them? (Assumption: Supplier reference remains in PO history for audit trail; supplier cannot be deleted if active POs exist).
- What happens when line item quantity is changed to zero or negative? (Assumption: System rejects zero/negative quantities; buyer must delete line item instead).
- How does the system handle concurrent edits if multiple buyers try to edit the same draft PO? (Assumption: Pessimistic locking - first buyer to open for edit gets exclusive access; others see read-only view).
- What happens if approval threshold changes while a PO is awaiting approval? (Assumption: Threshold applies at submission time only; no retroactive recalculation).

## Requirements

### Functional Requirements

- **FR-001**: System MUST allow authenticated buyers to create a new PO by selecting a supplier and specifying branch location.
- **FR-002**: System MUST support adding multiple line items to a PO, each with product ID, quantity, and expected unit price.
- **FR-003**: System MUST automatically calculate extended price for each line item (quantity × unit price) and total PO amount.
- **FR-004**: System MUST allow buyers to edit line items (quantity, price) in draft POs and recalculate totals dynamically.
- **FR-005**: System MUST allow buyers to delete line items from draft POs.
- **FR-006**: System MUST allow buyers to cancel draft POs, changing status to Cancelled and preventing further edits.
- **FR-007**: System MUST persist PO state including all line items, timestamps, and status through submission.
- **FR-008**: System MUST enable buyers to submit draft POs to suppliers; submission requires an expected delivery date to be set on the PO.
- **FR-009**: System MUST change PO status from Draft to Submitted upon successful submission.
- **FR-010**: System MUST send supplier notifications upon PO submission containing PO number, total amount, buyer/branch info, line items, and expected delivery date.
- **FR-011**: System MUST prevent editing of submitted POs (read-only after submission).
- **FR-012**: System MUST route POs with total amount ≥ $10,000 to approval workflow upon submission (status becomes "Awaiting Approval").
- **FR-013**: System MUST allow any user with the system-wide "approver" role to view all pending approval POs with full details and take approve/reject actions.
- **FR-014**: System MUST change status to Approved when an approver approves a high-value PO.
- **FR-015**: System MUST change status to Revision Required (not Cancelled) when an approver rejects a high-value PO; the approver MUST provide a rejection reason; the buyer is notified with the reason and may edit and resubmit the PO, re-entering the Awaiting Approval state.
- **FR-015a**: System MUST notify the supplier that the PO is on hold when a PO enters Revision Required status.
- **FR-016**: System MUST send approval/rejection notifications to relevant parties.
- **FR-017**: System MUST allow suppliers to mark POs as Fulfilled and record fulfillment timestamp.
- **FR-018**: System MUST display PO status history with all transitions and timestamps for audit purposes.
- **FR-019**: System MUST enforce role-based access control (buyers view/edit own POs, suppliers view submitted POs addressed to them, approvers with the system-wide "approver" role view all pending approvals regardless of branch).
- **FR-020**: System MUST track all PO state changes for compliance and reporting purposes.

### Key Entities

- **Purchase Order (PO)**: Represents a complete order with unique identifier, status (Draft/Submitted/Awaiting Approval/Approved/Fulfilled/Cancelled/Revision Required), buyer (user), branch, supplier, creation date, submission date, approval date, fulfillment date, expected delivery date (buyer-specified, required at submission), total amount, and notes.
- **Line Item**: Represents a single product order within a PO with product ID/name, quantity, unit price, extended price (calculated), and line number.
- **Supplier**: External party receiving POs with name, contact information, and notification preferences.
- **Branch**: Company location where buyer operates, with unique identifier and location info.
- **Notification**: Sent to suppliers and approvers when POs are submitted, approved, or rejected, containing relevant PO details.
- **Approval**: Records approval decisions including approver identity, decision (approve/reject), timestamp, and reason if rejected.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Buyers can create a new PO and add line items in under 3 minutes on average.
- **SC-002**: PO submission triggers supplier notification within 10 seconds.
- **SC-003**: High-value POs (≥$10,000) are correctly routed to approvers; low-value POs skip approval step.
- **SC-004**: 100% of submitted POs maintain data integrity through all status transitions (no data loss or corruption).
- **SC-005**: Approvers receive and can act on approval notifications within 24 business hours of PO submission; unanswered approvals after this window are escalated.
- **SC-006**: System correctly calculates PO totals for 100% of POs with no arithmetic errors.
- **SC-007**: Role-based access control prevents unauthorized access: buyers cannot edit submitted POs, suppliers cannot create POs, approvers cannot submit POs.
- **SC-008**: Audit trail captures all PO state changes with 100% accuracy for compliance reporting.

## Clarifications

### Session 2026-06-10

- Q: What is the approval SLA for high-value POs? → A: 24 business hours
- Q: What happens if the notification service fails during PO submission? → A: Proceed with submission; queue notification for async retry
- Q: How are designated approvers for high-value POs determined? → A: System-wide approver role — any user with the "approver" role can approve any PO
- Q: What is the "delivery expectations" field referenced in supplier notifications? → A: Single expected delivery date on the PO
- Q: When an approver rejects a high-value PO, can the buyer revise and resubmit? → A: Yes — PO enters "Revision Required" status; buyer revises and resubmits

## Assumptions

- **User management and authentication**: Existing authentication system will be reused; buyers, suppliers, and approvers are already authenticated and have role assignments.
- **Product catalog**: Products are already defined in a system; line items reference existing products by ID (product details like description, price are retrieved from product service).
- **Supplier management**: Suppliers already exist in the system with contact information and notification preferences configured; PO feature only references them.
- **Branch management**: Branches are already defined in the system; buyers select from existing branches.
- **Approval threshold**: The $10,000 approval threshold is a fixed business rule for this MVP; threshold changes would require system updates (not configurable UI).
- **Notifications**: Email or messaging infrastructure is available; system queues notifications for async delivery by the notification service. If the notification service is unavailable at submission time, the PO submission succeeds and the notification is retried asynchronously — submission is never blocked or rolled back due to a notification failure.
- **Database**: Real SQLite database will be used for PO persistence per constitution principle (no mocks).
- **Draft auto-save**: POs are not automatically saved; buyers must explicitly save drafts (reduces database churn, avoids conflicts).
- **Supplier notification content**: Suppliers receive notifications with core PO details; detailed PO inspection happens through a supplier portal or PO viewing endpoint.
- **Initial MVP scope**: Reporting and analytics features are out of scope for v1; focus is on core PO lifecycle (create, submit, approve, fulfill).
- **Soft delete**: Cancelled POs remain in system for audit trail; they are never permanently deleted.
- **PO edit lifecycle**: Submitted POs cannot be edited while in Submitted, Awaiting Approval, Approved, Fulfilled, or Cancelled status. Exception: a PO returned to Revision Required by an approver may be edited and resubmitted by the buyer; this is the only post-submission edit path.
