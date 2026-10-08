# New Avenue 1 — Integration & Stabilization Phase: Changes, Testing, Limitations

This covers the work done on top of the existing New Avenue 1 app (frontend + backend). Nothing
was rebuilt from scratch; no existing feature was removed or redesigned. Everything below is
additive or a targeted fix to the Owner/Daily-Report logic described in the spec.

## 1. What changed

### Owners → real Owner↔Unit relationships
- **Frontend** (`new-avenue-1-frontend/js/data.js`, `js/pages/owners.js`, `js/session.js`):
  replaced the bare `owner.units` / `owner.unitsCount` number with two real collections —
  `DB.owners` (contacts: name + normalized phone) and `DB.ownerUnits` (one row per owner↔unit↔
  salesperson relationship, each with its own `lastUpdateAt`/`nextUpdateAt`/`reminderAt`/`status`).
- **Backend** (`na1-backend/src/db.js`, `src/routes/owners.js`, `src/routes/admin.js`): new
  `owners` and `owner_units` tables (`owner_units` replaces the old `units_count` column entirely);
  `owner_transfers` extended with a `type` (`transfer` | `claim`) and `owner_unit_id`.
- **30-owner cap**: counts `COUNT(DISTINCT owner_id)` across a salesperson's *active* relationships
  — never resets monthly, never counts units. Enforced identically in both layers.
- **Unlimited units per owner**: adding another unit to an owner you already hold never touches
  the cap or creates a new owner record.
- **Update Owner flow** (`js/pages/owners.js: openUpdateOwnerModal`, backend
  `POST /relationships/:id/automatic-update` and `PATCH /relationships/:id/unit`): pick the unit →
  **Automatic Update** (relationship refreshed, unit untouched) or **Edit Unit** (change the unit,
  saving also refreshes the relationship).
- **Per-relationship 30-day cycle**: `ownerExpiryState()` now takes a relationship's
  `lastUpdateAt`, not the owner's. The existing 25-day "soon" / 30-day "expired" thresholds are
  unchanged. Two owners sharing a contact but different units can be in different states at once.
- **Transfers apply to one relationship only**: `request-transfer` / admin `approve` only ever
  touch the single `owner_units` row named in the request — an owner's other relationships (with
  the same or other salespeople) are never modified.
- **Cross-salesperson claim, admin-approved, no silent duplication**: adding an owner by phone
  resolves to one of three outcomes — brand new owner (no match), add-unit-to-owner-you-already-
  hold (match + you hold it), or **pending claim requiring admin approval** (match + someone else
  holds it). The owner record is never duplicated.

### Phone numbers
- `isDigitsOnly()` / `normalizeEgyptPhone()` implemented identically in
  `new-avenue-1-frontend/js/data.js` and `na1-backend/src/utils/phone.js`. Rejects `+`, spaces,
  `-`, brackets, letters. Accepts local `01XXXXXXXXX` (11 digits) and international
  `20XXXXXXXXXXX` (12 digits, no `+`), both normalized to the same 12-digit canonical value used
  for duplicate detection (`UNIQUE(team, phone)` on the backend) and search. No other country-code
  rule (no "22 rule" or similar) was added anywhere.

### Daily Performance Report (new module, inside this same app)
- **Frontend**: `js/pages/dailyreport.js` (new page) + Daily Report data/helpers in `js/data.js`
  (`getOrCreateDailyReport`, `setReportField`, `isReportComplete`, `completeReport`,
  `reportsForMonth`, `monthlyTotals`, `availableMonthsFor`). Added to navigation as "Daily
  Reports" (salespeople only); not a separate app.
- **Backend**: `src/routes/dailyReports.js` (new) + `daily_reports` table with
  `UNIQUE(salesperson_id, date)`.
- **Launch date 2026-11-01, zero historical data.** Before that date the page shows a "begins
  2026-11-01" notice instead of empty/fake data; no Daily Report rows are ever generated for
  earlier dates.
- **One report per salesperson per date**, continuously updatable: `getOrCreateDailyReport` /
  `getOrCreateReport` is the single choke point on both sides, backed by the DB `UNIQUE` constraint
  — a race cannot create a duplicate row (the harness test below exercises this).
- **Exactly 11 fields**, no more/less: Calls (Count, Active), Leads, Showings (Buyer, Seller),
  Meetings (Buyer, Seller, Developer), Other Activities (Inventory, Orientation, Closed Deals).
  `0` is stored and treated as present; only `null`/unset blocks completion
  (`isFieldFilled`/`isComplete`).
- **Complete Report** only succeeds once all 11 fields are filled; status is
  `in_progress`/`completed`, shown clearly in the UI.
- **Previous-day-incomplete notification** reuses the existing `notify()` system and
  notifications page/UI (no parallel notification mechanism). Clicking it opens that exact date
  (`notification.meta.date`). The incomplete report is never locked — it stays open, editable and
  completable after the day ends.
- **Monthly Reports**: months are derived from existing report dates (`SELECT DISTINCT
  substr(date,1,7)` / `monthKeyOf`), never manually created; November 2026 is the first possible
  month. Summary totals (11 cards) and the daily table are always computed live from the stored
  daily reports, never hardcoded or cached.
- **Architecture leaves room for the future Manager Report phase** (personal manager reports, team
  overview, one team-wide Manager Comment/day, manager activities) without building it now — the
  per-salesperson report rows plus the existing `manager_id` hierarchy are what a team-overview
  query would aggregate; nothing here blocks adding that later.

### Leads (Phase 2 / inactive)
- `LEADS_MODULE_ENABLED = false` (`js/data.js`) and `LEADS_MODULE_ENABLED` (backend
  `src/utils/helpers.js`) remove Leads from navigation/mobile tabs and stop all fresh-lead/
  reminder notifications on both sides. The Leads schema, routes, and page file are left in place
  and untouched — flipping the flag back on is the only step needed to reactivate it later.
- The dashboard's old fresh-lead banner was replaced with a Daily Report status banner for
  salespeople (and a plain welcome banner before the Report launch date / for non-salespeople).

### Backend runnability
- `na1-backend/src/db.js` tries the declared dependency `better-sqlite3` first and falls back to
  Node's built-in `node:sqlite` only if that package isn't installed (logged on startup either
  way) — this is what allowed the live functional testing below to run in a sandbox with no
  network access to the npm registry, without changing the declared architecture.
- `src/seed/seed.js` was out of sync with the new `owners`/`owner_units` schema (it still inserted
  into columns that no longer exist, and didn't wipe the new tables on re-seed) — fixed to seed
  real owners + relationships against real unit ids, and to wipe `owner_units`/`daily_reports` on
  re-seed.
- **Bug fixed**: in `src/routes/dailyReports.js`, the fixed-path routes `GET /months`,
  `GET /previous-incomplete/check` and `GET /monthly/:month` were registered *after* the generic
  `GET /:date` route. Since Express matches routes in registration order and `/:date` matches any
  single path segment, `GET /months` was being silently swallowed as `date === "months"`. Reordered
  so the specific routes are registered first — confirmed fixed by the test harness below.

## 2. What was tested, and how

**Backend — live, not just syntax-checked.** This sandbox has no network access to the npm
registry, so `express`, `bcryptjs`, `jsonwebtoken`, `cors`, `morgan`, `uuid`, `dotenv` and
`better-sqlite3` could not be installed here. Rather than stop at static analysis, the real,
unmodified route files in `na1-backend/src/routes/*.js` and the real schema in `src/db.js` were
exercised **live** against real SQLite (via the `node:sqlite` fallback) using a disposable,
clearly-labeled, sandbox-only Express-compatible shim (not part of this deliverable — a normal
`npm install` on a machine with network access gets the real packages). 31 functional assertions
passed, covering:

- Login (correct/incorrect password).
- Phone validation (rejects `+`/spaces/letters) and normalization (local → canonical, intl → same
  canonical).
- Adding a second unit to an owner you already hold (same owner, 2 real distinct unit
  relationships — not a count).
- Cross-salesperson claim: second salesperson adding the same normalized phone is queued
  `pending_claim`, no duplicate owner record created; admin approval creates a relationship for the
  claimant's unit only, leaving the original holder's relationship untouched.
- Automatic Update and Edit Unit both refresh the target relationship's cycle; Edit Unit actually
  changes the underlying unit row.
- The 30-DISTINCT-owner cap blocks a 31st (verified both as a fresh create and, separately, that a
  salesperson already at the cap is blocked from claiming too) — exactly 30 active relationships
  exist for that salesperson at the moment it blocks.
- Daily Report: before/after launch date, field value `0` vs `null`, Complete Report refusing
  until all 11 fields are set, completion persisting across a fresh `GET` ("reload"), repeated
  same-day updates never creating a second DB row, monthly `/months` and `/monthly/:month` totals
  computed correctly, and the previous-day-incomplete check reporting `false` once that day is
  completed.

Run it yourself: `na1-backend/README.md` documents the exact assumptions this harness makes
(sandbox-only, deleted after use) — on a machine with npm access, `npm install && npm run seed &&
npm run dev` is the real, fully-dependency-backed path; no test code from the sandbox harness ships
in this ZIP.

**Frontend — live, in Node.** `new-avenue-1-frontend/js/data.js`'s pure data-layer functions were
loaded and executed directly in Node (with `localStorage` stubbed) — not just read. 21 assertions
passed: phone validation/normalization (including that local and international forms of the same
number are recognized as equal, and that no invented country-code rule like a "22 rule" exists),
the Owner/relationship shape (no owner object carries a bare `units`/`unitsCount` field),
11-field Daily Report completion logic (`0` vs `null`), `getOrCreateDailyReport` never creating a
second row for the same salesperson+date, and live-computed monthly totals.

**Static checks on every file in both projects**: `node --check` (syntax) — all pass, including
after every edit made in this phase. Searched both trees for stale references to the old owner
shape (`o.units`, `o.salespersonId` directly on an owner, etc.) — none found outside the files
intentionally rewritten for this phase; `units[].ownerSalespersonId` (which salesperson listed a
unit in Inventory) is a separate, pre-existing field and was correctly left untouched.

**Not independently re-verified in this pass** (inherited from the existing, previously-reviewed
app and not touched this phase): Inventory/News Feed filtering and popularity scoring, Requests
feed + personal read positions, Reference dictionary, user/role management, and the Residential/
Commercial team-switcher for admins. These were not part of this phase's required changes and
their code was not modified, so they were spot-checked by reading rather than re-run end-to-end.

## 3. Known limitations — stated plainly, not hidden

- **No live `npm install`/full dependency run was possible in this sandbox** (no network access to
  the npm registry). The backend's real, declared dependencies (`express`, `better-sqlite3`, etc.)
  were never literally imported here — only exercised through the sandbox-only compatibility shim
  described above. This is the one thing in this deliverable that a developer with normal network
  access should re-verify first: `cd na1-backend && npm install && npm run seed && npm run dev`,
  then re-run (or write) an integration test against the real stack.
- **Frontend and backend are still two independent implementations**, not wired together over
  HTTP. This was true before this phase and remains true after it — the frontend's `js/data.js`
  still persists to `localStorage`, not to the backend API, for every module including the new
  Daily Report. The backend's Daily Report / Owner-relationship API is complete, tested, and ready
  to be called from the frontend, but no `fetch()` calls were added in this phase. Wiring the two
  together (swapping the frontend's local mock-data calls for real API calls) remains the next
  milestone, exactly as the pre-existing root README already flagged for the rest of the app
  before this phase started. Given that every other module in the app (Inventory, Leads, Requests,
  Owners prior to this phase) already worked this way, keeping Daily Reports on the same pattern
  was the consistent choice rather than making one module networked while the rest stayed local.
- **Demo/seed data was regenerated, not migrated**, when the Owner↔Unit relationship model
  replaced the old bare-count model (frontend storage version bumped from 1 → 2; backend
  `npm run seed` rewrites the `owners`/`owner_units` tables from scratch). This only affects
  generated demo data, never real records, since no real backend database existed before this
  phase (the backend was never connected to real users).
- **Assumption, flagged**: when a claimed owner's approval is granted, the claimant gets a
  relationship on the specific unit they requested — the admin-approval screen doesn't let the
  admin choose a different one. This matches the spec's wording ("follow existing admin-approval
  rules") applied to the new relationship model; adjust `POST /api/admin/owner-transfers/:id/
  approve` if the real policy differs.
- **Manager Reports are intentionally not built** — only the data shape supports them later, per
  the spec's explicit "do not fully implement this now."

## 4. Exact run commands

### Frontend (the app you've been reviewing)
```bash
cd new-avenue-1-frontend
npm install
npm start
```
Open the printed `http://localhost:3000` link. No environment variables required. Daily Reports
begin 2026-11-01 — before that date the page shows a "begins 2026-11-01" notice; use the on-page
"Preview the module" button (sets an in-memory simulated date, nothing persisted) to try it early.

### Backend
```bash
cd na1-backend
npm install
cp .env.example .env        # set JWT_SECRET to a long random string before any real deployment
npm run seed                 # creates ./data/new-avenue-1.sqlite with demo accounts + owners/relationships
npm run dev                  # http://localhost:4000
```
Demo login: any seeded email (e.g. `s1@newavenue.demo`) + password `Demo123!`. Required env vars:
`JWT_SECRET` (required, no fallback), `PORT` (default 4000), `JWT_EXPIRES_IN` (default `12h`),
`DB_PATH` (default `./data/new-avenue-1.sqlite`).
