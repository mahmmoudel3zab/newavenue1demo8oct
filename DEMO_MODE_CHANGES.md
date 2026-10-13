# Frontend Demo Mode: change notes

## Why
The themed frontend signs in through the backend API. The public Vercel demo is a static site with no backend, so sign-in failed there.

## Design
- **Explicit switch, no detection or fallback.** `js/app-mode.js` sets `window.NA1_APP_MODE` to `'demo'` or `'full'`. If the file is missing or the value is unset, the app runs in **Full Application Mode**. An unknown value also runs Full mode and shows a warning. If a backend is unreachable in Full mode, the app shows "Could not reach the server" and never switches to demo data.
- **Separation.** `js/demo-mode.js` returns immediately unless the mode is `'demo'`. In demo mode it replaces `window.NA1_API` with an in-browser stand-in built from the app's existing sample data (`buildDemoData()` in `js/data.js`):
  - It answers the same endpoints, in the same response shapes, that the pages already use.
  - It never calls `fetch` or any network API, so it cannot reach or unlock real data.
  - It keeps its session under its own key (`na1_demo_session`), never the real token key (`na1_token`).
  - It refuses to start if `NA1_API_BASE` (a real backend address) is also set.
- **Real authentication untouched.** `js/api.js`, `js/sync.js`, `js/session.js`, all other page files and the whole backend are unchanged. Full mode signs in with email and password against `/api/auth/login` exactly as before.

## Files
| File | Change |
|---|---|
| `js/app-mode.js` | **New.** The one-line mode switch (set to `'demo'` in this ZIP). |
| `js/demo-mode.js` | **New.** The Demo Mode stand-in described above. |
| `index.html` | Loads `app-mode.js` before `api.js` and `demo-mode.js` right after it. |
| `js/shell.js` | Demo Mode only: the login screen shows a "Frontend Demo Mode" notice and one-click demo accounts (no password form), and the app header shows a "Demo Mode" badge. It also shows a warning if the mode setting is wrong. The Full-mode login markup is unchanged. |
| `js/pages/profile.js` | Demo Mode only: "Reset demo data" resets the demo sample data. Full mode behaviour is unchanged. |
| `css/styles.css` | 14 lines **added** at the end for the badge and warning. No existing rule was changed. |

## What works in Demo Mode
- Browsing every page with sample data.
- Opening units (records views).
- Posting requests.
- Marking notifications as read.
- Daily report entries on dates the real backend would also accept.

Actions that need a server are refused with a clear "Demo Mode … Nothing was saved" message: creating, editing or deleting units and owners, claims and transfers, admin user management, reference edits, announcements, photo uploads and password changes.

## Inventory views
The News Feed (Inventory) page in this codebase has a single card grid, with no List/Grid toggle. Its filters, sorting and search are unchanged.
