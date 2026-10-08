# New Avenue 1 — Backend API (Node.js)

A REST API for the New Avenue 1 internal sales platform, built with **Node.js + Express + SQLite**
(via `better-sqlite3`). It implements the business rules the front-end prototype demonstrates: team
separation, role-based visibility, popularity scoring with anti-manipulation dedup, a real
**Owner↔Unit relationship model** (not a bare count) with a **30-distinct-owner cap per salesperson**,
per-relationship 30-day update/expiry cycles, admin-gated owner transfers/claims, and the new
**Daily Performance Report** module (one report per salesperson per date, 11 required metrics,
monthly roll-ups). The Leads module is Phase 2 / currently inactive (see below) — its schema and
routes are kept intact but dormant.

SQLite was chosen so the API runs with zero external services during the prototype/testing phase.
The query layer is isolated in `src/db.js` and plain `db.prepare(...)` calls in each route file, so
swapping to Postgres/MySQL later means reimplementing that layer — route and business logic stay the same.

`src/db.js` tries the declared dependency `better-sqlite3` first; if it isn't installed (e.g. no
network access to the npm registry) it falls back to Node's built-in `node:sqlite` module, which has
a near-identical `prepare().get()/.run()/.all()` surface. This is a compatibility shim only — a normal
`npm install` always gets you the real `better-sqlite3`, and the fallback is logged on startup so it's
never silent.

## Setup

```bash
cd na1-backend
npm install
cp .env.example .env        # edit JWT_SECRET before any real deployment
npm run seed                 # creates ./data/new-avenue-1.sqlite with demo accounts
npm run dev                  # starts on http://localhost:4000
```

All seeded demo accounts use the password `Demo123!`. Useful logins:

| Email | Role |
|---|---|
| `s1@newavenue.demo` | Residential salesperson |
| `s4@newavenue.demo` | Commercial salesperson |
| `tl1@newavenue.demo` | Residential team leader |
| `m1@newavenue.demo` | Residential sales manager |
| `headadmin@newavenue.demo` | Head Admin |

> Note: this sandbox has no network access to the npm registry, so `better-sqlite3`, `express`,
> `bcryptjs`, `jsonwebtoken`, `cors`, `morgan`, `uuid` and `dotenv` could not be installed here.
> Every file is syntax-checked (`node --check`). Beyond that, the actual route files and schema in
> this folder were exercised **live and unmodified** against real SQLite (via the `node:sqlite`
> fallback above) using a disposable, clearly-labeled sandbox-only HTTP/Express-compatible test
> harness — 31 functional assertions covering login, phone validation/normalization, the 30-owner
> cap, cross-salesperson claims + admin approval, the Automatic Update / Edit Unit relationship
> flow, and the full Daily Report lifecycle (create → fill → complete → persist → monthly totals)
> all pass. That harness is not part of this deliverable — run `npm install && npm run seed && npm run dev`
> on a machine with normal network access for the real, fully-dependency-backed run.

## Auth

`POST /api/auth/login { email, password }` → `{ token, user }`. Send `Authorization: Bearer <token>`
on every other request. `GET /api/auth/me` returns the current user.

## Team scoping

Team-assigned roles (salesperson, team leader, manager, director) are locked to their own team server-side
— there's no way to request the other team's data even by editing query params. Accounts with no fixed
team (Head of Sales, CEO, admins) must pass `?team=residential` or `?team=commercial` on every scoped
endpoint; this mirrors the "two separate environments" requirement while giving company-wide roles a way
to inspect either one.

## Endpoints

| Resource | Endpoints |
|---|---|
| Leads *(Phase 2 / inactive)* | `GET /api/leads`, `GET /api/leads/:id`, `PATCH /api/leads/:id/status`, `POST /api/leads/:id/notes`, `POST /api/leads/:id/reminders`, `PATCH /api/leads/reminders/:id` — schema/routes intact but not reachable from the active app; no fresh-lead notifications are generated while `LEADS_MODULE_ENABLED=false` in `src/utils/helpers.js` |
| Units | `GET /api/units` (filters: `bedrooms,bathrooms,unitType,finishing,saleRent,delivery` as comma-lists; `sort=popularity|newest|oldest`; `q=` search), `GET /api/units/:id`, `POST /api/units`, `POST /api/units/:id/interactions` |
| Owners (real Owner↔Unit relationships) | `GET /api/owners` (grouped by owner, each with its `relationships[]`), `GET /api/owners/available` (expired relationships open to transfer), `POST /api/owners` (`{name, phone, phone2?, unitId}` — 3-case create/add-unit/claim logic, see below), `POST /api/owners/relationships/:relId/automatic-update`, `PATCH /api/owners/relationships/:relId/unit`, `POST /api/owners/relationships/:relId/request-transfer` |
| Daily Performance Report | `GET /api/daily-reports/today?date=`, `GET /api/daily-reports/:date`, `PUT /api/daily-reports/:date` (`{section,key,value}`, one field at a time), `POST /api/daily-reports/:date/complete`, `GET /api/daily-reports/previous-incomplete/check`, `GET /api/daily-reports/monthly/:month`, `GET /api/daily-reports/months` |
| Requests | `GET /api/requests` (returns feed + your personal `lastReadRequestId` + `unreadCount`), `POST /api/requests`, `POST /api/requests/:id/replies`, `PUT /api/requests/read-position` |
| Reference dictionary | `GET /api/reference`, `POST /api/reference` (admin), `DELETE /api/reference/:id` (admin) |
| Notifications | `GET /api/notifications` (lazily generates per-relationship owner-refresh and missing-Daily-Report notifications; fresh-lead/reminder notifications stay off while Leads is inactive), `PATCH /api/notifications/:id/read` |
| Users | `GET /api/users` (scoped to downline/team), `GET /api/users/:id/team-summary` |
| Admin | `GET/POST /api/admin/units/pending`, `GET /api/admin/owner-transfers`, `POST /api/admin/owner-transfers/:id/approve|reject` (handles both `type:'transfer'` and `type:'claim'`), `POST /api/admin/users/:id/team`, `POST /api/admin/users`, `PATCH /api/admin/users/:id/role`, `GET /api/admin/audit-log` |

### Owner↔Unit relationship model

An **Owner** is a real contact (`owners`: name + normalized phone). A **Unit** is company inventory
(`units`). The link between them lives in **`owner_units`**: one row per (owner, unit, salesperson),
each with its own `status`, `last_update_at`/`next_update_at`/`reminder_at` (independent 30-day cycle —
the same 25-day "soon" / 30-day "expired" rule as before, now applied per relationship, not per owner).
One owner can have unlimited active relationships (unlimited units). The 30-cap in `POST /api/owners`
counts `COUNT(DISTINCT owner_id)` for a salesperson's active rows — never the row count itself.

`POST /api/owners` resolves to one of three outcomes based on normalized-phone lookup, scoped to the
request's team: **`created`** (no existing owner with that phone — new owner + new relationship, no
approval needed), **`unit_added`** (the requesting salesperson already holds that owner — just add the
new unit relationship), or **`pending_claim`** (the phone belongs to an owner another salesperson
currently holds — a `type:'claim'` row is queued in `owner_transfers` for admin approval rather than
silently duplicating the owner record). Approving a claim creates a relationship for the claimant's
unit only; approving a `type:'transfer'` request reassigns one specific `owner_units` row — neither
ever touches the owner's other relationships.

### Daily Performance Report

One row per `(salesperson_id, date)`, enforced by `UNIQUE(salesperson_id, date)` plus a find-or-create
choke point (`getOrCreateReport`) so a race can never insert two rows for the same salesperson+date.
Exactly 11 nullable metric columns (`0` is a valid stored value, distinct from `NULL` = not entered).
`POST /:date/complete` only succeeds once every column is non-null. No data exists before
`2026-11-01`; months are derived with `SELECT DISTINCT substr(date,1,7)`, never manually created, and
monthly totals are always computed live from the rows, never stored.

## Business rules implemented server-side (not just UI)

- **Fresh lead clears on action, not on view**: `PATCH /api/leads/:id/status` is the only thing that
  flips `fresh` to false; opening/reading a lead does nothing.
- **Popularity anti-manipulation**: `unit_interactions` has `UNIQUE(unit_id, user_id, type)` — a second
  call/WhatsApp/PDF/view from the same user on the same unit is silently ignored, so one person can't
  inflate a unit's ranking. The numeric score is stripped from API responses for non-admins.
- **30-DISTINCT-owner cap, never a monthly reset**: `POST /api/owners` counts
  `COUNT(DISTINCT owner_id)` across a salesperson's active `owner_units` rows before allowing a
  brand-new owner or a claim — unlimited units per owner never count against it.
- **Relationship transfer/claim → admin-approved only, scoped to one relationship**:
  `POST /api/owners/relationships/:relId/request-transfer` and the claim path in `POST /api/owners`
  only ever create a `pending` row in `owner_transfers`; nothing in `owner_units` changes until an
  admin calls `/api/admin/owner-transfers/:id/approve|reject`, and approval touches that one
  relationship row only.
- **Daily Report uniqueness**: `UNIQUE(salesperson_id, date)` on `daily_reports` plus a
  find-or-create choke point in `routes/dailyReports.js` — no code path can create a second report
  for the same salesperson on the same date.
- **Personal request read position**: `request_read_positions` is keyed by `(user_id, team)` — never a
  single shared position.
- **RBAC**: `requireRole` / `requireAdmin(minLevel)` / `resolveTeam` middleware gate every scoped route;
  `visibleSalespersonIds` restricts leads/owners queries to self (salesperson), downline (management), or
  unrestricted-within-team (admins/top execs).

## Assumptions carried over from the front-end build (flagged, not silently decided)

- Director is team-scoped like Team Leader/Manager; Head of Sales and CEO are company-wide.
- Admin tiering used here: **Junior Admin** — approve pending units, manage reference dictionary;
  **Senior Admin** — junior admin's powers + approve/reject owner transfers + change a user's team;
  **Head Admin** — all of the above + create users and change roles. This is an assumption filling a
  gap the spec left open ("permissions should reflect the hierarchy") — tell me if the real policy
  differs and I'll adjust `requireAdmin(...)` calls in `src/routes/admin.js` accordingly.
- Photos are stored only as a count in this MVP (no file upload / object storage yet) — add S3-compatible
  storage + a `unit_photos` table when real photos are needed.
- WhatsApp/Call are client-side `wa.me` / `tel:` links, not server-mediated — nothing to build here unless
  you want server-side click tracking beyond what `/api/units/:id/interactions` already records.

## Not built yet (intentionally out of scope for this pass)

- eProfit CRM migration (Phase 12 in the spec) — needs a real export sample before any schema/import work
  can start; happy to scope that once you can get a sample export from the CRM manager.
- Real-time push for notifications (currently polling `GET /api/notifications`) — swap in WebSockets/SSE
  if the salesforce needs instant fresh-lead alerts rather than next-refresh alerts.
- Rate limiting / brute-force login protection, refresh tokens, password reset flow.
