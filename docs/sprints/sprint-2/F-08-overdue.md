# F-08 Due Dates and Overdue Status — Engineering Contract

| Item | Value |
|---|---|
| Feature | F-08 Due Dates and Overdue Status |
| Requirements | FR-12, BR-11, BR-12, BR-06 |
| Sprint | Sprint 2 |
| Depends on | F-05, F-07 |

### Version history

| Version | Date | Change |
|---|---|---|
| v0.1 | 2026-11-28 | Contract written before implementation |

## 1. Purpose and scope

Loans past their due date are shown as **Overdue** to the borrower and to the custodian, and a borrower with an overdue loan cannot create new requests until it is returned. Overdue is calculated when read (no stored flag, no scheduled job). Out of scope: fines, e-mail reminders.

## 2. Workflow and state transitions

1. Any read of a loan (`GET /api/requests/mine`, `GET /api/custodian/loans`) adds `isOverdue = isOverdue(loan, now)`.
2. My Borrowing and the custodian Loans page show a red **Overdue** badge next to the due date.
3. `POST /api/requests` (F-04): after the item and loan-length checks, the server looks for an Active loan of this borrower with `dueAt < now`; if one exists → `409 OVERDUE_LOAN`, nothing reserved.
4. When the loan is returned (F-07) the borrower can request again.

No new states: overdue is a derived view of `Loan ACTIVE` + time.

## 3. Business rules and validation

| Rule | Implementation |
|---|---|
| BR-11 overdue = Active and now > dueAt | Pure function `isOverdue({ status, dueAt }, now): boolean` in `server/src/lib/overdue.ts`; exactly at `dueAt` is **not** overdue; Returned is never overdue |
| BR-12 no new requests while overdue | In the `createRequest` transaction, `tx.loan.count({ where: { borrowerId, status: 'ACTIVE', dueAt: { lt: now } } }) > 0` → `409 OVERDUE_LOAN` "You have an overdue loan. Return it before requesting another item." |
| Order with other checks | `404` → `400` (BR-04) → `409 OVERDUE_LOAN` → `409 BORROWING_LIMIT` (F-09) → `409 ITEM_NOT_AVAILABLE` |
| Time source | Server clock (UTC) only; the client never decides overdue |

## 4. Data model changes

None. Index `Loan(borrowerId)` already exists.

## 5. API specification

`GET /api/requests/mine` and `GET /api/custodian/loans`: each loan object gains `isOverdue: boolean`.
`POST /api/requests`: new error `409 { "error": { "code": "OVERDUE_LOAN", "message": "You have an overdue loan. Return it before requesting another item." } }`.

## 6. UI behavior

| Screen | Behavior |
|---|---|
| My Borrowing | Overdue loans: red **Overdue** badge and the due date in red; an alert above the table "You have an overdue loan. Return it before requesting another item." |
| Request form | A `409 OVERDUE_LOAN` answer shows the server message in a red alert; the form stays filled. |
| Custodian Loans | **Overdue** badge on overdue rows; overdue rows are listed first (they have the earliest due dates). |

## 7. Permissions

Unchanged: a borrower sees only their own loans (BR-06), a custodian only their locations (BR-05).

## 8. Acceptance criteria

| ID | Criterion |
|---|---|
| AC-08-01 | `isOverdue` is `false` for an Active loan due in the future and exactly at the due time, `true` one millisecond after, and `false` for any Returned loan. |
| AC-08-02 | Given borrower1 with an Active loan whose `dueAt` is in the past, `GET /api/requests/mine` shows that loan with `isOverdue: true`, and custodian.hw's `GET /api/custodian/loans` shows it with `isOverdue: true`. |
| AC-08-03 | Given that overdue loan, when borrower1 requests an Available item, then `409 OVERDUE_LOAN`; no request is created and the item stays `AVAILABLE`. |
| AC-08-04 | After the overdue loan is returned, borrower1's next request succeeds (`201`). |
| AC-08-05 | A borrower with an Active loan that is not yet due can still request (`201`). |
| AC-08-06 | In the UI, My Borrowing shows the Overdue badge and alert, and the request form shows the `409` message. |

## 9. Software Test Specification

| Test ID | AC | Level | File › test | Setup | Action | Expected |
|---|---|---|---|---|---|---|
| TEST-08-01 | AC-08-01 | Unit | `server/tests/unit/overdue.test.ts` › "isOverdue" (table) | Fixed `now` | future, equal, +1 ms, returned | false, false, true, false |
| TEST-08-02 | AC-08-02 | API | `server/tests/api/overdue.test.ts` › "flags overdue loans" | Loan with `dueAt = now − 1 day` (set in the DB) | borrower GET mine; custodian GET loans | `isOverdue: true` in both |
| TEST-08-03 | AC-08-03 | API | › "blocks new requests while overdue" | Overdue loan for borrower1 | POST request for ARD-001 | 409 OVERDUE_LOAN; request count and item status unchanged |
| TEST-08-04 | AC-08-04 | API | › "can request again after the return" | Overdue loan, then return (F-07) | POST request | 201 |
| TEST-08-05 | AC-08-05 | API | › "a loan that is not due does not block" | Active loan due tomorrow | POST request | 201 |
| TEST-08-06 | AC-08-06 | Component | `MyBorrowingPage.test.tsx` › "overdue badge"; `RequestPage.test.tsx` › "overdue 409" | Mocked API | Render / submit | Badge and alert; 409 message shown |

## 10. Definition of Done

Sprint 2 DoD ([README.md](README.md)) applies. TDD evidence required for TEST-08-01 and TEST-08-03.
