# F-13 Item Loan History — Engineering Contract

| Item | Value |
|---|---|
| Feature | F-13 Item Loan History |
| Requirements | FR-18, BR-05 |
| Sprint | Sprint 3 |
| Depends on | F-07, F-10 |

### Version history

| Version | Date | Change |
|---|---|---|
| v0.1 | 2026-11-28 | Contract written before implementation |
| v0.2 | 2026-11-28 | Review on PR #59 (@PakPak27): manual status changes made in F-10 (Maintenance, Available, Retired) are not stored as events, so they are out of scope for the history. |

## 1. Purpose and scope

A custodian opens one item in their location and sees its requests and loans, newest first: who requested it, when, the outcome (Pending, Rejected with reason, Cancelled, Fulfilled → loan checked out, due, returned, overdue). Read-only. Out of scope: manual status changes from F-10 (they are not recorded as events).

## 2. Workflow

Inventory page (F-10) → **History** on a row → `/custodian/items/:id/history` → `GET /api/custodian/items/:id/history`.

## 3. Business rules and validation

| Rule | Implementation |
|---|---|
| FR-18 | One list of events built from `BorrowRequest` and its `Loan`: requested, rejected/cancelled/fulfilled (with who and when), checked out, returned (the return time; whether the item went to Maintenance is not stored on the loan, so it is not shown) |
| Order | Newest request first; inside a request, events in time order |
| BR-05 | Item must be in the custodian's locations, else `404` |
| Privacy | Borrower name and e-mail are shown to custodians only (BR-06 unchanged for borrowers) |

## 4. Data model changes

None.

## 5. API specification

`GET /api/custodian/items/:id/history` → `200 { "item": { id, assetTag, name, status }, "requests": [ { id, status, purpose, requestedDays, createdAt, decidedAt, decisionNote, borrower: { name, email }, loan: { checkedOutAt, dueAt, returnedAt, status, isOverdue } | null } ] }`.
Errors: `400` (id), `401`, `403`, `404`.

## 6. UI behavior

A timeline list per request with status badges; empty state "This item has not been requested yet."

## 7. Permissions

Custodians of the item's location; borrowers `403`; other custodians `404`.

## 8. Acceptance criteria

| ID | Criterion |
|---|---|
| AC-13-01 | Given LAP-001 with a rejected request, a cancelled request and a fulfilled-and-returned request, the history lists the three requests newest first with their outcomes, borrower names and loan dates. |
| AC-13-02 | An item with no requests returns `requests: []`. |
| AC-13-03 | custodian.media asking for a HW-LAB item gets `404`; borrower1 gets `403`. |
| AC-13-04 | In the UI the custodian opens History from the inventory and sees the timeline. |

## 9. Software Test Specification

| Test ID | AC | Level | File › test | Setup | Action | Expected |
|---|---|---|---|---|---|---|
| TEST-13-01 | AC-13-01 | API | `server/tests/api/history.test.ts` › "lists requests and loans" | Three requests on LAP-001 | GET history | 3 rows, newest first, outcomes and dates |
| TEST-13-02 | AC-13-02 | API | › "empty history" | Seed | GET for ARD-003 | `requests: []` |
| TEST-13-03 | AC-13-03 | API | › "scope and role" | — | media; borrower | 404; 403 |
| TEST-13-04 | AC-13-04 | Component | `client/src/pages/ItemHistoryPage.test.tsx` | Mocked API | render | timeline rows |

## 10. Definition of Done

Sprint 2 DoD ([../sprint-2/README.md](../sprint-2/README.md)) applies. Status at Deliverable 2: **planned**.
