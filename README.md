# New Avenue: Frontend-only Vercel demo (features round)

This ZIP holds **only the website** (`new-avenue-1-frontend/`). It runs on your existing static Vercel demo with **no backend, no database, no real company data and no secrets**: Frontend Demo Mode uses built-in *fake* sample data and never contacts a server.

## What is (and is not) in the demo
- **New and visible in the demo:** *Reply* on every request in the Requests feed (works on phones; kept in your browser tab only, nothing is saved or sent anywhere).
- **Deliberately NOT in the demo:** user deactivation, forced password change, activation codes, CSV imports (users / units / owners), the owner-limit setting and admin-created owners. They need the real backend, so the demo hides them (there is no *Data Import* or *Settings* tab, and the import code is not even included in this ZIP). Nobody can load real records into the demo.
- Those features are in the **Localhost ZIP** (`USER_AND_DATA_IMPORT_GUIDE.md` there explains them).

## Update your existing GitHub repository (and Vercel demo)
`js/app-mode.js` in your repository already says `'demo'`. **Do not change or re-upload it.** (The copy in this ZIP is also `'demo'`.)

Upload these **10 files** into the same places in your repository (replace the old ones):

| # | File |
|---|---|
| 1 | `js/api.js` |
| 2 | `js/app.js` |
| 3 | `js/data.js` |
| 4 | `js/demo-mode.js` (adds replies to the demo) |
| 5 | `js/shell.js` |
| 6 | `js/sync.js` |
| 7 | `js/pages/admin.js` |
| 8 | `js/pages/dashboard.js` |
| 9 | `js/pages/owners.js` |
| 10 | `js/pages/requests.js` (Reply button) |

`index.html` is unchanged (do not add anything to it). Vercel publishes automatically within about a minute.

## Check it
1. Refresh with Ctrl + Shift + R (Cmd + Shift + R on Mac). The sign-in page still shows **Frontend Demo Mode** and the account list; there is no password form and no "Activate your account" link.
2. Sign in as any demo account → **Requests** → tap **Reply** under a request, type, press Enter: the reply appears. Reload the page: it is gone (demo only).
3. Sign in as *Laila Mansour (Head Admin)* → Admin: tabs are Users, Pending Units, Owner Transfers, Audit Log, … (no Data Import / Settings).

## Safety notes
- Demo Mode never contacts a server and can't reach or change real data. Real sign-in is a separate mode, switched only by `js/app-mode.js` (`'full'`).
- This ZIP contains no backend, database, `.env` file, passwords or keys.

## What was tested for this ZIP (Chromium, executed)
Demo-mode test suite 63/63, Grid/List + dashboard 39/39, new `test-demo-new-features` 8/8 (no import/settings UI, import code absent, nothing sent to any API, replies work). Not tested: Vercel itself (nothing was deployed), Safari/Firefox, real phones.
