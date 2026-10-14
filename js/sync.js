/* =========================================================
   Backend sync — Increment 2 (Owners, + read-only Units for the Owners module)
   =========================================================
   This file is the ONLY place that translates between the real backend's row shape
   (snake_case, matching na1-backend/src/db.js exactly) and this frontend's existing
   camelCase DB.* shape that every render function already reads. Keeping the mapping in one
   place means pages/owners.js (and later pages/inventory.js, pages/myunits.js, etc.) don't
   need to know the backend's column names at all.

   Scope of what's wired so far (see AUDIT_AND_BACKEND_INTEGRATION_PHASE1.md for the full
   picture): Owners are now fully real — every create/edit/delete/claim/share goes through
   the API and the local DB.owners/DB.ownerUnits are always re-fetched from the server after
   a write (never patched locally and left to drift). Units (Increment 3) are real too: create,
   edit, delete, approve, restore and interactions all go through the API and re-hydrate.
   ========================================================= */

function mapServerOwnerToLocal(o) {
  return {
    id: o.id, team: o.team, name: o.name, phone: o.phone, phone2: o.phone2 || null,
    salespersonId: o.salespersonId || null, sharedWith: o.sharedWith || [],
    createdAt: o.createdAt, deletedAt: null, deletedBy: null,
  };
}
function mapServerRelToLocal(r) {
  return {
    id: r.id, ownerId: r.ownerId, unitId: r.unitId, salespersonId: r.salespersonId, status: r.status,
    lastUpdateAt: r.lastUpdateAt, nextUpdateAt: r.nextUpdateAt, reminderAt: r.reminderAt,
  };
}
// Interaction history: the server sends per-type COUNTS plus the caller's own interaction types
// (never who else viewed/called). The frontend's popularityScore() only reads array LENGTHS, so
// each array is rebuilt with the right length, holding the current user's id when they have
// interacted themselves (so "unique per user" dedup in recordInteraction still works locally).
function _interactionArray(count, mineHas, meId) {
  const arr = [];
  for (let i = 0; i < (count || 0); i++) arr.push('#other' + i);
  if (mineHas && meId) { if (arr.length) arr[0] = meId; else arr.push(meId); }
  return arr;
}
function mapServerUnitToLocal(u, meId) {
  const c = u.interactions || {}, mine = u.myInteractions || [];
  return {
    id: u.id, team: u.team, pending: !!u.pending,
    compound: u.compound, phase: u.phase, developer: u.developer,
    city: u.city, area: u.area, saleRent: u.sale_rent,
    unitType: u.unit_type, areaSize: u.area_size,
    garden: u.garden, roof: u.roof, bedrooms: u.bedrooms, bathrooms: u.bathrooms,
    deliveryYears: u.delivery_years,
    downPayment: u.down_payment, remainingAmount: u.remaining_amount, remainingInstallments: u.remaining_installments,
    totalPrice: u.total_price, extraFees: u.extra_fees,
    finishing: u.finishing, furnished: !!u.furnished,
    photoIds: Array.isArray(u.photoIds) ? u.photoIds.slice() : [],
    photos: (Array.isArray(u.photoIds) && u.photoIds.length) ? u.photoIds.length : u.photos_count,   // legacy units only have the old count
    ownerSalespersonId: u.owner_salesperson_id,
    createdAt: u.created_at, updatedAt: u.updated_at || null,
    deletedAt: u.deleted_at || null, deletedBy: u.deleted_by || null,
    views: _interactionArray(c.view, mine.includes('view'), meId),
    calls: _interactionArray(c.call, mine.includes('call'), meId),
    whatsapps: _interactionArray(c.whatsapp, mine.includes('whatsapp'), meId),
    pdfs: _interactionArray(c.pdf, mine.includes('pdf'), meId),
  };
}
// Deleted rows (Head Admin only views) arrive from /admin/*/deleted in raw snake_case.
function mapServerDeletedOwnerToLocal(o) {
  return { id: o.id, team: o.team, name: o.name, phone: o.phone, phone2: o.phone2 || null,
    salespersonId: o.salesperson_id || null, sharedWith: [], createdAt: o.created_at,
    deletedAt: o.deleted_at, deletedBy: o.deleted_by || null };
}
function mapServerDeletedRelToLocal(r) {
  return { id: r.id, ownerId: r.owner_id, unitId: r.unit_id, salespersonId: r.salesperson_id, status: r.status,
    lastUpdateAt: r.last_update_at, nextUpdateAt: r.next_update_at, reminderAt: r.reminder_at };
}

// The team to hydrate for: the user's own fixed team, or (for team-less admins/execs) the team
// view they currently have active, defaulting to residential. Switching the view calls
// switchTeamView() below, which re-fetches Owners for the newly selected team from the server.
function syncScopeTeam(u) { return u.team || session.activeTeamView || 'residential'; }

// Re-fetches Owners (with their relationships) and Units for the current scope team and
// REPLACES the in-memory DB.owners/DB.ownerUnits entirely, and DB.units for that team, with
// the server's data. Called once after login, and again after every owner-related write, so
// the UI can never silently drift from what the backend actually has stored.
async function hydrateOwnersAndUnitsFromServer(u) {
  const team = syncScopeTeam(u);
  // Team-less users (admins / top execs) can switch team views, so hydrate BOTH teams' units for
  // them; a salesperson/manager only ever needs (and is only allowed) their own team.
  const unitTeams = u.team ? [u.team] : ['residential', 'commercial'];
  const isHead = u.role === 'headadmin';
  const seesTransfers = u.role === 'senioradmin' || isHead; // GET /admin/owner-transfers is Senior Admin and above
  try {
    const [ownersResp, capResp, ...rest] = await Promise.all([
      NA1_API.get('/owners', { team }),
      NA1_API.get('/owners/cap', { team }),
      ...unitTeams.map(t => NA1_API.get('/units', { team: t })),
      ...(isHead ? [NA1_API.get('/admin/owners/deleted'), NA1_API.get('/admin/units/deleted')] : []),
      ...(seesTransfers ? [NA1_API.get('/admin/owner-transfers')] : []),
    ]);
    const unitResps = rest.slice(0, unitTeams.length);
    DB.owners = ownersResp.map(mapServerOwnerToLocal);
    DB.ownerUnits = [];
    ownersResp.forEach(o => (o.relationships || []).forEach(r => DB.ownerUnits.push(mapServerRelToLocal(r))));
    let freshUnits = [];
    unitResps.forEach(resp => { freshUnits = freshUnits.concat(resp.map(x => mapServerUnitToLocal(x, u.id))); });
    // Keep units of teams that were not hydrated exactly as they were; replace the hydrated
    // teams' units (and any stale local deleted copies) with the server's real data.
    DB.units = DB.units.filter(x => !unitTeams.includes(x.team) && !x.deletedAt).concat(freshUnits);
    if (isHead) {
      const delOwners = rest[unitTeams.length], delUnits = rest[unitTeams.length + 1];
      delOwners.forEach(o => {
        DB.owners.push(mapServerDeletedOwnerToLocal(o));
        (o.relationships || []).forEach(r => DB.ownerUnits.push(mapServerDeletedRelToLocal(r)));
      });
      DB.units = DB.units.concat(delUnits.map(x => mapServerUnitToLocal(x, u.id)));
    }
    if (seesTransfers) {
      const tr = rest[unitTeams.length + (isHead ? 2 : 0)];
      DB.transfers = tr.map(t => ({
        id: t.id, type: t.type, ownerId: t.owner_id, ownerUnitId: t.owner_unit_id || null, unitId: t.unit_id || null,
        fromSalespersonId: t.from_salesperson_id || null, toSalespersonId: t.to_salesperson_id,
        status: t.status, at: t.requested_at, decidedAt: t.decided_at || null, decidedBy: t.decided_by || null,
        ownerName: t.owner_name, team: t.owner_team,
      }));
    }
    DB.ownerCap = capResp.cap;
    DB._ownersHydrated = true;
    DB._ownersHydratedTeam = team;
    return true;
  } catch (e) {
    console.error('Failed to load Owners/Units from the server', e);
    DB._ownersHydrated = false;
    if (typeof toast === 'function') {
      toast(e && e.isNetworkError
        ? 'Could not reach the server — Owners/Units data may be out of date. Check your connection.'
        : 'Could not load data from the server: ' + ((e && e.message) || 'unknown error'));
    }
    return false;
  }
}

// Shared error reporter for Units write paths — never silently swallow a failed save.
function reportUnitWriteError(e, what) {
  console.error('Unit ' + what + ' failed', e);
  if (typeof toast === 'function') {
    toast(e && e.isNetworkError ? 'Could not reach the server — nothing was saved.' : ((e && e.message) || ('Could not ' + what)));
  }
}

// Admin / top-exec Residential <-> Commercial switch. Owners are loaded per team, so the switch
// FIRST re-fetches the selected team's owners (replacing the other team's owners in memory — they
// are never both held at once, so records cannot mix or leak between the two teams), and only then
// re-renders. If the fetch fails the previous view is kept and the user is told; the switch is not
// silently shown with stale/other-team data.
async function switchTeamView(team) {
  const u = currentUser();
  if (!u || team === session.activeTeamView) { render(); return; }
  const previous = session.activeTeamView;
  session.activeTeamView = team;
  const ok = await hydrateOwnersAndUnitsFromServer(u);
  if (!ok) { session.activeTeamView = previous; }
  render();
}

/* =========================================================
   Daily Reports (Increment 4)
   The server is the source of truth. Salespeople's 11-metric reports and management's
   Comments+Activities reports are loaded from /daily-reports/*, and every change is written
   through the API; the local DB.dailyReports / DB.mgmtReports are only an in-memory view of that.
   ========================================================= */
// Everything a freshly authenticated (or page-refreshed) session needs from the server.
async function hydrateSessionData(u) {
  const a = await hydrateOwnersAndUnitsFromServer(u);
  const b = await hydrateReportsFromServer(u);
  const c = await hydrateRequestsFromServer(u);
  await hydrateReferenceFromServer(u);
  await hydrateNotificationsFromServer(u);
  await hydrateAnnouncementsFromServer(u);
  if (typeof startRequestsPolling === 'function') startRequestsPolling();
  return a && b && c;
}

/* ---------- Reference directory (code / phone / WhatsApp per sales-active person) ----------
   Server-owned. A team-bound user receives only their own team's directory; team-less accounts
   (admins, Head of Sales, CEO, Head of HR) load both. Names/roles/managers still come from the
   user directory (DB.users). */
function mapServerRefToLocal(r) { return { id: r.id, team: r.team, userId: r.userId, code: r.code, phone: r.phone, whatsapp: r.whatsapp }; }
async function hydrateReferenceFromServer(u) {
  const teams = u.team ? [u.team] : ['residential', 'commercial'];
  try {
    const resps = await Promise.all(teams.map(t => NA1_API.get('/reference', { team: t })));
    DB.refs = [].concat(...resps).map(mapServerRefToLocal);
    DB._refsHydrated = true;
    return true;
  } catch (e) {
    console.error('Failed to load the Reference directory from the server', e);
    DB._refsHydrated = false;
    if (typeof toast === 'function') toast(e && e.isNetworkError ? 'Could not reach the server — the Reference directory may be out of date.' : 'Could not load the Reference directory: ' + ((e && e.message) || 'unknown error'));
    return false;
  }
}
async function saveReferenceOnServer(userId, fields) {
  const r = await NA1_API.put('/reference/user/' + encodeURIComponent(userId), fields);
  await hydrateReferenceFromServer(currentUser());
  return r;
}

/* ---------- Notifications ----------
   Server-owned: the server decides which notifications exist for a user (only ever their own),
   de-duplicates them, and stores the read/unread state. Fetching also lets the server create any
   notification that has become due. */
function mapServerNotifToLocal(n) {
  return { id: n.id, userId: n.userId, type: n.type, text: n.text, link: n.link || null, read: !!n.is_read, at: n.at, key: n.dedup_key || null, meta: n.meta || null };
}
async function hydrateNotificationsFromServer(u) {
  try {
    const r = await NA1_API.get('/notifications');
    DB.notifications = r.notifications.map(mapServerNotifToLocal);
    DB.notifUnread = r.unreadCount;
    DB._notifsHydrated = true;
    return true;
  } catch (e) {
    console.error('Failed to load Notifications from the server', e);
    DB._notifsHydrated = false;
    if (typeof toast === 'function') toast(e && e.isNetworkError ? 'Could not reach the server — notifications may be out of date.' : 'Could not load notifications: ' + ((e && e.message) || 'unknown error'));
    return false;
  }
}
async function markNotificationReadOnServer(id) {
  try {
    const r = await NA1_API.patch('/notifications/' + encodeURIComponent(id) + '/read', {});
    const n = DB.notifications.find(x => x.id === id); if (n) n.read = true;
    DB.notifUnread = r.unreadCount;
    return true;
  } catch (e) {
    if (typeof toast === 'function') toast(e && e.isNetworkError ? 'Could not reach the server — the notification was NOT marked as read.' : ((e && e.message) || 'Could not mark as read'));
    return false;
  }
}

/* ---------- Company Announcements ----------
   Server-owned. The server returns only what this user may see: Head of HR → the announcements
   they sent (with audience + recipient count); everyone else → announcements addressed to them. */
function mapServerAnnouncementToLocal(a) {
  return { id: a.id, title: a.title, message: a.message, byId: a.by_id, at: a.at,
    audience: a.audience || null, recipientCount: a.recipient_count || 0 };
}
async function hydrateAnnouncementsFromServer(u) {
  try {
    const list = await NA1_API.get('/announcements');
    DB.announcements = list.map(a => mapServerAnnouncementToLocal(Object.assign({}, a, { audience: a.audience_json ? JSON.parse(a.audience_json) : null })));
    DB._announcementsHydrated = true;
    return true;
  } catch (e) {
    console.error('Failed to load Announcements from the server', e);
    DB._announcementsHydrated = false;
    if (typeof toast === 'function') toast(e && e.isNetworkError ? 'Could not reach the server — announcements may be out of date.' : 'Could not load announcements: ' + ((e && e.message) || 'unknown error'));
    return false;
  }
}
// The idempotency key is derived from the content, so a retry of the SAME publish (lost response,
// double click) is recognised by the server, while changed content is always a new announcement.
function announcementRequestId(title, message, audience) {
  const sig = JSON.stringify([title, message, audience]);
  if (!session._anReq || session._anReq.sig !== sig) session._anReq = { sig, id: 'ann-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10) };
  return session._anReq.id;
}
async function publishAnnouncementOnServer(title, message, audience) {
  const body = { title, message, audience, requestId: announcementRequestId(title, message, audience) };
  const r = await NA1_API.post('/announcements', body);
  session._anReq = null;
  await hydrateAnnouncementsFromServer(currentUser());
  return r;
}

/* ---------- Requests (team feed, replies, personal read position) ----------
   Server-owned. A team-bound user only ever receives their own team's feed (the server ignores a
   different ?team=); team-less accounts (admins, Head of Sales, CEO, Head of HR) load both. */
function mapServerRequestToLocal(r) {
  return { id: r.id, team: r.team, authorId: r.author_id, text: r.text, at: r.at,
    replies: (r.replies || []).map(x => ({ id: x.id, authorId: x.author_id, text: x.text, at: x.at })) };
}
async function hydrateRequestsFromServer(u, onlyTeam) {
  const teams = onlyTeam ? [onlyTeam] : (u.team ? [u.team] : ['residential', 'commercial']);
  try {
    const resps = await Promise.all(teams.map(t => NA1_API.get('/requests', { team: t })));
    teams.forEach((t, i) => {
      DB.requests[t] = resps[i].requests.map(mapServerRequestToLocal);
      DB.requestRead[t] = resps[i].lastReadRequestId || null;
      DB.requestUnread[t] = resps[i].unreadCount || 0;
    });
    DB._requestsHydrated = true;
    return true;
  } catch (e) {
    console.error('Failed to load Requests from the server', e);
    DB._requestsHydrated = false;
    if (typeof toast === 'function') toast(e && e.isNetworkError ? 'Could not reach the server — Requests may be out of date.' : 'Could not load Requests: ' + ((e && e.message) || 'unknown error'));
    return false;
  }
}
async function postRequestOnServer(u, team, text) {
  await NA1_API.post('/requests', { text, team });
  await hydrateRequestsFromServer(u, team);
}
async function postReplyOnServer(u, team, requestId, text) {
  await NA1_API.post('/requests/' + encodeURIComponent(requestId) + '/replies', { text, team });
  await hydrateRequestsFromServer(u, team);
}
// Moves this user's personal read position (server-side, forward only) and adopts the server's answer.
let _reqReadInFlight = null;
async function markRequestsReadOnServer(u, team) {
  const list = DB.requests[team] || [];
  if (!list.length) return false;
  const last = list[list.length - 1].id;
  if (DB.requestRead[team] === last || _reqReadInFlight === team + ':' + last) return false;
  _reqReadInFlight = team + ':' + last;
  try {
    const r = await NA1_API.put('/requests/read-position', { requestId: last, team });
    DB.requestRead[team] = r.lastReadRequestId; DB.requestUnread[team] = r.unreadCount;
    return true;
  } catch (e) {
    if (typeof toast === 'function') toast(e && e.isNetworkError ? 'Could not reach the server — your read position was NOT saved.' : ((e && e.message) || 'Could not save read position'));
    return false;
  } finally { _reqReadInFlight = null; }
}
// Light polling so new requests/unread badges from OTHER users appear without a manual refresh.
let _reqPollTimer = null;
function startRequestsPolling() {
  if (_reqPollTimer || typeof setInterval !== 'function') return;
  _reqPollTimer = setInterval(async () => {
    const u = (typeof currentUser === 'function') ? currentUser() : null;
    if (!u || !NA1_API.isLoggedIn()) return;
    const sig = () => JSON.stringify([DB.requestUnread, DB.notifUnread, Object.keys(DB.requests).map(t => (DB.requests[t][DB.requests[t].length - 1] || {}).id), (DB.notifications[0] || {}).id]);
    const before = sig();
    const ok1 = await hydrateRequestsFromServer(u, u.team || syncScopeTeam(u));
    const ok2 = await hydrateNotificationsFromServer(u);
    if (!ok1 && !ok2) return;
    const input = document.getElementById('reqInput');
    const rin = document.querySelector('[data-replyinput]');
    if (before !== sig() && !(session.page === 'requests' && ((input && input.value) || (rin && rin.value)))) render();
  }, 60000);
}
function stopRequestsPolling() { if (_reqPollTimer) { clearInterval(_reqPollTimer); _reqPollTimer = null; } }
// Called at page load: if a verified token + user were restored from sessionStorage, reload ALL
// server data BEFORE the first render, so a browser refresh never shows stale localStorage data.
async function restoreSessionOnLoad() {
  if (!session.userId) return false;
  // The user directory comes from the server too; without it the stored id cannot be resolved,
  // so the session is dropped (back to the sign-in screen) rather than guessed from local data.
  const dirOk = await hydrateUsersFromServer();
  const u = dirOk ? currentUser() : null;
  if (!u) {
    session.userId = null; sessionStorage.removeItem('na1_user');
    if (dirOk && typeof NA1_API !== 'undefined') NA1_API.logout();
    session._loginError = dirOk ? 'Your session could not be restored. Please sign in again.' : 'Could not reach the server to restore your session. Please sign in again.';
    return false;
  }
  await hydrateSessionData(u);
  return true;
}

/* ---------- User directory (Admin: user/role management) ----------
   The organisation directory (names, roles, departments, reporting lines, job titles) is owned by
   the server. DB.users is REPLACED by it after login/refresh and after every user-management
   write. The built-in roster is only used on the login screen of a demo build. */
function mapServerUserToLocal(x) {
  return { id: x.id, name: x.name, email: x.email || null, role: x.role, team: x.team || null,
    managerId: x.managerId || null, avatar: x.avatarColor || avatarColor(x.name),
    jobTitle: x.jobTitle || null, titleNeedsReview: !!x.titleNeedsReview, active: x.active !== false };
}
async function hydrateUsersFromServer() {
  try {
    const list = await NA1_API.get('/users/directory');
    DB.users = list.map(mapServerUserToLocal);
    DB._usersHydrated = true;
    return true;
  } catch (e) {
    console.error('Failed to load the user directory from the server', e);
    DB._usersHydrated = false;
    return false;
  }
}
function reportUserWriteError(e, what) {
  const msg = e && e.isNetworkError ? 'Could not reach the server — ' + what + ' was NOT saved.'
    : ((e && e.message) || 'Unknown error');
  if (typeof toast === 'function') toast(msg);
}
// Admin user-management writes. Each re-fetches the directory afterwards (never patches locally).
async function createUserOnServer(payload) {
  const r = await NA1_API.post('/admin/users', payload);
  await hydrateUsersFromServer();
  await hydrateReferenceFromServer(currentUser());
  return r;
}
async function updateUserOnServer(id, payload) {
  const r = await NA1_API.patch('/admin/users/' + encodeURIComponent(id), payload);
  await hydrateUsersFromServer();
  await hydrateReferenceFromServer(currentUser());
  return r;
}
async function setUserActiveOnServer(id, active) {
  const r = active ? await NA1_API.post('/admin/users/' + encodeURIComponent(id) + '/reactivate', {}) : await NA1_API.post('/admin/users/' + encodeURIComponent(id) + '/deactivate', {});
  await hydrateUsersFromServer();
  await hydrateReferenceFromServer(currentUser());
  return r;
}
async function resetUserPasswordOnServer(id) {
  return NA1_API.post('/admin/users/' + encodeURIComponent(id) + '/reset-password', {});
}
async function hydrateReportsFromServer(u) {
  try {
    if (u.role === 'salesperson') {
      const months = await NA1_API.get('/daily-reports/months');
      const monthly = await Promise.all(months.map(m => NA1_API.get('/daily-reports/monthly/' + m)));
      const own = [];
      monthly.forEach(r => r.reports.forEach(x => own.push(x)));
      DB.dailyReports = DB.dailyReports.filter(r => r.salespersonId !== u.id && !r._draft).concat(own);
    } else if (isMgmt(u)) {
      const list = await NA1_API.get('/daily-reports/mgmt');
      DB.mgmtReports = DB.mgmtReports.filter(r => r.userId !== u.id).concat(list);
    }
    return true;
  } catch (e) {
    console.error('Failed to load Daily Reports from the server', e);
    if (typeof toast === 'function') toast(e && e.isNetworkError ? 'Could not reach the server — Daily Reports may be out of date.' : 'Could not load Daily Reports: ' + ((e && e.message) || 'unknown error'));
    return false;
  }
}
// Management's Team Reports for one date (downline only — enforced by the server).
async function loadTeamReports(u, ds) {
  const resp = await NA1_API.get('/daily-reports/team', { date: ds });
  const salesIds = new Set(resp.salespeople.map(x => x.user.id));
  const mgmtIds = new Set(resp.management.map(x => x.user.id));
  DB.dailyReports = DB.dailyReports.filter(r => !(r.date === ds && salesIds.has(r.salespersonId)));
  resp.salespeople.forEach(x => { if (x.report) DB.dailyReports.push(x.report); });
  DB.mgmtReports = DB.mgmtReports.filter(r => !(r.date === ds && mgmtIds.has(r.userId)));
  resp.management.forEach(x => { if (x.report) DB.mgmtReports.push(x.report); });
  DB._teamSummary = DB._teamSummary || {};
  DB._teamSummary[u.id + '|' + ds] = resp.summary;
  return resp;
}
function _mergeOwnSalesReport(saved, onlyField) {
  // Update the existing in-memory row IN PLACE (the Daily Reports page holds a reference to it
  // while the user is typing); only push a new row if there was none.
  const cur = DB.dailyReports.find(r => r.salespersonId === saved.salespersonId && r.date === saved.date);
  if (cur && onlyField) {
    // A single-field save only brings back THAT field (+ bookkeeping) so a response arriving
    // late can never overwrite what the user has meanwhile typed into other, not-yet-saved fields.
    cur[onlyField[0]][onlyField[1]] = saved[onlyField[0]][onlyField[1]];
    ['id', 'status', 'completedAt', 'updatedAt', 'createdAt'].forEach(k => { cur[k] = saved[k]; });
    delete cur._draft; return cur;
  }
  if (cur) { delete cur._draft; Object.assign(cur, saved); return cur; }
  DB.dailyReports.push(saved);
  return saved;
}
// Writes are SERIALIZED (one at a time, in order) so a quick edit-then-Complete can never race.
let _reportWriteChain = Promise.resolve();
function queueReportWrite(fn) {
  const next = _reportWriteChain.then(fn, fn);
  _reportWriteChain = next.catch(() => {});
  return next;
}
function flushReportWrites() { return _reportWriteChain; }
async function saveSalesReportField(ds, section, key, value) {
  return queueReportWrite(async () => _mergeOwnSalesReport(await NA1_API.put('/daily-reports/' + ds, { section, key, value }), [section, key]));
}
async function completeSalesReportOnServer(ds) {
  await flushReportWrites();
  return queueReportWrite(async () => _mergeOwnSalesReport(await NA1_API.post('/daily-reports/' + ds + '/complete', {})));
}
async function saveMgmtReportOnServer(ds, comments, activities) {
  const saved = await NA1_API.put('/daily-reports/mgmt/' + ds, { comments, activities });
  DB.mgmtReports = DB.mgmtReports.filter(r => !(r.userId === saved.userId && r.date === saved.date)).concat([saved]);
  return saved;
}


/* =========================================================
   UNIT PHOTOS (Module F)
   ---------------------------------------------------------
   Images live on the server (persistent disk) and are only reachable with a valid login. The
   browser therefore downloads them with fetch() + the Authorization header and shows blob: URLs;
   nothing about a photo is ever written to localStorage. A tiny in-memory cache avoids
   re-downloading the same photo while the page is open and is cleared at logout.
   ========================================================= */
const PHOTO_MAX_FULL_PX = 1600, PHOTO_MAX_THUMB_PX = 480;
const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp';
const _photoUrlCache = new Map();      // "id|size" -> Promise<string|null>
let _photoActive = 0; const _photoQueue = [];
function _photoRun(fn){
  return new Promise((resolve)=>{
    const go = ()=>{ _photoActive++; fn().then(resolve, ()=>resolve(null)).finally(()=>{ _photoActive--; const n=_photoQueue.shift(); if(n) n(); }); };
    if(_photoActive < 4) go(); else _photoQueue.push(go);
  });
}
// Resolves to a blob: URL for the photo, or null if it cannot be loaded (never throws).
function photoUrl(id, size){
  const key = id+'|'+(size||'full');
  if(_photoUrlCache.has(key)) return _photoUrlCache.get(key);
  const p = _photoRun(async ()=>{
    const blob = await NA1_API.blob('/unit-photos/'+encodeURIComponent(id), size==='thumb' ? {size:'thumb'} : undefined);
    return URL.createObjectURL(blob);
  }).then(url=>{ if(!url) _photoUrlCache.delete(key); return url; });
  _photoUrlCache.set(key, p);
  return p;
}
function clearPhotoCache(){
  _photoUrlCache.forEach(p=>p.then(u=>{ if(u) try{ URL.revokeObjectURL(u); }catch(e){} }));
  _photoUrlCache.clear(); _photoQueue.length = 0;
}
// data: URL of a photo (used for the printable sheet, which is written into a separate window).
async function photoDataUrl(id, size){
  const blob = await NA1_API.blob('/unit-photos/'+encodeURIComponent(id), size==='thumb' ? {size:'thumb'} : undefined);
  return new Promise((resolve, reject)=>{ const fr = new FileReader(); fr.onload = ()=>resolve(fr.result); fr.onerror = ()=>reject(fr.error); fr.readAsDataURL(blob); });
}
// Fills every <img data-photo-id="…" [data-photo-size="thumb"]>. Loading is LAZY: a News Feed can hold
// hundreds of cards, so a picture is only downloaded when its card is (about to be) on screen.
// <img data-photo-eager> opts out (small, always-needed sets such as the photo picker in a form).
let _photoIO = null;
function _loadPhotoImg(img){
  if(img.getAttribute('data-photo-state') === 'loading' || img.getAttribute('data-photo-state') === 'ready') return;
  img.setAttribute('data-photo-state','loading');
  photoUrl(img.getAttribute('data-photo-id'), img.getAttribute('data-photo-size')).then(url=>{
    if(url){ img.src = url; img.setAttribute('data-photo-state','ready'); }
    else { img.setAttribute('data-photo-state','error'); img.alt = 'Photo unavailable'; if(img.parentElement) img.parentElement.classList.add('photo-failed'); }
  });
}
function hydratePhotoImages(root){
  const scope = root || document;
  if(!scope.querySelectorAll) return;
  const canObserve = typeof IntersectionObserver !== 'undefined';
  if(canObserve && !_photoIO){
    _photoIO = new IntersectionObserver((entries)=>{ entries.forEach(e=>{ if(e.isIntersecting){ _photoIO.unobserve(e.target); _loadPhotoImg(e.target); } }); }, { rootMargin: '400px 0px' });
  }
  scope.querySelectorAll('img[data-photo-id]:not([data-photo-state])').forEach(img=>{
    if(canObserve && !img.hasAttribute('data-photo-eager')){ img.setAttribute('data-photo-state','pending'); _photoIO.observe(img); }
    else _loadPhotoImg(img);
  });
}
// Images are inserted by many render functions; one observer picks them all up.
if(typeof MutationObserver !== 'undefined' && typeof document !== 'undefined' && document.body){
  new MutationObserver(()=>hydratePhotoImages()).observe(document.body, {childList:true, subtree:true});
}

// Re-encodes a chosen picture in the browser: scales it down (max 1600 px, thumbnail 480 px), converts
// to JPEG and so also drops camera metadata such as GPS. The server still validates the result.
function _loadBitmap(file){
  if(typeof createImageBitmap === 'function') return createImageBitmap(file, {imageOrientation:'from-image'}).catch(()=>createImageBitmap(file));
  return new Promise((res, rej)=>{ const im = new Image(); const u = URL.createObjectURL(file); im.onload = ()=>{ URL.revokeObjectURL(u); res(im); }; im.onerror = ()=>{ URL.revokeObjectURL(u); rej(new Error('decode')); }; im.src = u; });
}
function _encode(bmp, maxPx, quality){
  const w0 = bmp.width, h0 = bmp.height, k = Math.min(1, maxPx/Math.max(w0,h0));
  const w = Math.max(1, Math.round(w0*k)), h = Math.max(1, Math.round(h0*k));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0,0,w,h); g.drawImage(bmp, 0, 0, w, h);
  return new Promise((res, rej)=> c.toBlob(b=> b ? res(b) : rej(new Error('encode')), 'image/jpeg', quality));
}
function _blobToBase64(blob){
  return new Promise((res, rej)=>{ const fr = new FileReader(); fr.onload = ()=>res(String(fr.result).split(',')[1]); fr.onerror = ()=>rej(fr.error); fr.readAsDataURL(blob); });
}
const PHOTO_ALLOWED_TYPES = ['image/jpeg','image/png','image/webp'];
function checkPhotoFile(file){
  const okType = PHOTO_ALLOWED_TYPES.includes(file.type) || (!file.type && /\.(jpe?g|png|webp)$/i.test(file.name||''));
  if(!okType) return 'Only JPEG, PNG or WebP pictures can be uploaded';
  if(file.size > 30*1024*1024) return 'This picture is too large (over 30 MB)';
  return null;
}
// Uploads ONE picture. Resolves to { id, previewUrl } (previewUrl is a local blob: URL for the form).
async function uploadUnitPhoto(file){
  const why = checkPhotoFile(file); if(why) throw new Error(why);
  let bmp;
  try { bmp = await _loadBitmap(file); } catch(e){ throw new Error('This file could not be read as a picture'); }
  const full = await _encode(bmp, PHOTO_MAX_FULL_PX, 0.85);
  const thumb = await _encode(bmp, PHOTO_MAX_THUMB_PX, 0.75);
  if(bmp.close) try{ bmp.close(); }catch(e){}
  const resp = await NA1_API.post('/unit-photos', { data: await _blobToBase64(full), thumb: await _blobToBase64(thumb) });
  return { id: resp.id, previewUrl: URL.createObjectURL(thumb) };
}


/* ---------- Admin audit log (server records) ----------
   The Audit Log tab shows the SERVER's audit_log (GET /api/admin/audit-log, Junior Admin and above,
   newest 200). Before this fix the tab showed only entries the browser itself had made in the current
   page session, so a restart, another device or another admin's action was invisible. */
async function hydrateAuditLogFromServer(){
  try {
    const rows = await NA1_API.get('/admin/audit-log');
    DB.auditLog = (rows || []).map(r => {
      let details = {}; try { details = JSON.parse(r.details_json || '{}') || {}; } catch (e) {}
      return { id: r.id, actor: r.actor_id, action: r.action, details, at: r.at };
    });
    return true;
  } catch (e) {
    if (typeof toast === 'function') toast('Could not load the audit log from the server: ' + ((e && e.message) || 'unknown error'));
    return false;
  }
}
