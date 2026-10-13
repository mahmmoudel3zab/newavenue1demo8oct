/* =========================================================
   ROOT RENDER
   ========================================================= */
function render(){
  const app = document.getElementById('app');
  const u = currentUser();
  if(!u){ app.innerHTML = renderLogin(); attachLoginEvents(); return; }
  syncNotifications(u);
  app.innerHTML = renderShell(u);
  attachShellEvents(u);
  renderPageInto(u);
}

// ---------------------------------------------------------------------------
// Sign-in screen. As of the backend-integration round this calls the REAL
// POST /api/auth/login endpoint (see js/api.js) — the backend verifies the
// password against a bcrypt hash and issues a JWT; nothing about identity is
// decided in the browser any more. The quick-fill demo list below is purely a
// convenience for exploring the prototype: clicking a card fills the email
// field and the shared demo password (every seeded account uses `Demo123!` —
// see na1-backend/src/seed/seed.js) and still submits through the real login
// call, it does not bypass it. Visual design is otherwise unchanged.
// ---------------------------------------------------------------------------
const DEMO_PASSWORD = 'Demo123!'; // matches na1-backend/src/seed/seed.js DEFAULT_PASSWORD
const LOGIN_GROUPS = [
  {label:'Residential Team', ids:['s1','s2','s3','s6','tl1','m1','dir1']},
  {label:'Commercial Team', ids:['s4','s5','s7','tl2','m2','dir2']},
  {label:'Company Leadership', ids:['hos1','ceo1']},
  {label:'Administration', ids:['ja1','sa1','ha1']},
  {label:'Human Resources', ids:['hr1']},
];
function renderLogin(){
  const q = (session._loginSearch||'').trim().toLowerCase();
  const matches = (u)=> !q || u.name.toLowerCase().includes(q) || displayTitle(u).toLowerCase().includes(q);
  const cardFor = (id)=>{
    const u = DB.users.find(x=>x.id===id); if(!u || !matches(u)) return '';
    return `<button type="button" class="login-card" data-uid="${u.id}" data-email="${esc(u.email||'')}">
      <span class="avatar login-card-avatar" style="background:${u.avatar}">${initials(u.name)}</span>
      <span class="login-card-info">
        <span class="login-card-name">${esc(u.name)}</span>
        <span class="login-card-role">${esc(displayTitle(u))}${u.team?' · '+ (u.team[0].toUpperCase()+u.team.slice(1)):''}</span>
      </span>
      ${ic('chevron')}
    </button>`;
  };
  const groupsHTML = LOGIN_GROUPS.map(g=>{
    const cards = g.ids.map(cardFor).filter(Boolean).join('');
    if(!cards) return '';
    return `<div class="login-group"><div class="login-group-label">${g.label}</div>${cards}</div>`;
  }).join('');
  // Demo-account quick-fill (names/emails of the prototype's accounts) is for demos only. A real
  // deployment sets window.NA1_SHOW_DEMO_ACCOUNTS = false (see index.html) to hide the whole list.
  const showDemoAccounts = window.NA1_SHOW_DEMO_ACCOUNTS !== false;
  const err = session._loginError;
  // Frontend Demo Mode (js/app-mode.js + js/demo-mode.js): static preview, sample data, no
  // backend. Only then is the password form replaced by one-click demo accounts.
  const demoMode = window.NA1_DEMO_MODE === true;
  const modeError = window.NA1_MODE_ERROR ? `<div class="mode-error" role="alert">${esc(window.NA1_MODE_ERROR)}</div>` : '';
  const accountList = `<div class="search-field login-search" style="margin:10px 0;">
            ${ic('search')}<input id="loginSearch" placeholder="Search by name or role…" value="${esc(session._loginSearch||'')}" autocomplete="off">
          </div>
          <div class="login-list" id="loginList">
            ${groupsHTML || `<div class="empty-state" style="padding:26px 10px;">${ic('search')}<div>No accounts match “${esc(session._loginSearch||'')}”.</div></div>`}
          </div>`;
  return `
  <div class="login-screen">
    <div class="login-shell">
      <div class="login-brandpane">
        <div class="login-brandpane-pattern"></div>
        <div class="login-brandpane-top">
          <div class="login-logo">
            <div class="login-logo-mark">N</div>
            <div><div class="login-logo-name">New Avenue</div><div class="login-logo-sub">Real Estate Consultancy</div></div>
          </div>
        </div>
        <div class="login-brandpane-mid">
          <h1>The sales platform<br>behind every deal.</h1>
          <p>Inventory, owners, leads and client requests — one connected workspace for New Avenue's entire residential and commercial sales organization.</p>
        </div>
        <div class="login-stats">
          <div class="login-stat"><div class="login-stat-num">2</div><div class="login-stat-label">Divisions</div></div>
          <div class="login-stat"><div class="login-stat-num">18</div><div class="login-stat-label">Sales &amp; admin seats</div></div>
          <div class="login-stat"><div class="login-stat-num">24/7</div><div class="login-stat-label">Live inventory</div></div>
        </div>
      </div>
      <div class="login-formpane">
        <div class="login-formpane-inner">
          ${modeError}
          ${demoMode ? `<span class="demo-badge demo-badge-light"><i class="db-dot"></i> Frontend Demo Mode</span>
          <h2>Sign in</h2>
          <p class="login-formpane-sub">Choose a demo account to explore — no password needed. This preview runs without a backend on sample data, and nothing you do is saved to a server.</p>
          ${err ? `<div class="login-error" style="color:#B0463F; font-size:12.5px; font-weight:700; margin-bottom:10px;">${esc(err)}</div>` : ''}
          ${session._loginBusy ? `<div class="login-foot" style="border:0; margin:0 0 6px; padding:0;">Signing in…</div>` : ''}
          <div class="login-foot" style="margin-top:4px;">Demo accounts — click an account to sign in instantly</div>
          ${accountList}
` : `
          <h2>Sign in</h2>
          <p class="login-formpane-sub">Enter your email and password to continue.</p>
          <form id="loginForm" autocomplete="on">
            <div class="search-field login-search" style="margin-bottom:10px;">
              <input id="loginEmail" type="email" placeholder="Email" value="${esc(session._loginEmail||'')}" autocomplete="username" required>
            </div>
            <div class="search-field login-search">
              <input id="loginPassword" type="password" placeholder="Password" autocomplete="current-password" required>
            </div>
            ${err ? `<div class="login-error" style="color:#B0463F; font-size:12.5px; font-weight:700; margin-top:10px;">${esc(err)}</div>` : ''}
            <button type="submit" id="loginSubmit" class="btn btn-primary" style="width:100%; margin-top:14px;">${session._loginBusy ? 'Signing in…' : 'Sign in'}</button>
          </form>
          ${showDemoAccounts ? `          <div class="login-foot" style="margin-top:18px;">Demo accounts — click to fill, password still required to sign in</div>
          ${accountList}
` : ''}`}
          <div class="login-foot">Internal prototype · Residential &amp; Commercial environments</div>
        </div>
      </div>
    </div>
  </div>`;
}
async function doLogin(email, password){
  session._loginError = null;
  session._loginBusy = true;
  render();
  try {
    const backendUser = await NA1_API.login(email, password);
    await setAuthenticatedUser(backendUser);
    session._loginBusy = false;
  } catch(e){
    session._loginBusy = false;
    session._loginError = (e && e.message) ? e.message : 'Sign in failed. Please try again.';
    render();
  }
}
function attachLoginEvents(){
  document.querySelectorAll('.login-card').forEach(b=>{
    b.addEventListener('click', (e)=>{
      // Quick-fill only — pre-fills the email + shared demo password so exploring the
      // prototype stays one click, but the real login call below is still what runs.
      const btn = e.currentTarget;
      // Frontend Demo Mode only: there is no backend, so picking an account signs in straight
      // away (handled by js/demo-mode.js, which never contacts a server). In Full Application
      // Mode this branch cannot run and the card only pre-fills the real login form below.
      if(window.NA1_DEMO_MODE === true){
        if(session._loginBusy) return;
        btn.classList.add('is-loading');
        doLogin(btn.dataset.email || '', null);
        return;
      }
      session._loginEmail = btn.dataset.email || '';
      const emailEl = document.getElementById('loginEmail');
      const pwEl = document.getElementById('loginPassword');
      if(emailEl) emailEl.value = session._loginEmail;
      if(pwEl) pwEl.value = DEMO_PASSWORD;
      if(emailEl) emailEl.focus();
    });
  });
  const form = document.getElementById('loginForm');
  if(form){
    form.addEventListener('submit', (e)=>{
      e.preventDefault();
      if(session._loginBusy) return;
      const email = (document.getElementById('loginEmail')||{}).value || '';
      const password = (document.getElementById('loginPassword')||{}).value || '';
      session._loginEmail = email;
      doLogin(email.trim(), password);
    });
  }
  const s = document.getElementById('loginSearch');
  if(s){
    s.addEventListener('input', ()=>{ session._loginSearch = s.value; render(); });
    if(session._loginSearchFocused){ s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
    s.addEventListener('focus', ()=>{ session._loginSearchFocused = true; });
    s.addEventListener('blur', ()=>{ session._loginSearchFocused = false; });
  }
}

// Header-band helpers (presentation only). The search box hands its text to the News Feed's
// existing search (session.invSearch) and opens that page — no new data or permissions involved.
// The Daily Report pill only reads the user's existing report status and links to Daily Reports.
function shellDateLabel(){
  try { return new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' }); }
  catch(e){ return ''; }
}
function shellReportPill(u){
  if(!isSalesActive(u)) return '';
  const ds = effectiveTodayStr();
  if(!isOnOrAfterLaunch(ds)) return '';
  const st = personalReportStatus(u, ds);
  const label = st==='completed' ? 'Completed' : st==='in_progress' ? 'In progress' : 'Not started';
  return `<button class="report-pill ${st==='completed'?'done':''}" data-nav="reports" title="Open today's Daily Report">${ic('calendar')}<span class="rp-label">Daily Report · ${label}</span></button>`;
}
function renderShell(u){
  const items = navItems(u);
  const teamKey = myTeamKey(u);
  const envLabel = teamKey[0].toUpperCase()+teamKey.slice(1);
  return `
  <div class="sidebar">
    <div class="brand">
      <div class="brand-mark">N</div>
      <div><div class="brand-name">New Avenue 1</div><div class="brand-sub">Internal Sales Platform</div></div>
    </div>
    ${(!u.team) ? `<div style="padding:0 6px 14px 6px;"><div class="sidebar-env-label">Viewing environment</div>
      <div class="env-switch">
        <button class="${teamKey==='residential'?'on':''}" id="teamViewRes">Residential</button>
        <button class="${teamKey==='commercial'?'on':''}" id="teamViewCom">Commercial</button>
      </div></div>` : `<div style="padding:0 8px 14px 8px;"><span class="team-pill ${u.team}">${u.team}</span></div>`}
    <nav style="display:flex; flex-direction:column; gap:2px;">
      ${items.map(it=>{
        const badge = it.badge ? it.badge() : 0;
        return `<button class="nav-item ${session.page===it.key?'active':''}" data-nav="${it.key}">${ic(it.icon)}<span>${it.label}</span>${badge>0?`<span class="nav-badge">${badge>9?'9+':badge}</span>`:''}</button>`;
      }).join('')}
    </nav>
    <div class="sidebar-foot">
      <div class="nav-divider"></div>
      <button class="nav-item" id="changePwBtn">${ic('lock')}<span>Change password</span></button>
      <button class="nav-item" id="logoutBtn">${ic('logout')}<span>Switch account</span></button>
    </div>
  </div>
  <div id="main">
    <div class="topbar">
      <div class="topbar-row">
        ${window.NA1_DEMO_MODE === true ? `<span class="demo-badge" title="Frontend Demo Mode — sample data, no backend, nothing is saved"><i class="db-dot"></i><span class="db-label">Demo Mode</span></span>` : ''}
        <form class="global-search" id="globalSearchForm" role="search">
          <span class="gs-env"><i></i>${envLabel}</span>${ic('search')}
          <input id="globalSearchInput" type="search" placeholder="Search units by compound, developer or area" aria-label="Search the News Feed" autocomplete="off">
          <kbd>Enter</kbd>
        </form>
        <div class="topbar-spacer"></div>
        ${shellReportPill(u)}
        <button class="icon-btn" id="topNotifBtn" aria-label="Notifications">${ic('notif')}${unreadNotifCount(u)>0?`<span class="dot-badge">${unreadNotifCount(u)>9?'9+':unreadNotifCount(u)}</span>`:''}</button>
        <div class="user-chip">
          <span class="avatar" style="background:${u.avatar}; width:32px;height:32px;font-size:11.5px;">${initials(u.name)}</span>
          <span><span class="user-chip-name" style="display:block;">${esc(u.name)}</span><span class="user-chip-role">${esc(displayTitle(u))}</span></span>
        </div>
      </div>
      <div class="topbar-head">
        <div class="topbar-eyebrow">${esc(envLabel)} · ${esc(shellDateLabel())}</div>
        <div class="topbar-title">${(navItems(u).find(i=>i.key===session.page)||{}).label || (typeof PAGE_LABELS!=='undefined'?PAGE_LABELS[session.page]:'') || ''}</div>
      </div>
    </div>
    <div class="page" id="pageRoot"></div>
  </div>
  <div class="mobile-tabbar">
    ${MOBILE_TABS.map(k=>{
      const it = items.find(i=>i.key===k); if(!it) return '';
      const badge = it.badge?it.badge():0;
      const active = session.page===k && !session._moreOpen;
      return `<button class="mtab ${active?'active':''}" data-nav="${k}"><span class="mtab-icon-wrap">${ic(it.icon)}${badge>0?`<span class="nav-badge">${badge>9?'9+':badge}</span>`:''}</span><span>${it.label}</span></button>`;
    }).join('')}
    ${renderMoreTab(u)}
  </div>
  ${session._moreOpen ? renderMoreDrawer(u) : ''}`;
}

// The mobile "More" drawer — this is where every nav item NOT pinned to the 4 fixed tabs
// (Dashboard, News Feed, Requests, Reference are the fixed tabs) lives: Owners, My Units,
// Leads (if enabled), Daily Reports, Notifications, Admin, Profile, Switch account. Nothing
// here is removed from the app; it's one tap away instead of a fixed icon, exactly as the
// spec explicitly allows.
function renderMoreTab(u){
  const moreItems = mobileMoreItems(u);
  const badge = mobileMoreBadgeTotal(u);
  const active = session._moreOpen || moreItems.some(it=>it.key===session.page);
  return `<button class="mtab ${active?'active':''}" id="moreTabBtn"><span class="mtab-icon-wrap">${ic('more')}${badge>0?`<span class="nav-badge">${badge>9?'9+':badge}</span>`:''}</span><span>More</span></button>`;
}
function renderMoreDrawer(u){
  const moreItems = mobileMoreItems(u);
  return `<div class="drawer-backdrop" id="moreDrawerBackdrop">
    <div class="drawer-sheet">
      <div class="drawer-handle"></div>
      <div style="font-weight:800; font-size:14px; padding:0 4px 10px;">More</div>
      ${moreItems.map(it=>{
        const badge = it.badge?it.badge():0;
        return `<button class="nav-item drawer-item ${session.page===it.key?'active':''}" data-nav="${it.key}" data-closemore="1">${ic(it.icon)}<span>${it.label}</span>${badge>0?`<span class="nav-badge">${badge>9?'9+':badge}</span>`:''}</button>`;
      }).join('')}
      <div class="nav-divider"></div>
      <button class="nav-item drawer-item" id="drawerChangePwBtn">${ic('lock')}<span>Change password</span></button>
      <button class="nav-item drawer-item" id="drawerLogoutBtn">${ic('logout')}<span>Switch account</span></button>
    </div>
  </div>`;
}

function attachShellEvents(u){
  document.querySelectorAll('[data-nav]').forEach(b=> b.addEventListener('click', ()=>{ session._moreOpen=false; go(b.dataset.nav); }));
  const lo = document.getElementById('logoutBtn'); if(lo) lo.addEventListener('click', logout);
  const cp = document.getElementById('changePwBtn'); if(cp) cp.addEventListener('click', openChangePasswordModal);
  const dcp = document.getElementById('drawerChangePwBtn'); if(dcp) dcp.addEventListener('click', ()=>{ session._moreOpen=false; openChangePasswordModal(); });
  const nb = document.getElementById('topNotifBtn'); if(nb) nb.addEventListener('click', ()=> go('notifications'));
  const tr = document.getElementById('teamViewRes'); if(tr) tr.addEventListener('click', ()=> switchTeamView('residential'));
  const tc = document.getElementById('teamViewCom'); if(tc) tc.addEventListener('click', ()=> switchTeamView('commercial'));
  const mb = document.getElementById('moreTabBtn'); if(mb) mb.addEventListener('click', ()=>{ session._moreOpen = !session._moreOpen; render(); });
  const bd = document.getElementById('moreDrawerBackdrop'); if(bd) bd.addEventListener('click', (e)=>{ if(e.target===bd){ session._moreOpen=false; render(); } });
  const dlo = document.getElementById('drawerLogoutBtn'); if(dlo) dlo.addEventListener('click', ()=>{ session._moreOpen=false; logout(); });
  // Header search → the News Feed's existing search field (same filter, same data).
  const gs = document.getElementById('globalSearchForm');
  if(gs) gs.addEventListener('submit', (e)=>{
    e.preventDefault();
    const inp = document.getElementById('globalSearchInput');
    session.invSearch = (inp && inp.value || '').trim();
    session._moreOpen = false;
    go('inventory');
  });
}

// Part 6 — navigation fix: a page reachable only indirectly (e.g. Company Announcements,
// opened from a notification rather than a nav item for most employees — see
// pages/announcements.js) has no entry in navItems(u) for that viewer, which previously left
// the topbar title blank. PAGE_LABELS is the fallback for exactly that case, so the topbar
// always shows where you are, however you got there.
const PAGE_LABELS = {
  dashboard:'Dashboard', leads:'Leads', inventory:'News Feed', myunits:'My Units',
  requests:'Requests', owners:'Owners', reference:'Reference', notifications:'Notifications',
  admin:'Admin', profile:'Profile', reports:'Daily Reports', announcements:'Company Announcements'
};
function renderPageInto(u){
  const root = document.getElementById('pageRoot');
  const renderers = {
    dashboard: renderDashboard, leads: renderLeadsPage, inventory: renderInventoryPage,
    myunits: renderMyUnitsPage, requests: renderRequestsPage, owners: renderOwnersPage,
    reference: renderReferencePage, notifications: renderNotificationsPage, admin: renderAdminPage,
    profile: renderProfilePage, reports: renderDailyReportPage, announcements: renderAnnouncementsPage
  };
  const fn = renderers[session.page] || renderDashboard;
  root.innerHTML = fn(u);
  const titleEl = document.querySelector('.topbar-title');
  if(titleEl) titleEl.textContent = (navItems(u).find(i=>i.key===session.page)||{}).label || PAGE_LABELS[session.page] || '';
  const after = AFTER_RENDER[session.page];
  if(after) after(u);
}
const AFTER_RENDER = {};



// Own-account password change (POST /auth/change-password). Passwords are only ever sent to the
// server over the API call; nothing is stored in the page or in browser storage.
function openChangePasswordModal(){
  openModal(`
  <div class="modal-head"><div style="font-weight:800;">Change password</div><button class="close-x" id="modalCloseX">${ic('x')}</button></div>
  <div class="modal-body">
    <div class="field"><label class="field-label">Current password</label><input id="cp_cur" type="password" autocomplete="current-password"></div>
    <div class="field"><label class="field-label">New password (8–128 characters)</label><input id="cp_new" type="password" autocomplete="new-password"></div>
    <div class="field"><label class="field-label">Repeat new password</label><input id="cp_rep" type="password" autocomplete="new-password"></div>
  </div>
  <div class="modal-foot"><button class="btn btn-primary" id="cp_save">Change password</button></div>`);
  document.getElementById('modalCloseX').addEventListener('click', closeModal);
  document.getElementById('cp_save').addEventListener('click', async ()=>{
    const cur = document.getElementById('cp_cur').value, nw = document.getElementById('cp_new').value, rep = document.getElementById('cp_rep').value;
    if(!cur){ toast('Enter your current password'); return; }
    if(nw.length < 8 || nw.length > 128){ toast('New password must be 8–128 characters'); return; }
    if(nw !== rep){ toast('The new passwords do not match'); return; }
    const btn = document.getElementById('cp_save'); btn.disabled = true;
    try{ await NA1_API.changePassword(cur, nw); closeModal(); toast('Password changed'); }
    catch(e){ btn.disabled = false; toast((e && e.isNetworkError) ? 'Could not reach the server — password NOT changed.' : ((e && e.message) || 'Password change failed')); }
  });
}
