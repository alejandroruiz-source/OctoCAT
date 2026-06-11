# Feature Specification: Purchase Order Management Frontend

**Feature Branch**: `002-po-frontend-ui`

**Created**: 2026-06-10

**Status**: Draft

**Input**: User description: "update the spec to include a frontend for the current feature"

**Depends on**: `specs/001-purchase-order-mgmt` — this frontend consumes the Purchase Order Management REST API.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Buyer: Create and Manage Draft Purchase Orders (Priority: P1)

A buyer at a branch location opens the PO management interface and creates a new purchase order by selecting a supplier and entering product line items. They can add, edit, or remove line items and see the running total update in real time. They can save the draft and return to it later, or cancel the PO entirely.

**Why this priority**: Without the ability to view and manage draft POs, none of the downstream workflows are reachable. This is the entry point for all PO activity.

**Independent Test**: A buyer can log in, navigate to the PO list, create a new PO with at least two line items, edit a quantity, delete one item, verify the total recalculates, and cancel the PO — entirely without involving any supplier, approver, or notification system.

**Acceptance Scenarios**:

1. **Given** a buyer is authenticated, **When** they open the PO list page, **Then** they see only their own POs (no other buyers' drafts are visible) with their current status and total displayed.
2. **Given** a buyer starts a new PO, **When** they enter a supplier and branch, **Then** a draft PO is created and the buyer is taken to the PO detail/edit page.
3. **Given** a draft PO is open, **When** the buyer adds a line item with a product, quantity, and unit price, **Then** the line item appears with the computed extended price and the PO total updates immediately.
4. **Given** a draft PO with multiple line items, **When** the buyer edits a quantity, **Then** the extended price and running total both update without requiring a page reload.
5. **Given** a draft PO, **When** the buyer deletes a line item, **Then** the item is removed and the total recalculates.
6. **Given** a draft PO, **When** the buyer clicks Cancel PO and confirms, **Then** the PO status changes to Cancelled and the buyer is returned to the PO list.
7. **Given** a PO is currently locked for editing by another user, **When** a buyer tries to edit it, **Then** a clear message indicates who holds the lock and when it will expire.

---

### User Story 2 — Buyer: Submit a Purchase Order (Priority: P1)

A buyer with a complete draft PO reviews the total, sets an expected delivery date, and submits the PO to the supplier. The interface warns the buyer if the total meets or exceeds the $10,000 approval threshold, so they know what to expect next. Once submitted, the PO becomes read-only.

**Why this priority**: Submission is the central action that advances the PO from internal draft to external commitment. Without it, the backend API and notifications deliver no user value.

**Independent Test**: A buyer submits a draft PO under $10,000 (expects Submitted status) and a separate draft PO at or above $10,000 (expects Awaiting Approval status), confirming the correct next status appears in the UI after each submission.

**Acceptance Scenarios**:

1. **Given** a draft PO with at least one line item, **When** the buyer opens the submit flow, **Then** they are prompted to confirm or enter an expected delivery date before proceeding.
2. **Given** a draft PO whose total is below $10,000, **When** the buyer submits, **Then** the status updates to Submitted and the page reflects the read-only state immediately.
3. **Given** a draft PO whose total is $10,000 or more, **When** the buyer is about to submit, **Then** the interface displays a clear notice that this PO will require manager approval before proceeding.
4. **Given** a draft PO at or above $10,000, **When** the buyer submits, **Then** the status updates to Awaiting Approval and the approval deadline is displayed on the PO detail page.
5. **Given** a submitted or awaiting-approval PO, **When** the buyer views it, **Then** all line items and fields are read-only; no edit or add-line-item controls are shown.
6. **Given** a draft PO with no line items, **When** the buyer attempts to submit, **Then** submission is blocked with a message indicating at least one line item is required.

---

### User Story 3 — Approver: Review and Decide on High-Value Purchase Orders (Priority: P2)

A designated approver opens an approval queue showing all POs awaiting their review. They select a PO, review its details (supplier, line items, total, submission date, approval deadline), and either approve it or reject it with a mandatory written reason. After a decision, the PO disappears from the queue.

**Why this priority**: Required for any PO at or above $10,000 to progress. Without this screen, high-value POs would be permanently stuck in Awaiting Approval.

**Independent Test**: An approver logs in, sees at least one PO in the approval queue, approves one (status changes to Approved), and rejects another with a reason (status changes to Revision Required) — all without any buyer or supplier interaction required in the same session.

**Acceptance Scenarios**:

1. **Given** an approver is authenticated, **When** they open the approval queue, **Then** they see all POs in Awaiting Approval status across all buyers and branches.
2. **Given** the approver opens a PO for review, **When** viewing the detail page, **Then** they see the full PO details including approval deadline, and Approve and Reject buttons are available.
3. **Given** an approver clicks Approve, **When** they confirm, **Then** the PO status changes to Approved, a success message is shown, and the PO is removed from the queue.
4. **Given** an approver clicks Reject, **When** prompted, **Then** they must enter a rejection reason (field is required; submission blocked if empty) before the decision is confirmed.
5. **Given** a rejection reason is submitted, **When** confirmed, **Then** the PO status changes to Revision Required, and the PO is removed from the approval queue.
6. **Given** a PO whose approval deadline has passed, **When** the approver views the queue, **Then** overdue POs are visually distinguished (e.g., highlighted or labelled "Overdue").

---

### User Story 4 — Buyer: Revise and Resubmit a Rejected Purchase Order (Priority: P2)

A buyer receives notification that their PO has been sent back for revision. They open the PO, read the rejection reason, make adjustments to line items or notes, and resubmit. The PO re-enters the approval queue with the updated details.

**Why this priority**: Closes the approval loop. Without this, the Revision Required state is a dead end and buyers have no way to recover rejected high-value orders.

**Independent Test**: A buyer opens a PO in Revision Required status, edits a line item to change the total, reads the displayed rejection reason, and resubmits — the PO returns to Awaiting Approval status.

**Acceptance Scenarios**:

1. **Given** a buyer's PO is in Revision Required status, **When** they open it, **Then** the rejection reason is prominently displayed alongside the editable PO fields.
2. **Given** a PO in Revision Required status, **When** the buyer edits line items, **Then** the PO behaves identically to a draft (editable, totals recalculate).
3. **Given** a revised PO, **When** the buyer resubmits, **Then** the status returns to Awaiting Approval and the approval deadline resets.

---

### User Story 5 — Supplier: View and Fulfill Submitted Purchase Orders (Priority: P3)

A supplier logs in and sees all POs addressed to them that have been submitted or approved (drafts are hidden). They can view the full PO details and, when goods are ready for delivery, mark a PO as Fulfilled.

**Why this priority**: Completes the supply chain loop, but can be delivered after the core buyer and approver workflows are proven.

**Independent Test**: A supplier views a PO in Submitted status (low-value) and one in Approved status, marks one as Fulfilled, and confirms the status changes to Fulfilled — entirely without a buyer or approver interaction in the same session.

**Acceptance Scenarios**:

1. **Given** a supplier is authenticated, **When** they open the PO list, **Then** they see only POs addressed to their supplier account and only in non-Draft statuses.
2. **Given** a supplier views a PO in Submitted or Approved status, **When** they click Fulfill, **Then** they confirm the action and the PO status changes to Fulfilled with the current timestamp.
3. **Given** a PO in any other status (Draft, Awaiting Approval, Cancelled, Fulfilled), **When** the supplier views it, **Then** no Fulfill button is shown.

---

### User Story 6 — All Roles: View PO Status History (Priority: P3)

Any authenticated user can view the complete lifecycle timeline for any PO they have permission to see. The timeline shows each status transition, when it happened, and who caused it.

**Why this priority**: Provides audit visibility and is useful for debugging disputes, but the core workflows function without it.

**Independent Test**: Any role opens a PO that has gone through at least three status changes and verifies the timeline displays each transition in chronological order with the correct actor and timestamp.

**Acceptance Scenarios**:

1. **Given** any user with permission to view a PO, **When** they open its detail page, **Then** a status history section lists all transitions in chronological order (oldest first).
2. **Given** a history entry, **When** displayed, **Then** it shows the previous status, new status, who made the change, the date and time, and any note or reason (e.g., rejection reason).

---

### Edge Cases

- What happens when a buyer's session times out while editing a draft — is the draft preserved?
- How does the interface behave when the API is temporarily unavailable (network error)?
- What does the PO list show when a buyer has no POs yet?
- What if the approval deadline passes while the approver has the PO open — does the UI update?
- What happens if two users try to edit the same draft simultaneously (lock conflict)?

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The interface MUST display different navigation options and available actions based on the authenticated user's role (BUYER, SUPPLIER, APPROVER).
- **FR-002**: Buyers MUST be able to create a new purchase order by specifying a supplier, branch, optional expected delivery date, and optional notes.
- **FR-003**: Buyers MUST be able to add, edit, and delete line items on a draft or revision-required PO; the running total MUST update on every change without requiring a page reload.
- **FR-004**: The interface MUST prevent all edit operations on POs not in Draft or Revision Required status, showing appropriate read-only indicators.
- **FR-005**: Buyers MUST be able to set or update the expected delivery date when submitting a PO; the field MUST be required at submission time.
- **FR-006**: The submission flow MUST display a visual warning when the PO total meets or exceeds the $10,000 approval threshold before the buyer confirms.
- **FR-007**: Approvers MUST have a dedicated view listing all POs in Awaiting Approval status, with overdue approvals visually distinguished.
- **FR-008**: The reject action MUST require a non-empty reason; the interface MUST block submission of a rejection without one.
- **FR-009**: Buyers viewing a PO in Revision Required status MUST see the rejection reason prominently before the editable fields.
- **FR-010**: Suppliers MUST see only non-Draft POs addressed to their account; the Fulfill action MUST only appear on Submitted or Approved POs.
- **FR-011**: A status history timeline MUST appear on every PO detail page, listing all transitions in chronological order with actor, timestamp, and any associated note.
- **FR-012**: When a PO is locked by another user, the interface MUST display the lock holder's identity and the time remaining until the lock expires, without allowing a competing edit.
- **FR-013**: The PO list MUST support filtering by status and searching by PO number, and MUST paginate results when the list exceeds a reasonable threshold.
- **FR-014**: All operations that modify PO data MUST provide clear success or failure feedback to the user within the same view.

### Key Entities

- **PO Summary**: A condensed view of a purchase order as it appears in a list — PO number, supplier name, status badge, total, last-updated date.
- **PO Detail**: The full editable or read-only form showing all PO fields, line items, and status history.
- **Line Item Row**: A single product entry in the PO, showing product name, quantity, unit price, and computed extended price; editable in draft state.
- **Approval Queue Entry**: An approver-facing summary of a PO awaiting decision, including total, buyer name, submission date, and approval deadline.
- **Status History Entry**: A single event in the PO lifecycle timeline — previous status, new status, actor, timestamp, and optional note.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A buyer can create a new PO and submit it (including adding at least two line items and setting a delivery date) in under 5 minutes from first login.
- **SC-002**: An approver can review and decide on a PO (approve or reject with reason) in under 2 minutes from opening the approval queue.
- **SC-003**: The PO list page loads within 2 seconds when displaying up to 200 POs on a standard office internet connection.
- **SC-004**: All three role-specific workflows (buyer, approver, supplier) can be completed end-to-end without requiring any developer intervention or direct API access.
- **SC-005**: The interface is usable on tablet-sized screens (minimum 768px viewport width) to support branch and warehouse staff who may not have desktop workstations.
- **SC-006**: After a status change (submit, approve, reject, fulfill), the updated status is visible to any viewing user within 15 seconds without a manual page reload.
- **SC-007**: A first-time user of a given role can identify and complete their primary task (create/submit, approve/reject, fulfill) without any written instructions, achieving a task-completion rate of 90% or above.

---

## Assumptions

- Users are pre-assigned a role (BUYER, SUPPLIER, or APPROVER) by an administrator; the frontend does not need a self-registration or role-assignment workflow in this version.
- Authentication is handled by an existing SSO or identity provider before users reach the PO management interface; the frontend does not include a login screen. It receives an authenticated session token, performs a session validity check on load, and redirects unauthenticated users to the organization's identity provider. A logout action clears the local session and redirects to the identity provider's logout endpoint.
- The frontend communicates exclusively with the REST API defined in `specs/001-purchase-order-mgmt`; no direct database access or additional backend services are introduced.
- Supplier entities are pre-populated in the system; the buyer selects from an existing supplier list rather than creating new suppliers through this interface.
- A single-page application layout (one tab, persistent navigation) is assumed; multi-window or multi-tab conflict scenarios are out of scope for this version.
- Email and push notification delivery (supplier notified of submission, buyer notified of rejection) is handled by the backend outbox worker defined in spec 001; this frontend does not send notifications directly.
- Browser support targets modern evergreen browsers (Chrome, Firefox, Edge, Safari current + prior major version); IE11 is out of scope.
