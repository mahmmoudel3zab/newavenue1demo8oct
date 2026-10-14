# New Avenue: Frontend-only Vercel demo

This ZIP holds **only the website** (`new-avenue-1-frontend/`). It runs on your existing static Vercel demo with **no backend and no database**: Frontend Demo Mode uses built-in sample data.

## What's new
- Grid / List views on the News Feed (and My Units).
- New dashboard shortcuts.
- Search fields no longer lose focus while typing.
- New PDF brochure.
- The name "New Avenue" everywhere.

Full details are in `FINAL_UI_IMPROVEMENTS.md`.

## Update your existing GitHub repository (and Vercel demo)

You already uploaded the Demo Mode version earlier, so `js/app-mode.js` in your repository already says `'demo'`. Don't change it.

### Easiest way: upload three items
1. Open this ZIP's `new-avenue-1-frontend/` folder on your computer.
2. In your GitHub repository, open the folder that contains `index.html`, `css` and `js`.
3. Click **Add file → Upload files**.
4. Drag in **`index.html`**, the **`css`** folder and the **`js`** folder, all three at once.
5. Click **Commit changes**.

GitHub replaces the files with the same names and adds nothing else. It never deletes files you don't upload.

### Or upload exactly the changed files
Upload each file into the same place in your repository, replacing the old one:

| # | File | Why |
|---|---|---|
| 1 | `index.html` | page title and app name "New Avenue" |
| 2 | `css/styles.css` | Grid/List, dashboard tiles, mobile menu brand, mobile badge fix |
| 3 | `js/icons.js` | Grid and List icons |
| 4 | `js/shell.js` | branding, login search fix, display-preference helper |
| 5 | `js/demo-mode.js` | demo welcome text says "New Avenue" |
| 6 | `js/pages/inventory.js` | News Feed Grid/List, live search and filters, new PDF brochure |
| 7 | `js/pages/myunits.js` | Grid/List on My Units |
| 8 | `js/pages/dashboard.js` | new dashboard shortcuts, reference search fix |
| 9 | `js/pages/reference.js` | search fix |
| 10 | `js/pages/admin.js` | two search fixes |
| 11 | `js/pages/announcements.js` | search fix, draft kept |
| 12 | `js/pages/owners.js` | "New Avenue" in one message |

These four changed only in code comments or local-server text. Uploading them is optional and changes nothing on the website: `js/session.js`, `package.json`, `build.js`, `server.js`.

**Don't touch** `js/app-mode.js`, your Vercel settings, or any other file.

## Build and check
- **Build:** nothing to do. Vercel publishes the new files automatically within about a minute of each commit. The project's build setup is unchanged; if your Vercel project uses `npm run build`, it still produces the same `dist/` folder.
- **Check it on your phone and computer** (refresh with Ctrl + Shift + R, or Cmd + Shift + R on Mac):
  1. The sign-in page shows **"Frontend Demo Mode"** and the account list. Click any account and you're in, no password.
  2. The browser tab says **New Avenue**. On a phone, the **More** menu shows "New Avenue" at the top.
  3. The **Dashboard** shows My Units, Owner follow-ups, Unread requests and Notifications tiles, plus quick actions.
  4. On the **News Feed**, the **Grid | List** switch changes the layout. Type a full word in the search box without clicking it again.
  5. Open a unit, tap **Create PDF**, then **Print / Save as PDF**. You get a one-page New Avenue brochure.

## Demo accounts
In Demo Mode, **every demo account on the sign-in screen works with one click and no password**. It's sample data only, with no backend, and nothing you do is saved to a server. For example: Mona Adel (Salesperson), Dina Youssef (Sales Manager), Laila Mansour (Head Admin), Yasmin Adly (Head of HR).

The password `Demo123!` is only for the full localhost app, where the backend checks it. It is not needed and not used in Demo Mode.

## Safety notes
- Demo Mode never contacts a server and can't reach or change real data. Real sign-in (email + password checked by the backend) is a separate mode, switched only by `js/app-mode.js` (`'full'`). If the backend is unreachable in full mode, the app shows an error. It never falls back to demo sign-in.
- This ZIP contains no backend, database, `.env` file, passwords or keys.
