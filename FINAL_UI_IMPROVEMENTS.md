# New Avenue — Final UI improvements

This release builds on the approved Lumen × Clarity theme. Nothing was redesigned from scratch and no pages or features were removed. No changes were made to authentication, roles, permissions or API routes.

## 1. News Feed: Grid / List views
- A **Grid | List** switcher sits above the results. It is styled like the theme's other segmented controls, and on phones it shows icons only.
- **List view** shows one compact row per unit: photo, project, type, area, offer, delivery, beds/baths/size, and total price with down payment and installments. Clicking a row opens the same unit details as a card.
- Switching views never re-fetches, duplicates or drops units. Sorting, search and every filter keep working in both views.
- The choice is remembered across pages and reloads on that device.
- **My Units (and Team Units)** got the same switcher and remembered choice. In List view your own units keep their Edit / Delete buttons, and team units don't get them.
- Note: before this release there was no List/Grid switcher anywhere in the app, including the Inventory / My Units pages, so there was no existing one to preserve.

## 2. Dashboard: useful shortcuts instead of inventory counters
- **Removed:** Live units (duplicated the News Feed card's "See all"), New this week, Immediate delivery, and Pending admin review (an admin concern shown to everyone).
- **Added shortcut tiles.** Each number comes from data the app already loads, and each tile opens its page:
  - **My Units**: your units, and how many await admin review.
  - **Owner follow-ups due**: your owner↔unit relationships due for their 30-day update (due within 2 days, or overdue), using the same rule as the Owners page.
  - **Unread requests**: the server's exact unread count for your team feed.
  - **Notifications**: unread.
  - **Admins:** Units to review (opens Admin → Pending Units). Senior/Head Admin also get Owner requests (opens Admin → Owner Transfers). The duplicate "Admin queue" card was removed.
  - **Head of HR:** Announcements sent.
- **Quick actions:** Add unit, Add owner, Post a request, Browse News Feed. These open the existing screens, so the existing permission checks and limits still apply.

## 3. Search / filter fields losing focus (fixed at the root)
- **Cause:** typing in a search box re-drew the whole page (or the whole sign-in screen), which destroyed and re-created the box you were typing in. The old "re-focus afterwards" workaround didn't work in current Chrome: the re-created box lost focus after the first character, and the cursor always jumped to the end.
- **Fix:** each search now refreshes only its results list. The input is never re-created, so focus, cursor position, paste, editing and the mobile keyboard all behave normally.
- **Fixed fields:** sign-in account search, Dashboard reference search, News Feed search, News Feed price filters (now apply live as you type; previously, moving between them could wipe what you typed), Reference search, Admin user search, Admin owner-transfer search, Announcements employee search.
- **Also fixed:**
  - On Announcements, changing the recipients used to erase a title and message you had already typed. Only the recipients section refreshes now, and the draft is kept until it's published.
  - Typing in the sign-in account search no longer clears an email or password you had typed.

## 4. Unit PDF: redesigned property brochure
- A new A4 brochure in the theme: dark header band with the New Avenue brand, project name in Bodoni, location and developer, a magazine-style photo gallery (only when the unit has real photos), key facts, a dark payment-plan panel, property details, and the consultant's name, title, phone and WhatsApp from the Reference directory.
- It uses the unit's real fields only. Missing or zero fields are left out, with no placeholders. Rent units show "Rental terms" and "Price".
- It never prints owner details, admin or "pending review" status, popularity, or audit data.
- It is always exactly one A4 page. Sample PDFs are 230–460 KB, small enough for WhatsApp.
- The in-app preview now uses the brochure's own styles (the old preview had none), scaled to fit. **Print / Save as PDF** and **Share on WhatsApp** work as before.

## 5. Branding: "New Avenue"
- The browser title, home-screen app name (`application-name`, `apple-mobile-web-app-title`), sidebar brand, a new brand header in the mobile **More** menu, the demo welcome notice, the duplicate-owner message, the local server messages and the Windows script titles now all say **New Avenue**.
- Folder names (`new-avenue-1-frontend`, `na1-backend`), storage keys and the database file name are unchanged on purpose, so your deployment settings keep working and no data migration is needed. The app had no PWA manifest, so there was none to rename.

## Other fixes in this release
- **Mobile tab bar:** the unread badges were clipped in half by a label rule. They now show in full.
- **Seed safety:** `npm run seed` refuses to run on a database that already has accounts. Use `npm run seed -- --reset` to deliberately start over. The seed's printed example emails were also corrected.
- **Test fix:** `integration/harness-admin-owner-workflow.js` backdated a record from the computer's real clock while the app under test used a pinned date, so it started failing once the real date passed 12 Oct 2026. It now uses the same clock. The app itself was not wrong.

## Files changed
**Frontend** (`new-avenue-1-frontend/`):
- `index.html`
- `css/styles.css`
- `js/icons.js`
- `js/shell.js`
- `js/demo-mode.js`
- `js/pages/inventory.js`, `myunits.js`, `dashboard.js`, `reference.js`, `admin.js`, `announcements.js`, `owners.js`
- Comment or console text only: `js/session.js`, `package.json`, `build.js`, `server.js`

**Backend:**
- `na1-backend/src/seed/seed.js` (the guard and example emails)
- `na1-backend/src/index.js` (start-up message)

**Tests:**
- `test-harnesses/integration/harness-admin-owner-workflow.js` (clock fix)
- New folder `test-harnesses/browser/final-ui/`

**Docs and scripts:**
- `README.md` (new "Start here" section)
- `setup-windows.cmd`, `start-windows.cmd` (titles)
- This file

---
## Verification round note
Only change in this checked copy: `js/session.js` and `js/pages/owners.js` carry the Owners fix (admins see owners that have no unit yet; short explanation note on the Owners page). `js/app-mode.js` is still `'demo'`. Nothing was deployed.
