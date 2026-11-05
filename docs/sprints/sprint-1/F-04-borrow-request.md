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

## 1. Purpose and scope

A borrower requests one specific available item, stating why and for how many days. The request reserves the item so that no one else can request it. The borrower can see all their requests and, once checked out, the loan due date. Cancellation (F-06) and the borrowing limit (F-09) are Sprint 2.

## 2. Workflow and state transitions

1. Borrower clicks **Request** on an Available item → `/catalog/:id/request` shows the item summary and a form: **Purpose** (textarea) and **Loan length (days)** (number, default 7).
2. Submit → `POST /api/requests`.
3. In **one transaction** the server:
   1. checks the item exists (else `404 ITEM_NOT_FOUND`);
   2. runs `updateMany({ where: { id: itemId, status: 'AVAILABLE' }, data: { status: 'RESERVED' } })`;
   3. if 0 rows changed → rolls back, `409 ITEM_NOT_AVAILABLE`;
   4. creates `BorrowRequest { status: 'PENDING' }`.
4. Client shows a success toast and navigates to `/my`.

Transitions in this feature: Item `AVAILABLE → RESERVED`; BorrowRequest `(none) → PENDING`.

## 3. Business rules and validation

| Rule | Implementation |
|---|---|
| BR-01 Only Available items | Conditional update in step 3.2; `409 ITEM_NOT_AVAILABLE` "This item is not available to request." |
| BR-02 One open commitment per item | Same conditional update + partial unique index `BorrowRequest(itemId) WHERE status='PENDING'`; a `P2002` error is mapped to `409 ITEM_NOT_AVAILABLE`. |
| BR-04 Loan length | `requestedDays` integer 1–14 (Zod `z.number().int().min(1).max(14)`), plus DB CHECK constraint. |
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
Errors: `400 VALIDATION_ERROR`, `401`, `403` (custodian), `404 ITEM_NOT_FOUND`, `409 ITEM_NOT_AVAILABLE`.

### `GET /api/requests/mine` (Borrower)

`200 OK`: `{ "requests": [ <request as above> ] }` newest first. When fulfilled, `status` = `FULFILLED` and `loan` = `{ "id", "status": "ACTIVE", "checkedOutAt", "dueAt" }`.

### `GET /api/requests/:id` (Borrower, own)

`200 OK`: `{ "request": { ... } }`. Errors: `401`, `403` (custodian), `404 NOT_FOUND` (unknown or not own).

## 6. UI behavior

| Screen | Behavior |
|---|---|
| Request form `/catalog/:id/request` | Shows item asset tag, name, location. Purpose (required, character counter 0/200) and Loan length (1–14). Client-side validation mirrors server rules; server `400` details are shown under the matching field. `409` → red alert "This item is no longer available. Please choose another item." with a link back to the catalog. Submit button disabled while saving. |
| My Borrowing `/my` | Table: Asset tag, Item, Requested on, Days, Status, Due date. Status text: **Pending** (waiting for custodian), **On loan** (fulfilled, loan active). Due date shown only for loans, in Bangkok time. Empty state: "You have no requests yet." with link to Catalog. |

## 7. Permissions

Borrower only (F-02). Custodian → 403. Anonymous → 401.

## 8. Acceptance criteria

| AC | Given / When / Then |
|---|---|
| AC-04-01 | Given `LAP-001` is Available, when borrower1 submits a valid request, then the response is `201` with status `PENDING`; the item's status is `RESERVED`; and the request is returned by a later `GET /api/requests/mine`. |
| AC-04-02 | Given an item that is Reserved, On Loan, or Maintenance, when a borrower requests it, then the response is `409 ITEM_NOT_AVAILABLE`, no request is created, and the item's status is unchanged. |
| AC-04-03 | Given `LAP-002` is Available, when borrower1 and borrower2 request it at the same moment, then exactly one gets `201` and the other `409`, and the database holds exactly one Pending request for `LAP-002`. |
| AC-04-04 | `requestedDays` of 1 and 14 are accepted; 0, 15, 2.5, and `"7"` are rejected with `400`. A purpose of 5 and 200 characters (after trimming) is accepted; 4 or 201 characters, or only spaces, is rejected with `400`. An unknown `itemId` returns `404 ITEM_NOT_FOUND`. |
| AC-04-05 | `GET /api/requests/mine` returns only the caller's requests, newest first, each with item summary, status, and `loan` (null until checked out). |
| AC-04-06 | A borrower can open their own request with `GET /api/requests/:id` (200). |
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
| TEST-04-12 | AC-04-07 | Component | `client/src/pages/RequestPage.test.tsx` | Mocked API returning 409; then empty purpose | Submit | Shows "This item is no longer available…"; empty purpose shows inline field error and no API call |

## 10. Definition of Done

Product DoD in [README.md](README.md) applies. TDD evidence required for TEST-04-02 and TEST-04-03 (red commit before the conditional-update implementation).
