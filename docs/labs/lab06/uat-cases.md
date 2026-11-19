# LendLab — Sprint 1 UAT cases and handoff (Lab 6, Part A)

Draft v0.1. The Product Team (LendLab) gives this file to the UAT Team. Fill the *TBD* rows before the handoff.

## 1. Handoff

| Item | Value |
|---|---|
| Product | LendLab — equipment lending for the CPE labs |
| Repository | https://github.com/PakPak27/lendlab |
| Sprint 1 baseline | tag `v0.1.0` (commit `00ee860`) |
| Tested release | The commit shown by https://s07a7184d-4d7hbszvwq-as.a.run.app/api/health on the test day (`commit` field). The Product Team confirms it in the chat before the session and does not deploy during it. *Current: `6a9882f354d98b255966020f8f27c9976a416230` (first deploy, 2026-11-20); to be replaced by the first pipeline release from `main`.* |
| Deployed URL | https://s07a7184d-4d7hbszvwq-as.a.run.app |
| Cloud Run revision | Given by the Product Team with the commit (current: `s07a7184d-00003-7sj`) |
| Accepted-for-test scope | Sprint 1 only: F-01 sign-in/session, F-02 role and location access, F-03 catalog, F-04 borrow request and My Borrowing, F-05 custodian queue and checkout |
| Out of scope | Returns, renewals, reservations calendar, item editing, search, notifications (Sprint 2 and 3) |
| Browser | Any current Chrome, Edge or Firefox. A private window per account avoids mixing sessions. |

### Test accounts (passwords are sent privately, never in this file)

| Label | E-mail | Role | Locations |
|---|---|---|---|
| B1 | `borrower1@lendlab.test` | Borrower | — |
| B2 | `borrower2@lendlab.test` | Borrower | — |
| C-HW | `custodian.hw@lendlab.test` | Custodian | HW-LAB (CPE Hardware Lab) |
| C-MEDIA | `custodian.media@lendlab.test` | Custodian | MEDIA (CPE Media Room) |

### Data and order

The live database starts from the seed: 10 items, all **Available** except `ARD-003` (**Maintenance**). `PRJ-002` is already **Reserved** by a Product Team persistence check and is not used by these cases. Requests and loans change item status and cannot be undone from the UI in Sprint 1, so **run the cases in order UAT-01 → UAT-05**, each on its own item as listed. Before the session the Product Team confirms that the items below are Available; if one is not, the Product Team names a replacement item of the same location before testing starts. Do not request other items, so a re-test can use fresh ones.

| Case | Items used |
|---|---|
| UAT-01 | `LAP-001` |
| UAT-02 | `ARD-001`, `ARD-003`, and `LAP-001` (already on loan after UAT-01) |
| UAT-03 | `LAP-002`, `CAM-001` |
| UAT-04 | the UAT-01 loan and the UAT-03 requests |
| UAT-05 | none |

Record for every case: tester name and team, date and time, tested commit, the inputs you used, the **actual** result in your own words, and PASS / FAIL / BLOCKED (with the reason).

## 2. Cases

### UAT-01 — Borrow and check out a laptop (normal journey)

| Field | Value |
|---|---|
| Category | Normal domain journey |
| References | F-01 AC-01-08; F-03 AC-03-05; F-04 AC-04-01, AC-04-07; F-05 AC-05-02, AC-05-06, AC-05-07 |
| Purpose | A borrower requests an Available item and the custodian of its location checks it out, with the right due date. |
| Roles | B1, then C-HW, then B1 |
| Preconditions | `LAP-001` is Available. |
| Inputs | Purpose `UAT-01 lab assignment`; Loan length `7` days |

Steps
1. Open the URL and sign in as **B1**.
2. On **Catalog**, find `LAP-001` and click **Request**.
3. Enter the inputs above and submit.
4. Open **My Borrowing**.
5. Sign out. Sign in as **C-HW** and open **Requests**.
6. Find the `LAP-001` request from Borrower One and check it out. Note the date and time of the checkout.
7. Sign out. Sign in as **B1** and open **My Borrowing**.

Expected results
- Step 1: lands on `/catalog`; header shows "Borrower One" and "Borrower".
- Step 2: `LAP-001` shows **Available** with an enabled **Request** button.
- Step 3: a success message; `LAP-001` now shows **Reserved** in the catalog.
- Step 4: the request is listed as **Pending** with purpose and 7 days.
- Step 6: the request is in the queue with borrower name, item, purpose and 7 days; after checkout a success message shows a due date **exactly 7 days after the checkout time**, and the row leaves the queue.
- Step 7: the request is **Fulfilled**, the loan is **Active**, and the due date is the same as in step 6. `LAP-001` shows **On Loan** in the catalog.

### UAT-02 — Loan length, purpose and availability rules (business rule and boundary)

| Field | Value |
|---|---|
| Category | Business rule / boundary |
| References | F-04 BR-01, BR-04, BR-14; AC-04-02, AC-04-04, AC-04-07; F-03 AC-03-05 |
| Purpose | Only Available items can be requested; loan length must be 1–14 days; purpose must be 5–200 characters. |
| Role | B1 |
| Preconditions | UAT-01 done (`LAP-001` On Loan). `ARD-001` Available. `ARD-003` Maintenance. |

Steps
1. Sign in as **B1**. Open the request form for `ARD-001`.
2. Purpose `UAT-02 boundary`, Loan length `15`. Submit.
3. Loan length `0`. Submit.
4. Loan length `14`, purpose `abcd` (4 characters). Submit.
5. Purpose of only spaces. Submit.
6. Purpose `abcde` (5 characters), Loan length `14`. Submit.
7. Back on **Catalog**, look at `ARD-003` and `LAP-001`.

Expected results
- Steps 2–5: the form is not accepted; an error appears under the field at fault (loan length 1–14; purpose 5–200 characters); no request appears on My Borrowing; `ARD-001` stays **Available**.
- Step 6: accepted; `ARD-001` becomes **Reserved** and My Borrowing shows a **Pending** request for 14 days.
- Step 7: `ARD-003` shows **Maintenance** and `LAP-001` shows **On Loan**; both **Request** buttons are disabled, so neither can be requested.

### UAT-03 — Another borrower's data and another location's queue (forbidden role / ownership)

| Field | Value |
|---|---|
| Category | Forbidden role / ownership |
| References | F-02 AC-02-02, AC-02-04, AC-02-05, AC-02-06, AC-02-07; F-04 BR-06, AC-04-05; F-03 privacy rule |
| Purpose | Users see and change only what their role and location allow, and a rejected action changes nothing. |
| Roles | B2, B1, C-HW, C-MEDIA |
| Preconditions | UAT-02 done. `LAP-002` (HW-LAB) and `CAM-001` (MEDIA) Available. |

Steps
1. Sign in as **B2**. Request `LAP-002` (purpose `UAT-03 borrower two`, 3 days). Sign out.
2. Sign in as **B1**. Request `CAM-001` (purpose `UAT-03 camera`, 2 days).
3. Still as **B1**, open **My Borrowing**.
4. Still as **B1**, look at the menu, then type `<URL>/custodian/requests` in the address bar.
5. Still as **B1**, open **Catalog** and look at `LAP-002`.
6. Sign out. Sign in as **C-HW** and open **Requests**.
7. Sign out. Sign in as **C-MEDIA** and open **Requests**.

Expected results
- Step 3: only B1's own requests (UAT-01, UAT-02, `CAM-001`); B2's `LAP-002` request is **not** listed.
- Step 4: no **Requests** menu item; the address shows the "You do not have access to this page." page and no queue data.
- Step 5: `LAP-002` shows **Reserved** only; nothing reveals who reserved it.
- Step 6: the queue shows the `LAP-002` request (HW-LAB) and **not** the `CAM-001` request (MEDIA).
- Step 7: the queue shows the `CAM-001` request and **not** `LAP-002`.
- Do not check anything out in this case. Afterwards both requests are still **Pending** (checked again in UAT-04).

Optional API check (testers comfortable with a terminal): sign in as B1 with `POST <URL>/api/auth/login`, then call `GET <URL>/api/requests/<id of B2's LAP-002 request>` with B1's token. Expected `404 NOT_FOUND` and no request data. The Product Team gives the request id at handoff.

### UAT-04 — Records survive sign-out, restart and redeploy (state / history / persistence)

| Field | Value |
|---|---|
| Category | State / history / persistence |
| References | F-01 AC-01-05; F-04 AC-04-05; F-05 AC-05-03, AC-05-06; NFR-06 |
| Purpose | Requests, loans and statuses are kept in the database, and a fulfilled request cannot be checked out twice. |
| Roles | B1, C-HW, Product Team (restart / redeploy only) |
| Preconditions | UAT-01 to UAT-03 done. |

Steps
1. As **B1**, open **My Borrowing** and write down each request's item, status and due date.
2. Sign out, then press the browser **Back** button and reload.
3. The Product Team restarts the service (new revision of the same image) and tells the testers. Sign in as **B1** again and open **My Borrowing**.
4. The Product Team redeploys a new release through the pipeline and tells the testers the new commit. Open `<URL>/api/health` and note `commit`. Sign in as **B1** and open **My Borrowing**.
5. Sign in as **C-HW** and open **Requests**.

Expected results
- Step 2: no borrowing data is shown; the app asks for sign-in (the old session no longer works).
- Steps 3 and 4: the list is the same as in step 1: UAT-01 **Fulfilled** with the same due date, `ARD-001` **Pending**, `CAM-001` **Pending**. Catalog statuses are unchanged (`LAP-001` On Loan, `ARD-001`, `LAP-002`, `CAM-001` Reserved).
- Step 4: `commit` matches the commit the Product Team announced.
- Step 5: the fulfilled `LAP-001` request is not in the queue, so it cannot be checked out again; the `LAP-002` request is still there.

### UAT-05 — Sign-in rejection and protected pages

| Field | Value |
|---|---|
| Category | Business rule (authentication) |
| References | F-01 AC-01-02, AC-01-03, AC-01-08; F-02 AC-02-01 |
| Purpose | Wrong credentials never sign anyone in and do not reveal whether an account exists; protected pages need a session. |
| Role | none, then B1 |
| Preconditions | Signed out. |

Steps
1. Without signing in, open `<URL>/my`.
2. Sign in as `borrower1@lendlab.test` with a wrong password.
3. Sign in as `nobody@lendlab.test` with any password.
4. Sign in with e-mail `abc` (not an e-mail address).
5. Sign in as **B1** with the correct password.

Expected results
- Step 1: redirected to `/login`.
- Steps 2 and 3: the same red message "Invalid e-mail or password." in both cases; still on `/login`.
- Step 4: "Enter a valid e-mail address." under the e-mail field; still on `/login`.
- Step 5: lands on `/catalog` as Borrower One.

## 3. Coverage

| Sprint 1 feature | Cases |
|---|---|
| F-01 Authentication and session | UAT-01, UAT-04, UAT-05 |
| F-02 Role and location access | UAT-03 |
| F-03 Catalog | UAT-01, UAT-02, UAT-03 |
| F-04 Borrow request, My Borrowing | UAT-01, UAT-02, UAT-03, UAT-04 |
| F-05 Queue and checkout | UAT-01, UAT-03, UAT-04 |

Required categories: normal journey UAT-01; business rule / boundary UAT-02 (and UAT-05); forbidden role / ownership UAT-03; state / history / persistence UAT-04.

## 4. Reporting a finding

Open an Issue in the repository with the label `uat`, or send it through the agreed chat, with: case ID and step, tested commit, account label (never the password), what you did, expected result, actual result, a screenshot, and your severity (critical / major / minor) with the user impact. The Product Team answers every finding with a classification (accepted defect, duplicate, not a defect, enhancement) and a reason.
