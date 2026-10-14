/* =========================================================
   NEW AVENUE 1 — FRONTEND DEMO MODE
   =========================================================
   Loaded right after js/api.js. It does NOTHING unless js/app-mode.js explicitly sets
   window.NA1_APP_MODE = 'demo'. In Full Application Mode this file returns immediately and the
   real backend client from api.js is used untouched.

   In Demo Mode it replaces window.NA1_API with an in-browser stand-in that:
     - answers the same requests the pages already make, using the app's existing sample data
       (buildDemoData() in js/data.js), so every page can be previewed with no backend;
     - signs in by picking one of the demo accounts — no password, because there is no server
       and nothing real to protect;
     - NEVER calls fetch() or any network API, so it cannot reach, unlock or change real data;
     - stores its session under its own key ('na1_demo_session'), never under the real
       login-token key used by api.js, so a demo session can never look like a real login;
     - refuses actions that need a real server (create/edit/delete units and owners, admin
       changes, passwords, photo uploads…) with a clear "Demo Mode — nothing was saved" message.

   Demo Mode is never a fallback: if Full Application Mode cannot reach the backend, the app
   shows the normal "Could not reach the server" error and does not switch to sample data.
   ========================================================= */
(function () {
  var rawMode = (typeof window !== 'undefined' && typeof window.NA1_APP_MODE === 'string') ? window.NA1_APP_MODE.trim().toLowerCase() : '';
  if (rawMode && rawMode !== 'demo' && rawMode !== 'full') {
    // An unrecognised value is a configuration mistake: run Full Application Mode (the safe
    // choice) and say so on the sign-in screen rather than guessing.
    window.NA1_MODE_ERROR = 'Unknown app mode "' + window.NA1_APP_MODE + '" in js/app-mode.js — running Full Application Mode. Use \'demo\' or \'full\'.';
  }
  if (rawMode !== 'demo') { window.NA1_DEMO_MODE = false; return; }
  if (window.NA1_API_BASE) {
    // A real backend address AND demo mode at the same time is contradictory. Do not activate
    // demo sign-in next to a real backend; keep the real client and explain the conflict.
    window.NA1_DEMO_MODE = false;
    window.NA1_MODE_ERROR = 'Demo Mode is switched on in js/app-mode.js, but a real backend address (NA1_API_BASE) is also set. Demo Mode was NOT started. Choose one: set NA1_APP_MODE to \'full\' for the real application, or remove NA1_API_BASE for the static demo.';
    return;
  }
  Object.defineProperty(window, 'NA1_DEMO_MODE', { value: true, writable: false, configurable: false });

  var SESSION_KEY = 'na1_demo_session';
  var USER_KEY = 'na1_demo_user';
  var STORE_KEY = 'na1_demo_store';
  var LAUNCH = '2026-11-01';
  var DEMO_BLOCKED = 'Demo Mode: this action needs the real backend, so it is turned off in this preview. Nothing was saved.';

  function ss(op, k, v) {
    try {
      if (op === 'get') return sessionStorage.getItem(k);
      if (op === 'set') sessionStorage.setItem(k, v);
      if (op === 'del') sessionStorage.removeItem(k);
    } catch (e) { /* storage unavailable: the demo still works, it just won't survive a reload */ }
    return null;
  }

  // Same error class/shape as api.js so every existing page shows these messages unchanged.
  var ApiError = (window.NA1_API && window.NA1_API.ApiError) || (function () {
    function E(status, body) { var m = (body && body.error) || ('Request failed with status ' + status); var e = new Error(m); e.name = 'ApiError'; e.status = status; e.body = body; return e; }
    return E;
  })();
  function fail(status, msg) { var e = new ApiError(status, { error: msg }); if (!(e instanceof Error)) e = Object.assign(new Error(msg), { status: status }); e.isDemoMode = true; return e; }
  function blocked() { return fail(403, DEMO_BLOCKED); }

  /* ---------- the sample-data store (in memory, kept for this browser tab only) ---------- */
  var store = null;
  function save() { if (store) ss('set', STORE_KEY, JSON.stringify(store)); }
  function getStore() {
    if (store) return store;
    var raw = ss('get', STORE_KEY);
    if (raw) { try { store = JSON.parse(raw); } catch (e) { store = null; } }
    if (!store || !store.v) {
      var d = buildDemoData();           // the app's existing sample dataset (js/data.js)
      store = {
        v: 1, users: d.users, units: d.units, owners: d.owners, ownerUnits: d.ownerUnits, refs: d.refs,
        requests: d.requests, readPos: {}, dailyReports: [], mgmtReports: [], notifications: [],
      };
      Object.keys(d.readPositions || {}).forEach(function (uid) {
        var u = d.users.find(function (x) { return x.id === uid; });
        if (u && u.team) store.readPos[uid + '|' + u.team] = d.readPositions[uid];
      });
      save();
    }
    return store;
  }

  function me() { var id = ss('get', SESSION_KEY); return id ? getStore().users.find(function (u) { return u.id === id; }) || null : null; }
  function requireMe() { var u = me(); if (!u) throw fail(401, 'Your demo session has ended. Please pick a demo account again.'); return u; }
  function isAdminRole(u) { return ['junioradmin', 'senioradmin', 'headadmin'].indexOf(u.role) >= 0; }
  function isMgmtRole(u) { return ['teamleader', 'manager', 'director', 'headofsales', 'ceo'].indexOf(u.role) >= 0; }
  // Same rule as the backend: a team-bound user always gets their own team; team-less accounts
  // (admins, Head of Sales, CEO, Head of HR) choose with ?team=.
  function scopeTeam(u, q) { if (u.team) return u.team; var t = q && q.team; return (t === 'commercial') ? 'commercial' : 'residential'; }
  function downline(rootId) { return getDownlineIds(getStore().users, rootId); }
  function cairoToday() {
    try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
    catch (e) { return todayStr(); }
  }
  function safeUser(u) { return { id: u.id, name: u.name, email: u.email, role: u.role, team: u.team || null, managerId: u.managerId || null, jobTitle: u.jobTitle || null }; }

  /* ---------- shape converters: sample data -> the exact shapes the real API returns ---------- */
  function unitOut(x, meId) {
    var mine = [];
    if ((x.views || []).indexOf(meId) >= 0) mine.push('view');
    if ((x.calls || []).indexOf(meId) >= 0) mine.push('call');
    if ((x.whatsapps || []).indexOf(meId) >= 0) mine.push('whatsapp');
    if ((x.pdfs || []).indexOf(meId) >= 0) mine.push('pdf');
    return {
      id: x.id, team: x.team, pending: x.pending ? 1 : 0, compound: x.compound, phase: x.phase, developer: x.developer,
      city: x.city, area: x.area, sale_rent: x.saleRent, unit_type: x.unitType, area_size: x.areaSize,
      garden: x.garden, roof: x.roof, bedrooms: x.bedrooms, bathrooms: x.bathrooms, delivery_years: x.deliveryYears,
      down_payment: x.downPayment, remaining_amount: x.remainingAmount, remaining_installments: x.remainingInstallments,
      total_price: x.totalPrice, extra_fees: x.extraFees, finishing: x.finishing, furnished: x.furnished ? 1 : 0,
      photos_count: x.photos || 0, photoIds: [], owner_salesperson_id: x.ownerSalespersonId,
      created_at: x.createdAt, updated_at: x.updatedAt || null, deleted_at: null, deleted_by: null,
      interactions: { view: (x.views || []).length, call: (x.calls || []).length, whatsapp: (x.whatsapps || []).length, pdf: (x.pdfs || []).length },
      myInteractions: mine,
    };
  }
  function ownersHeldBy(spId) {
    var s = getStore(), ids = {};
    s.owners.forEach(function (o) { if (o.salespersonId === spId || (o.sharedWith || []).indexOf(spId) >= 0) ids[o.id] = 1; });
    s.ownerUnits.forEach(function (r) { if (r.status === 'active' && r.salespersonId === spId) ids[r.ownerId] = 1; });
    return ids;
  }
  function ownersFor(u, team) {
    var s = getStore(), allowed = null;
    if (u.role === 'salesperson') allowed = ownersHeldBy(u.id);
    else if (isMgmtRole(u)) { allowed = {}; [u.id].concat(downline(u.id)).forEach(function (id) { Object.assign(allowed, ownersHeldBy(id)); }); }
    return s.owners.filter(function (o) { return o.team === team && !o.deletedAt && (!allowed || allowed[o.id]); }).map(function (o) {
      return {
        id: o.id, team: o.team, name: o.name, phone: o.phone, phone2: o.phone2 || null, salespersonId: o.salespersonId,
        createdAt: o.createdAt, sharedWith: (o.sharedWith || []).slice(),
        relationships: s.ownerUnits.filter(function (r) { return r.ownerId === o.id && r.status === 'active'; }).map(function (r) {
          return { id: r.id, ownerId: r.ownerId, unitId: r.unitId, salespersonId: r.salespersonId, status: r.status, lastUpdateAt: r.lastUpdateAt, nextUpdateAt: r.nextUpdateAt, reminderAt: r.reminderAt };
        }),
      };
    });
  }
  function requestsOut(u, team) {
    var s = getStore(), list = s.requests[team] || [];
    var last = s.readPos[u.id + '|' + team] || null, idx = -1;
    if (last) list.forEach(function (r, i) { if (r.id === last) idx = i; });
    return {
      team: team, lastReadRequestId: last, unreadCount: last && idx >= 0 ? list.length - 1 - idx : list.length,
      requests: list.map(function (r) {
        return { id: r.id, team: r.team, author_id: r.authorId, text: r.text, at: r.at,
          replies: (r.replies || []).map(function (x) { return { id: x.id, author_id: x.authorId, text: x.text, at: x.at }; }) };
      }),
    };
  }
  function notificationsFor(u) {
    var s = getStore();
    if (!s.notifications.some(function (n) { return n.userId === u.id; })) {
      s.notifications.push({ id: 'n_demo_' + u.id, userId: u.id, type: 'system', link: null, is_read: 0, at: Date.now(), dedup_key: 'demo_welcome', meta: null,
        text: 'Welcome to the New Avenue Frontend Demo. You are viewing sample data — nothing you do here is saved to a server.' });
      save();
    }
    var mine = s.notifications.filter(function (n) { return n.userId === u.id; }).sort(function (a, b) { return b.at - a.at; });
    return { unreadCount: mine.filter(function (n) { return !n.is_read; }).length, notifications: mine };
  }
  var FIELDS = [['calls', 'count'], ['calls', 'active'], ['leads', 'count'], ['showings', 'buyer'], ['showings', 'seller'],
    ['meetings', 'buyer'], ['meetings', 'seller'], ['meetings', 'developer'], ['other', 'inventory'], ['other', 'orientation'], ['other', 'closedDeals']];
  function filingDateProblem(ds) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ds || '')) return 'date must be in YYYY-MM-DD format';
    if (ds < LAUNCH) return 'Daily Reports begin ' + LAUNCH;
    if (ds > cairoToday()) return 'A report cannot be filed for a future date';
    return null;
  }
  function teamReports(u, ds) {
    var s = getStore(), launched = ds >= LAUNCH, ids = downline(u.id);
    var people = s.users.filter(function (p) { return ids.indexOf(p.id) >= 0; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
    var uo = function (p) { return { id: p.id, name: p.name, role: p.role, jobTitle: p.jobTitle || null, team: p.team }; };
    var sales = people.filter(function (p) { return p.role === 'salesperson'; }).map(function (p) {
      var r = launched ? s.dailyReports.find(function (x) { return x.salespersonId === p.id && x.date === ds; }) || null : null;
      return { user: uo(p), status: !launched ? 'n/a' : r ? r.status : 'missing', report: r };
    });
    var mgmt = people.filter(isMgmtRole).map(function (p) {
      var r = launched ? s.mgmtReports.find(function (x) { return x.userId === p.id && x.date === ds; }) || null : null;
      var ok = !!(r && r.comments.trim() && r.activities.trim());
      return { user: uo(p), status: !launched ? 'n/a' : ok ? 'submitted' : 'missing', report: r };
    });
    var totals = {}; FIELDS.forEach(function (f) { totals[f[0] + '.' + f[1]] = sales.reduce(function (n, x) { return n + ((x.report && x.report[f[0]][f[1]]) || 0); }, 0); });
    var c = function (a, st) { return a.filter(function (x) { return x.status === st; }).length; };
    return { date: ds, launched: launched, launchDate: LAUNCH, salespeople: sales, management: mgmt,
      summary: { salespeople: { total: sales.length, completed: c(sales, 'completed'), inProgress: c(sales, 'in_progress'), missing: c(sales, 'missing') },
        management: { total: mgmt.length, submitted: c(mgmt, 'submitted'), missing: c(mgmt, 'missing') }, totals: totals } };
  }

  /* ---------- request router: same paths and response shapes as na1-backend ---------- */
  function route(method, path, body, query) {
    var u = requireMe(), s = getStore(), m;
    query = query || {}; body = body || {};
    if (method === 'GET') {
      if (path === '/auth/me') return safeUser(u);
      if (path === '/users/directory') return s.users.map(function (x) {
        var row = { id: x.id, name: x.name, role: x.role, team: x.team, managerId: x.managerId, jobTitle: x.jobTitle || null, avatarColor: x.avatar };
        if (isAdminRole(u)) { row.email = x.email; row.titleNeedsReview = !!x.titleNeedsReview; }
        return row;
      });
      if (path === '/units') { var t = scopeTeam(u, query); return s.units.filter(function (x) { return x.team === t && !x.deletedAt; }).map(function (x) { return unitOut(x, u.id); }); }
      if (path === '/owners') return ownersFor(u, scopeTeam(u, query));
      if (path === '/owners/cap') return { cap: 30 };
      if (path === '/owners/check-phone') return { match: null };
      if (path === '/admin/owners/deleted' || path === '/admin/units/deleted' || path === '/admin/owner-transfers' || path === '/admin/audit-log') return [];
      if (path === '/reference') { var rt = scopeTeam(u, query); return s.refs.filter(function (r) { return r.team === rt; }).map(function (r) { return { id: r.id, team: r.team, userId: r.userId, code: r.code, phone: r.phone, whatsapp: r.whatsapp }; }); }
      if (path === '/notifications') return notificationsFor(u);
      if (path === '/announcements') return [];
      if (path === '/requests') return requestsOut(u, scopeTeam(u, query));
      if (path === '/daily-reports/months') { var ms = {}; s.dailyReports.forEach(function (r) { if (r.salespersonId === u.id) ms[r.date.slice(0, 7)] = 1; }); return Object.keys(ms).sort(); }
      if ((m = path.match(/^\/daily-reports\/monthly\/(\d{4}-\d{2})$/))) return { month: m[1], reports: s.dailyReports.filter(function (r) { return r.salespersonId === u.id && r.date.slice(0, 7) === m[1]; }), totals: {} };
      if (path === '/daily-reports/mgmt') return s.mgmtReports.filter(function (r) { return r.userId === u.id; });
      if (path === '/daily-reports/team') { if (!isMgmtRole(u)) throw fail(403, 'Only management roles can use this endpoint'); return teamReports(u, query.date || cairoToday()); }
      throw fail(404, 'Demo Mode: no sample data for ' + path);
    }
    // ---- the few harmless actions that work in the preview (kept in this tab only) ----
    if (method === 'POST' && (m = path.match(/^\/units\/([^/]+)\/interactions$/))) {
      var un = s.units.find(function (x) { return x.id === m[1]; });
      var key = { view: 'views', call: 'calls', whatsapp: 'whatsapps', pdf: 'pdfs' }[body.type];
      if (!un || !key) throw fail(404, 'Unit not found');
      un[key] = un[key] || []; var created = un[key].indexOf(u.id) < 0; if (created) un[key].push(u.id); save();
      return { ok: true, newInteraction: created };
    }
    if (method === 'POST' && path === '/requests') {
      var text = typeof body.text === 'string' ? body.text.trim() : '';
      if (!text) throw fail(400, 'text is required');
      var team = scopeTeam(u, body), r = { id: uid('r'), team: team, authorId: u.id, text: text.slice(0, 2000), at: Date.now(), replies: [] };
      (s.requests[team] = s.requests[team] || []).push(r); s.readPos[u.id + '|' + team] = r.id; save();
      return { id: r.id };
    }
    if (method === 'PUT' && path === '/requests/read-position') {
      var tm = scopeTeam(u, body); s.readPos[u.id + '|' + tm] = body.requestId; save();
      var st = requestsOut(u, tm); return { lastReadRequestId: st.lastReadRequestId, unreadCount: st.unreadCount };
    }
    if (method === 'PATCH' && (m = path.match(/^\/notifications\/([^/]+)\/read$/))) {
      var n = s.notifications.find(function (x) { return x.id === m[1] && x.userId === u.id; });
      if (!n) throw fail(404, 'Notification not found');
      n.is_read = 1; save(); return { ok: true, unreadCount: notificationsFor(u).unreadCount };
    }
    if (method === 'PUT' && (m = path.match(/^\/daily-reports\/(\d{4}-\d{2}-\d{2})$/))) {
      if (u.role !== 'salesperson') throw fail(403, 'The detailed Daily Report is filed by salespeople.');
      var bad = filingDateProblem(m[1]); if (bad) throw fail(400, bad);
      var f = FIELDS.find(function (x) { return x[0] === body.section && x[1] === body.key; });
      if (!f) throw fail(400, 'Unknown field');
      if (body.value !== null && !(Number.isInteger(body.value) && body.value >= 0 && body.value <= 100000)) throw fail(400, 'Value must be a whole number from 0 to 100000, or null to clear it');
      var rep = s.dailyReports.find(function (x) { return x.salespersonId === u.id && x.date === m[1]; });
      if (!rep) { rep = { id: uid('dr'), salespersonId: u.id, date: m[1], status: 'in_progress', calls: {}, leads: {}, showings: {}, meetings: {}, other: {}, createdAt: Date.now(), updatedAt: Date.now(), completedAt: null }; FIELDS.forEach(function (x) { rep[x[0]][x[1]] = null; }); s.dailyReports.push(rep); }
      rep[f[0]][f[1]] = body.value; rep.updatedAt = Date.now();
      if (rep.status === 'completed' && body.value === null) { rep.status = 'in_progress'; rep.completedAt = null; }
      save(); return JSON.parse(JSON.stringify(rep));
    }
    if (method === 'POST' && (m = path.match(/^\/daily-reports\/(\d{4}-\d{2}-\d{2})\/complete$/))) {
      if (u.role !== 'salesperson') throw fail(403, 'The detailed Daily Report is filed by salespeople.');
      var bad2 = filingDateProblem(m[1]); if (bad2) throw fail(400, bad2);
      var rp = s.dailyReports.find(function (x) { return x.salespersonId === u.id && x.date === m[1]; });
      if (!rp) throw fail(404, 'No report for that date yet');
      if (!FIELDS.every(function (x) { return rp[x[0]][x[1]] !== null && rp[x[0]][x[1]] !== undefined; })) throw fail(400, 'Every field must have a value (0 is valid) before completing');
      rp.status = 'completed'; rp.completedAt = rp.updatedAt = Date.now(); save(); return JSON.parse(JSON.stringify(rp));
    }
    if (method === 'PUT' && (m = path.match(/^\/daily-reports\/mgmt\/(\d{4}-\d{2}-\d{2})$/))) {
      if (!isMgmtRole(u)) throw fail(403, 'Only management roles can use this endpoint');
      var bad3 = filingDateProblem(m[1]); if (bad3) throw fail(400, bad3);
      if (typeof body.comments !== 'string' || typeof body.activities !== 'string') throw fail(400, 'comments and activities must both be provided as text');
      var mr = s.mgmtReports.find(function (x) { return x.userId === u.id && x.date === m[1]; });
      if (!mr) { mr = { id: uid('mr'), userId: u.id, date: m[1], createdAt: Date.now() }; s.mgmtReports.push(mr); }
      mr.comments = body.comments; mr.activities = body.activities; mr.updatedAt = Date.now(); save();
      return JSON.parse(JSON.stringify(mr));
    }
    // Everything else (units, owners, admin, users, reference edits, announcements, photos…)
    // needs the real backend.
    throw blocked();
  }
  function call(method, path, body, query) {
    // Asynchronous like a real request, and deep-copied so pages can't mutate the store by accident.
    return new Promise(function (resolve, reject) {
      setTimeout(function () {
        try { var out = route(method, path, body, query); resolve(out === undefined ? null : JSON.parse(JSON.stringify(out))); }
        catch (e) { if (e && e.status === 401 && typeof onUnauthorized === 'function') onUnauthorized(); reject(e); }
      }, 0);
    });
  }

  var onUnauthorized = null;
  var DemoAPI = {
    ApiError: ApiError,
    isDemo: true,
    getToken: function () { var id = ss('get', SESSION_KEY); return id ? 'demo-session:' + id : null; },
    getAuthUser: function () { var raw = ss('get', USER_KEY); try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; } },
    isLoggedIn: function () { return !!ss('get', SESSION_KEY); },
    set onUnauthorized(fn) { onUnauthorized = fn; },
    // Demo sign-in: picks a demo account by its fixed id (e.g. 'm1'), or by its email. The
    // password is not used — there is no server and no real account behind it. This function
    // only exists in Demo Mode.
    login: function (account) {
      return new Promise(function (resolve, reject) {
        setTimeout(function () {
          var e = String(account || '').trim().toLowerCase();
          var u = e && getStore().users.find(function (x) { return x.id.toLowerCase() === e || (x.email || '').toLowerCase() === e; });
          if (!u) { reject(fail(401, 'That demo account was not found. Please reload the page and pick an account again.')); return; }
          ss('set', SESSION_KEY, u.id); ss('set', USER_KEY, JSON.stringify(safeUser(u)));
          resolve(safeUser(u));
        }, 0);
      });
    },
    changePassword: function () { return Promise.reject(fail(403, 'Demo Mode: demo accounts have no password, so there is nothing to change. Nothing was saved.')); },
    me: function () { return call('GET', '/auth/me'); },
    logout: function () { ss('del', SESSION_KEY); ss('del', USER_KEY); },
    // Puts the sample data back to its original state (Profile → Reset demo data).
    resetDemoData: function () { store = null; ss('del', STORE_KEY); },
    get: function (p, q) { return call('GET', p, undefined, q); },
    blob: function () { return Promise.reject(fail(404, 'Demo Mode: sample units have no uploaded photos.')); },
    post: function (p, b) { return call('POST', p, b); },
    put: function (p, b) { return call('PUT', p, b); },
    patch: function (p, b) { return call('PATCH', p, b); },
    del: function (p, b) { return call('DELETE', p, b); },
  };
  window.NA1_API = DemoAPI;
})();
