# LendLab — Software Requirements Specification (SRS)

| Item | Value |
|---|---|
| Product | **LendLab** — CPE Department Equipment Lending System |
| Course | CPE 334, Semester 1/2026 — Group Project, Theme 2 (Inventory and Borrowing System) |
| Team | `<Chanaphath> (<ID ending 3462>)`, `<Punyawat> (<ID ending 3468>)` |
| Document version | v0.1 (draft) — 2026-11-05 |
| Status | Baseline for Sprint 1 (Project Deliverable 1) |

### Version history

| Version | Date | Author | Change |
|---|---|---|---|
| v0.1 | 2026-11-05 | Both members | First baseline: context, actors, FR/BR/NFR, decisions |

---

## 1. Stakeholder problem and context

The Computer Engineering (CPE) department owns shared equipment — laptops, microcontroller kits, cameras, and projectors — that students borrow for course labs and projects. Today, borrowing is tracked on paper forms and a shared spreadsheet kept by each lab's custodian. This causes three recurring problems:

1. **Double allocation.** Two students are promised the same physical item because the spreadsheet is not updated in time.
2. **No visibility for students.** A student cannot see what is available without walking to the lab, and cannot see the status of their own request.
3. **No reliable record.** Custodians cannot easily answer "who has asset CAM-002 and when is it due back?"

LendLab replaces the paper process with a web application in which students request specific items, custodians hand them out, and every item has exactly one authoritative status.

**Chosen context.** Equipment is kept in department **locations** (for example the CPE Hardware Lab and the CPE Media Room). Each location has one or more **custodians** who are responsible only for the items stored there. Each physical item has a unique **asset tag** and is tracked individually.

## 2. Actors and responsibilities

| Actor | Type | Responsibilities in LendLab |
|---|---|---|
| **Borrower** | Human user (student) | Browse the catalog, request an available item for a stated purpose and loan length, track their own requests and loans. |
| **Custodian** | Human user (lab staff / TA) | Review pending requests for items in their assigned locations, check items out (create loans), record returns, maintain inventory of their locations, view reports. |
| **System (LendLab)** | Software | Enforce item exclusivity, compute due dates, authenticate users, enforce role and location permissions, keep durable records. |

Accounts are created by seeding (no self-registration). Each account has exactly one role.

## 3. Product scope

### 3.1 In scope (whole product, Sprints 1–3)

- Sign-in, sign-out, and current-user identity for two roles (Borrower, Custodian).
- Equipment catalog of individually tracked items with category, location, and status.
- Borrow requests that reserve a specific item; custodian checkout that creates a loan with a due date.
- Request rejection (custodian) and cancellation (borrower).
- Returns, due dates, and overdue status.
- Per-borrower borrowing limits.
- Inventory maintenance by custodians (add/edit items, maintenance, retirement).
- Catalog search and filtering.
- Inventory and loan summary reports; per-item loan history.

### 3.2 Explicit exclusions

- Self-registration, password recovery, e-mail verification, multi-role accounts, and a separate administrator role.
- Fines, payments, or deposits.
- E-mail, LINE, or SMS notifications (overdue status is shown in the app only).
- Barcode/QR scanning hardware integration.
- Reservations for a future date (a request applies to "now"; it is not calendar booking).
- Quantity-based (non-serialized) consumables such as resistors or cables.
- Integration with university identity systems (SSO) or any external API.

## 4. Functional Requirements (FR)

| ID | Requirement | Sprint |
|---|---|---|
| FR-01 | The system shall let a seeded user sign in with e-mail and password and start an authenticated session. | 1 |
| FR-02 | The system shall let a signed-in user sign out, ending the session on the server. | 1 |
| FR-03 | The system shall show the signed-in user's name and role and route them to the home page for their role. | 1 |
| FR-04 | The system shall let any signed-in user view the equipment catalog, showing each item's asset tag, name, category, location, and current status. | 1 |
| FR-05 | The system shall let a Borrower request one available item, stating a purpose and a requested loan length in days. | 1 |
| FR-06 | The system shall let a Borrower view their own requests and loans, including status and, once checked out, the due date. | 1 |
| FR-07 | The system shall let a Custodian view pending requests for items in the locations they are assigned to. | 1 |
| FR-08 | The system shall let a Custodian check out a pending request, creating an active loan with a due date. | 1 |
| FR-09 | The system shall let a Custodian reject a pending request with a reason. | 2 |
| FR-10 | The system shall let a Borrower cancel their own pending request. | 2 |
| FR-11 | The system shall let a Custodian record the return of an item on an active loan, optionally marking it as needing maintenance. | 2 |
| FR-12 | The system shall show loans that are past their due date as overdue to the Borrower and to the responsible Custodian. | 2 |
| FR-13 | The system shall let a Custodian add items to, and edit items in, their assigned locations. | 2 |
| FR-14 | The system shall let a Custodian change an item's status to Maintenance, back to Available, or to Retired. | 2 |
| FR-15 | The system shall let users search the catalog by name or asset tag and filter it by category, location, and status. | 3 |
| FR-16 | The system shall show a Custodian an inventory summary: item counts by status for each of their locations. | 3 |
| FR-17 | The system shall show a Custodian a loan report for a date range: loans created, returned, and currently overdue. | 3 |
| FR-18 | The system shall show a Custodian the loan history of an item in their locations. | 3 |
| FR-19 | The system shall let a Custodian view all active loans for their locations. | 2 |

## 5. Business Rules (BR)

| ID | Rule | Sprint |
|---|---|---|
| BR-01 | A borrow request may be created only for an item whose status is **Available**. Requests for Reserved, On Loan, Maintenance, or Retired items are rejected. | 1 |
| BR-02 | An item may have **at most one open commitment** at a time: either one Pending request or one Active loan. Creating a request changes the item from Available to **Reserved**; if two borrowers request the same item at the same time, exactly one succeeds. | 1 |
| BR-03 | A checkout is allowed only for a **Pending** request whose item is Reserved. Checkout atomically sets the request to Fulfilled, creates an Active loan, and sets the item to On Loan. A request can be checked out at most once. | 1 |
| BR-04 | The requested loan length is a whole number of days from **1 to 14**. The due date is the checkout time plus the requested number of days. | 1 |
| BR-05 | A Custodian may view and act on requests, loans, and items only in locations they are assigned to. | 1 |
| BR-06 | A Borrower may view only their own requests and loans. | 1 |
| BR-07 | A Borrower may not check out, return, reject, or change inventory. A Custodian may not create borrow requests. | 1 |
| BR-08 | A Borrower may hold at most **3** open commitments (Pending requests plus Active loans) at any time. | 2 |
| BR-09 | Rejecting a request requires a reason of 5–200 characters. Rejection or cancellation returns the item from Reserved to Available. Only Pending requests can be rejected or cancelled. | 2 |
| BR-10 | Recording a return sets the loan to Returned with the return time and sets the item to Available, or to Maintenance if the custodian marks it as needing maintenance. A loan can be returned only once. | 2 |
| BR-11 | A loan is **overdue** when it is Active and the current time is after its due date. | 2 |
| BR-12 | A Borrower who has an overdue loan may not create new requests until it is returned. | 2 |
| BR-13 | An item that has a Pending request or an Active loan may not be set to Maintenance or Retired. A Retired item cannot be changed back. | 2 |
| BR-14 | The request purpose is required and must be 5–200 characters after trimming whitespace. | 1 |

## 6. Non-Functional Requirements (NFR)

| ID | Requirement (measurable target) | Verification method | Sprint |
|---|---|---|---|
| NFR-01 | Passwords are stored only as bcrypt hashes (cost ≥ 10); no API response ever contains a password or password hash. | Unit test on hashing; API test inspects login and `/me` bodies | 1 |
| NFR-02 | Every request to a protected endpoint without a valid session is rejected with HTTP 401 and returns no domain data. | API tests over all protected endpoints | 1 |
| NFR-03 | Role and ownership rules are enforced on the backend; a forbidden operation returns 403 (role) or 404 (another user's or another location's record) and changes no data. | API tests that check status code, body, and database state | 1 |
| NFR-04 | Sessions expire after 8 hours (configurable); signing out invalidates the session token immediately on the server. | API test: token rejected after logout; unit test on expiry check | 1 |
| NFR-05 | Under concurrent requests, an item never has more than one Pending request or more than one Active loan. | Integration test firing parallel requests; database partial unique indexes | 1 |
| NFR-06 | All application data is stored in PostgreSQL and survives an application restart and redeployment; nothing the app needs is kept only in the container. | Sprint 1: manual restart check; Lab 5: Cloud Run restart and redeploy check | 1 / Lab 5 |
| NFR-07 | The catalog list API responds in under 500 ms (p95) with 200 seeded items on a developer laptop. | Scripted timing test (autocannon or Playwright timing) | 3 |
| NFR-08 | Every page is usable without horizontal scrolling at 375 px and 1280 px viewport widths. | Playwright viewport tests | 2 / 3 |
| NFR-09 | Every setting (database URL, port, session lifetime, seed passwords) is read from environment variables; no real secret is committed to Git. | `.env.example` review; secret scanning; code review | 1 |
| NFR-10 | Forms have visible labels, are fully operable by keyboard, and text meets WCAG 2.1 AA contrast. | Playwright keyboard test; axe accessibility check | 3 |
| NFR-11 | All API errors use one JSON error shape `{ "error": { "code", "message", "details?" } }` and never include stack traces. | API tests assert error shape | 1 |
| NFR-12 | The application builds into a single Docker image and is deployed to Google Cloud Run with Cloud SQL for PostgreSQL. | Lab 5 evidence (CI run, Cloud Run revision) | Lab 5 |

## 7. Assumptions and constraints

| ID | Assumption / constraint |
|---|---|
| A-01 | Users are department members with seeded accounts; the department adds new accounts through the seed/migration process. |
| A-02 | Each item belongs to exactly one location. Each custodian is assigned to one or more locations. |
| A-03 | The handover of the physical item happens at the lab counter at the moment the custodian clicks **Check out**. |
| A-04 | Times are stored in UTC and displayed in Asia/Bangkok time (UTC+7). |
| A-05 | Demo data is synthetic. No real student data is stored. |
| A-06 | The application must be packaged with Docker and deployed on GCP in Lab 5, so it must run as a stateless web process with an external PostgreSQL database. |
| A-07 | The team uses the same stack as Labs 1–4 (React, Express, Prisma, PostgreSQL) to reduce risk. |

## 8. Decisions and resolved questions

| ID | Question | Decision | Reason |
|---|---|---|---|
| D-01 | Track individual copies or quantities? | **Individual items** with unique asset tags. | Makes exclusivity (BR-02) precise and matches how the department labels equipment. |
| D-02 | Does a request need separate approval before checkout? | **No separate approval step.** A request reserves the item; the custodian's checkout is the approval. Rejection is added in Sprint 2. | Keeps Sprint 1 small while still giving a real state transition (Pending → Fulfilled, Available → Reserved → On Loan). |
| D-03 | What happens to other borrowers while an item is requested? | The item becomes **Reserved** and cannot be requested by anyone else (first come, first served). | Prevents competing requests and gives a clear, testable concurrency rule. |
| D-04 | What does "authorized inventory" mean for custodians? | Custodians are assigned to **locations** and act only on items in those locations. | Provides a meaningful ownership restriction beyond role checks. |
| D-05 | Session or token? | Opaque random **bearer token** stored hashed in a `Session` table, 8-hour lifetime, revoked on logout. | Server-side revocation for logout; matches the Lab 5 smoke test (`Authorization: Bearer`). |
| D-06 | What does a user see when accessing another user's record? | **404 Not Found** (not 403). | Does not reveal that the record exists. Role-level violations still return 403. |
| D-07 | Who chooses the loan length? | The borrower requests 1–14 days; the custodian cannot change it in Sprint 1. | Simple rule for Sprint 1. Custodian override is open question Q-01. |
| D-08 | Is there an administrator role? | **No.** Accounts are seeded. | The theme requires two roles; administration is out of scope. |

### Open questions (to confirm with the TA/instructor)

| ID | Question | Planned resolution |
|---|---|---|
| Q-01 | Should a custodian be able to shorten or extend the loan length at checkout or later? | Decide before Sprint 2 contract for F-08. |
| Q-02 | Should overdue borrowers be blocked from all requests, or only from new requests in the same location? | Current rule BR-12 blocks all new requests; confirm before Sprint 2. |
