# Sprint 3 — Engineering Contracts Index

Version v0.1 — 2026-11-28. Sprint goal: finish the remaining features and harden the product for the final release `v1.0.0` on 13 December 2026 ([plan.md](../plan.md)).

| Feature / responsibility | Contract | Requirements | Status at Deliverable 2 (29 Nov) |
|---|---|---|---|
| F-11 Catalog Search and Filter | [F-11-search-filter.md](F-11-search-filter.md) | FR-15, NFR-07 | Implemented first (the Sprint 3 workflow shown in Deliverable 2); NFR-07 timing planned |
| F-12 Inventory and Loan Reports | [F-12-reports.md](F-12-reports.md) | FR-16, FR-17 | Planned |
| F-13 Item Loan History | [F-13-item-history.md](F-13-item-history.md) | FR-18 | Planned |
| SYS-03 accessibility part | §1 below | NFR-10 | Planned |
| NFR-07 catalog performance | F-11 TEST-11-07 | NFR-07 | Planned |

### Version history

| Version | Date | Change |
|---|---|---|
| v0.1 | 2026-11-28 | Contracts written before implementation |

## 1. SYS-03 accessibility (NFR-10)

| ID | Criterion | Test |
|---|---|---|
| AC-S3-04 | Every form field has a visible label linked to the control; every page has one h1. | TEST-S3-04 E2E `client/e2e/a11y.spec.ts` › "labels and headings" |
| AC-S3-05 | Login → request → My Borrowing and the custodian checkout and return flows can be completed with the keyboard only (Tab, Shift+Tab, Enter, Space, Esc closes dialogs; focus returns to the trigger). | TEST-S3-05 E2E › "keyboard journey" |
| AC-S3-06 | `@axe-core/playwright` reports no serious or critical violations on every page in SYS-03 §3 (WCAG 2.1 AA, including contrast). | TEST-S3-06 E2E › "axe" |

## 2. Sprint 3 integration and final checks (before `v1.0.0`)

| ID | Check |
|---|---|
| SIT3-01 | All unit, API, component and E2E suites pass on the release candidate commit. |
| SIT3-02 | NFR-07 timing (TEST-11-07) and NFR-08/NFR-10 E2E checks pass. |
| SIT3-03 | UAT re-test of the full product with team Frenchies (Lab 6 partner), findings triaged. |
| SIT3-04 | Post-deploy checks of every feature on the final revision; persistence after a redeploy. |

The Sprint 2 Definition of Done applies to every Sprint 3 feature.
