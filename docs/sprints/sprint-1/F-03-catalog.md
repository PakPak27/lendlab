# F-03 Equipment Catalog — Engineering Contract

| Item | Value |
|---|---|
| Feature | F-03 Equipment Catalog |
| Requirements | FR-04 (and supports FR-05) |
| Sprint / Issue | Sprint 1 / #6 |
| Depends on | SYS-01 (Item, Category, Location seed), F-01 |

### Version history

| Version | Date | Change |
|---|---|---|
| v0.1 | 2026-11-05 | Contract written before implementation |

## 1. Purpose and scope

Show every signed-in user the list of items with their current status so borrowers can choose an available item. Sprint 1 includes a status filter only; text search and other filters are F-11 (Sprint 3). Editing items is F-10 (Sprint 2).

## 2. Workflow

1. Signed-in user opens `/catalog`. The page calls `GET /api/items`.
2. The list shows asset tag, name, category, location, and a status badge.
3. The user may choose a status from a dropdown (All / Available / Reserved / On Loan / Maintenance), which reloads with `?status=`.
4. For a Borrower, each **Available** item has a **Request** button leading to `/catalog/:id/request` (F-04). Other statuses show the button disabled with the status as tooltip. Custodians see no Request button.

## 3. Business rules and validation

| Rule | Detail |
|---|---|
| Retired items | Not shown in the catalog (filtered out by the server). |
| Status filter | Optional; must be one of `AVAILABLE`, `RESERVED`, `ON_LOAN`, `MAINTENANCE`; otherwise `400 VALIDATION_ERROR`. |
| Sorting | By `name` ascending, then `assetTag` ascending. |
| Privacy | The catalog shows item status only — never who has reserved or borrowed an item. |

## 4. Data model changes

None beyond SYS-01.

## 5. API specification

### `GET /api/categories` (public)

`200 OK`: `[ { "id": 1, "name": "Camera" }, ... ]` sorted by name. (Plain array — used by the Lab 5 smoke test.)

### `GET /api/items?status=AVAILABLE` (signed in)

`200 OK`:
```json
{
  "items": [
    {
      "id": 1, "assetTag": "LAP-001", "name": "Dell Latitude 5440",
      "category": { "id": 2, "name": "Laptop" },
      "location": { "id": 1, "code": "HW-LAB", "name": "CPE Hardware Lab" },
      "status": "AVAILABLE"
    }
  ]
}
```
Errors: `400 VALIDATION_ERROR` (bad status), `401`.

### `GET /api/items/:id` (signed in)

`200 OK`: `{ "item": { ...same fields..., "description": "..." } }`. Errors: `400` (id not a positive integer), `401`, `404 ITEM_NOT_FOUND` (unknown or retired).

## 6. UI behavior

| State | Display |
|---|---|
| Loading | Spinner "Loading catalog…" |
| Loaded | Table (≥ 576 px) or stacked cards (< 576 px) with status badge text and color as in SDS §3 |
| Empty | "No items match this filter." |
| Error | Red alert with message and **Retry** button |

## 7. Permissions

Both roles may read the catalog. Categories are public. Anonymous access to items → 401 (tested in TEST-02-01).

## 8. Acceptance criteria

| AC | Given / When / Then |
|---|---|
| AC-03-01 | Given the seed, when a signed-in user calls `GET /api/items`, then all non-retired items are returned with `assetTag`, `name`, `category`, `location`, `status`, sorted by name then asset tag, and with no borrower information. |
| AC-03-02 | `GET /api/items?status=AVAILABLE` returns only Available items; `?status=BROKEN` returns `400 VALIDATION_ERROR`. |
| AC-03-03 | `GET /api/items/:id` returns the item for a valid id and `404 ITEM_NOT_FOUND` for an unknown id. |
| AC-03-04 | `GET /api/categories` without a token returns `200` and a non-empty array. |
| AC-03-05 | In the UI, a borrower sees each item's status as text; the **Request** button is enabled only for Available items; loading, empty, and error states display as specified. |

## 9. Software Test Specification

| Test | AC | Level | File / name | Precondition / input | Action | Expected result |
|---|---|---|---|---|---|---|
| TEST-03-01 | AC-03-01 | API | `tests/api/items.test.ts` › "lists catalog items" | Seed (10 items, 0 retired); borrower1 token | GET /api/items | 200; length 10; each has the 5 fields; order matches sort rule; no key `borrower`/`request`/`loan` |
| TEST-03-02 | AC-03-02 | API | › "filters by status" | `ARD-003` in Maintenance | GET `?status=AVAILABLE`; GET `?status=BROKEN` | First: every item `AVAILABLE`, `ARD-003` absent. Second: 400 `VALIDATION_ERROR` |
| TEST-03-03 | AC-03-03 | API | › "item detail and not found" | — | GET `/api/items/1`; GET `/api/items/99999` | 200 with `item.assetTag`; 404 `ITEM_NOT_FOUND` |
| TEST-03-04 | AC-03-04 | API | `tests/api/health.test.ts` › "categories are public" | No token | GET /api/categories | 200; array length ≥ 1 |
| TEST-03-05 | AC-03-05 | E2E | `client/e2e/catalog.spec.ts` | borrower1 signed in | Open `/catalog` | `LAP-001` row shows "Available" and enabled **Request**; `ARD-003` row shows "Maintenance" and disabled **Request** |
| TEST-03-06 | AC-03-05 | Component | `client/src/pages/CatalogPage.test.tsx` | Mocked API: pending promise / `[]` / 500 error | Render page | Shows "Loading catalog…" / "No items match this filter." / error alert with **Retry** |

## 10. Definition of Done

Product DoD in [README.md](README.md) applies.
