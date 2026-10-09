# New Avenue 1 — Frontend Prototype

This is the complete, working front-end prototype for **New Avenue 1**, the internal sales
platform for New Avenue Real Estate Consultancy. It's the exact same application you already
reviewed — nothing in the design, layout, or functionality has been changed. The only thing
that changed is *how the files are organized*: the original single HTML file has been split
into clearly named files (pages, styling, data, icons) so it's easy for a developer to open,
navigate, and extend.

**No framework, no build tools, no external packages are required to run this.** It's plain
HTML, CSS, and JavaScript, plus one tiny local server script (also plain JavaScript) so you
can open it on your laptop and your phone at the same time.

---

## 1. What you need installed

- **Node.js** (version 16 or newer) — this is the *only* requirement, and it's only needed to
  run the local server / LAN access. If you don't have it: go to **https://nodejs.org**, download
  the "LTS" version, and install it like any other program (Next → Next → Finish).
- Any modern web browser (Chrome, Safari, Edge, Firefox) on your laptop and/or phone.
- No internet connection is required to run the app itself. (The two fonts — Fraunces and
  Manrope — load from Google Fonts if you're online; if you're offline, the app automatically
  falls back to your system's default fonts and looks almost identical.)

You do **not** need to know how to code to follow the steps below.

---

## 2. Install — exact commands

Open a terminal (Mac: "Terminal" app · Windows: "Command Prompt" or "PowerShell") and go into
the folder you unzipped, then run:

```bash
cd new-avenue-1-frontend
npm install
```

`npm install` will finish almost instantly and print no warnings — this project has **zero
external dependencies**, so there is nothing to download. This step just confirms Node.js is
installed correctly.

---

## 3. Run it locally

```bash
npm start
```

You'll see something like this in the terminal:

```
  New Avenue 1 is running.
  --------------------------------------------
  On this computer:   http://localhost:3000
  On your phone:      http://192.168.1.23:3000
  (phone must be on the same Wi-Fi network as this computer)
  --------------------------------------------
  Press Ctrl+C to stop the server.
```

- **On your laptop:** open the `http://localhost:3000` link in your browser.
- **On your phone (iPhone or Android):** connect your phone to the **same Wi-Fi network** as
  your laptop, then open the `http://192.168.1.23:3000`-style address shown in your terminal
  (the actual numbers will be different — always use whatever your terminal prints). That's it;
  no app store, no install on the phone.

To stop the server, click back into the terminal and press `Ctrl + C`.

> **Didn't want to install Node.js at all?** You can also just double-click `index.html` inside
> the folder to open the app straight in your browser. This works for trying it out on one
> computer, but your phone won't be able to reach it this way, and a couple of address-bar
> conveniences (like the "open in new tab" links) behave slightly better when served properly —
> so `npm start` is the recommended way for anything beyond a quick look.

---

## 4. Build the production version

```bash
npm run build
```

This app has no compiler/bundler step — the source files *are* the production files. Running
`npm run build` simply collects everything needed (`index.html`, `css/`, `js/`) into a clean
`dist/` folder, ready to upload anywhere. After building, `npm start` will automatically serve
`dist/` instead of the source folder if it exists.

---

## 5. Put it on the internet (a real shareable URL)

If you want a link you can send to anyone — not just people on your Wi-Fi — the easiest options
for a static site like this one are:

1. **Netlify Drop** (no account needed): run `npm run build`, then go to
   **https://app.netlify.com/drop** in your browser and drag the `dist` folder onto the page.
   You'll get a public `https://…netlify.app` link in about 10 seconds.
2. **Vercel** or **GitHub Pages**: both also host static sites for free; a developer can connect
   this folder to either in a few minutes.
3. You already have a hosted, shareable version of this exact prototype from our earlier work
   together — ask me for that link again any time if you've misplaced it.

Because there's no backend/database involved in this package, any static host works — nothing
to configure beyond uploading the `dist` folder.

---

## 6. Is it responsive on phones? (iPhone / Android / laptop)

Yes — this was built mobile-first from the start, and that hasn't changed:

- Under ~880px width (any phone, and most tablets in portrait), the left sidebar automatically
  becomes a bottom tab bar, and pages reflow to a single column.
- Above that width (laptops, tablets in landscape, desktops), you get the full sidebar +
  multi-column layout.
- It works the same in Safari on iPhone, Chrome on Android, and any desktop browser — there's
  nothing to configure. Just open the URL from step 3 on each device.
- Tip: on an iPhone (Safari) or Android (Chrome), you can use **"Add to Home Screen"** from the
  browser's share/menu button so it opens like a regular app icon.

---

## 7. Where your data lives / resetting it

All the demo data (leads, units, owners, requests, etc.) is generated the first time the app
loads and then saved in your **browser's local storage** — not on a server. That means:

- Data persists between visits on the *same browser, same device*.
- Each device/browser you open it on gets its own independent copy of the data.
- To wipe everything back to the original demo state, go to **Profile → Reset demo data**
  inside the app.

---

## 8. Project structure

```
new-avenue-1-frontend/
├── index.html              # The app shell — loads all CSS/JS below, in order
├── package.json            # npm scripts (start, build) — zero dependencies
├── server.js               # Local static server (also detects your phone-accessible LAN address)
├── build.js                # Assembles the production dist/ folder
├── css/
│   └── styles.css          # All visual styling (design tokens, layout, components)
├── js/
│   ├── data.js             # Data model, demo/mock data generator, persistence (localStorage)
│   ├── icons.js            # Inline SVG icon set used throughout the UI
│   ├── session.js          # Login session, navigation state, role/team visibility helpers
│   ├── shell.js            # App shell: login screen, sidebar/topbar, page router
│   ├── app.js              # One-line bootstrap that starts the app
│   └── pages/              # One file per screen — this is the "pages/screens" of the app
│       ├── dashboard.js
│       ├── leads.js        # Phase 2 / inactive — kept but unreachable from navigation (see below)
│       ├── inventory.js    # "News Feed" / inventory search
│       ├── myunits.js
│       ├── requests.js
│       ├── owners.js       # real Owner<->Unit relationships (not a bare "units" count)
│       ├── dailyreport.js  # NEW: Daily Performance Report + Monthly Reports
│       ├── reference.js
│       ├── notifications.js
│       ├── admin.js
│       └── profile.js
├── assets/                 # Reserved for real photos later (see assets/README.txt)
└── README.md                # This file
```

**Note on "components":** this prototype is plain HTML/CSS/JavaScript (no React/Vue/etc.), so
there isn't a separate component framework — each file in `js/pages/` is a self-contained
screen that builds its own HTML and wires up its own buttons. This mirrors exactly how the app
already worked; a developer converting this into React or another framework later can use each
`js/pages/*.js` file as the spec for one component/page.

---

## 9. Handing this to a developer

Everything a developer needs is in this ZIP — there's no separate design file, no missing
assets, and no hidden configuration. A few notes that will save them time:

- All demo/mock data is generated in `js/data.js` (functions named `build...`), using a seeded
  random generator so the same demo data appears every time storage is cleared. Storage is
  versioned (`meta.version`, currently `3`); bumping it regenerates fresh demo data rather than
  migrating the previous shape, since this is seeded/demo data, not real records.
- **An Owner now exists independently of any Unit.** `DB.owners` holds the contact itself
  (`name`, normalized `phone`/`phone2`, `salespersonId` = the salesperson who created/"owns" this
  contact, `sharedWith` = other salespeople admin-approved onto the same contact) and can have
  **zero** linked units. `DB.ownerUnits` is the separate owner↔unit link — one row per
  (owner, unit, salesperson), each with its own 30-day update cycle
  (`lastUpdateAt`/`nextUpdateAt`/`reminderAt`) and `status`. One owner can have unlimited linked
  units. The 30-cap counts **distinct owners** per salesperson
  (`distinctOwnerCountForSalesperson` → `ownersForSalesperson`), including owners with zero units.
  See `js/pages/owners.js`: "Add owner" takes only name + phone (no unit), "Add unit" links a unit
  to an existing owner afterward, and "Edit owner" changes the contact's own details. Creating an
  owner whose phone matches one that already exists elsewhere either silently reuses it (already
  yours) or raises an admin-approved "claim" (`DB.transfers`, `type:'claim'`, `unitId:null`) that
  grants shared access via `owner.sharedWith` rather than ever duplicating the owner record — see
  the `[data-approvetransfer]` handler in `js/pages/admin.js`.
- **Every management role is also personally a salesperson — role never removes personal sales
  activity.** `isSalesActive(u)` (`js/data.js`) is `true` for `salesperson` and every role in
  `MGMT_ROLES` (`teamleader`, `manager`, `director`, `headofsales`, `ceo`); only `ADMIN_ROLES`
  (`junioradmin`, `senioradmin`, `headadmin`) are excluded. Demo data generation
  (`buildUnits`/`buildLeads`/`buildOwnersAndRelationships`/`buildReferenceDict`) uses this
  predicate everywhere a "who personally sells" filter is needed, so team-assigned managers get
  their own Owners/Units/Leads/Reference entries, not just downline visibility.
- **Personal ("My") vs Team data is a hard split, never merged.** `js/session.js` defines
  symmetric pairs for every domain — `myOwners`/`teamOwners`, `myUnits`/`teamUnits`,
  `myLeads`/`teamLeads` — where `team*(u)` is always computed from `downlineIds(u)`
  (`getDownlineIds`, which never includes `u` itself) and explicitly excludes anything already in
  `my*(u)`. The Owners, My Units and Daily Reports pages each render a `.scope-tabs` toggle
  (`session._ownersScope` / `_unitsScope` / `_reportView`) for management users so "My X" and
  "Team X" are visually distinct, separately counted lists — never one combined table. A
  management user's own Daily Report (`getOrCreateDailyReport(u.id, date)`) is likewise entirely
  separate from their downline's report statuses (`renderTeamReportsView` in
  `js/pages/dailyreport.js`), which only ever reads, never writes, the downline's own reports.
- **Reference (`js/pages/reference.js`) is a salesperson contact directory**, not a
  project/compound sheet. `buildReferenceDict` (`js/data.js`) gives every sales-active,
  team-assigned user (per `isSalesActive`) one entry with a reference code, role, manager/team
  relationship, and **separate** `phone`/`whatsapp` fields (they may differ). The page is
  searchable by name or code (`session._refSearch`) and every entry renders real `tel:`/`wa.me`
  action buttons (`telHref`/`waHref`, also reused by the Unit-detail modal's Call/WhatsApp
  buttons in `inventory.js`) rather than plain text. Editing a contact's phone/WhatsApp
  (`openEditRefModal`) is gated to the user themself or a Senior/Head Admin.
- **Mobile keeps full functionality — nothing is hidden.** `MOBILE_TABS` in `js/session.js` is a
  fixed 4-slot bottom bar (`dashboard`, `owners`, `myunits`, `reference` — the three explicitly
  protected sections plus Dashboard); every other nav item (Daily Reports, Notifications, Admin,
  Leads if enabled, Profile) is one tap away in the "More" drawer (`renderMoreTab`/
  `renderMoreDrawer` in `js/shell.js`, `mobileMoreItems`/`mobileMoreBadgeTotal` in
  `js/session.js`). This is additive, not a reduced feature set — every `navItems(u)` entry is
  reachable from mobile for every role.
- **The Unit property sheet / PDF export was redesigned** (`unitSheetHTML`/`UNIT_SHEET_CSS` in
  `js/pages/inventory.js`) as a branded, self-contained HTML+CSS template (header, hero, photo
  strip, spec tiles, pricing band, agent contact footer pulling real phone/WhatsApp from
  `DB.refs`, legal disclaimer) — used both for the in-app preview modal and the `window.open('')`
  print/PDF popup, plus a "Share on WhatsApp" button.
- **Daily Performance Report** (`js/pages/dailyreport.js`) launches 2026-11-01 with zero historical
  data. `getOrCreateDailyReport(spId, date)` is the single choke point that guarantees one report
  per salesperson per date; exactly 11 metrics, `0` valid, `null` = missing, both tracked
  separately (`isFieldFilled`). Monthly totals (`monthlyTotals`) are always computed live from
  `DB.dailyReports`, never stored. The previous-day-incomplete notification reuses the existing
  `notify()`/notifications page and deep-links via `notification.meta.date`.
- **Leads is Phase 2 / inactive**: `LEADS_MODULE_ENABLED = false` in `js/data.js` keeps `leads.js`,
  its data model, and its notifications code in place but unreachable from navigation and silent —
  flip the flag back on when Leads re-launches; no other file needs to change.
- Business rules that must **not** be relaxed if this becomes a real production app: the 30-DISTINCT-
  owner cap (counting owners with zero units too), the personal/team data separation described
  above, popularity de-duplication (one user can't inflate a unit's ranking), the personal
  per-user request read position, and one Daily Report per salesperson per date — all enforced
  client-side here; a production backend needs to re-implement the same Owner↔Unit model (owner
  contact separate from its unit links, with `sharedWith` for admin-approved claims) and the same
  `isSalesActive` rule server-side, not just the previous owner-count check (see
  `na1-backend/README.md`, which predates this round of frontend changes and should be reviewed
  against them before going to production).
- The files load as classic (non-module) scripts and intentionally share one global scope —
  this was a deliberate choice to keep the split mechanical and risk-free (no behavior change
  from the reviewed version). A developer modernizing this later may want to convert it to ES
  modules or a framework; that's a rewrite decision, not something this package assumes for you.

---

## 10. Troubleshooting

| Problem | Fix |
|---|---|
| `npm: command not found` | Node.js isn't installed yet — see step 1. |
| Phone can't open the LAN address | Make sure the phone and laptop are on the *same* Wi-Fi network (not phone data), and that your laptop's firewall allows incoming connections on the port shown. |
| Port 3000 already in use | Run `PORT=3001 npm start` (Mac/Linux) or `set PORT=3001 && npm start` (Windows), then use that port instead. |
| Fonts look slightly different | You're likely offline — the app falls back to system fonts automatically; everything still works. |
| Want to start over with fresh demo data | Open the app → Profile → "Reset demo data". |

---

*This package was produced directly from the reviewed prototype. Before packaging, every page
was run through an automated check (all 18 demo accounts × all 10 screens) to confirm the
split files behave identically to the original single-file version — no design or functionality
was changed.*

---

## 11. What was tested in this round of changes (owner/management/reference/PDF/mobile rework)

Every `.js` file passes `node --check` (syntax validity) after these changes. Beyond that, the
data-model and business-logic layer (`data.js` + `session.js` + the page modules' non-DOM logic)
was exercised with a Node-based test harness (loading the real source with `vm.runInThisContext`
and real demo data from `buildDemoData()`), not just read over by eye. 55 assertions passed, 0
failed, covering:

- Owners can exist with zero linked units, and `distinctOwnerCountForSalesperson` counts them.
- Every management role is sales-active (`isSalesActive`); admin roles are not.
- "My" and "Team" never overlap, for Owners, Units and Leads, across every management role.
- Every management user with a downline also has personal data of their own (role ≠ sales
  activity holds in the generated demo data, not just in the code path).
- The Reference directory's entry count matches the expected sales-active+team user set; search
  by name and by code both filter correctly; every entry renders a working `tel:`/`wa.me` link.
- `telHref`/`waHref` produce correctly formatted links; the Add-Owner duplicate-detection flow
  correctly re-finds an existing owner from a freshly-typed local-format phone number.
- The redesigned PDF/property sheet (`unitSheetHTML`) renders without throwing, includes the
  real salesperson contact pulled from `DB.refs` (not a placeholder), and degrades gracefully
  when no salesperson is attached to a unit.
- Every mobile `MOBILE_TABS`/`mobileMoreItems` combination reaches every `navItems()` entry, for
  every role — nothing is unreachable on mobile.
- The Daily Report "Team Reports" view never includes the manager's own name/report, and the
  manager's own Daily Report view is unaffected by switching into Team view.

**One real bug was found and fixed by this testing**, not caught by `node --check`: demo Owner
phone numbers were generated in a malformed "canonical" format (`buildOwnersAndRelationships`'s
`freshPhone()` used `'2001'+...` instead of `'201'+...`, producing 13-digit values instead of the
12-digit canonical format `normalizeEgyptPhone` actually produces/expects). This silently broke
two things: the Owner card's phone display (`ownerPhoneDisplay`) rendered a garbled
`00XXXXXXXXXX` string instead of a clean local number, and — more importantly — the Add-Owner
duplicate/claim-detection logic could never match an existing owner by phone, since the malformed
stored value could never be reproduced by re-normalizing a correctly-typed phone number. Fixed in
`js/data.js`; confirmed by the test harness above (owner phone values now round-trip cleanly
through `normalizeEgyptPhone`/`phoneLocalDisplay`, and duplicate-detection now finds existing
owners correctly).

**What was *not* independently verified** (honestly flagged, not claimed as tested): actual
clicking-through in a real browser — opening the mobile "More" drawer, visually inspecting the
PDF sheet's layout/spacing, clicking a Call/WhatsApp button to confirm the OS actually opens the
dialer/WhatsApp, and the responsive CSS at various breakpoints. The test harness above runs the
real application logic headlessly in Node (not a simulation of it), so the *data and business
rules* are verified against the actual source; the *visual/interactive* layer still benefits from
a pass in an actual browser on desktop and mobile before this goes in front of real users.

---

## 12. This round's changes (mobile nav polish, login redesign, financial filters, full sales‑user management, department switching, simplified management Daily Report)

This round built directly on top of everything in §§1–11 above — nothing described there was
removed, rebuilt, or had its behavior changed except where explicitly noted below (the mobile tab
set and the management Daily Report format). All business rules from the previous round (Owner
independent of Unit, My/Team separation, Reference directory, PDF export, admin hierarchy) are
still in force and were re-verified, not just assumed.

### What changed

- **Mobile navigation — same structure, cleaner implementation.** The primary bottom bar is now
  **Dashboard / News Feed (Inventory) / Requests / Reference**, with every other section (Owners,
  My Units, Leads if enabled, Daily Reports, Notifications, Profile, Admin when authorized) one
  tap away in the "More" drawer — this is a deliberate change from the *previous* round's tab set
  (`dashboard`/`owners`/`myunits`/`reference`), per this round's explicit spec. `MOBILE_TABS` in
  `js/session.js` is still the single source of truth, and `mobileMoreItems`/`navItems` guarantee
  every item is reachable from mobile for every role — nothing lost, just re-grouped. The tab bar
  markup/CSS (`.mtab`, `.mtab-icon-wrap` in `css/styles.css`) was redone for consistent icon
  sizing, spacing, active-state pill, badge placement and a 360px breakpoint so nothing overlaps
  or clips on narrow phones.
- **Sign-in screen redesign.** `renderLogin()`/`attachLoginEvents()` in `js/shell.js` (plus a new
  CSS block in `css/styles.css`) replace the previous plain card with a split-pane layout: a
  branded left panel (logo, tagline, a few stat callouts) and a right-hand sign-in panel with a
  searchable account list grouped by role, clear visual hierarchy, and a brief loading transition
  on sign-in. **The actual login mechanism is unchanged** — `setUser()` and the `sessionStorage`
  session are exactly what they were; this is a visual/UX redesign only, not a new auth system,
  and nothing here claims to add real security.
- **Inventory filters expanded.** Down Payment and Total Price are now real min/max range filters
  (`session.invFilters.dpMin/dpMax/totalMin/totalMax` in `js/session.js`), reading the same
  `downPayment`/`totalPrice` fields already on each unit — no new data shape. Bedroom and bathroom
  filters now offer every value the demo data actually contains, plus a "N or more" bucket
  (`matchesCountFilter` in `js/pages/inventory.js`, driven by a `'6+'`/`'5+'`-style option value)
  instead of being capped at a few fixed checkboxes. All filters (new and pre-existing: compound,
  phase, area, unit type, category, sale/rent, finishing, delivery) combine with AND logic, each
  has its own clear control, and a "Reset Filters" action clears everything at once
  (`blankInvFilters()` in `js/session.js`). On mobile the filter panel is a scrollable
  non-overflowing panel (`.filter-panel` CSS), not a layout that pushes off-screen.
- **Head Admin / Senior Admin: full sales-user management.** `js/pages/admin.js`'s Users tab now
  has a search box, a role filter, and — for Senior/Head Admin only (`canManageUsers(u)`, new in
  `js/data.js`) — an "Add sales user" button and a "Manage" button per row opening a real edit
  modal (`openUserAdminModal`): name, role, department/team, "reports to" manager, and reference
  code/phone/WhatsApp. Junior Admin still sees the directory but it's read-only, consistent with
  the existing admin hierarchy. Role, team and manager changes go through a confirmation summary
  (`confirm()`) before saving, and a user can never edit their own role/team/manager through this
  screen (those three fields are disabled whenever the target *is* the logged-in admin) — ordinary
  profile editing was already separate from this and remains so.
- **Reference directory no longer goes stale after an edit.** This was the architectural fix that
  makes the above safe: `DB.refs` entries now store only `{team, userId, code, phone, whatsapp}` —
  name, role and manager are resolved **live** from `DB.users` via two new helpers, `refUser(r)`
  and `refManager(r)`, everywhere the Reference page, its search, and its edit modal need them.
  Previously these were denormalized copies that an admin edit could leave outdated; now there is
  nothing to go stale. `syncRefForUser(user)` is the single function that creates, removes, or
  re-teams a user's reference entry whenever their role or department changes, called from every
  place a role/department change can happen.
- **Employee department (Residential/Commercial) switching — admin-only, not a everyday feature.**
  The same admin edit modal above includes a department field, used only when a Senior/Head Admin
  is editing someone else; it requires the same confirmation step as a role change, and
  `syncRefForUser` keeps that person's Reference entry and team-scoped visibility consistent with
  the new department afterward. This is not exposed anywhere in the ordinary Profile screen or as
  a prominent action — it only exists inside administrative user editing, per the spec's explicit
  instruction not to build an everyday department-switcher.
- **Simplified Daily Report for management roles.** Team Leader, Sales Manager, Supervisor/
  Director, Sales Director/Head of Sales and CEO now fill out a **two-field** personal report —
  Daily Comments and Daily Activities, both free text — instead of the 11-field salesperson form.
  This is a new, separate collection, `DB.mgmtReports` (one row per manager per date; `js/data.js`:
  `getMgmtReport`/`getOrCreateMgmtReport`/`saveMgmtReport`/`mgmtReportsForUser`), not a reduced
  version of the salesperson report — the two never mix. `js/pages/dailyreport.js`'s
  `renderSimpleMgmtView` renders the two-field form plus a history list of that manager's own past
  reports (editable for the same day, consistent with how the salesperson report already allowed
  same-day edits). Regular salespeople's report is completely unchanged — still the full 11-field
  form.
- **Personal vs. team reports stay separate for management, in the new format too.**
  `renderTeamReportsView` now splits a manager's downline into salespeople (viewed via the
  existing detailed per-metric table) and other managers below them (viewed via a "Management
  team — personal reports" section reading `DB.mgmtReports`) — a Sales Manager's downline often
  contains Team Leaders, who are themselves managers with the simplified report format, so both
  shapes needed their own correctly-sourced view. A manager's own report is never shown inside
  their team view, exactly as before.
- **One routing bug class fixed proactively, before any test ran:** every place that shows "has
  this person filed today's report yet" (`js/session.js`'s nav badge, `js/pages/dashboard.js`'s
  banner and team-overview table) used to call `reportStatusOf`, which only ever looks at
  `DB.dailyReports` — which a management user no longer writes to. Caught during code review and
  fixed by routing all three call-sites through a new `personalReportStatus(user, ds)` that
  branches by `isMgmt(user)` to read the correct collection.

### What was tested, and how

Four new Node-based harnesses (same approach as §11 — the real source files loaded with
`vm.runInThisContext` against real `buildDemoData()`-generated data, not a simulation) plus one
more written during final regression: **62 assertions passed, 0 failed.** Specifically:

- **Inventory filters** (18 assertions): Down Payment and Total Price min/max actually narrow the
  visible unit list to units whose price falls in range (and back out again when cleared); every
  bedroom/bathroom "N or more" bucket matches correctly at the boundary; filters combine with AND
  logic across financial + bedroom/bathroom + pre-existing filters simultaneously;
  `blankInvFilters()`/the Reset action clears every filter key back to empty.
- **Admin user management — direct function + end-to-end through a real DOM-driven modal**
  (15 + 17 = 32 assertions): `canManageUsers` correctly gates Junior Admin out and Senior/Head
  Admin in; a role change via the real `openUserAdminModal` save flow updates `DB.users` and
  triggers `syncRefForUser` correctly (ref created when newly sales-active, removed when no longer
  sales-active, re-teamed when the department changes); the self-edit lock actually disables the
  role/team/manager controls when an admin opens their own record, and a save in that state cannot
  change their own role; promoting a non-sales user into a sales role live-enables the reference
  fields and *requires* them before the save is accepted (this closes a bug found during this
  round's own code review — see below); `possibleManagersFor` never offers a user's own downline
  as a valid "reports to" choice (would create a reporting cycle); adding a brand-new sales user
  end-to-end creates exactly one `DB.users` row and one matching `DB.refs` row with the
  admin-entered phone/WhatsApp.
- **Simplified management Daily Report + personal/team separation** (part of the 18, plus
  additional direct checks): `getOrCreateMgmtReport` never creates a second row for the same
  manager+date; `saveMgmtReport` updates in place on a same-day re-save; `personalReportStatus`
  correctly reports a management user's status from `DB.mgmtReports` (not `DB.dailyReports`) and a
  salesperson's from `DB.dailyReports`; a manager's own report never appears inside their team
  view, and a mixed downline (salespeople + sub-managers) is split into the correct two sections
  reading the correct collection for each.
- **Login screen + mobile shell** (8 assertions): the account list used by the login screen
  includes every seeded demo user across all groups; `MOBILE_TABS` is exactly the new
  spec-required set (`dashboard`, `inventory`, `requests`, `reference`); every `navItems()` entry
  for every role is reachable either directly on mobile or via `mobileMoreItems`; the login
  mechanism itself (`setUser`) is untouched and still sets the session correctly.
- **Reference directory search, re-verified against the refactored `DB.refs` shape**
  (4 assertions, run last, specifically because the shape changed this round): searching by a
  user's name and by their reference code both still find the right entry when name/role are
  resolved live via `refUser`/`refManager` instead of from stored fields; a no-match search still
  shows the correct empty state.
- **Full regression re-run of every harness from the previous round** (§11's 55 assertions, across
  6 harness files): **all still pass except 3 assertions that fail for an expected reason, not a
  regression** — two assertions in the old mobile-nav harness check that `MOBILE_TABS` contains
  `owners`/`myunits`, which this round intentionally changed (see above); one assertion in the old
  Daily Report harness checks that a management user's own report view contains the
  11-field salesperson inputs, which this round intentionally replaced with the 2-field form; and
  one old harness (testing the pre-refactor `DB.refs[].name` field directly) throws immediately
  because that field no longer exists by design — superseded by the new Reference-search
  regression test above, which exercises the same behavior against the current shape. None of
  these three represent an application bug; they are old assertions written against behavior this
  round's own spec explicitly asked to change.
- **One real bug found and fixed by this round's own testing, before being reported as working**:
  `openUserAdminModal`'s reference-code/phone/WhatsApp fields were disabled based on whether a
  `DB.refs` row already existed *when the modal opened*, not on the role/department currently
  selected in the form — so promoting someone into a sales role left those fields locked in the
  same save, forcing a second trip into the modal just to fill them in. Fixed by making field
  enable/disable track the live-selected role+team (`syncApplicability()`, wired to both selects'
  `change` events) and changing the save-time validation to require those fields whenever the
  *about-to-be-saved* role+team would make the person sales-active, not whether a ref happened to
  already exist.
- **`node --check` syntax sweep**: every file under `js/` passes with zero failures, run fresh
  after the final edits in this round (not just mid-edit on individual files).

### What was *not* independently verified this round (same honest caveat as §11)

Actual clicking-through in a real browser — the redesigned login screen's visual polish and
loading transition, the admin "Manage user" modal's on-screen layout and confirmation dialog
wording, the inventory filter panel's mobile scroll behavior, and the mobile "More" drawer with
the new tab set — was not performed in this sandbox (no graphical browser available here). Every
test above runs the real application source and real generated demo data headlessly in Node, so
the underlying logic, data mutations, and routing are verified against the actual code, not a
description of it; a pass through an actual desktop and mobile browser remains worthwhile before
this goes in front of real users, and is the one item in the spec's 19-item testing checklist that
could not be executed from here (see the delivery summary for the full item-by-item mapping).

---

## 13. Automatic duplicate-owner detection (live phone-match warning)

Added directly on top of the existing "Add owner" / "Edit owner" flows in `js/pages/owners.js` —
nothing about Owner creation, the 30-owner cap, the existing admin-approved claim flow, or the
Add-unit-to-owner workflow was removed or changed in behavior; this adds a live check and a richer
warning in front of the same save logic that was already there.

### What it does

- **Detects as you type.** Both phone fields in "Add owner" (and the phone field in "Edit owner")
  run a live check on every keystroke (`findDuplicateOwnerByRawPhone` in `js/data.js`) — the same
  normalization (`normalizeEgyptPhone`) and the same team-scoped match (`findOwnerByCanonicalPhone`)
  already used at save-time, just run earlier and shown inline instead of only discovered after
  clicking Save. Spaces/dashes typed in are stripped the same way the field already stripped them;
  local (`01XXXXXXXXX`) and international (`20XXXXXXXXXXX`) forms of the same number both match.
- **Shows full context, not just "duplicate found."** `ownerDuplicateContext()` (`js/data.js`)
  resolves the matching owner's name/phone, the responsible salesperson's name and Reference code
  (pulled live from `DB.refs`/`refUser`, never stale), and every unit currently linked to that
  owner (compound, phase, unit type, area, sale/rent, pending-review status) — rendered by
  `renderOwnerDupWarning()` in `js/pages/owners.js`. "Unit number" from the spec's example isn't a
  field this data model has, so it's honestly left out rather than invented.
- **Responsible-salesperson contact, one tap away.** When the matched salesperson has a Reference
  entry, the warning includes working Call (`tel:`) and WhatsApp (`wa.me`) buttons for them,
  reusing the same `telHref`/`waHref` helpers as the Reference directory — this is not new
  exposure, since that same contact info is already visible to the whole team via Reference.
- **Duplicate creation is prevented, not just discouraged.** The Save button is disabled the
  moment a match held by someone else is detected (and the save handler itself also refuses, as a
  second line of defense in case Save is still triggered directly). The only two ways past a
  detected duplicate are: (1) **Request access** — sends the existing admin-approved "claim"
  request (unchanged mechanism, `DB.transfers` with `type:'claim'`), never creates a second owner
  record; or (2) for **Senior/Head Admin only** (`canManageUsers(u)`), an explicit **"Create
  separate record anyway"** override that requires typing a reason and confirming a dialog before
  it creates a genuinely separate `DB.owners` row (tagged `duplicateOverride:{of, reason, by, at}`
  and logged via `log()`) — satisfying the spec's "explicit, authorized workflow with a clear
  reason and appropriate confirmation," never a silent duplicate.
- **A match that's already your own owner is informational, not a blocker.** If the matched owner
  is already in the current user's own list, the warning becomes a plain green "Already in your
  list" notice and Save still works exactly as before (reuses the existing owner, as it already
  did pre-this-round).
- **Permission-aware.** The matched salesperson's team/manager line is shown only to the record's
  own holder, admins, and management roles (`isAdmin`/`isMgmt`) — an ordinary salesperson sees who
  holds the owner and their units (needed to avoid duplicate work) but not their reporting
  hierarchy. Everything is still scoped to the viewer's own team the same way Owners always were
  (`findOwnerByCanonicalPhone` takes the team into account), so this never surfaces another team's
  data.
- **Edit Owner gets the same live check**, in a read-only form: changing an owner's phone to match
  a *different* owner record shows the same warning (no action buttons — there's no sensible
  "claim" or "override" for an in-place edit that would otherwise merge two owner records) and
  blocks Save, which is a stricter version of the clash check that already existed there.
- **Where else a phone attaches to a record**: this application only ever captures a phone number
  in the Owner workflow (Add Owner / Edit Owner) — Unit creation and "Add unit to an existing
  owner" never ask for a phone number (a Unit is linked to an already-created Owner by picking it
  from a list). So those are the only two places this check needed to be added; there is no
  separate "new Unit with a phone" entry point to extend it to.

### What was tested, and how

A new Node harness (same approach as §§11–12 — real source loaded with `vm.runInThisContext`
against real `buildDemoData()`-generated data, this time driven through a DOM shim extended to
support dynamic `innerHTML` writes so the live-typing warning box could be exercised exactly as a
real browser would run it): **32 assertions passed, 0 failed**, covering the spec's 8 test
scenarios by name:

1. A completely new phone number shows no warning and leaves Save enabled.
2. An existing phone number shows the full "Existing Owner Found" warning with the correct owner.
3. The same number typed with different formatting (stripped spaces/dashes, and separately the
   international form) both still match after normalization.
4. The responsible salesperson's name and Reference code are displayed correctly.
5. Every unit associated with the matching owner is listed with its real details.
6. Duplicate creation is prevented: clicking Save while a hostile match is showing creates no new
   owner; "Request access" creates a claim (not a duplicate); the admin override requires a reason
   and a confirmation dialog before creating a separate record, and is never offered to a
   non-admin.
7. Personal/team visibility rules are respected: an ordinary salesperson doesn't see the matched
   person's manager/team line, an admin does, and viewing your own already-existing owner shows
   the non-blocking "already in your list" notice instead.
8. Existing Owner creation (a genuinely new owner) and the multi-unit "Add unit to owner" workflow
   both still work exactly as before, untouched by this change — plus the Edit Owner read-only
   variant of the same live check.

Full regression: all 94 assertions across every harness from this round and the previous one
(§§11–12) were re-run together after this change — all still pass (aside from the 3 old,
intentionally-superseded assertions already explained in §12). `node --check` passes on every file
under `js/`, run fresh after these edits.

### What was *not* independently verified

Same caveat as §§11–12: no graphical browser was available in this sandbox, so the actual visual
appearance of the warning card, the live feel of typing into the phone field, and tapping the
Call/WhatsApp buttons to confirm the OS opens the dialer/WhatsApp were not clicked through by hand.
The DOM-shim-driven test above exercises the real rendering function and the real event-handling
code path (not a mock of it), so the logic is verified against the actual source; a real-browser
pass is still worth doing before this goes in front of real users.

---
