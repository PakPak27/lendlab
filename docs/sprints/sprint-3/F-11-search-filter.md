# F-11 Catalog Search and Filter — Engineering Contract

| Item | Value |
|---|---|
| Feature | F-11 Catalog Search and Filter |
| Requirements | FR-15, NFR-07 |
| Sprint | Sprint 3 (implemented first, for the Deliverable 2 checkpoint) |
| Depends on | F-03, F-10 |

### Version history

| Version | Date | Change |
|---|---|---|
| v0.1 | 2026-11-28 | Contract written before implementation |

## 1. Purpose and scope

Users find equipment by typing part of the name or asset tag and narrowing by category, location and status, with pages of 20 items. Out of scope: full-text ranking, saved searches.

## 2. Workflow

1. `/catalog` shows a search box, Category, Location and Status selects, and the result count "Showing 1–20 of 34".
2. Typing (300 ms debounce) or changing a select calls `GET /api/items?q=&categoryId=&locationId=&status=&page=1`; the filters are kept in the URL query so Back and a reload keep them.
3. **Previous / Next** change `page`. "No items match your search." when empty, with a **Clear filters** button.

## 3. Business rules and validation

| Rule | Implementation |
|---|---|
| Search | `q` trimmed, 0–50 characters; case-insensitive `contains` on `name` OR `assetTag`; empty `q` = no text filter |
| Filters | `categoryId`, `locationId`: positive integers (unknown id → empty result, not an error); `status`: AVAILABLE, RESERVED, ON_LOAN, MAINTENANCE (RETIRED never listed, unchanged F-03 rule) |
| Paging | `page` ≥ 1 (default 1), `pageSize` 1–50 (default 20); a page past the end returns `items: []` with the correct `total` |
| Order | Unchanged: name, then asset tag |
| Invalid input | `400 VALIDATION_ERROR` with the field (`q` too long, `page=0`, `pageSize=51`, `status=RETIRED`, `categoryId=abc`) |
| NFR-07 | p95 < 500 ms with 200 seeded items, measured by a scripted timing test (Sprint 3 final verification) |

## 4. Data model changes

None (indexes on `Item.locationId`, `Item.status` exist; `categoryId` index added only if NFR-07 fails).

## 5. API specification

`GET /api/items?q=lap&categoryId=1&locationId=1&status=AVAILABLE&page=1&pageSize=20` → `200 { "items": [ ...F-03 item shape... ], "page": 1, "pageSize": 20, "total": 3 }`.
Backward compatible: without parameters the first 20 items are returned with the same item shape; `items` keeps the F-03 v0.3 element shape (TEST-03-01 still asserts it). The response object gains `page`, `pageSize`, `total`.
Errors: `400 VALIDATION_ERROR`, `401`.

`GET /api/locations` (new, signed-in users) → `200 { "locations": [ { id, code, name } ] }` for the Location select.

## 6. UI behavior

As §2. The controls have visible labels; the status select keeps its existing name "Status" so Sprint 1 tests still find it.

## 7. Permissions

Every signed-in user (unchanged F-03 rule).

## 8. Acceptance criteria

| ID | Criterion |
|---|---|
| AC-11-01 | `q=lap` returns the items whose name or asset tag contains "lap" in any case (LAP-001…LAP-003), ordered by name then tag; `q=LAP-002` returns exactly LAP-002. |
| AC-11-02 | `categoryId` (Camera), `locationId` (MEDIA) and `status=AVAILABLE` each narrow the list, and combined they are joined with AND. |
| AC-11-03 | With 25 matching items, `page=1` returns 20 with `total: 25`, `page=2` returns 5, `page=3` returns 0 with `total: 25`. |
| AC-11-04 | `q` of 51 characters, `page=0`, `pageSize=51`, `status=RETIRED` and `categoryId=abc` are `400` with the field name. |
| AC-11-05 | Retired items never appear, even when the search matches them. |
| AC-11-06 | In the UI, typing "canon" shows only CAM-001, choosing Location MEDIA shows only MEDIA items, the count text is right, and Clear filters restores the full list. |

## 9. Software Test Specification

| Test ID | AC | Level | File › test | Setup | Action | Expected |
|---|---|---|---|---|---|---|
| TEST-11-01 | AC-11-01 | API | `server/tests/api/search.test.ts` › "text search" | Seed | `q=lap`, `q=LaP`, `q=LAP-002` | as AC |
| TEST-11-02 | AC-11-02 | API | › "filters combine with AND" | Seed | each filter and a combination | only matching items |
| TEST-11-03 | AC-11-03 | API | › "paging" | 22 extra items created in the test DB | pages 1–3 | 20 / 5 / 0, `total` 25 |
| TEST-11-04 | AC-11-04 | API | › "invalid parameters" (table) | — | bad values | 400 with field |
| TEST-11-05 | AC-11-05 | API | › "retired items are hidden" | Retire LAP-003 | `q=LAP` | LAP-003 absent |
| TEST-11-06 | AC-11-06 | Component | `CatalogPage.test.tsx` › "search and filters" | Mocked API | type, select, clear | requests carry the right query; count text |
| TEST-11-07 | NFR-07 | Performance | `server/tests/perf/catalog.perf.ts` (planned, Sprint 3) | 200 items | 200 GETs | p95 < 500 ms |

## 10. Definition of Done

Sprint 2 DoD ([../sprint-2/README.md](../sprint-2/README.md)) applies. TDD evidence required for TEST-11-01 and TEST-11-03.
