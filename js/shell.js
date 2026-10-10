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
// Sign-in screen. This is a FRONTEND DEMO PROTOTYPE: there is no real password
// auth here, and nothing about this screen's visual polish changes that — it
// simply lets you pick any seeded demo account to explore the app from that
// person's seat, exactly as before. Nothing about the underlying login
// mechanism (setUser/sessionStorage) changed, only how it looks and how the
// account list is browsed.
// ---------------------------------------------------------------------------
const LOGIN_GROUPS = [
  {label:'Residential Team', ids:['s1','s2','s3','s6','tl1','m1','dir1']},
  {label:'Commercial Team', ids:['s4','s5','s7','tl2','m2','dir2']},
  {label:'Company Leadership', ids:['hos1','ceo1']},
  {label:'Administration', ids:['ja1','sa1','ha1']},
  {label:'Human Resources', ids:['hr1']},
];
function renderLogin(){
  const q = (session._loginSearch||'').trim().toLowerCase();
  const matches = (u)=> !q || u.name.toLowerCase().includes(q) || ROLE_LABELS[u.role].toLowerCase().includes(q);
  const cardFor = (id)=>{
    const u = DB.users.find(x=>x.id===id); if(!u || !matches(u)) return '';
    return `<button class="login-card" data-uid="${u.id}">
      <span class="avatar login-card-avatar" style="background:${u.avatar}">${initials(u.name)}</span>
      <span class="login-card-info">
        <span class="login-card-name">${esc(u.name)}</span>
        <span class="login-card-role">${ROLE_LABELS[u.role]}${u.team?' · '+ (u.team[0].toUpperCase()+u.team.slice(1)):''}</span>
      </span>
      ${ic('chevron')}
    </button>`;
  };
  const groupsHTML = LOGIN_GROUPS.map(g=>{
    const cards = g.ids.map(cardFor).filter(Boolean).join('');
    if(!cards) return '';
    return `<div class="login-group"><div class="login-group-label">${g.label}</div>${cards}</div>`;
  }).join('');
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
          <h2>Sign in</h2>
          <p class="login-formpane-sub">This is an internal prototype — choose a demo account below to continue. No password is required in this demo environment.</p>
          <div class="search-field login-search">
            ${ic('search')}<input id="loginSearch" placeholder="Search by name or role…" value="${esc(session._loginSearch||'')}" autocomplete="off">
          </div>
          <div class="login-list" id="loginList">
            ${groupsHTML || `<div class="empty-state" style="padding:26px 10px;">${ic('search')}<div>No accounts match “${esc(session._loginSearch||'')}”.</div></div>`}
          </div>
          <div class="login-foot">Internal prototype · Residential &amp; Commercial environments</div>
        </div>
      </div>
    </div>
  </div>`;
}
function attachLoginEvents(){
  document.querySelectorAll('.login-card').forEach(b=>{
    b.addEventListener('click', (e)=>{
      // Brief loading state on the clicked card before handing off to setUser(), so switching
      // accounts reads as a real sign-in action rather than an instant, jarring page swap.
      const btn = e.currentTarget;
      if(btn.classList.contains('is-loading')) return;
      btn.classList.add('is-loading');
      btn.disabled = true;
      setTimeout(()=> setUser(btn.dataset.uid), 220);
    });
  });
  const s = document.getElementById('loginSearch');
  if(s){
    s.addEventListener('input', ()=>{ session._loginSearch = s.value; render(); });
    if(session._loginSearchFocused){ s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
    s.addEventListener('focus', ()=>{ session._loginSearchFocused = true; });
    s.addEventListener('blur', ()=>{ session._loginSearchFocused = false; });
  }
}

function renderShell(u){
  const items = navItems(u);
  const teamKey = myTeamKey(u);
  return `
  <div class="sidebar">
    <div class="brand">
      <div class="brand-mark">N</div>
      <div><div class="brand-name">New Avenue 1</div><div class="brand-sub">Internal Sales Platform</div></div>
    </div>
    ${(!u.team) ? `<div style="padding:0 10px 12px 10px;"><div style="font-size:10.5px; font-weight:800; color:var(--text-faint); text-transform:uppercase; margin-bottom:6px;">Viewing environment</div>
      <div style="display:flex; gap:6px;">
        <button class="btn btn-sm ${teamKey==='residential'?'btn-primary':''}" id="teamViewRes" style="flex:1; justify-content:center;">Residential</button>
        <button class="btn btn-sm ${teamKey==='commercial'?'btn-primary':''}" id="teamViewCom" style="flex:1; justify-content:center;">Commercial</button>
      </div></div>` : `<div style="padding:0 10px 12px 10px;"><span class="team-pill ${u.team}">${u.team}</span></div>`}
    <nav style="display:flex; flex-direction:column; gap:2px;">
      ${items.map(it=>{
        const badge = it.badge ? it.badge() : 0;
        return `<button class="nav-item ${session.page===it.key?'active':''}" data-nav="${it.key}">${ic(it.icon)}<span>${it.label}</span>${badge>0?`<span class="nav-badge">${badge>9?'9+':badge}</span>`:''}</button>`;
      }).join('')}
    </nav>
    <div class="sidebar-foot">
      <div class="nav-divider"></div>
      <button class="nav-item" id="logoutBtn">${ic('logout')}<span>Switch account</span></button>
    </div>
  </div>
  <div id="main">
    <div class="topbar">
      <div class="topbar-title">${navItems(u).find(i=>i.key===session.page)?.label || ''}</div>
      <div class="topbar-spacer"></div>
      <button class="icon-btn" id="topNotifBtn">${ic('notif')}${unreadNotifCount(u)>0?`<span class="dot-badge">${unreadNotifCount(u)>9?'9+':unreadNotifCount(u)}</span>`:''}</button>
      <div class="user-chip">
        <span class="avatar" style="background:${u.avatar}; width:26px;height:26px;font-size:11px;">${initials(u.name)}</span>
        <span><span class="user-chip-name" style="display:block;">${esc(u.name)}</span><span class="user-chip-role">${ROLE_LABELS[u.role]}</span></span>
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
      <button class="nav-item drawer-item" id="drawerLogoutBtn">${ic('logout')}<span>Switch account</span></button>
    </div>
  </div>`;
}

function attachShellEvents(u){
  document.querySelectorAll('[data-nav]').forEach(b=> b.addEventListener('click', ()=>{ session._moreOpen=false; go(b.dataset.nav); }));
  const lo = document.getElementById('logoutBtn'); if(lo) lo.addEventListener('click', logout);
  const nb = document.getElementById('topNotifBtn'); if(nb) nb.addEventListener('click', ()=> go('notifications'));
  const tr = document.getElementById('teamViewRes'); if(tr) tr.addEventListener('click', ()=>{ session.activeTeamView='residential'; render(); });
  const tc = document.getElementById('teamViewCom'); if(tc) tc.addEventListener('click', ()=>{ session.activeTeamView='commercial'; render(); });
  const mb = document.getElementById('moreTabBtn'); if(mb) mb.addEventListener('click', ()=>{ session._moreOpen = !session._moreOpen; render(); });
  const bd = document.getElementById('moreDrawerBackdrop'); if(bd) bd.addEventListener('click', (e)=>{ if(e.target===bd){ session._moreOpen=false; render(); } });
  const dlo = document.getElementById('drawerLogoutBtn'); if(dlo) dlo.addEventListener('click', ()=>{ session._moreOpen=false; logout(); });
}

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
  const after = AFTER_RENDER[session.page];
  if(after) after(u);
}
const AFTER_RENDER = {};

