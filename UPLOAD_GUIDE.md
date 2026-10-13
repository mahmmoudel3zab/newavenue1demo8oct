# How to update your Vercel demo (Frontend Demo Mode)

This fixes the sign-in problem on your public demo. On the demo, clicking any demo account signs you in right away, with no password and no backend needed. The new Lumen × Clarity design is unchanged.

## What's in this ZIP

- `new-avenue-1-frontend/`: the full corrected frontend, ready to use.
- `UPLOAD_GUIDE.md`: this guide.
- `DEMO_MODE_CHANGES.md`: technical notes on what changed and why.

## The 6 files to upload to GitHub

In your GitHub repository you'll see `index.html` next to a `css` folder and a `js` folder. Upload each file below into the **same place** in your repository, replacing the old file when GitHub asks.

| # | File in this ZIP (inside `new-avenue-1-frontend/`) | New or replaced? |
|---|---|---|
| 1 | `index.html` | replaced |
| 2 | `css/styles.css` | replaced |
| 3 | `js/shell.js` | replaced |
| 4 | `js/pages/profile.js` | replaced |
| 5 | `js/app-mode.js` | **new** |
| 6 | `js/demo-mode.js` | **new** |

Don't upload or delete anything else. Every other file stays exactly as it is.

### Step by step on github.com

1. Open your repository and go into the `js` folder.
2. Click **Add file → Upload files**.
3. Drag in `shell.js`, `app-mode.js` and `demo-mode.js` from this ZIP's `new-avenue-1-frontend/js/` folder.
4. Click **Commit changes**.
5. Go into `js/pages` and upload `profile.js` the same way, then commit.
6. Go into `css` and upload `styles.css`, then commit.
7. Go back to the top of the repository and upload `index.html`, then commit.

Vercel rebuilds your demo automatically after each commit, usually within a minute. You don't need to change anything in Vercel.

## How to check it worked

Open your demo link. If it still looks old, refresh with Ctrl + Shift + R (Windows) or Cmd + Shift + R (Mac). You should see:

- a gold **"Frontend Demo Mode"** label above "Sign in";
- the list of demo accounts, with no password box;
- one click on any account opens the app, with a small **"Demo Mode"** badge at the top.

## Good to know

- **The only switch** between the two modes is the one line in `js/app-mode.js`:
  - `window.NA1_APP_MODE = 'demo';` is for your static Vercel demo (what this ZIP contains).
  - `window.NA1_APP_MODE = 'full';` is for the real company system with the backend. Real email and password sign-in is used there, exactly as before.

  **When you deploy the real system, change this line to `'full'`.** If you forget and also set a backend address, the app refuses to start Demo Mode and shows a warning instead of a demo sign-in.
- **What works in Demo Mode:** you can browse every page with the sample data, open units, use filters, post a request and mark notifications as read. These changes are kept only in that browser tab.
- **What's turned off in Demo Mode:** actions that need a real server, such as adding or editing units and owners, admin changes, password changes and photo uploads. They show *"Demo Mode … Nothing was saved"* instead of pretending to work.
- **Resetting the demo:** Profile → **Reset demo data** puts the sample data back to how it started.
