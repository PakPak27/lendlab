# F-02 Role and Location Access Control — Engineering Contract

| Item | Value |
|---|---|
| Feature | F-02 Role and Location Access Control |
| Requirements | BR-05, BR-06, BR-07, NFR-02, NFR-03 |
| Sprint / Issue | Sprint 1 / #5 |
| Depends on | F-01 (`authenticate` middleware), SYS-01 (`CustodianLocation` seed) |

### Version history

| Version | Date | Change |
|---|---|---|
| v0.1 | 2026-11-05 | Contract written before implementation |
| v0.2 | 2026-11-06 | Implementation (PR for #5): guards are mounted by path prefix in `app.ts` (`/api/items` → authenticate; `/api/requests` → borrower only; `/api/custodian` → custodian only), so they exist before the feature routers do. TEST-02-04 needs `GET /api/requests/:id` (F-04, #7) and TEST-02-05/06 need the custodian queue and checkout (F-05, #8), which do not exist yet, so those three tests are written in the F-04 and F-05 PRs. `scope.ts` (`borrowerScope`, `custodianScope`) is delivered here with unit tests. Everything else is tested in this PR. |

## 1. Purpose and scope

Provide reusable backend enforcement for (1) authentication on every protected route, (2) role restrictions, and (3) record-level scope: borrowers see only their own records and custodians only records in their assigned locations. Provide role-aware navigation in the UI. This feature adds no new domain screens; it is used by F-03, F-04, and F-05.

## 2. Design

| Component | Behavior |
|---|---|
| `authenticate` (from F-01) | Attaches `req.user = { id, role, locationIds }` or returns `401 UNAUTHENTICATED`. |
| `requireRole(...roles)` | Returns `403 FORBIDDEN` "You do not have permission to perform this action." if `req.user.role` is not listed; otherwise `next()`. |
| Ownership scope (service layer) | Borrower queries always include `borrowerId = req.user.id`. Custodian queries always include `item.locationId IN req.user.locationIds`. A record outside the scope is treated as **not found** → `404 NOT_FOUND` (decision D-06). |
| Router layout | `/api/custodian/*` router mounts `authenticate, requireRole('CUSTODIAN')` once for all its routes. `POST /api/requests` uses `requireRole('BORROWER')`. |

Enforcement order: `authenticate` (401) → `requireRole` (403) → scope check (404) → business rule (409). A rejected request must not change any data.

## 3. Data model changes

None beyond SYS-01 (`CustodianLocation` join table).

## 4. API impact

No new endpoints. Applies the matrix in [system-sds.md §5](../../system-sds.md#5-roles-and-permissions) to every Sprint 1 endpoint:

| Endpoint | Anonymous | Borrower | Custodian |
|---|---|---|---|
| `GET /api/items`, `/api/items/:id` | 401 | 200 | 200 |
| `POST /api/requests` | 401 | 201 / 409 | **403** |
| `GET /api/requests/mine` | 401 | 200 (own) | **403** |
| `GET /api/requests/:id` | 401 | 200 own / **404** other | **403** |
| `GET /api/custodian/requests` | 401 | **403** | 200 (own locations) |
| `POST /api/custodian/requests/:id/checkout` | 401 | **403** | 201 own location / **404** other location |

## 5. UI behavior

| Element | Behavior |
|---|---|
| Navigation | Borrower sees **Catalog** and **My Borrowing**. Custodian sees **Requests** (Loans/Items/Reports appear in later sprints). |
| `ProtectedRoute roles=[...]` | No session → `/login`. Wrong role → `/forbidden` page: "You do not have access to this page." with a link to the role's home. |
| API `403` / `404` in a page | Shown as a red alert with the server message. |

## 6. Acceptance criteria

| AC | Given / When / Then |
|---|---|
| AC-02-01 | When any protected Sprint 1 endpoint is called without a valid token, the response is `401 UNAUTHENTICATED` and the body contains only the `error` object. |
| AC-02-02 | Given a signed-in borrower, when they call `GET /api/custodian/requests` or `POST /api/custodian/requests/:id/checkout`, the response is `403 FORBIDDEN` and no request, loan, or item changes. |
| AC-02-03 | Given a signed-in custodian, when they call `POST /api/requests`, the response is `403 FORBIDDEN` and no request is created and no item changes. |
| AC-02-04 | Given borrower2 owns a request, when borrower1 calls `GET /api/requests/:id` for it, the response is `404 NOT_FOUND` with no request data. |
| AC-02-05 | Given pending requests for items in HW-LAB and MEDIA, when the HW-LAB custodian lists pending requests, only HW-LAB requests are returned. |
| AC-02-06 | Given a pending request for a MEDIA item, when the HW-LAB custodian tries to check it out, the response is `404 NOT_FOUND` and the request stays Pending, the item stays Reserved, and no loan is created. |
| AC-02-07 | In the UI, a borrower does not see the **Requests** menu, and opening `/custodian/requests` directly shows the "You do not have access" page. |

## 7. Software Test Specification

| Test | AC | Level | File / name | Precondition / input | Action | Expected result |
|---|---|---|---|---|---|---|
| TEST-02-01 | AC-02-01 | API | `tests/api/access.test.ts` › "protected endpoints require a session" (table-driven over the 7 endpoints in §4 plus `/api/auth/me` and `/api/auth/logout` — 9 in total) | No `Authorization` header | Call endpoint | 401; body keys = `["error"]`; `error.code` = `UNAUTHENTICATED` |
| TEST-02-02 | AC-02-02 | API | › "borrower cannot use custodian operations" | borrower1 token; a Pending request for `LAP-001` | GET queue; POST checkout | Both 403 `FORBIDDEN`; request still `PENDING`; item still `RESERVED`; `Loan` count unchanged |
| TEST-02-03 | AC-02-03 | API | › "custodian cannot create a borrow request" | custodian.hw token; `LAP-002` Available | POST /api/requests | 403; `BorrowRequest` count unchanged; item still `AVAILABLE` |
| TEST-02-04 | AC-02-04 | API | › "borrower cannot read another borrower's request" | Request owned by borrower2 | borrower1 GET /api/requests/:id | 404 `NOT_FOUND`; body has no `request` key |
| TEST-02-05 | AC-02-05 | API | › "custodian sees only own-location requests" | Pending requests on `LAP-001` (HW-LAB) and `CAM-001` (MEDIA) | custodian.hw GET queue | Result contains the LAP-001 request only |
| TEST-02-06 | AC-02-06 | API | › "custodian cannot check out another location's request" | Pending request on `CAM-001` | custodian.hw POST checkout | 404; request `PENDING`; item `RESERVED`; no Loan |
| TEST-02-07 | AC-02-02, AC-02-03 | Unit | `tests/unit/requireRole.test.ts` | Mock `req.user` = borrower / custodian / undefined | Call `requireRole('CUSTODIAN')` | 403 / `next()` called / 401 |
| TEST-02-08 | AC-02-07 | E2E | `client/e2e/access.spec.ts` | Signed in as borrower1 | Check nav; visit `/custodian/requests` | No "Requests" link; page shows "You do not have access to this page." |

## 8. Definition of Done

Product DoD in [README.md](README.md) applies. Every negative test asserts the database state after the call, not only the status code.
