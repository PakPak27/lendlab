# F-10 Inventory Management — Engineering Contract

| Item | Value |
|---|---|
| Feature | F-10 Inventory Management |
| Requirements | FR-13, FR-14, BR-05, BR-07, BR-13 |
| Sprint | Sprint 2 |
| Depends on | F-02, F-03 |

### Version history

| Version | Date | Change |
|---|---|---|
| v0.1 | 2026-11-28 | Contract written before implementation |

## 1. Purpose and scope

A custodian sees all items in their locations (including Maintenance and Retired), adds new items, edits item details, and changes an item's status between Available, Maintenance and Retired. Out of scope: deleting items, moving items to a location the custodian is not assigned to, bulk import, photos.

## 2. Workflow and state transitions

1. Custodian opens `/custodian/inventory` → `GET /api/custodian/items` (own locations, all statuses, name order).
2. **Add item** → form (Asset tag, Name, Category, Location, Description) → `POST /api/custodian/items` → `201`; the item is Available and appears in the catalog.
3. **Edit** on a row → same form filled → `PATCH /api/custodian/items/:id` (name, description, categoryId, locationId) → `200`.
4. Status buttons on a row → `POST /api/custodian/items/:id/status` `{ "status": "MAINTENANCE" | "AVAILABLE" | "RETIRED" }`. Retiring asks for confirmation ("Retired items cannot be brought back").

Allowed status changes (BR-13):

| From \ To | AVAILABLE | MAINTENANCE | RETIRED |
|---|---|---|---|
| AVAILABLE | — (409) | ✓ | ✓ |
| MAINTENANCE | ✓ | — (409) | ✓ |
| RESERVED, ON_LOAN | 409 ITEM_IN_USE | 409 ITEM_IN_USE | 409 ITEM_IN_USE |
| RETIRED | 409 ITEM_RETIRED | 409 ITEM_RETIRED | 409 ITEM_RETIRED |

RESERVED and ON_LOAN are only set by requests and checkouts (F-04, F-05), never by this endpoint.

## 3. Business rules and validation

| Rule | Implementation |
|---|---|
| FR-13 add / edit | Zod: `assetTag` 3–20 characters, upper-case letters, digits and single hyphens (`^[A-Z0-9]+(-[A-Z0-9]+)*$`), unique (`409 ASSET_TAG_TAKEN`); `name` trimmed 2–100; `description` optional ≤ 500; `categoryId` must exist (`400`, `field: "categoryId"`); `locationId` must be one of the custodian's locations (`400`, `field: "locationId"`, "You can only use your own locations."). The asset tag cannot be edited. |
| FR-14 / BR-13 status change | Pure function `statusChangeError(from, to)` in `server/src/lib/itemStatus.ts` returns the error code or `null`; the update is conditional on the current status (`updateMany where status = from`), so a request reserving the item at the same moment wins or loses cleanly (`409`). |
| BR-05 scope | Every lookup uses `item.locationId ∈ user.locationIds`; outside → `404` |
| BR-07 roles | Borrowers → `403` on all `/api/custodian/items*` |
| Catalog | Retired items stay hidden from `GET /api/items` (F-03, unchanged) |

## 4. Data model changes

None (`Item` has all fields; `ItemStatus.RETIRED` exists; `assetTag` is unique).

## 5. API specification

| Method and path | Body | Success | Errors |
|---|---|---|---|
| `GET /api/custodian/items` | — | `200 { items: [ { id, assetTag, name, description, status, category: { id, name }, location: { id, code, name } } ] }` | 401, 403 |
| `POST /api/custodian/items` | `{ assetTag, name, categoryId, locationId, description? }` | `201 { item }` (status AVAILABLE) | 400, 401, 403, 409 ASSET_TAG_TAKEN |
| `PATCH /api/custodian/items/:id` | any of `{ name, description, categoryId, locationId }` (at least one) | `200 { item }` | 400, 401, 403, 404 |
| `POST /api/custodian/items/:id/status` | `{ status: "AVAILABLE" \| "MAINTENANCE" \| "RETIRED" }` | `200 { item }` | 400, 401, 403, 404, 409 ITEM_IN_USE, 409 ITEM_RETIRED, 409 INVALID_STATUS_CHANGE |

## 6. UI behavior

| Screen | Behavior |
|---|---|
| Custodian nav | New link **Inventory** (`/custodian/inventory`). |
| Inventory page | Table/cards with asset tag, name, category, location, status badge, **Edit** and status buttons allowed by the table above (others hidden); a status filter. |
| Add / Edit form | Labelled fields; inline field errors from the client check and from a server `400`; `409 ASSET_TAG_TAKEN` shows "This asset tag is already used." under Asset tag. |
| Status change | `409` shows the server message and reloads the row. |

## 7. Permissions

Custodian of the item's location (and only for their own locations when adding or moving). Borrowers: `403`. Other custodians: `404`.

## 8. Acceptance criteria

| ID | Criterion |
|---|---|
| AC-10-01 | custodian.hw's `GET /api/custodian/items` returns all HW-LAB items, including Maintenance (ARD-003), and no MEDIA items. |
| AC-10-02 | custodian.hw adds `LAP-010` "Dell Latitude 7450", Laptop, HW-LAB → `201`, status `AVAILABLE`; it appears in `GET /api/items` and can be requested. |
| AC-10-03 | Invalid input is `400` with the field name and nothing is saved: asset tag `lap 1`, a 2-character tag, an unknown category, a name of 1 character, and a MEDIA location for custodian.hw. A duplicate asset tag (`LAP-001`) is `409 ASSET_TAG_TAKEN`. |
| AC-10-04 | custodian.hw edits the name and description of LAP-002 → `200` and the catalog shows the new name; editing a MEDIA item is `404`. |
| AC-10-05 | Status changes follow the table: Available → Maintenance → Available → Retired are `200`; Reserved or On Loan → anything is `409 ITEM_IN_USE`; Retired → anything is `409 ITEM_RETIRED`; same status is `409 INVALID_STATUS_CHANGE`. A refused change leaves the status unchanged. |
| AC-10-06 | A Retired item is not in `GET /api/items`, `GET /api/items/:id` is `404`, and a request for it is `404`/`409`; it is still listed in the custodian inventory as Retired. |
| AC-10-07 | borrower1 calling any inventory endpoint gets `403`; custodian.media changing a HW-LAB item gets `404`. |
| AC-10-08 | In the UI, the custodian adds an item, edits it, and sets it to Maintenance; the form shows server errors under the fields. |

## 9. Software Test Specification

| Test ID | AC | Level | File › test | Setup | Action | Expected |
|---|---|---|---|---|---|---|
| TEST-10-01 | AC-10-05 | Unit | `server/tests/unit/itemStatus.test.ts` › "statusChangeError" (full table) | — | every from/to pair | codes as in §2 |
| TEST-10-02 | AC-10-01 | API | `server/tests/api/inventory.test.ts` › "lists own items" | Seed | custodian.hw GET | HW-LAB items only, ARD-003 included |
| TEST-10-03 | AC-10-02 | API | › "adds an item" | Seed | POST LAP-010 | 201; DB row; GET /api/items contains it; borrower request 201 |
| TEST-10-04 | AC-10-03 | API | › "validation" (table) and "duplicate tag" | Seed | invalid bodies; LAP-001 | 400 with field, count unchanged; 409 |
| TEST-10-05 | AC-10-04 | API | › "edits an item" | Seed | PATCH LAP-002; PATCH a MEDIA item | 200 + DB; 404 |
| TEST-10-06 | AC-10-05 | API | › "status changes" | Items in each status | POST status | 200/409 per table; DB unchanged on 409 |
| TEST-10-07 | AC-10-06 | API | › "retired items" | Retire LAP-003 | GET catalog, GET detail, POST request | not listed; 404; refused |
| TEST-10-08 | AC-10-07 | API | › "role and scope" | Seed | borrower1 GET/POST; media PATCH/status on HW item | 403; 404 |
| TEST-10-09 | AC-10-08 | Component | `client/src/pages/InventoryPage.test.tsx` | Mocked API | Add, server 400/409, status change | Fields errors shown; list updated |

## 10. Definition of Done

Sprint 2 DoD ([README.md](README.md)) applies. TDD evidence required for TEST-10-01, TEST-10-03 and TEST-10-06.
