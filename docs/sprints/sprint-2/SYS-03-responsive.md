# SYS-03 UI Quality Hardening (Sprint 2 part: responsive layout) — Engineering Contract

| Item | Value |
|---|---|
| Responsibility | SYS-03 (Sprint 2 part) |
| Requirements | NFR-08 (Sprint 2), NFR-10 (Sprint 3, see [sprint-3/README.md](../sprint-3/README.md)) |
| Sprint | Sprint 2 |
| Depends on | All pages of F-01…F-10 |

### Version history

| Version | Date | Change |
|---|---|---|
| v0.1 | 2026-11-28 | Contract written before implementation |

## 1. Purpose and scope

Every page works on a phone (375 px) and a laptop (1280 px) without horizontal scrolling, and the pages share one consistent visual design. Accessibility checks (keyboard, contrast, axe) are the Sprint 3 part of SYS-03.

## 2. Design rules

| Area | Rule |
|---|---|
| Layout | One container with page padding; page title (h1) and a short description under it on every page. |
| Navigation | At < 768 px the header collapses into a **Menu** button that opens the role's links; the user name and Sign out move into the menu. |
| Tables | At < 768 px each table row is shown as a card (label: value pairs) so no row is wider than the screen; action buttons are full width. |
| Status | One badge style per status (Available green, Reserved amber, On Loan blue, Maintenance grey, Retired dark, Overdue red, Pending amber, Rejected red, Cancelled grey, Returned green-outline). |
| Forms | Labels above fields, field errors under the field, primary button first. |
| Feedback | Success and error messages use the same alert component and are announced (`role="status"` / `role="alert"`). |
| Text | No text that only exists in an image; existing labels and messages used by tests are kept. |

## 3. Pages in scope

`/login`, `/catalog`, `/catalog/:id/request`, `/my`, `/custodian/requests`, `/custodian/loans`, `/custodian/inventory`, not-found page.

## 4. Acceptance criteria

| ID | Criterion |
|---|---|
| AC-S3-01 | At 375 × 812 and 1280 × 800, for every page in §3 signed in with the right role, `document.documentElement.scrollWidth ≤ window.innerWidth` (no horizontal scrolling). |
| AC-S3-02 | At 375 px the navigation is reachable through the Menu button and every link in it opens its page. |
| AC-S3-03 | Existing component and E2E tests keep passing (labels, button names and messages unchanged). |

## 5. Software Test Specification

| Test ID | AC | Level | File › test | Setup | Action | Expected |
|---|---|---|---|---|---|---|
| TEST-S3-01 | AC-S3-01 | E2E | `client/e2e/responsive.spec.ts` › "no horizontal scroll" (page × viewport table) | Seeded DB, borrower1 and custodian.hw | Visit each page at both widths | `scrollWidth ≤ innerWidth` |
| TEST-S3-02 | AC-S3-02 | E2E | › "mobile menu" | 375 px | Open Menu, follow each link | Each page heading visible |
| TEST-S3-03 | AC-S3-03 | Component + E2E | Existing suites | — | Run all | All pass |

## 6. Definition of Done

Sprint 2 DoD ([README.md](README.md)) applies; screenshots at 375 px and 1280 px of the main pages are kept as evidence.
