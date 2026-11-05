# LendLab — Feature Inventory

Version v0.1 — 2026-11-05. Requirement IDs refer to [srs.md](srs.md).

### Version history

| Version | Date | Change |
|---|---|---|
| v0.1 | 2026-11-05 | First complete inventory for the product baseline |

## Product features

| ID | Feature | Scope | Requirements | Depends on | Sprint |
|---|---|---|---|---|---|
| F-01 | Authentication and Session | Sign-in with e-mail and password, bearer-token sessions stored in the database, current-user endpoint, sign-out, protected routes in the UI. | FR-01, FR-02, FR-03, NFR-01, NFR-02, NFR-04 | SYS-01 | 1 |
| F-02 | Role and Location Access Control | Backend middleware for authentication and role checks, ownership checks for borrower records, custodian location scope, role-aware navigation. | BR-05, BR-06, BR-07, NFR-02, NFR-03 | F-01 | 1 |
| F-03 | Equipment Catalog | List and detail of items with category, location, and status; public category list; status filter; Request button for available items. | FR-04 | F-01, SYS-01 | 1 |
| F-04 | Borrow Request and My Borrowing | Borrower creates a request that reserves an available item; validation of purpose and loan length; concurrency-safe reservation; "My Borrowing" page listing own requests and loans. | FR-05, FR-06, BR-01, BR-02, BR-04, BR-06, BR-14, NFR-05 | F-02, F-03 | 1 |
| F-05 | Request Queue and Checkout | Custodian sees pending requests for their locations and checks one out, creating an active loan with a due date in a single transaction. | FR-07, FR-08, BR-02, BR-03, BR-04, BR-05, NFR-05 | F-02, F-04 | 1 |
| F-06 | Request Rejection and Cancellation | Custodian rejects with a reason; borrower cancels own pending request; item returns to Available. | FR-09, FR-10, BR-09 | F-04, F-05 | 2 |
| F-07 | Active Loans and Returns | Custodian lists active loans for their locations and records returns, optionally sending the item to Maintenance. | FR-11, FR-19, BR-10 | F-05 | 2 |
| F-08 | Due Dates and Overdue Status | Overdue calculation, overdue badges for borrowers and custodians, blocking new requests for borrowers with overdue loans. | FR-12, BR-11, BR-12 | F-05, F-07 | 2 |
| F-09 | Borrowing Limit | Enforce at most 3 open commitments per borrower when creating a request. | BR-08 | F-04 | 2 |
| F-10 | Inventory Management | Custodian adds and edits items in their locations and changes status to Maintenance, Available, or Retired. | FR-13, FR-14, BR-05, BR-13 | F-02, F-03 | 2 |
| F-11 | Catalog Search and Filter | Text search by name or asset tag; filters for category, location, and status; pagination. | FR-15, NFR-07 | F-03, F-10 | 3 |
| F-12 | Inventory and Loan Reports | Inventory counts by status per location; loan report by date range including overdue loans. | FR-16, FR-17 | F-07, F-08 | 3 |
| F-13 | Item Loan History | Chronological list of requests and loans for one item (who, when, outcome). | FR-18 | F-07 | 3 |

## System-wide responsibilities (cross-cutting)

| ID | Responsibility | Scope | Requirements | Sprint |
|---|---|---|---|---|
| SYS-01 | Platform Foundation | Project structure, Prisma schema, migrations, seed, environment configuration, health/ready endpoints, standard JSON error handling, test setup. | NFR-06 (local), NFR-09, NFR-11 | 1 |
| SYS-02 | Container and Cloud Delivery | Dockerfile, CI on pull requests, deployment to Cloud Run with Cloud SQL, release pipeline from `main`. | NFR-06 (cloud), NFR-09, NFR-12 | Lab 5 (between Sprints 1 and 2) |
| SYS-03 | UI Quality Hardening | Responsive layout checks, keyboard and contrast checks across all pages. | NFR-08, NFR-10 | 2 (responsive) / 3 (accessibility) |
