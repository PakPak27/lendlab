# F-01 Authentication and Session — Engineering Contract

| Item | Value |
|---|---|
| Feature | F-01 Authentication and Session |
| Requirements | FR-01, FR-02, FR-03, NFR-01, NFR-02, NFR-04, NFR-11 |
| Sprint / Issue | Sprint 1 / #4 |
| Depends on | SYS-01 (User and Session tables, seed) |

### Version history

| Version | Date | Change |
|---|---|---|
| v0.1 | 2026-11-05 | Contract written before implementation |
| v0.2 | 2026-11-06 | Review on PR #11 (@Sirazaza): constant-time login for unknown e-mails (dummy hash), password limit set to 72 bytes (bcrypt limit), rate limiting stated as out of scope. Added TEST-01-11. |

## 1. Purpose and scope

Let seeded users sign in with e-mail and password, identify the current user on every request, and sign out with server-side revocation. Out of scope: registration, password change/recovery, "remember me", token renewal, and **login rate limiting / account lockout**. Rate limiting is deferred because Sprint 1 uses seeded demo accounts only; it is recorded as a known limitation and a candidate for Sprint 3 hardening.

## 2. Workflow

1. User opens `/login`, enters e-mail and password, presses **Sign in**.
2. Server normalizes e-mail, finds an active user, compares bcrypt hash.
3. On success the server creates a `Session` (hashed token, `expiresAt = now + SESSION_TTL_HOURS`) and returns `{ token, user }`.
4. Client stores the token in `sessionStorage` and routes by role: Borrower → `/catalog`, Custodian → `/custodian/requests`.
5. On every app load the client calls `GET /api/auth/me`; a `401` clears the token and redirects to `/login`.
6. **Sign out** calls `POST /api/auth/logout`, which sets `revokedAt`; the client clears the token and goes to `/login`.

Session states: `valid` → (`logout`) → `revoked`; `valid` → (time passes `expiresAt`) → `expired`. Only `valid` authenticates.

## 3. Business rules and validation

| Rule | Detail |
|---|---|
| Login input | `email`: required, valid e-mail format, max 254 chars. `password`: required, 1–**72 bytes** in UTF-8 (bcrypt only uses the first 72 bytes, so longer input is rejected rather than silently truncated). Otherwise `400 VALIDATION_ERROR` with field details. |
| Same failure message | Unknown e-mail, wrong password, and inactive user → `401 INVALID_CREDENTIALS`, message "Invalid e-mail or password." |
| Same response time | When the e-mail is unknown, the server still runs `bcrypt.compare` against a fixed dummy hash, so an unknown e-mail takes about as long as a wrong password and response timing does not reveal which accounts exist. |
| Hashing | bcrypt cost 10 (NFR-01). |
| Token | 32 random bytes, base64url; only SHA-256 hash stored. |
| Expiry | `SESSION_TTL_HOURS` (default 8) (NFR-04). |

## 4. Data model changes

Created in SYS-01 migration: `User` (`email` unique, `passwordHash`, `role`, `isActive`) and `Session` (`tokenHash` unique, `userId` FK, `expiresAt`, `revokedAt?`). No further change in F-01.

## 5. API specification

### `POST /api/auth/login` (public)

Request:
```json
{ "email": "borrower1@lendlab.test", "password": "<DEMO_USER_PASSWORD>" }
```
`200 OK`:
```json
{
  "token": "q1Zl...43 chars...",
  "user": { "id": 3, "email": "borrower1@lendlab.test", "name": "Borrower One", "role": "BORROWER", "locationIds": [] }
}
```
Errors: `400 VALIDATION_ERROR`, `401 INVALID_CREDENTIALS`.

### `GET /api/auth/me` (signed in)

`200 OK`: `{ "user": { "id", "email", "name", "role", "locationIds" } }` — `locationIds` lists assigned locations for custodians, `[]` for borrowers.
Errors: `401 UNAUTHENTICATED` (no header, malformed header, unknown, revoked, or expired token, or inactive user).

### `POST /api/auth/logout` (signed in)

`204 No Content`. Errors: `401 UNAUTHENTICATED`.

## 6. UI behavior

| Element | Behavior |
|---|---|
| `/login` | E-mail and password fields with labels; **Sign in** button disabled while submitting. `400` → inline field errors; `401` → red alert "Invalid e-mail or password."; network error → "Cannot reach the server. Try again." |
| App header | Shows user name and role badge ("Borrower" / "Custodian") and **Sign out**. |
| Protected routes | No token or `/me` returns `401` → redirect to `/login`. |
| After sign-in | Borrower → `/catalog`; Custodian → `/custodian/requests`. |

## 7. Permissions

Login is public. `/me` and `/logout` need a valid session. Role checks are in F-02.

## 8. Acceptance criteria

| AC | Given / When / Then |
|---|---|
| AC-01-01 | Given a seeded active user, when they log in with the correct password, then the response is `200` with a token and a `user` object containing `id`, `email`, `name`, `role`, `locationIds`, and **no** `password` or `passwordHash` field. |
| AC-01-02 | When the password is wrong **or** the e-mail does not exist, then the response is `401` with code `INVALID_CREDENTIALS`, the same message in both cases, and no token; the password check runs in both cases so timing does not reveal whether the account exists. |
| AC-01-03 | When the e-mail is missing or malformed, or the password is empty or longer than 72 bytes, then the response is `400 VALIDATION_ERROR` with `details` naming the field. |
| AC-01-04 | Given a valid token, `GET /api/auth/me` returns `200` with the user. Without a token, with a random token, or with an expired token it returns `401 UNAUTHENTICATED` and no user data. |
| AC-01-05 | Given a valid token, `POST /api/auth/logout` returns `204`, and the same token then gets `401` on `/api/auth/me`. |
| AC-01-06 | Seeded passwords are stored as bcrypt hashes that differ from the plaintext and verify correctly. |
| AC-01-07 | Given a user with `isActive = false`, login returns `401 INVALID_CREDENTIALS`. |
| AC-01-08 | In the UI, a borrower who signs in lands on `/catalog` and sees their name and "Borrower"; after **Sign out** they are on `/login`; opening `/my` without signing in redirects to `/login`. |

## 9. Software Test Specification

| Test | AC | Level | File / name | Precondition / input | Action | Expected result |
|---|---|---|---|---|---|---|
| TEST-01-01 | AC-01-01 | API | `tests/api/auth.test.ts` › "logs in with valid credentials" | Seeded `borrower1` | POST login | 200; `token` is a non-empty string; `user.role` = `BORROWER`; body JSON has no key matching `/password/i` |
| TEST-01-02 | AC-01-02 | API | › "rejects wrong password" | Seeded `borrower1`, password `wrong` | POST login | 401; `error.code` = `INVALID_CREDENTIALS`; no `token`; no new Session row |
| TEST-01-03 | AC-01-02 | API | › "rejects unknown e-mail with same message" | `nobody@lendlab.test` | POST login | 401; same `error.message` as TEST-01-02 |
| TEST-01-04 | AC-01-03 | API | › "validates login input" (table-driven) | `{}`, `{email:"abc"}`, `{email:"a@b.c", password:""}`, password of 73 ASCII chars, password of 25 Thai chars (75 bytes) | POST login | 400 `VALIDATION_ERROR`; `details[].field` contains `email` or `password` |
| TEST-01-05 | AC-01-04 | API | › "me requires a valid session" | (a) valid token (b) none (c) `Bearer xyz` (d) session with `expiresAt` in the past | GET /me | (a) 200 with user (b)(c)(d) 401 `UNAUTHENTICATED`, body has no `user` |
| TEST-01-06 | AC-01-05 | API | › "logout revokes the token" | Valid token | POST logout, then GET /me | 204, then 401; Session row has `revokedAt` set |
| TEST-01-07 | AC-01-04 | Unit | `tests/unit/session.test.ts` › "isSessionValid" | Sessions: valid, revoked, expired by 1 s, expires in 1 s | Call function | true, false, false, true |
| TEST-01-08 | AC-01-06 | Unit | `tests/unit/password.test.ts` | Plain `Secret123!` | `hashPassword`, `verifyPassword` | Hash ≠ plain, starts with `$2`; verify(correct) = true; verify(wrong) = false |
| TEST-01-09 | AC-01-07 | API | `tests/api/auth.test.ts` › "inactive user cannot log in" | User with `isActive=false` | POST login | 401 `INVALID_CREDENTIALS` |
| TEST-01-10 | AC-01-08 | E2E | `client/e2e/auth.spec.ts` | Seeded DB, app running | Visit `/my` → sign in as borrower1 → check header → Sign out | Redirected to `/login`; after sign-in URL is `/catalog` and header shows "Borrower One" and "Borrower"; after sign out URL is `/login` |
| TEST-01-11 | AC-01-02 | Unit | `tests/unit/authService.test.ts` › "runs bcrypt even when the e-mail is unknown" | Spy on `verifyPassword`; user lookup returns null | Call `login('nobody@lendlab.test', 'x')` | Throws `INVALID_CREDENTIALS`; `verifyPassword` was called exactly once (with the dummy hash) |

## 10. Definition of Done

Product DoD in [README.md](README.md) applies. Feature-specific evidence: Supertest output for `auth.test.ts`; Playwright report for `auth.spec.ts`; screenshot of login error and header.
