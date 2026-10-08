/* =========================================================
   ADMIN
   ========================================================= */
function renderAdminPage(u){
  if(!isAdmin(u)) return `<div class="empty-state">${ic('admin')}<div>Access denied — administrative permissions required.</div></div>`;
  const tab = session._adminTab || 'users';
  const tabs = [['users','Users'],['units','Pending Units'],['transfers','Owner Transfers'],['audit','Audit Log']];
  let body = '';
  if(tab==='users') body = renderAdminUsers(u);
  else if(tab==='units') body = renderAdminUnits(u);
  else if(tab==='transfers') body = renderAdminTransfers(u);
  else body = renderAdminAudit(u);
  return `
  <div style="margin-bottom:10px;"><span class="badge badge-brand">${ROLE_LABELS[u.role]}</span></div>
  <div class="tabs">${tabs.map(([k,l])=>`<button class="tab-btn ${tab===k?'active':''}" data-admintab="${k}">${l}</button>`).join('')}</div>
  ${body}`;
}
function renderAdminUsers(u){
  const canChangeTeam = u.role==='senioradmin' || u.role==='headadmin';
  return `<div class="card"><table><thead><tr><th>Name</th><th>Role</th><th>Team</th><th>Manager</th>${canChangeTeam?'<th>Action</th>':''}</tr></thead><tbody>
  ${DB.users.map(x=>{
    const mgr = DB.users.find(m=>m.id===x.managerId);
    return `<tr><td style="font-weight:700;">${esc(x.name)}</td><td>${ROLE_LABELS[x.role]}</td><td>${x.team?`<span class="team-pill ${x.team}">${x.team}</span>`:'—'}</td><td>${esc(mgr?mgr.name:'—')}</td>
    ${canChangeTeam?`<td>${x.team?`<button class="btn btn-sm" data-switchteam="${x.id}">Switch to ${x.team==='residential'?'Commercial':'Residential'}</button>`:'—'}</td>`:''}</tr>`;
  }).join('')}
  </tbody></table></div>`;
}
function renderAdminUnits(u){
  const pending = DB.units.filter(x=>x.pending);
  return `<div class="card">${pending.length? pending.map(un=>{
    const sp = DB.users.find(x=>x.id===un.ownerSalespersonId);
    return `<div style="display:flex; align-items:center; gap:12px; padding:12px 16px; border-bottom:1px solid var(--border);">
      <div style="flex:1;"><div style="font-weight:700; font-size:13px;">${esc(un.compound)} · ${esc(un.unitType)}</div><div style="font-size:11.5px; color:var(--text-faint);">${fmtMoney(un.totalPrice)} · by ${esc(sp?sp.name:'—')} · ${esc(un.team)}</div></div>
      <button class="btn btn-sm btn-primary" data-approveunit="${un.id}">Approve</button>
    </div>`;
  }).join('') : emptyRow('No units pending review.')}</div>`;
}
function renderAdminTransfers(u){
  const pending = DB.transfers.filter(t=>t.status==='pending');
  return `<div class="card">${pending.length? pending.map(t=>{
    const o = DB.owners.find(x=>x.id===t.ownerId);
    const unit = DB.units.find(x=>x.id===t.unitId);
    const from = DB.users.find(x=>x.id===t.fromSalespersonId);
    const to = DB.users.find(x=>x.id===t.toSalespersonId);
    const kind = t.type==='claim' ? 'Claim (owner already exists with another salesperson)' : 'Transfer (expired relationship)';
    return `<div style="display:flex; align-items:center; gap:12px; padding:12px 16px; border-bottom:1px solid var(--border);">
      <div style="flex:1;"><div style="font-weight:700; font-size:13px;">${esc(o?o.name:'—')} ${unit?'· '+esc(unitLabel(unit)):''}</div><div style="font-size:11.5px; color:var(--text-faint);">${kind} · ${esc(from?from.name:'—')} → ${esc(to?to.name:'—')} · requested ${fmtDateTime(t.at)}</div></div>
      <button class="btn btn-sm btn-danger" data-rejecttransfer="${t.id}">Reject</button>
      <button class="btn btn-sm btn-primary" data-approvetransfer="${t.id}">Approve</button>
    </div>`;
  }).join('') : emptyRow('No pending owner transfer/claim requests.')}</div>`;
}
function renderAdminAudit(u){
  return `<div class="card">${DB.auditLog.length? DB.auditLog.slice(0,60).map(l=>{
    const actor = DB.users.find(x=>x.id===l.actor);
    return `<div style="padding:10px 16px; border-bottom:1px solid var(--border); font-size:12.5px;"><b>${esc(actor?actor.name:l.actor)}</b> — ${l.action.replace(/_/g,' ')} <span style="color:var(--text-faint);">· ${fmtDateTime(l.at)}</span></div>`;
  }).join('') : emptyRow('No audit history yet.')}</div>`;
}
AFTER_RENDER.admin = function(u){
  document.querySelectorAll('[data-admintab]').forEach(b=> b.addEventListener('click', ()=>{ session._adminTab=b.dataset.admintab; renderPageInto(u); }));
  document.querySelectorAll('[data-switchteam]').forEach(b=> b.addEventListener('click', ()=>{
    const x = DB.users.find(z=>z.id===b.dataset.switchteam);
    const oldTeam = x.team; x.team = x.team==='residential'?'commercial':'residential';
    log(u.id,'team_change',{userId:x.id, from:oldTeam, to:x.team});
    persist(); toast(x.name+' moved to '+x.team); renderPageInto(u);
  }));
  document.querySelectorAll('[data-approveunit]').forEach(b=> b.addEventListener('click', ()=>{
    const un = DB.units.find(x=>x.id===b.dataset.approveunit); un.pending=false;
    log(u.id,'unit_approved',{unitId:un.id}); persist(); toast('Unit approved'); renderPageInto(u);
  }));
  document.querySelectorAll('[data-approvetransfer]').forEach(b=> b.addEventListener('click', ()=>{
    const t = DB.transfers.find(x=>x.id===b.dataset.approvetransfer); t.status='approved'; t.decidedAt=now(); t.decidedBy=u.id;
    if(t.type==='claim'){
      // Creates a NEW relationship for the requesting salesperson on that specific unit only —
      // it never duplicates the owner record and never touches that owner's other relationships.
      DB.ownerUnits.push(makeOwnerUnitRel(t.ownerId, t.unitId, t.toSalespersonId, 0));
      log(u.id,'owner_claim_approved',{ownerId:t.ownerId, unitId:t.unitId, to:t.toSalespersonId});
    } else {
      // Transfer applies ONLY to this specific owner-unit relationship, not the owner's other units.
      const rel = DB.ownerUnits.find(x=>x.id===t.ownerUnitId);
      if(rel){ rel.salespersonId = t.toSalespersonId; rel.lastUpdateAt=now(); rel.nextUpdateAt=rel.lastUpdateAt+30*86400000; rel.reminderAt=rel.lastUpdateAt+25*86400000; rel.status='active'; }
      log(u.id,'owner_transfer_approved',{ownerUnitId:t.ownerUnitId, to:t.toSalespersonId});
    }
    notify(t.toSalespersonId,'system','Your owner request was approved','owners');
    persist(); toast('Request approved'); renderPageInto(u);
  }));
  document.querySelectorAll('[data-rejecttransfer]').forEach(b=> b.addEventListener('click', ()=>{
    const t = DB.transfers.find(x=>x.id===b.dataset.rejecttransfer); t.status='rejected'; t.decidedAt=now(); t.decidedBy=u.id;
    log(u.id,'owner_transfer_rejected',{transferId:t.id});
    notify(t.toSalespersonId,'system','Your owner request was rejected','owners');
    persist(); toast('Request rejected'); renderPageInto(u);
  }));
};

