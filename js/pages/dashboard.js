/* =========================================================
   DASHBOARD
   ========================================================= */
function renderDashboard(u){
  const teamKey = myTeamKey(u);
  const allUnits = visibleUnits(u);
  const units = allUnits.slice().sort((a,b)=>popularityScore(b)-popularityScore(a)).slice(0,4);
  const reqList = requestsFor(teamKey);
  const unread = unreadCountFor(u);
  const recentReq = reqList.slice(-3).reverse();
  const envLabel = teamKey[0].toUpperCase()+teamKey.slice(1);

  // Inventory at a glance — counts read from the same visible inventory the News Feed shows.
  const weekAgo = Date.now() - 7*86400000;
  const newThisWeek = allUnits.filter(x=>x.createdAt && x.createdAt>=weekAgo).length;
  const immediate = allUnits.filter(x=>x.deliveryYears===0).length;
  const pendingCount = allUnits.filter(x=>x.pending).length;
  const kpis = `<div class="dash-kpis">
    <div class="card dash-kpi"><b>${allUnits.length.toLocaleString('en-US')}</b><span>Live units · ${esc(envLabel)}</span></div>
    <div class="card dash-kpi"><b>${newThisWeek}</b><span>New this week</span></div>
    <div class="card dash-kpi"><b>${immediate}</b><span>Immediate delivery</span></div>
    <div class="card dash-kpi"><b>${pendingCount}</b><span>Pending admin review</span></div>
  </div>`;

  // "Your day" — the same Daily Report status the old banner showed, as a progress card.
  let dayCard;
  if(isSalesActive(u)){
    const ds = effectiveTodayStr();
    const launched = isOnOrAfterLaunch(ds);
    const st = launched ? personalReportStatus(u, ds) : null;
    if(launched && !isMgmt(u)){
      const r = getDailyReport(u.id, ds);
      const secs = (typeof REPORT_SECTIONS!=='undefined') ? REPORT_SECTIONS : [];
      let filled = 0, total = 0;
      const segs = secs.map(sec=>{
        const n = sec.fields.filter(([k])=> r && r[sec.key] && r[sec.key][k]!==null && r[sec.key][k]!==undefined).length;
        filled += n; total += sec.fields.length;
        return `<i class="${n===sec.fields.length?'on':''}"></i>`;
      }).join('');
      const labels = secs.map(sec=>`<span>${esc(sec.title.split(' ')[0])}</span>`).join('');
      dayCard = `<div class="card day-card">
        <div class="card-head"><h3>Your Daily Report</h3>${st==='completed'?'<span class="badge badge-success">Completed</span>':st==='in_progress'?'<span class="badge badge-pending">In progress</span>':'<span class="badge badge-fresh">Not started</span>'}</div>
        <div class="day-body">
          <div class="day-big"><b>${filled}</b><span>/ ${total} fields</span></div>
          <div class="seg-bar">${segs}</div><div class="seg-labels">${labels}</div>
          <button class="btn btn-primary" data-nav="reports" style="width:100%; justify-content:center; margin-top:16px;">${st==='completed'?'View report':'Open Daily Report'}</button>
        </div></div>`;
    } else if(launched){
      dayCard = `<div class="card day-card">
        <div class="card-head"><h3>Your Daily Report</h3>${st==='completed'?'<span class="badge badge-success">Submitted</span>':'<span class="badge badge-pending">Draft</span>'}</div>
        <div class="day-body"><p style="margin:0 0 14px; color:var(--text-muted); font-size:13px;">Just two quick fields — your comments and activities for today.</p>
          <button class="btn btn-primary" data-nav="reports" style="width:100%; justify-content:center;">${st==='completed'?'View report':'Open Daily Report'}</button></div></div>`;
    } else {
      dayCard = `<div class="card day-card"><div class="card-head"><h3>Daily Reports</h3><span class="badge badge-muted">Opens ${esc(DAILY_REPORT_LAUNCH_DATE)}</span></div>
        <div class="day-body"><p style="margin:0; color:var(--text-muted); font-size:13px;">Welcome back, ${esc(u.name.split(' ')[0])}. Daily Performance Reports start on ${esc(DAILY_REPORT_LAUNCH_DATE)}.</p></div></div>`;
    }
  } else {
    dayCard = `<div class="card welcome-card"><div class="section-title">Welcome back, ${esc(u.name.split(' ')[0])}</div>
      <div class="section-sub" style="margin-bottom:0;">${esc(displayTitle(u))}${u.team? ' · '+u.team[0].toUpperCase()+u.team.slice(1):' · Company-wide'}</div></div>`;
  }

  const newsCard = `<div class="card">
    <div class="card-head"><h3>Popular in the News Feed</h3><button class="link" data-nav="inventory">See all ${allUnits.length.toLocaleString('en-US')} ${ic('chevron')}</button></div>
    ${units.length? units.map(un=>unitMiniRow(un)).join('') : emptyRow('No inventory yet')}
  </div>`;

  const referencesCard = renderDashboardReferencesCard(u, teamKey);

  const reqCard = `<div class="card">
    <div class="card-head"><h3>Requests</h3>${unread>0?`<span class="badge badge-brand">${unread} new</span>`:`<small>${esc(envLabel)} team</small>`}</div>
    ${recentReq.length? recentReq.map(r=>{
      const a = DB.users.find(x=>x.id===r.authorId);
      return `<div class="req-row"><div class="rr-w"><b>${esc(a?a.name:'?')}</b></div><p>${esc(r.text)}</p></div>`;
    }).join('') : emptyRow('No requests yet')}
    <div class="card-foot"><button class="btn btn-sm" data-nav="requests" style="width:100%; justify-content:center;">Open Requests ${ic('chevron')}</button></div>
  </div>`;

  let teamCard = '';
  if(isMgmt(u)){
    const downIds = getDownlineIds(DB.users, u.id);
    // Includes EVERY sales-active downline member — plain salespeople AND any management role below.
    const downUsers = DB.users.filter(x=>downIds.includes(x.id) && isSalesActive(x));
    const ds = effectiveTodayStr();
    const launched = isOnOrAfterLaunch(ds);
    let done=0, prog=0, miss=0;
    const rows = downUsers.map(su=>{
      const sun = DB.units.filter(x=>x.ownerSalespersonId===su.id && !x.deletedAt).length;
      const so = distinctOwnerCountForSalesperson(su.id);
      const st = launched ? personalReportStatus(su, ds) : 'n/a';
      if(st==='completed') done++; else if(st==='in_progress') prog++; else if(st==='missing') miss++;
      const stBadge = st==='completed' ? '<span class="badge badge-success">Completed</span>' : st==='in_progress' ? '<span class="badge badge-pending">In progress</span>' : st==='missing' ? '<span class="badge badge-fresh">Missing</span>' : '<span class="badge badge-muted">—</span>';
      return `<div class="list-row"><span class="avatar" style="background:${su.avatar}; width:34px; height:34px; font-size:11.5px;">${initials(su.name)}</span>
        <div class="lr-t"><b>${esc(su.name)}</b><small>${esc(displayTitle(su))} · ${sun} units · ${so}/30 owners</small></div>${stBadge}</div>`;
    }).join('');
    const tot = Math.max(1, done+prog+miss);
    teamCard = `<div class="card">
      <div class="card-head"><h3>Team today</h3><small>${downUsers.length} below you</small></div>
      ${downUsers.length ? rows : emptyRow('No team members yet.')}
      ${launched && downUsers.length ? `<div class="stack-bar"><span style="flex:${done};background:var(--success)"></span><span style="flex:${prog};background:#E0A848"></span><span style="flex:${miss};background:var(--danger)"></span>${(done+prog+miss)===0?'<span style="flex:1;background:var(--surface-3)"></span>':''}</div>
      <div class="stack-legend"><span>${done} completed</span><span>${prog} in progress</span><span>${miss} missing</span></div>` : ''}
    </div>`;
  }

  let adminCard = '';
  if(isAdmin(u)){
    const pendingUnits = DB.units.filter(x=>x.pending && !x.deletedAt).length;
    const pendingTransfers = DB.transfers.filter(t=>t.status==='pending').length;
    adminCard = `<div class="card">
      <div class="card-head"><h3>Admin queue</h3><small>Needs review</small></div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; padding:4px 20px 6px;">
        <div class="dash-kpi" style="background:var(--surface-2); border-radius:14px;"><b>${pendingUnits}</b><span>Units pending review</span></div>
        <div class="dash-kpi" style="background:var(--surface-2); border-radius:14px;"><b>${pendingTransfers}</b><span>Owner transfer requests</span></div>
      </div>
      <div class="card-foot" style="border:0;"><button class="btn btn-primary btn-sm" data-nav="admin" style="width:100%; justify-content:center;">Go to Admin panel</button></div>
    </div>`;
  }

  const third = (teamCard || adminCard) ? `<div class="dash-col">${teamCard}${adminCard}</div>` : '';
  return `${kpis}<div class="dash-grid${third?'':' two'}">
    <div class="dash-col">${dayCard}${reqCard}</div>
    <div class="dash-col">${newsCard}${referencesCard}</div>
    ${third}
  </div>`;
}

/* =========================================================
   PART 5 — Dashboard References card
   Replaces the old "My Units" summary card on the Dashboard ONLY. My Units itself is untouched
   and still fully reachable from the normal navigation (sidebar / mobile More drawer) — see
   navItems() in session.js, unchanged. "References" here means the salesperson CONTACT
   DIRECTORY (same data/permission rules as the full Reference page in pages/reference.js — see
   that file's header comment), not a unit/compound reference list. Uses real DB.refs/DB.users
   data only; nothing here is hardcoded or fabricated. A small, dashboard-scoped search field
   lets the person jump straight to a colleague without leaving the Dashboard; "Open full
   directory" goes to the complete Reference page for everyone else.
   ========================================================= */
function renderDashboardReferencesCard(u, teamKey){
  const q = (session._dashRefSearch||'').trim().toLowerCase();
  let list = DB.refs.filter(r=>r.team===teamKey).map(r=>({r, person: refUser(r)})).filter(x=>x.person);
  if(q) list = list.filter(({r,person})=> person.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q));
  list = list.slice().sort((a,b)=>a.person.name.localeCompare(b.person.name));
  const shown = list.slice(0,4);
  return `<div class="card">
    <div class="card-head"><h3>Reference</h3><button class="link" data-nav="reference">Full directory ${ic('chevron')}</button></div>
    <div class="search-field" style="margin:0 20px 10px;">
      ${ic('search')}<input id="dashRefSearch" placeholder="Search by name or reference code…" value="${esc(session._dashRefSearch||'')}">
    </div>
    ${shown.length? shown.map(({r,person})=>dashboardRefRow(r,person)).join('') : emptyRow(q?'No one matches that search.':'No directory entries yet.')}
    ${list.length>shown.length ? `<div style="font-size:12px; color:var(--text-faint); padding:8px 20px 14px;">+${list.length-shown.length} more in the full directory</div>` : '<div style="height:6px"></div>'}
  </div>`;
}
function dashboardRefRow(r,person){
  return `<div class="list-row" style="padding:9px 20px;">
    <span class="avatar" style="background:${avatarColor(person.name)}; width:34px;height:34px; font-size:11.5px;">${initials(person.name)}</span>
    <div class="lr-t"><b>${esc(person.name)}</b><small>${esc(displayTitle(person))}${r.code?' · '+esc(r.code):''}</small></div>
    <a class="mini-act dark" href="${telHref(r.phone)}" title="Call ${esc(person.name)}" aria-label="Call ${esc(person.name)}">${ic('phone')}</a>
    <a class="mini-act" href="${waHref(r.whatsapp)}" target="_blank" rel="noopener" title="WhatsApp ${esc(person.name)}" aria-label="WhatsApp ${esc(person.name)}">${ic('whatsapp')}</a>
  </div>`;
}
function unitMiniRow(un){
  return `<div class="unit-mini list-row" data-unit="${un.id}">
    <div class="scrim-photo">${(un.photoIds&&un.photoIds.length)?`<img data-photo-id="${un.photoIds[0]}" data-photo-size="thumb" alt="">`:''}</div>
    <div class="lr-t"><b>${esc(un.compound)}</b><small>${esc(un.unitType)} · ${esc(un.area)}${un.pending?' · Pending review':''}</small></div>
    <div class="lr-p">${fmtMoney(un.totalPrice)}<small>DP ${fmtMoney(un.downPayment)}</small></div>
  </div>`;
}
function emptyRow(text){ return `<div style="padding:16px 20px; font-size:12.5px; color:var(--text-faint); text-align:center;">${text}</div>`; }
AFTER_RENDER.dashboard = function(u){
  document.querySelectorAll('.unit-mini').forEach(el=> el.addEventListener('click', ()=> openUnitModal(el.dataset.unit, u)));
  document.querySelectorAll('[data-nav]').forEach(b=> b.addEventListener('click', ()=> go(b.dataset.nav)));
  const rs = document.getElementById('dashRefSearch');
  if(rs){
    rs.addEventListener('input', ()=>{ session._dashRefSearch = rs.value; renderPageInto(u); });
    if(session._dashRefSearchFocused){ rs.focus(); rs.setSelectionRange(rs.value.length, rs.value.length); }
    rs.addEventListener('focus', ()=>{ session._dashRefSearchFocused = true; });
    rs.addEventListener('blur', ()=>{ session._dashRefSearchFocused = false; });
  }
};

