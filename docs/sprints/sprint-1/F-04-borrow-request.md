# F-04 Borrow Request and My Borrowing — Engineering Contract

| Item | Value |
|---|---|
| Feature | F-04 Borrow Request and My Borrowing |
| Requirements | FR-05, FR-06, BR-01, BR-02, BR-04, BR-06, BR-14, NFR-05 |
| Sprint / Issue | Sprint 1 / #7 |
| Depends on | F-02, F-03 |

### Version history

| Version | Date | Change |
|---|---|---|
| v0.1 | 2026-11-05 | Contract written before implementation |
| v0.2 | 2026-11-06 | Clarified interactive transaction (same reason as F-05 v0.2). |
| v0.3 | 2026-11-26 | **CHG-01** (Issue #50, Lab 7): BR-04 per-category maximum loan length. Changed: §2 step 3.1, §3 BR-04, §4, §5, §6, AC-04-04, TEST-04-12. Added: AC-04-08…10, TEST-04-13…19. Written and reviewed before the code change. |

## 1. Purpose and scope

A borrower requests one specific available item, stating why and for how many days. The request reserves the item so that no one else can request it. The borrower can see all their requests and, once checked out, the loan due date. Cancellation (F-06) and the borrowing limit (F-09) are Sprint 2.

## 2. Workflow and state transitions

1. Borrower clicks **Request** on an Available item → `/catalog/:id/request` shows the item summary and a form: **Purpose** (textarea) and **Loan length (days)** (number, default 7; *CHG-01:* default `min(7, category maximum)`, label shows the maximum).
2. Submit → `POST /api/requests`.
3. In **one interactive transaction** (`prisma.$transaction(async (tx) => { ... })`, because step 3.4 depends on the row count from step 3.3) the server:
   1. reads the item with its category's `maxLoanDays` (else `404 ITEM_NOT_FOUND`);
   2. *(CHG-01)* if `requestedDays` > `maxLoanDays` → rolls back, `400 VALIDATION_ERROR` with `details: [{ field: "requestedDays", message: "Loan length for <Category> items must be 1–<max> days." }]`. Nothing is reserved. This runs before the availability check, so an over-limit request for an unavailable item is also `400`;
   3. runs `updateMany({ where: { id: itemId, status: 'AVAILABLE' }, data: { status: 'RESERVED' } })`;
   4. if 0 rows changed → rolls back, `409 ITEM_NOT_AVAILABLE`;
   5. creates `BorrowRequest { status: 'PENDING' }`.
4. Client shows a success toast and navigates to `/my`.

Transitions in this feature: Item `AVAILABLE → RESERVED`; BorrowRequest `(none) → PENDING`.

## 3. Business rules and validation

| Rule | Implementation |
|---|---|
| BR-01 Only Available items | Conditional update in step 3.3; `409 ITEM_NOT_AVAILABLE` "This item is not available to request." |
| BR-02 One open commitment per item | Same conditional update + partial unique index `BorrowRequest(itemId) WHERE status='PENDING'`; a `P2002` error is mapped to `409 ITEM_NOT_AVAILABLE`. |
| BR-04 Loan length *(v0.3, CHG-01)* | Two layers. (1) Input shape, unchanged: `requestedDays` integer 1–14 (Zod `z.number().int().min(1).max(14)`), plus the DB CHECK constraint (global upper bound). (2) New: `requestedDays` ≤ the item category's `maxLoanDays` (Laptop 7, Camera 3, Projector 3, Microcontroller Kit 14), checked in the transaction (step 3.2) by a pure function `loanLengthError(days, category)` that returns the error message or `null`. Requests created before the change are not re-checked. *(v0.2: layer 1 only.)* |
| BR-14 Purpose | Trimmed, 5–200 characters. |
| `itemId` | Positive integer. |
| BR-06 Own records only | `/mine` filters by `borrowerId = req.user.id`; `/:id` for another borrower's request → `404 NOT_FOUND`. |

## 4. Data model changes

`BorrowRequest` table (in SYS-01 migration) with partial unique index:
```sql
CREATE UNIQUE INDEX "BorrowRequest_one_pending_per_item"
  ON "BorrowRequest" ("itemId") WHERE "status" = 'PENDING';
ALTER TABLE "BorrowRequest"
  ADD CONSTRAINT "BorrowRequest_requestedDays_range" CHECK ("requestedDays" BETWEEN 1 AND 14);
```

### CHG-01 migration `category_max_loan_days`

```sql
ALTER TABLE "Category" ADD COLUMN "maxLoanDays" INTEGER NOT NULL DEFAULT 14;
ALTER TABLE "Category"
  ADD CONSTRAINT "Category_maxLoanDays_range" CHECK ("maxLoanDays" BETWEEN 1 AND 14);
UPDATE "Category" SET "maxLoanDays" = 7 WHERE "name" = 'Laptop';
UPDATE "Category" SET "maxLoanDays" = 3 WHERE "name" IN ('Camera', 'Projector');
```

Existing categories get their value in the same migration, so the live database needs no manual step. The seed sets the same values (also on update), so re-running the seed keeps them. Existing `BorrowRequest` rows are not changed (historical data, AC-04-10).

## 5. API specification

### `POST /api/requests` (Borrower)

Request:
```json
{ "itemId": 1, "purpose": "Embedded systems lab assignment 3", "requestedDays": 7 }
```
`201 Created`:
```json
{
  "request": {
    "id": 12, "status": "PENDING", "purpose": "Embedded systems lab assignment 3", "requestedDays": 7,
    "createdAt": "2026-11-07T03:15:00.000Z",
    "item": { "id": 1, "assetTag": "LAP-001", "name": "Dell Latitude 5440", "status": "RESERVED" },
    "loan": null
  }
}
```
Errors: `400 VALIDATION_ERROR` (also when `requestedDays` is above the category maximum, CHG-01), `401`, `403` (custodian), `404 ITEM_NOT_FOUND`, `409 ITEM_NOT_AVAILABLE`.

`400` for a Laptop requested for 8 days *(CHG-01)*:
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "The request is invalid.",
  "details": [ { "field": "requestedDays", "message": "Loan length for Laptop items must be 1–7 days." } ] } }
```

The form reads the maximum from `GET /api/items/:id`, which returns `category: { "id", "name", "maxLoanDays" }` (F-03 contract v0.3).

### `GET /api/requests/mine` (Borrower)

`200 OK`: `{ "requests": [ <request as above> ] }` newest first. When fulfilled, `status` = `FULFILLED` and `loan` = `{ "id", "status": "ACTIVE", "checkedOutAt", "dueAt" }`.

### `GET /api/requests/:id` (Borrower, own)

`200 OK`: `{ "request": { ... } }`. Errors: `401`, `403` (custodian), `404 NOT_FOUND` (unknown or not own).

## 6. UI behavior

| Screen | Behavior |
|---|---|
| Request form `/catalog/:id/request` | Shows item asset tag, name, location. Purpose (required, character counter 0/200) and Loan length *(CHG-01)*: label "Loan length (days, max N)" with N = `item.category.maxLoanDays`, input `min=1 max=N`, default `min(7, N)`; a value above N shows "Loan length for <Category> items must be 1–N days." and sends nothing. *(v0.2: 1–14 for every item, default 7.)* Client-side validation mirrors server rules; server `400` details are shown under the matching field. `409` → red alert "This item is no longer available. Please choose another item." with a link back to the catalog. Submit button disabled while saving. |
| My Borrowing `/my` | Table: Asset tag, Item, Requested on, Days, Status, Due date. Status text: **Pending** (waiting for custodian), **On loan** (fulfilled, loan active). Due date shown only for loans, in Bangkok time. Empty state: "You have no requests yet." with link to Catalog. |

## 7. Permissions

Borrower only (F-02). Custodian → 403. Anonymous → 401.

## 8. Acceptance criteria

| AC | Given / When / Then |
|---|---|
| AC-04-01 | Given `LAP-001` is Available, when borrower1 submits a valid request, then the response is `201` with status `PENDING`; the item's status is `RESERVED`; and the request is returned by a later `GET /api/requests/mine`. |
| AC-04-02 | Given an item that is Reserved, On Loan, or Maintenance, when a borrower requests it, then the response is `409 ITEM_NOT_AVAILABLE`, no request is created, and the item's status is unchanged. |
| AC-04-03 | Given `LAP-002` is Available, when borrower1 and borrower2 request it at the same moment, then exactly one gets `201` and the other `409`, and the database holds exactly one Pending request for `LAP-002`. |
| AC-04-04 | *(v0.3: the 1 and 14 boundaries are now stated for a Microcontroller Kit item, whose maximum is 14)* `requestedDays` of 1 and 14 are accepted for a Microcontroller Kit item; 0, 15, 2.5, and `"7"` are rejected with `400` for any item. A purpose of 5 and 200 characters (after trimming) is accepted; 4 or 201 characters, or only spaces, is rejected with `400`. An unknown `itemId` returns `404 ITEM_NOT_FOUND`. |
| AC-04-05 | `GET /api/requests/mine` returns only the caller's requests, newest first, each with item summary, status, and `loan` (null until checked out). |
| AC-04-06 | A borrower can open their own request with `GET /api/requests/:id` (200). |
| AC-04-08 | *(CHG-01)* Given the seeded categories, when borrower1 requests an Available item, then the loan length is accepted up to the category maximum and rejected one day above it: Laptop 7 → `201`, 8 → `400`; Camera 3 → `201`, 4 → `400`; Projector 3 → `201`, 4 → `400`; Microcontroller Kit 14 → `201`. A rejected request has `details[0].field = "requestedDays"` and the message "Loan length for <Category> items must be 1–<max> days.", creates no request and leaves the item `AVAILABLE`. An over-limit request for a Reserved item is `400` and changes nothing; for an unknown item it is `404 ITEM_NOT_FOUND`. |
| AC-04-09 | *(CHG-01)* `GET /api/items/:id` returns `category.maxLoanDays` (LAP-001 → 7, CAM-001 → 3). In the request form the label shows the maximum, the default is `min(7, max)`, and a value above the maximum shows the inline error and sends nothing. `GET /api/items` and `GET /api/categories` keep their v0.2 response shape. |
| AC-04-10 | *(CHG-01, historical data)* Given a Pending Laptop request for 10 days created before the change, when custodian.hw checks it out, then the response is `201` and `dueAt = checkedOutAt + 10 days`. |
| AC-04-07 | In the UI, a borrower can request an Available item, sees a success message, and finds it on My Borrowing as **Pending**; invalid input shows field errors; a 409 shows the "no longer available" message. |

## 9. Software Test Specification

| Test | AC | Level | File / name | Precondition / input | Action | Expected result |
|---|---|---|---|---|---|---|
| TEST-04-01 | AC-04-01 | API | `tests/api/requests.test.ts` › "creates a request and reserves the item" | `LAP-001` Available; borrower1 | POST valid body; GET /mine | 201 `PENDING`; DB item `RESERVED`; /mine contains the request id |
| TEST-04-02 | AC-04-02 | API | › "rejects items that are not available" (table: RESERVED, ON_LOAN, MAINTENANCE) | Item set to each status | POST | 409 `ITEM_NOT_AVAILABLE`; request count unchanged; item status unchanged |
| TEST-04-03 | AC-04-03 | API | › "only one of two concurrent requests succeeds" | `LAP-002` Available; borrower1 and borrower2 tokens | `Promise.all` of two POSTs | Status codes sorted = `[201, 409]`; exactly 1 `PENDING` request for `LAP-002` |
| TEST-04-04 | AC-04-03 | Integration (DB) | `tests/api/constraints.test.ts` › "DB allows one pending request per item" | One Pending request on `LAP-003` | `prisma.borrowRequest.create` a second Pending for `LAP-003` directly | Throws Prisma `P2002` |
| TEST-04-05 | AC-04-04 | Unit | `tests/unit/requestInput.test.ts` | Days: 0, 1, 14, 15, 2.5, `"7"` | `createRequestSchema.safeParse` | valid only for 1 and 14 |
| TEST-04-06 | AC-04-04 | API | `tests/api/requests.test.ts` › "loan length boundaries" | Available items | POST with days 0, 1, 14, 15 | 400, 201, 201, 400 |
| TEST-04-07 | AC-04-04 | Unit + API | `requestInput.test.ts` › "purpose length"; `requests.test.ts` › "rejects short purpose" | Purpose of 4, 5, 200, 201 chars and `"     "` | Parse; POST with 4 chars | Valid for 5 and 200 only; API 400 with `details[0].field = "purpose"` |
| TEST-04-08 | AC-04-04 | API | › "unknown item" | `itemId: 99999` | POST | 404 `ITEM_NOT_FOUND` |
| TEST-04-09 | AC-04-05 | API | › "mine returns only own requests" | borrower1 has 2 requests, borrower2 has 1 | borrower1 GET /mine | Length 2; all `borrowerId` = borrower1; newest first; `loan` null |
| TEST-04-10 | AC-04-06 | API | › "borrower reads own request" | borrower1 request | GET /api/requests/:id | 200 with matching id |
| TEST-04-11 | AC-04-07 | E2E | `client/e2e/borrow.spec.ts` | borrower1 signed in; `LAP-001` Available | Catalog → Request → fill purpose, 7 days → Submit | Toast "Request submitted"; on `/my` row `LAP-001` shows **Pending**; catalog shows `LAP-001` **Reserved** |
| TEST-04-12 | AC-04-07 | Component | `client/src/pages/RequestPage.test.tsx` | Mocked API returning 409; then empty purpose | Submit | Shows "This item is no longer available…"; empty purpose shows inline field error and no API call. *(v0.3: the "loan length of 15" case on the Laptop mock now expects "Loan length for Laptop items must be 1–7 days."; `validateRequestForm` takes the maximum as a third argument and keeps its 14-day cases with maximum 14.)* |
| TEST-04-13 | AC-04-08 | Unit | `server/tests/unit/loanLength.test.ts` › "loanLengthError" | `{ name: 'Laptop', maxLoanDays: 7 }` with 1, 7, 8; Camera (3) with 3, 4; Kit (14) with 14 | Call function | `null` for 1, 7, 3, 14; "Loan length for Laptop items must be 1–7 days." for 8; "Loan length for Camera items must be 1–3 days." for 4 |
| TEST-04-14 | AC-04-08 | API | `requests.test.ts` › "per-category maximum loan length (CHG-01)" (table) | Seeded items Available; borrower1 | POST LAP-001 7, LAP-002 8, CAM-001 3, CAM-002 4, PRJ-001 3, PRJ-002 4, ARD-001 14 | 201, 400, 201, 400, 201, 400, 201; each 400 has `field = "requestedDays"`, the category message, no new request, item `AVAILABLE` |
| TEST-04-15 | AC-04-08 | API | `requests.test.ts` › "over-limit request for an unavailable or unknown item" | LAP-003 set to `RESERVED`; `itemId: 99999` | POST with 8 days | 400, LAP-003 still `RESERVED`, request count unchanged; 404 `ITEM_NOT_FOUND` |
| TEST-04-16 | AC-04-09 | API | `server/tests/api/items.test.ts` › "item detail includes the category maximum loan length (CHG-01)" | Seed | GET `/api/items/:id` for LAP-001 and CAM-001 | `category.maxLoanDays` = 7 and 3. TEST-03-01 (unchanged) still asserts the exact list shape `category: { id, name }` |
| TEST-04-17 | AC-04-09 | Component | `RequestPage.test.tsx` › "laptop form shows max 7 and blocks 8"; "camera form defaults to 3 and blocks 4" | Mocked item with `maxLoanDays` 7 / 3 | Render; type 8 / 4; submit | Label contains "max 7" / "max 3"; default 7 / 3; inline category message; no POST |
| TEST-04-18 | AC-04-10 | API | `server/tests/api/checkout.test.ts` › "a request above the new maximum created before CHG-01 can still be checked out" | Pending LAP-001 request with `requestedDays: 10` inserted directly (an old row) | custodian.hw POST checkout | 201; `dueAt − checkedOutAt` = 10 days; request `FULFILLED` |
| TEST-04-19 | AC-04-08 | Integration (DB) | `server/tests/api/constraints.test.ts` › "Category.maxLoanDays seed values and range" | Seeded DB | Read categories; update one to 0 and to 15 | Laptop 7, Camera 3, Projector 3, Microcontroller Kit 14; 0 and 15 rejected by `Category_maxLoanDays_range` |

## 10. Definition of Done

Product DoD in [README.md](README.md) applies. TDD evidence required for TEST-04-02 and TEST-04-03 (red commit before the conditional-update implementation). *(CHG-01)* TEST-04-13…19 are committed and run on the pre-change code first (red); the implementation commit then makes them pass (green).
