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

function renderLogin(){
  const groups = [
    {label:'Residential Team', role:'', team:'residential', ids:['s1','s2','s3','s6','tl1','m1','dir1']},
    {label:'Commercial Team', role:'', team:'commercial', ids:['s4','s5','s7','tl2','m2','dir2']},
    {label:'Company Leadership', ids:['hos1','ceo1']},
    {label:'Administration', ids:['ja1','sa1','ha1']},
  ];
  const cardFor = (id)=>{
    const u = DB.users.find(x=>x.id===id); if(!u) return '';
    return `<button class="login-card" data-uid="${u.id}" style="text-align:left; display:flex; align-items:center; gap:11px; padding:12px 14px; border-radius:10px; border:1px solid var(--border); background:var(--surface); width:100%; margin-bottom:8px;">
      <span class="avatar" style="background:${u.avatar}">${initials(u.name)}</span>
      <span style="flex:1">
        <span style="display:block; font-weight:700; font-size:13.5px;">${esc(u.name)}</span>
        <span style="display:block; font-size:11.5px; color:var(--text-faint);">${ROLE_LABELS[u.role]}${u.team?' · '+ (u.team[0].toUpperCase()+u.team.slice(1)):''}</span>
      </span>
      ${ic('chevron')}
    </button>`;
  };
  return `
  <div style="min-height:100vh; display:flex; align-items:center; justify-content:center; background:var(--bg); padding:24px;">
    <div style="max-width:920px; width:100%; display:grid; grid-template-columns:1.1fr 1fr; gap:0; border-radius:20px; overflow:hidden; box-shadow:0 30px 70px rgba(0,0,0,.12); border:1px solid var(--border);">
      <div style="background:linear-gradient(160deg,var(--brand-dark),var(--teal)); color:#fff; padding:44px 38px; display:flex; flex-direction:column; justify-content:space-between;">
        <div>
          <div style="width:44px;height:44px;border-radius:10px; background:rgba(255,255,255,.18); display:flex;align-items:center;justify-content:center; font-family:var(--font-head); font-weight:700; font-size:21px;">N</div>
          <h1 style="font-size:32px; margin-top:26px; color:#fff;">New Avenue 1</h1>
          <p style="opacity:.85; font-size:13.5px; max-width:280px; margin-top:10px;">The internal sales platform that brings leads, inventory, owners and requests into one place.</p>
        </div>
        <div style="font-size:11.5px; opacity:.7;">Internal prototype · Residential &amp; Commercial environments</div>
      </div>
      <div style="background:var(--surface); padding:36px 32px; max-height:80vh; overflow-y:auto;">
        <h2 style="font-size:16px; margin-bottom:2px;">Sign in as a demo account</h2>
        <p style="font-size:12px; color:var(--text-faint); margin-bottom:18px;">Pick any account below to explore the prototype from that person's seat.</p>
        ${groups.map(g=>`<div style="margin-bottom:16px;"><div style="font-size:10.5px; font-weight:800; text-transform:uppercase; letter-spacing:.04em; color:var(--text-faint); margin-bottom:7px;">${g.label}</div>${g.ids.map(cardFor).join('')}</div>`).join('')}
      </div>
    </div>
  </div>`;
}
function attachLoginEvents(){
  document.querySelectorAll('.login-card').forEach(b=>{
    b.addEventListener('click', ()=> setUser(b.dataset.uid));
  });
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
      return `<button class="mtab ${session.page===k?'active':''}" data-nav="${k}">${ic(it.icon)}<span>${it.label}</span>${badge>0?`<span class="nav-badge">${badge>9?'9+':badge}</span>`:''}</button>`;
    }).join('')}
  </div>`;
}

function attachShellEvents(u){
  document.querySelectorAll('[data-nav]').forEach(b=> b.addEventListener('click', ()=> go(b.dataset.nav)));
  const lo = document.getElementById('logoutBtn'); if(lo) lo.addEventListener('click', logout);
  const nb = document.getElementById('topNotifBtn'); if(nb) nb.addEventListener('click', ()=> go('notifications'));
  const tr = document.getElementById('teamViewRes'); if(tr) tr.addEventListener('click', ()=>{ session.activeTeamView='residential'; render(); });
  const tc = document.getElementById('teamViewCom'); if(tc) tc.addEventListener('click', ()=>{ session.activeTeamView='commercial'; render(); });
}

function renderPageInto(u){
  const root = document.getElementById('pageRoot');
  const renderers = {
    dashboard: renderDashboard, leads: renderLeadsPage, inventory: renderInventoryPage,
    myunits: renderMyUnitsPage, requests: renderRequestsPage, owners: renderOwnersPage,
    reference: renderReferencePage, notifications: renderNotificationsPage, admin: renderAdminPage,
    profile: renderProfilePage, reports: renderDailyReportPage
  };
  const fn = renderers[session.page] || renderDashboard;
  root.innerHTML = fn(u);
  const after = AFTER_RENDER[session.page];
  if(after) after(u);
}
const AFTER_RENDER = {};

