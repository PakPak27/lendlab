# F-07 Active Loans and Returns — Engineering Contract

| Item | Value |
|---|---|
| Feature | F-07 Active Loans and Returns |
| Requirements | FR-11, FR-19, BR-10, BR-05, BR-07, NFR-05 |
| Sprint | Sprint 2 |
| Depends on | F-05 |

### Version history

| Version | Date | Change |
|---|---|---|
| v0.1 | 2026-11-28 | Contract written before implementation |

## 1. Purpose and scope

A custodian sees the active loans for their locations (soonest due first, overdue marked by F-08) and records a return when the borrower brings the item back, optionally sending it to Maintenance. Out of scope: partial returns, damage fees, returning on behalf of another location.

## 2. Workflow and state transitions

1. Custodian opens `/custodian/loans` → `GET /api/custodian/loans` (Active loans, own locations, `dueAt` ascending).
2. **Return** on a row → dialog "Record the return of LAP-001 from Borrower One?" with a checkbox **Needs maintenance** → **Record return**.
3. `POST /api/custodian/loans/:id/return` with `{ "needsMaintenance": false }`. In one interactive transaction:
   1. load the loan in the custodian's locations, else `404 NOT_FOUND`;
   2. `updateMany({ where: { id, status: 'ACTIVE' }, data: { status: 'RETURNED', returnedAt: now, returnedById } })`; 0 rows → `409 LOAN_NOT_ACTIVE`;
   3. `updateMany({ where: { id: itemId, status: 'ON_LOAN' }, data: { status: needsMaintenance ? 'MAINTENANCE' : 'AVAILABLE' } })`; 0 rows → roll back, `409 ITEM_NOT_ON_LOAN`.
4. The row leaves the list; toast "Return recorded — LAP-001 is Available" (or "… is in Maintenance").

Transitions: Loan `ACTIVE → RETURNED`; Item `ON_LOAN → AVAILABLE | MAINTENANCE`. The request stays `FULFILLED`.

## 3. Business rules and validation

| Rule | Implementation |
|---|---|
| BR-10 return sets Returned + time; item Available or Maintenance | Steps 3.2–3.3 in one `prisma.$transaction` |
| BR-10 returned only once | Conditional update on `status: 'ACTIVE'`; a second (or simultaneous) return → `409 LOAN_NOT_ACTIVE` |
| `needsMaintenance` | Optional boolean, default `false`; any other type → `400 VALIDATION_ERROR` |
| BR-05 scope | Loan lookup through `item.locationId ∈ user.locationIds`; outside → `404` |
| BR-07 roles | Borrower → `403` |

## 4. Data model changes

None. `Loan.status RETURNED`, `returnedAt`, `returnedById` exist. A new helper `loanScope(user)` gives the custodian where-clause for loans.

## 5. API specification

`GET /api/custodian/loans` → `200 { "loans": [ { id, status, checkedOutAt, dueAt, isOverdue, item: { id, assetTag, name, location: { code } }, borrower: { id, name, email } } ] }`, Active only, `dueAt` ascending.

`POST /api/custodian/loans/:id/return` — body `{ "needsMaintenance"?: boolean }` → `200 { "loan": { id, status: "RETURNED", returnedAt, item: { id, assetTag, status } } }`.
Errors: `400` (bad id or body), `401`, `403`, `404 NOT_FOUND`, `409 LOAN_NOT_ACTIVE`, `409 ITEM_NOT_ON_LOAN`.

`GET /api/requests/mine` (F-04): a returned loan shows `status: "RETURNED"` and `returnedAt`.

## 6. UI behavior

| Screen | Behavior |
|---|---|
| Custodian nav | New link **Loans** (`/custodian/loans`). |
| Loans page | Table/cards: asset tag, item, borrower, checked out, due date, **Overdue** badge (F-08), **Return** button. Empty state "No active loans in your locations." |
| Return dialog | Checkbox **Needs maintenance** (unchecked); `409` shows "This loan has already been returned." and reloads the list. |
| My Borrowing | Returned loans show the badge **Returned** and the return date. |

## 7. Permissions

Custodian of the item's location only. Borrowers: `403`. Other custodians: `404`.

## 8. Acceptance criteria

| ID | Criterion |
|---|---|
| AC-07-01 | `GET /api/custodian/loans` for custodian.hw returns only Active HW-LAB loans, soonest due first, with borrower name, item, `dueAt` and `isOverdue`; returned loans and MEDIA loans are not listed. |
| AC-07-02 | Given an Active loan of LAP-001, when custodian.hw returns it with `needsMaintenance: false`, then `200`; loan `RETURNED` with `returnedAt` and `returnedById`; LAP-001 `AVAILABLE`; the request stays `FULFILLED`. |
| AC-07-03 | With `needsMaintenance: true` the item becomes `MAINTENANCE`. |
| AC-07-04 | Returning the same loan again returns `409 LOAN_NOT_ACTIVE` and changes nothing; two simultaneous returns give one `200` and one `409`. |
| AC-07-05 | custodian.media returning a HW-LAB loan gets `404`; borrower1 calling the endpoints gets `403`; `needsMaintenance: "yes"` gets `400`. Nothing changes. |
| AC-07-06 | After a return, the item can be requested again (Available) and borrower1's My Borrowing shows the loan as Returned. |
| AC-07-07 | In the UI, the custodian opens Loans, records a return with Needs maintenance, and the row leaves the list. |

## 9. Software Test Specification

| Test ID | AC | Level | File › test | Setup | Action | Expected |
|---|---|---|---|---|---|---|
| TEST-07-01 | AC-07-01 | API | `server/tests/api/returns.test.ts` › "lists active loans" | Active HW and MEDIA loans, one returned | custodian.hw GET | Only Active HW-LAB loans, sorted by dueAt, fields present |
| TEST-07-02 | AC-07-02 | API | › "records a return" | Active LAP-001 loan | POST return | 200; DB as AC-07-02 |
| TEST-07-03 | AC-07-03 | API | › "return to maintenance" | Active loan | POST `{ needsMaintenance: true }` | item MAINTENANCE |
| TEST-07-04 | AC-07-04 | API | › "only once" and "simultaneous returns" | Active loan | second POST; two POSTs in `Promise.all` | 409; one 200 + one 409; returnedAt set once |
| TEST-07-05 | AC-07-05 | API | › "scope, role and body" | Active HW loan | media, borrower, bad body | 404, 403, 400; DB unchanged |
| TEST-07-06 | AC-07-06 | API | › "item can be requested again" | Returned loan | borrower2 POST request | 201 |
| TEST-07-07 | AC-07-07 | Component | `client/src/pages/CustodianLoansPage.test.tsx` | Mocked API | Return with Needs maintenance | POST body `{ needsMaintenance: true }`; row removed; toast |

## 10. Definition of Done

Sprint 2 DoD ([README.md](README.md)) applies. TDD evidence required for TEST-07-02 and TEST-07-04.
