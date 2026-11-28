# F-09 Borrowing Limit — Engineering Contract

| Item | Value |
|---|---|
| Feature | F-09 Borrowing Limit |
| Requirements | BR-08, NFR-05 |
| Sprint | Sprint 2 |
| Depends on | F-04 |

### Version history

| Version | Date | Change |
|---|---|---|
| v0.1 | 2026-11-28 | Contract written before implementation |

## 1. Purpose and scope

A borrower may hold at most **3 open commitments** (Pending requests plus Active loans). A 4th request is refused. Out of scope: per-category limits, custodian overrides.

## 2. Workflow and state transitions

`POST /api/requests` (F-04), inside the existing transaction, after the overdue check (F-08) and before the availability update:
1. lock the borrower's row: `SELECT id FROM "User" WHERE id = $1 FOR UPDATE` (so two requests from the same borrower are counted one after the other);
2. `open = count(BorrowRequest PENDING of borrower) + count(Loan ACTIVE of borrower)`;
3. `open >= 3` → `409 BORROWING_LIMIT` "You already have 3 open requests or loans. Cancel a request or return an item first."; nothing reserved.

A Fulfilled request is counted through its Active loan, not twice. Rejected, Cancelled and Returned records do not count.

## 3. Business rules and validation

| Rule | Implementation |
|---|---|
| BR-08 at most 3 open commitments | Count in the create transaction; limit constant `BORROWING_LIMIT = 3` in `server/src/lib/borrowingLimit.ts` with pure `limitReached(openCount)` |
| NFR-05 concurrency | Row lock on the borrower before counting; two simultaneous requests at 2 open commitments → one `201`, one `409` |
| Existing data | Borrowers already above 3 (created before this rule) keep their records; they only cannot create new requests until below 3 |

## 4. Data model changes

None.

## 5. API specification

`POST /api/requests`: new error `409 { "error": { "code": "BORROWING_LIMIT", "message": "You already have 3 open requests or loans. Cancel a request or return an item first." } }`.

## 6. UI behavior

| Screen | Behavior |
|---|---|
| Request form | A `409 BORROWING_LIMIT` answer shows the server message in a red alert with a link to My Borrowing. |
| My Borrowing | A line "Open requests and loans: N of 3". |

## 7. Permissions

Unchanged (borrowers only).

## 8. Acceptance criteria

| ID | Criterion |
|---|---|
| AC-09-01 | `limitReached` is false for 0, 1, 2 and true for 3 and 4. |
| AC-09-02 | Given borrower1 with 2 Pending requests and 0 loans, a 3rd request is `201`; a 4th is `409 BORROWING_LIMIT`, no request is created and the item stays `AVAILABLE`. |
| AC-09-03 | Given borrower1 with 1 Pending request and 2 Active loans, a new request is `409 BORROWING_LIMIT`. |
| AC-09-04 | Rejected, Cancelled and Returned records do not count: after cancelling one of 3 Pending requests, a new request is `201`. |
| AC-09-05 | borrower1 at 3 does not affect borrower2 (`201`). |
| AC-09-06 | Given borrower1 at 2 open commitments, two simultaneous requests for two different Available items give exactly one `201` and one `409 BORROWING_LIMIT`. |
| AC-09-07 | In the UI, the request form shows the `409` message and My Borrowing shows "Open requests and loans: N of 3". |

## 9. Software Test Specification

| Test ID | AC | Level | File › test | Setup | Action | Expected |
|---|---|---|---|---|---|---|
| TEST-09-01 | AC-09-01 | Unit | `server/tests/unit/borrowingLimit.test.ts` › "limitReached" | — | 0–4 | false ×3, true ×2 |
| TEST-09-02 | AC-09-02 | API | `server/tests/api/borrowingLimit.test.ts` › "3rd allowed, 4th refused" | borrower1 with 2 Pending | POST 3rd, POST 4th | 201; 409 BORROWING_LIMIT; counts and item unchanged |
| TEST-09-03 | AC-09-03 | API | › "loans count" | 1 Pending + 2 Active loans | POST | 409 |
| TEST-09-04 | AC-09-04 | API | › "closed records do not count" | 3 Pending, cancel one (F-06) | POST | 201 |
| TEST-09-05 | AC-09-05 | API | › "per borrower" | borrower1 at 3 | borrower2 POST | 201 |
| TEST-09-06 | AC-09-06 | API | › "simultaneous requests" | borrower1 at 2 | 2 POSTs in `Promise.all` | one 201, one 409; exactly 3 open |
| TEST-09-07 | AC-09-07 | Component | `RequestPage.test.tsx` › "borrowing limit 409"; `MyBorrowingPage.test.tsx` › "open count" | Mocked API | Submit / render | Message shown; "Open requests and loans: 2 of 3" |

## 10. Definition of Done

Sprint 2 DoD ([README.md](README.md)) applies. TDD evidence required for TEST-09-02 and TEST-09-06.
