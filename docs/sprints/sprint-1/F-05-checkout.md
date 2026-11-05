# F-05 Request Queue and Checkout — Engineering Contract

| Item | Value |
|---|---|
| Feature | F-05 Request Queue and Checkout |
| Requirements | FR-07, FR-08, BR-02, BR-03, BR-04, BR-05, NFR-05 |
| Sprint / Issue | Sprint 1 / #8 |
| Depends on | F-02, F-04 |

### Version history

| Version | Date | Change |
|---|---|---|
| v0.1 | 2026-11-05 | Contract written before implementation |

## 1. Purpose and scope

A custodian sees pending requests for items in their locations and checks one out when the borrower collects the item. Checkout creates an active loan with a due date and marks the item On Loan. Rejection (F-06), returns (F-07), and overdue (F-08) are Sprint 2.

## 2. Workflow and state transitions

1. Custodian opens `/custodian/requests` → `GET /api/custodian/requests` (Pending, own locations, oldest first).
2. Custodian clicks **Check out** on a row → confirmation modal "Hand over LAP-001 to Borrower One for 7 days? Due: 14 Nov 2026 10:15" → **Confirm**.
3. `POST /api/custodian/requests/:id/checkout`. In **one transaction** the server:
   1. loads the request with its item; if not found or `item.locationId ∉ req.user.locationIds` → `404 NOT_FOUND`;
   2. `updateMany({ where: { id, status: 'PENDING' }, data: { status: 'FULFILLED', decidedById, decidedAt: now } })`; 0 rows → `409 REQUEST_NOT_PENDING`;
   3. `updateMany({ where: { id: itemId, status: 'RESERVED' }, data: { status: 'ON_LOAN' } })`; 0 rows → roll back, `409 ITEM_NOT_AVAILABLE`;
   4. creates `Loan { status: 'ACTIVE', checkedOutAt: now, dueAt: computeDueDate(now, requestedDays), checkedOutById }`.
4. The row disappears from the queue; a toast shows "Checked out — due 14 Nov 2026".

Transitions: BorrowRequest `PENDING → FULFILLED`; Item `RESERVED → ON_LOAN`; Loan `(none) → ACTIVE`.

## 3. Business rules and validation

| Rule | Implementation |
|---|---|
| BR-03 Only Pending + Reserved; atomic; once | Steps 3.2–3.4 in one `prisma.$transaction`; `Loan.requestId` unique. |
| BR-02 One active loan per item | Partial unique index `Loan(itemId) WHERE status='ACTIVE'`; `P2002` → `409 ITEM_NOT_AVAILABLE`. |
| BR-04 Due date | `computeDueDate(checkedOutAt, days) = checkedOutAt + days × 24 h` (pure function, unit-tested). |
| BR-05 Location scope | Step 3.1; queue query filters `item.locationId IN locationIds`. |
| `:id` | Positive integer, else `400`. |

## 4. Data model changes

`Loan` table (in SYS-01 migration) with:
```sql
CREATE UNIQUE INDEX "Loan_one_active_per_item"
  ON "Loan" ("itemId") WHERE "status" = 'ACTIVE';
```
and `Loan.requestId` `@unique`.

## 5. API specification

### `GET /api/custodian/requests?status=PENDING` (Custodian)

`status` optional, Sprint 1 supports `PENDING` only (default). `200 OK`:
```json
{
  "requests": [
    {
      "id": 12, "status": "PENDING", "purpose": "Embedded systems lab assignment 3", "requestedDays": 7,
      "createdAt": "2026-11-07T03:15:00.000Z",
      "borrower": { "id": 3, "name": "Borrower One", "email": "borrower1@lendlab.test" },
      "item": { "id": 1, "assetTag": "LAP-001", "name": "Dell Latitude 5440", "location": { "code": "HW-LAB" } }
    }
  ]
}
```
Oldest first. Errors: `400` (other status values), `401`, `403`.

### `POST /api/custodian/requests/:id/checkout` (Custodian)

No body. `201 Created`:
```json
{
  "loan": {
    "id": 5, "status": "ACTIVE", "requestId": 12,
    "checkedOutAt": "2026-11-07T03:20:00.000Z", "dueAt": "2026-11-14T03:20:00.000Z",
    "item": { "id": 1, "assetTag": "LAP-001", "status": "ON_LOAN" },
    "borrower": { "id": 3, "name": "Borrower One" }
  }
}
```
Errors: `400`, `401`, `403` (borrower), `404 NOT_FOUND` (unknown or other location), `409 REQUEST_NOT_PENDING`, `409 ITEM_NOT_AVAILABLE`.

## 6. UI behavior

| State | Display |
|---|---|
| Loaded | Table: Requested on, Borrower, Asset tag, Item, Purpose, Days, **Check out** button. |
| Empty | "No pending requests for your locations." |
| Confirm modal | Shows asset tag, borrower name, days, computed due date (Bangkok time); **Confirm** / **Cancel**. |
| Success | Row removed; green toast with due date. |
| 409 | Red alert with server message; queue reloads. |
| Loading / error | Standard states (SDS §3). |

Borrower side: on `/my`, the request now shows **On loan** and the due date (from F-04's `loan` field).

## 7. Permissions

Custodian only, own locations (F-02). Borrower → 403; other location → 404.

## 8. Acceptance criteria

| AC | Given / When / Then |
|---|---|
| AC-05-01 | Given Pending requests in the custodian's location, `GET /api/custodian/requests` returns them oldest first with borrower name, item, purpose, and requested days. |
| AC-05-02 | Given a Pending request with `requestedDays = 7` in the custodian's location, when they check it out, then the response is `201`; a Loan exists with status `ACTIVE`, `dueAt = checkedOutAt + 7 days`; the request is `FULFILLED`; the item is `ON_LOAN`. |
| AC-05-03 | Given a request that is already `FULFILLED`, when a custodian checks it out again, then the response is `409 REQUEST_NOT_PENDING` and there is still exactly one Loan for that request. |
| AC-05-04 | When two checkout calls for the same Pending request arrive at the same moment, exactly one succeeds with `201` and exactly one Loan is created; the database never holds two Active loans for one item. |
| AC-05-05 | Given a Pending request whose item is no longer Reserved (for example set to Maintenance), when the custodian checks it out, then the response is `409 ITEM_NOT_AVAILABLE`, the request stays Pending, and no Loan is created. |
| AC-05-06 | After checkout, the borrower's `GET /api/requests/mine` shows the request as `FULFILLED` with `loan.status = ACTIVE` and the due date. |
| AC-05-07 | In the UI, the custodian sees the pending request, confirms checkout, sees the success toast with due date, and the row leaves the queue. |

## 9. Software Test Specification

| Test | AC | Level | File / name | Precondition / input | Action | Expected result |
|---|---|---|---|---|---|---|
| TEST-05-01 | AC-05-01 | API | `tests/api/checkout.test.ts` › "lists pending requests oldest first" | Two Pending HW-LAB requests created 1 min apart | custodian.hw GET queue | 200; 2 items; older first; each has `borrower.name`, `item.assetTag`, `purpose`, `requestedDays` |
| TEST-05-02 | AC-05-02 | API | › "checks out a pending request" | Pending request, 7 days | POST checkout | 201; `dueAt − checkedOutAt` = 7 × 86 400 000 ms; DB: request `FULFILLED`, item `ON_LOAN`, 1 `ACTIVE` loan |
| TEST-05-03 | AC-05-03 | API | › "cannot check out twice" | Request already checked out | POST checkout again | 409 `REQUEST_NOT_PENDING`; Loan count for request = 1 |
| TEST-05-04 | AC-05-04 | API | › "concurrent checkouts create one loan" | Pending request | `Promise.all` of two POSTs | Sorted codes `[201, 409]`; Loan count for item = 1 |
| TEST-05-05 | AC-05-05 | API | › "item no longer reserved" | Pending request; item set to `MAINTENANCE` directly in DB | POST checkout | 409 `ITEM_NOT_AVAILABLE`; request `PENDING`; no Loan |
| TEST-05-06 | AC-05-04 | Integration (DB) | `tests/api/constraints.test.ts` › "DB allows one active loan per item" | One ACTIVE loan on `LAP-001` | `prisma.loan.create` second ACTIVE loan for `LAP-001` (different request) | Throws `P2002` |
| TEST-05-07 | AC-05-06 | API | `checkout.test.ts` › "borrower sees the loan after checkout" | Request checked out | borrower GET /mine | Request `FULFILLED`; `loan.status` `ACTIVE`; `loan.dueAt` equals checkout response |
| TEST-05-08 | AC-05-06, AC-05-07 | E2E | `client/e2e/journey.spec.ts` (full Sprint 1 journey) | Fresh seed | borrower1 requests `LAP-001` → signs out → custodian.hw signs in → Check out → Confirm → signs out → borrower1 opens `/my` | Toast with due date; queue empty; borrower sees **On loan** with due date |
| TEST-05-09 | AC-05-02 | Unit | `tests/unit/dates.test.ts` › "computeDueDate" | `2026-11-28T10:00Z` + 7; `2026-11-07T00:00Z` + 1; + 14 | Call function | `2026-12-05T10:00Z`; `2026-11-08T00:00Z`; +14 days exactly |

## 10. Definition of Done

Product DoD in [README.md](README.md) applies. TDD evidence required for TEST-05-03, TEST-05-04, and TEST-05-05.
