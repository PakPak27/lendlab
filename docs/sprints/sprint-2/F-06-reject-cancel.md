# F-06 Request Rejection and Cancellation — Engineering Contract

| Item | Value |
|---|---|
| Feature | F-06 Request Rejection and Cancellation |
| Requirements | FR-09, FR-10, BR-09, BR-05, BR-06, BR-07 |
| Sprint | Sprint 2 |
| Depends on | F-04, F-05 |

### Version history

| Version | Date | Change |
|---|---|---|
| v0.1 | 2026-11-28 | Contract written before implementation |

## 1. Purpose and scope

A custodian rejects a Pending request in their location with a reason; a borrower cancels their own Pending request. Both end the request and return the reserved item to Available, so someone else can request it. Out of scope: rejecting or cancelling after checkout (that is a return, F-07); editing a request.

## 2. Workflow and state transitions

**Reject (custodian).**
1. On `/custodian/requests` the custodian clicks **Reject** on a row → dialog "Reject the request for LAP-001 by Borrower One?" with a required **Reason** textarea (counter 0/200) → **Reject request**.
2. `POST /api/custodian/requests/:id/reject` with `{ "reason": "..." }`. In one interactive transaction the server:
   1. loads the request in the custodian's locations, else `404 NOT_FOUND`;
   2. `updateMany({ where: { id, status: 'PENDING' }, data: { status: 'REJECTED', decidedById, decidedAt: now, decisionNote: reason } })`; 0 rows → `409 REQUEST_NOT_PENDING`;
   3. `updateMany({ where: { id: itemId, status: 'RESERVED' }, data: { status: 'AVAILABLE' } })`.
3. The row leaves the queue; toast "Request rejected — LAP-001 is available again."

**Cancel (borrower).**
1. On `/my` a Pending row has a **Cancel request** button → confirm dialog "Cancel your request for LAP-001?" → **Cancel request**.
2. `POST /api/requests/:id/cancel`. Same transaction shape: own request only (else `404`), `PENDING → CANCELLED` with `decidedById = borrower`, `decidedAt = now`; item `RESERVED → AVAILABLE`.
3. The row shows **Cancelled**; toast "Request cancelled."

Transitions: BorrowRequest `PENDING → REJECTED | CANCELLED`; Item `RESERVED → AVAILABLE`. A request that is already Fulfilled, Rejected or Cancelled cannot change (409).

## 3. Business rules and validation

| Rule | Implementation |
|---|---|
| BR-09 reason 5–200 characters | Zod `z.string().trim().min(5).max(200)` on `reason`; message "Reason must be 5–200 characters." |
| BR-09 only Pending; item back to Available | Conditional `updateMany` on `status: 'PENDING'` (409 if 0 rows) and on item `RESERVED`, in one transaction |
| BR-05 custodian scope | Request lookup uses `custodianScope(user)`; outside → `404` (D-06) |
| BR-06 borrower scope | Lookup uses `borrowerScope(user)`; another borrower's request → `404` |
| BR-07 roles | `/api/custodian/*` requires CUSTODIAN, `/api/requests/*` requires BORROWER (existing guards) → `403` |
| Concurrency | Reject vs checkout vs cancel on the same request: the conditional update lets exactly one win; the others get `409 REQUEST_NOT_PENDING` |

## 4. Data model changes

None. `BorrowRequest.status` already has `REJECTED` and `CANCELLED`; `decidedById`, `decidedAt`, `decisionNote` exist.

## 5. API specification

`POST /api/custodian/requests/:id/reject` — body `{ "reason": string }` → `200 { "request": { id, status: "REJECTED", decisionNote, decidedAt, item: { id, assetTag, status: "AVAILABLE" } } }`.
Errors: `400 VALIDATION_ERROR` (`field: "reason"`), `401`, `403`, `404 NOT_FOUND`, `409 REQUEST_NOT_PENDING`.

`POST /api/requests/:id/cancel` — no body → `200 { "request": { ...F-04 request shape, status: "CANCELLED" } }`.
Errors: `400` (bad id), `401`, `403`, `404 NOT_FOUND`, `409 REQUEST_NOT_PENDING`.

`GET /api/requests/mine` (F-04) also returns `decisionNote` and `decidedAt`, so the borrower sees the rejection reason.

## 6. UI behavior

| Screen | Behavior |
|---|---|
| Custodian queue | Each row has **Check out** and **Reject**. The reject dialog has a labelled Reason textarea with counter; fewer than 5 characters shows "Reason must be 5–200 characters." and sends nothing; `409` shows "This request is no longer pending." and reloads the queue. |
| My Borrowing | Pending rows have **Cancel request** (confirm dialog). Rejected rows show the badge **Rejected** and the reason under the item name. Cancelled rows show **Cancelled**. |

## 7. Permissions

Reject: Custodian of the item's location. Cancel: the borrower who created the request. Everyone else: `403` (wrong role) or `404` (out of scope).

## 8. Acceptance criteria

| ID | Criterion |
|---|---|
| AC-06-01 | Given a Pending request for LAP-001 (HW-LAB), when custodian.hw rejects it with reason "Item reserved for a class", then the response is `200`, the request is `REJECTED` with that `decisionNote`, `decidedById` and `decidedAt`, and LAP-001 is `AVAILABLE`. |
| AC-06-02 | A reason of 4 characters, only spaces, or 201 characters is rejected with `400`, `field: "reason"`; 5 and 200 characters are accepted. A rejected attempt changes nothing. |
| AC-06-03 | Rejecting or cancelling a request that is not Pending (Fulfilled, Rejected, Cancelled) returns `409 REQUEST_NOT_PENDING` and changes nothing. |
| AC-06-04 | custodian.media rejecting a HW-LAB request gets `404`; a borrower calling the reject endpoint gets `403`. Nothing changes. |
| AC-06-05 | Given borrower1's Pending request, when borrower1 cancels it, then `200`, request `CANCELLED`, item `AVAILABLE`. borrower2 cancelling it gets `404`; a custodian gets `403`. |
| AC-06-06 | When a rejection and a checkout of the same request run at the same time, exactly one succeeds and the other gets `409`; the item ends either `ON_LOAN` (with one loan) or `AVAILABLE` (with no loan). |
| AC-06-07 | In the UI, the custodian rejects with a reason and the row leaves the queue; the borrower sees **Rejected** with the reason on My Borrowing; the borrower cancels a Pending request and sees **Cancelled**. |

## 9. Software Test Specification

| Test ID | AC | Level | File › test | Setup | Action | Expected |
|---|---|---|---|---|---|---|
| TEST-06-01 | AC-06-01 | API | `server/tests/api/rejectCancel.test.ts` › "rejects a pending request" | Pending LAP-001 request | custodian.hw POST reject | 200; DB: request REJECTED, note, decidedById = custodian; item AVAILABLE |
| TEST-06-02 | AC-06-02 | API | › "reason boundaries" (table) | Pending request | reason length 4, spaces, 201, 5, 200 | 400 ×3 with `field: "reason"` and DB unchanged; 200 ×2 |
| TEST-06-03 | AC-06-03 | API | › "only pending requests" | Fulfilled, Rejected, Cancelled requests | reject and cancel each | 409 REQUEST_NOT_PENDING; DB unchanged |
| TEST-06-04 | AC-06-04 | API | › "scope and role" | HW-LAB pending request | custodian.media reject; borrower1 reject | 404; 403; DB unchanged |
| TEST-06-05 | AC-06-05 | API | › "borrower cancels own request" | borrower1 pending request | borrower1, borrower2, custodian.hw cancel | 200 + CANCELLED + AVAILABLE; 404; 403 |
| TEST-06-06 | AC-06-06 | API | › "reject and checkout race" | Pending request | reject and checkout with `Promise.all` | one 2xx, one 409; item and loan count consistent |
| TEST-06-07 | AC-06-02 | Unit | `server/tests/unit/requestInput.test.ts` › "rejectRequestSchema" | — | reason values | Same boundaries as TEST-06-02 |
| TEST-06-08 | AC-06-07 | Component | `CustodianRequestsPage.test.tsx` › "reject with a reason"; `MyBorrowingPage.test.tsx` › "cancel" and "shows rejection reason" | Mocked API | Reject with 4 then 20 chars; cancel | Inline error, no POST for 4 chars; POST once for 20; row removed; Cancelled/Rejected badges and reason shown |

## 10. Definition of Done

Sprint 2 DoD ([README.md](README.md)) applies. TDD evidence required for TEST-06-01, TEST-06-03 and TEST-06-05.
