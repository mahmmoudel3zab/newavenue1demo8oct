/* =========================================================
   DASHBOARD
   ========================================================= */
function renderDashboard(u){
  const teamKey = myTeamKey(u);
  const units = visibleUnits(u).slice().sort((a,b)=>popularityScore(b)-popularityScore(a)).slice(0,3);
  const myUnits = DB.units.filter(x=>x.ownerSalespersonId===u.id).slice(0,3);
  const reqList = requestsFor(teamKey);
  const unread = unreadCountFor(u);
  const recentReq = reqList.slice(-3).reverse();

  let banner;
  if(isSalesActive(u)){
    // Leads is Phase 2 / inactive, so the dashboard no longer leads with a fresh-lead alert.
    // Instead it surfaces today's Daily Performance Report status, since that's the daily task.
    const ds = effectiveTodayStr();
    const launched = isOnOrAfterLaunch(ds);
    const st = launched ? reportStatusOf(u.id, ds) : null;
    if(launched && st!=='completed'){
      banner = `<div class="card card-pad" style="display:flex; align-items:center; gap:14px; margin-bottom:18px;">
          <div style="width:42px;height:42px;border-radius:50%; background:var(--brand-tint); color:var(--brand-dark); display:flex;align-items:center;justify-content:center; flex-shrink:0;">${ic('calendar')}</div>
          <div style="flex:1;">
            <div style="font-weight:800; font-size:15px;">Today's Daily Report is ${st==='in_progress'?'in progress':'not started yet'}</div>
            <div style="font-size:12.5px; color:var(--text-muted);">Keep your calls, showings and meetings up to date — it only takes a few seconds.</div>
          </div>
          <button class="btn btn-primary" data-nav="reports">Open Daily Report</button>
        </div>`;
    } else if(launched){
      banner = `<div class="card card-pad" style="display:flex; align-items:center; gap:14px; margin-bottom:18px;">
          <div style="width:42px;height:42px;border-radius:50%; background:var(--success-tint); color:var(--success); display:flex;align-items:center;justify-content:center; flex-shrink:0;">${ic('check')}</div>
          <div><div style="font-weight:700; font-size:14px;">Today's Daily Report is completed</div><div style="font-size:12.5px; color:var(--text-faint);">Nice work — you can still update it any time today.</div></div>
          <button class="btn btn-ghost btn-sm" data-nav="reports" style="margin-left:auto;">View</button>
        </div>`;
    } else {
      banner = `<div class="card card-pad" style="margin-bottom:18px;">
        <div class="section-title">Welcome back, ${esc(u.name.split(' ')[0])}</div>
        <div class="section-sub">${ROLE_LABELS[u.role]}${u.team? ' · '+u.team[0].toUpperCase()+u.team.slice(1):' · Company-wide'}</div>
      </div>`;
    }
  } else {
    banner = `<div class="card card-pad" style="margin-bottom:18px;">
      <div class="section-title">Welcome back, ${esc(u.name.split(' ')[0])}</div>
      <div class="section-sub">${ROLE_LABELS[u.role]}${u.team? ' · '+u.team[0].toUpperCase()+u.team.slice(1):' · Company-wide'}</div>
    </div>`;
  }

  const newsCard = `<div class="card card-pad">
    <div style="display:flex; align-items:center; margin-bottom:2px;"><div class="section-title">News Feed</div></div>
    <div class="section-sub">Sorted by popularity</div>
    ${units.length? units.map(un=>unitMiniRow(un)).join('') : emptyRow('No inventory yet')}
    <button class="btn btn-ghost btn-sm" data-nav="inventory" style="margin-top:10px; width:100%; justify-content:center;">Open News Feed ${ic('chevron')}</button>
  </div>`;

  const myUnitsCard = `<div class="card card-pad">
    <div class="section-title">My Units</div>
    <div class="section-sub">${DB.units.filter(x=>x.ownerSalespersonId===u.id).length} units assigned to you</div>
    ${myUnits.length? myUnits.map(un=>unitMiniRow(un)).join('') : emptyRow('No units of your own yet')}
    <button class="btn btn-ghost btn-sm" data-nav="myunits" style="margin-top:10px; width:100%; justify-content:center;">Open My Units ${ic('chevron')}</button>
  </div>`;

  const reqCard = `<div class="card card-pad">
    <div style="display:flex; align-items:center; gap:8px;"><div class="section-title">Requests</div>${unread>0?`<span class="badge badge-fresh">${unread} new</span>`:''}</div>
    <div class="section-sub">${teamKey[0].toUpperCase()+teamKey.slice(1)} team feed</div>
    ${recentReq.length? recentReq.map(r=>{
      const a = DB.users.find(x=>x.id===r.authorId);
      return `<div style="padding:8px 0; border-top:1px solid var(--border);"><div style="font-size:12px; font-weight:700;">${esc(a?a.name:'?')}</div><div style="font-size:12px; color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(r.text)}</div></div>`;
    }).join('') : emptyRow('No requests yet')}
    <button class="btn btn-ghost btn-sm" data-nav="requests" style="margin-top:10px; width:100%; justify-content:center;">Open Requests ${ic('chevron')}</button>
  </div>`;

  let mgmtBlock = '';
  if(isMgmt(u)){
    const downIds = getDownlineIds(DB.users, u.id);
    // Includes EVERY sales-active downline member — plain salespeople AND any management role
    // below this user (e.g. a Sales Manager's team overview includes their Team Leaders too,
    // since a Team Leader is also personally sales-active) — never just literal salespeople.
    const downUsers = DB.users.filter(x=>downIds.includes(x.id) && isSalesActive(x));
    mgmtBlock = `<div class="card card-pad" style="margin-top:18px;">
      <div class="section-title">Team overview</div>
      <div class="section-sub">Visibility into everyone below you in the hierarchy — separate from your own personal activity above</div>
      <table><thead><tr><th>Team member</th><th>Role</th><th>Today's report</th><th>Units</th><th>Owners</th></tr></thead><tbody>
      ${downUsers.length ? downUsers.map(su=>{
        const sun = DB.units.filter(x=>x.ownerSalespersonId===su.id).length;
        const so = distinctOwnerCountForSalesperson(su.id);
        const ds = effectiveTodayStr();
        const st = isOnOrAfterLaunch(ds) ? reportStatusOf(su.id, ds) : 'n/a';
        const stBadge = st==='completed' ? '<span class="badge badge-success">Completed</span>' : st==='in_progress' ? '<span class="badge badge-pending">In progress</span>' : st==='missing' ? '<span class="badge badge-fresh">Missing</span>' : '<span class="badge badge-muted">—</span>';
        return `<tr><td style="font-weight:700;">${esc(su.name)}</td><td>${esc(ROLE_LABELS[su.role])}</td><td>${stBadge}</td><td>${sun}</td><td>${so} / 30</td></tr>`;
      }).join('') : emptyRow('No team members yet.')}
      </tbody></table>
    </div>`;
  }

  let adminBlock = '';
  if(isAdmin(u)){
    const pendingUnits = DB.units.filter(x=>x.pending).length;
    const pendingTransfers = DB.transfers.filter(t=>t.status==='pending').length;
    adminBlock = `<div class="card card-pad" style="margin-top:18px;">
      <div class="section-title">Admin queue</div>
      <div class="section-sub">Items needing administrative review</div>
      <div style="display:flex; gap:12px; flex-wrap:wrap;">
        <div class="card card-pad" style="flex:1; min-width:180px;"><div style="font-size:26px; font-weight:800; font-family:var(--font-head);">${pendingUnits}</div><div style="font-size:12px; color:var(--text-faint);">Units pending review</div></div>
        <div class="card card-pad" style="flex:1; min-width:180px;"><div style="font-size:26px; font-weight:800; font-family:var(--font-head);">${pendingTransfers}</div><div style="font-size:12px; color:var(--text-faint);">Owner transfer requests</div></div>
      </div>
      <button class="btn btn-primary btn-sm" data-nav="admin" style="margin-top:12px;">Go to Admin panel</button>
    </div>`;
  }

  return `${banner}<div class="grid-3">${newsCard}${myUnitsCard}${reqCard}</div>${mgmtBlock}${adminBlock}`;
}
function unitMiniRow(un){
  return `<div class="unit-mini" data-unit="${un.id}" style="display:flex; gap:10px; align-items:center; padding:8px 0; border-top:1px solid var(--border); cursor:pointer;">
    <div style="width:44px;height:34px;border-radius:6px; background:linear-gradient(135deg,var(--surface-3),var(--brand-tint)); flex-shrink:0;"></div>
    <div style="flex:1; min-width:0;">
      <div style="font-size:12.5px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(un.compound)} · ${esc(un.unitType)}</div>
      <div style="font-size:11.5px; color:var(--text-faint);">${fmtMoney(un.totalPrice)}</div>
    </div>
    ${un.pending?'<span class="badge badge-pending">Pending</span>':''}
  </div>`;
}
function emptyRow(text){ return `<div style="padding:14px 0; font-size:12.5px; color:var(--text-faint); text-align:center;">${text}</div>`; }
AFTER_RENDER.dashboard = function(u){
  document.querySelectorAll('.unit-mini').forEach(el=> el.addEventListener('click', ()=> openUnitModal(el.dataset.unit, u)));
  document.querySelectorAll('[data-nav]').forEach(b=> b.addEventListener('click', ()=> go(b.dataset.nav)));
};

