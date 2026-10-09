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
/* =========================================================
   ADMIN — full sales user management (Senior Admin / Head Admin only)
   Junior Admin sees this directory read-only (operational tasks only — no role/hierarchy/
   department changes); Senior Admin and Head Admin get the full Manage workflow: search/filter,
   open a profile, edit contact + reference code, change role, reassign manager, switch
   department — each with a confirmation dialog, each reflected everywhere live (My/Team
   visibility, Reference, other admin listings) because nothing here is cached — see
   syncRefForUser()/refUser()/refManager() in data.js.
   ========================================================= */
const ADMIN_ROLE_FILTER_GROUPS = [
  ['','All roles'],
  ['salesperson','Salesperson'],['teamleader','Team Leader'],['manager','Sales Manager'],
  ['director','Director'],['headofsales','Head of Sales'],['ceo','CEO'],
  ['junioradmin','Junior Admin'],['senioradmin','Senior Admin'],['headadmin','Head Admin'],
];
function renderAdminUsers(u){
  const canManage = canManageUsers(u);
  const q = (session._adminUserSearch||'').trim().toLowerCase();
  const roleFilter = session._adminRoleFilter || '';
  let list = DB.users.slice();
  if(roleFilter) list = list.filter(x=>x.role===roleFilter);
  if(q){
    list = list.filter(x=>{
      const ref = DB.refs.find(r=>r.userId===x.id);
      return x.name.toLowerCase().includes(q) || (ref && ref.code.toLowerCase().includes(q));
    });
  }
  list = list.slice().sort((a,b)=>a.name.localeCompare(b.name));
  return `
  <div style="display:flex; gap:10px; margin-bottom:14px; flex-wrap:wrap; align-items:center;">
    <div class="search-field" style="flex:1; min-width:200px;">
      ${ic('search')}<input id="adminUserSearch" placeholder="Search by name or reference code…" value="${esc(session._adminUserSearch||'')}">
    </div>
    <select id="adminRoleFilter" style="width:auto;">${ADMIN_ROLE_FILTER_GROUPS.map(([v,l])=>`<option value="${v}" ${roleFilter===v?'selected':''}>${l}</option>`).join('')}</select>
    ${canManage?`<button class="btn btn-primary btn-sm" id="addSalesUserBtn">${ic('plus')} Add sales user</button>`:''}
  </div>
  ${!canManage?`<div class="card card-pad" style="margin-bottom:14px; font-size:12.5px; color:var(--text-faint);">You have read-only access to the directory. Role, department and hierarchy changes require Senior Admin or Head Admin.</div>`:''}
  <div class="card" style="overflow-x:auto;"><table><thead><tr><th>Name</th><th>Role</th><th>Department</th><th>Reports to</th><th>Reference</th>${canManage?'<th></th>':''}</tr></thead><tbody>
  ${list.length? list.map(x=>{
    const mgr = DB.users.find(m=>m.id===x.managerId);
    const ref = DB.refs.find(r=>r.userId===x.id);
    return `<tr>
      <td style="font-weight:700;">${esc(x.name)}${x.id===u.id?' <span class="badge badge-muted">You</span>':''}</td>
      <td>${esc(ROLE_LABELS[x.role])}</td>
      <td>${x.team?`<span class="team-pill ${x.team}">${x.team}</span>`:'—'}</td>
      <td>${esc(mgr?mgr.name:'—')}</td>
      <td>${ref?`<span class="badge badge-brand">${esc(ref.code)}</span>`:'—'}</td>
      ${canManage?`<td><button class="btn btn-sm" data-manageuser="${x.id}">Manage</button></td>`:''}
    </tr>`;
  }).join('') : `<tr><td colspan="6">${emptyRow('No users match this search/filter.')}</td></tr>`}
  </tbody></table></div>`;
}

function roleTeamApplicable(role){ return ['salesperson','teamleader','manager','director'].includes(role); }

function openUserAdminModal(userId, u){
  const target = DB.users.find(x=>x.id===userId);
  if(!target) return;
  const isSelf = target.id===u.id;
  const ref = DB.refs.find(r=>r.userId===target.id);
  const mgrOptions = possibleManagersFor(target.id).sort((a,b)=>a.name.localeCompare(b.name));
  openModal(`
  <div class="modal-head"><div style="font-weight:800;">Manage — ${esc(target.name)}</div><button class="close-x" id="modalCloseX">${ic('x')}</button></div>
  <div class="modal-body">
    ${isSelf?`<div class="card card-pad" style="background:var(--warning-tint); border-color:var(--warning); margin-bottom:14px; font-size:12px; color:var(--warning);">You're editing your own account. Role, department and manager cannot be changed here — an administrative action can't grant its own user higher privileges.</div>`:''}
    <div class="field"><label class="field-label">Name</label><input id="ua_name" value="${esc(target.name)}"></div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
      <div class="field"><label class="field-label">Role</label>
        <select id="ua_role" ${isSelf?'disabled':''}>${ADMIN_ASSIGNABLE_ROLES.map(r=>`<option value="${r}" ${target.role===r?'selected':''}>${esc(ROLE_LABELS[r])}</option>`).join('')}</select>
      </div>
      <div class="field"><label class="field-label">Department</label>
        <select id="ua_team" ${isSelf?'disabled':''}>
          <option value="" ${!target.team?'selected':''}>— (company-wide / none)</option>
          <option value="residential" ${target.team==='residential'?'selected':''}>Residential</option>
          <option value="commercial" ${target.team==='commercial'?'selected':''}>Commercial</option>
        </select>
      </div>
    </div>
    <div class="field"><label class="field-label">Reports to</label>
      <select id="ua_manager" ${isSelf?'disabled':''}>
        <option value="">— No manager (top of hierarchy)</option>
        ${mgrOptions.map(m=>`<option value="${m.id}" ${target.managerId===m.id?'selected':''}>${esc(m.name)} — ${esc(ROLE_LABELS[m.role])}</option>`).join('')}
      </select>
    </div>
    <div class="divider"></div>
    <div class="section-sub" style="margin-bottom:10px;" id="ua_refNote">Reference directory details ${ref?'':'(created once this person is sales-active with a department assigned)'}</div>
    <div class="field"><label class="field-label">Reference code</label><input id="ua_code" value="${esc(ref?ref.code:'')}" placeholder="e.g. RES-S1" ${ref?'':'disabled'}></div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
      <div class="field"><label class="field-label">Phone (for calls)</label><input id="ua_phone" inputmode="numeric" value="${esc(ref?ref.phone:'')}" placeholder="e.g. 01012345678" ${ref?'':'disabled'}></div>
      <div class="field"><label class="field-label">WhatsApp number</label><input id="ua_wa" inputmode="numeric" value="${esc(ref?ref.whatsapp:'')}" placeholder="e.g. 01012345678" ${ref?'':'disabled'}></div>
    </div>
  </div>
  <div class="modal-foot"><button class="btn btn-primary" id="saveUserAdminBtn">Save changes</button></div>`);
  document.getElementById('modalCloseX').addEventListener('click', closeModal);
  ['ua_phone','ua_wa'].forEach(id=>{ const el=document.getElementById(id); if(el) el.addEventListener('input', (e)=>{ e.target.value = e.target.value.replace(/[^0-9]/g,''); }); });
  // Department AND reference-field applicability both follow the currently-SELECTED role+team
  // (not just whichever values the person had when the modal opened) — so promoting someone
  // into a sales-active role unlocks the reference fields immediately, in the same save, rather
  // than forcing a second trip back into this modal after the role change has already landed.
  const roleSel = document.getElementById('ua_role'), teamSel = document.getElementById('ua_team');
  const codeInp = document.getElementById('ua_code'), phoneInp = document.getElementById('ua_phone'), waInp = document.getElementById('ua_wa'), refNote = document.getElementById('ua_refNote');
  function syncApplicability(){
    if(isSelf) return;
    const applicable = roleTeamApplicable(roleSel.value);
    teamSel.disabled = !applicable;
    if(!applicable) teamSel.value = '';
    const eligible = isSalesActive({role:roleSel.value}) && !!teamSel.value;
    [codeInp,phoneInp,waInp].forEach(el=> el.disabled = !eligible);
    refNote.textContent = eligible ? 'Reference directory details' : 'Reference directory details (this role/department combination is not sales-active, so there is no directory entry)';
  }
  if(!isSelf){
    roleSel.addEventListener('change', syncApplicability);
    teamSel.addEventListener('change', syncApplicability);
    syncApplicability();
  }
  document.getElementById('saveUserAdminBtn').addEventListener('click', ()=>{
    const name = document.getElementById('ua_name').value.trim();
    if(!name){ toast('Name is required'); return; }
    const newRole = isSelf ? target.role : document.getElementById('ua_role').value;
    const newTeam = isSelf ? target.team : (document.getElementById('ua_team').value || null);
    const newManagerId = isSelf ? target.managerId : (document.getElementById('ua_manager').value || null);

    const roleChanged = newRole!==target.role;
    const teamChanged = newTeam!==target.team;
    const managerChanged = newManagerId!==target.managerId;

    if(roleChanged || teamChanged || managerChanged){
      const lines = [];
      if(roleChanged) lines.push(`Role: ${ROLE_LABELS[target.role]} → ${ROLE_LABELS[newRole]}`);
      if(teamChanged) lines.push(`Department: ${target.team?target.team:'—'} → ${newTeam?newTeam:'—'}`);
      if(managerChanged){
        const oldMgr = DB.users.find(m=>m.id===target.managerId), newMgr = DB.users.find(m=>m.id===newManagerId);
        lines.push(`Reports to: ${oldMgr?oldMgr.name:'—'} → ${newMgr?newMgr.name:'—'}`);
      }
      const ok = confirm(`Apply these changes to ${target.name}?\n\n${lines.join('\n')}\n\nThis affects their reporting relationships and what they can see across the app.`);
      if(!ok) return;
    }

    // Validate reference fields whenever the SELECTED role+team combination is sales-active —
    // including the case where this save is what makes them eligible for the first time.
    const willBeEligible = isSalesActive({role:newRole}) && !!newTeam;
    let codeVal = codeInp.value.trim();
    let phoneVal = phoneInp.value.trim();
    let waVal = waInp.value.trim();
    const existingRef = DB.refs.find(r=>r.userId===target.id);
    if(willBeEligible){
      if(!codeVal){ toast('Reference code is required'); return; }
      if(!isDigitsOnly(phoneVal) || !normalizeEgyptPhone(phoneVal)){ toast('Enter a valid phone number (digits only)'); return; }
      if(!isDigitsOnly(waVal) || !normalizeEgyptPhone(waVal)){ toast('Enter a valid WhatsApp number (digits only)'); return; }
      const codeClash = DB.refs.find(r=>r.id!==(existingRef?existingRef.id:null) && r.code===codeVal);
      if(codeClash){ toast('That reference code is already in use'); return; }
    }

    target.name = name;
    if(!isSelf){ target.role = newRole; target.team = newTeam; target.managerId = newManagerId; }
    syncRefForUser(target); // creates/removes/updates the ref entry to match the new role+team
    const refAfter = DB.refs.find(r=>r.userId===target.id);
    if(refAfter && willBeEligible){
      refAfter.code = codeVal;
      refAfter.phone = phoneLocalDisplay(normalizeEgyptPhone(phoneVal));
      refAfter.whatsapp = phoneLocalDisplay(normalizeEgyptPhone(waVal));
    }
    log(u.id,'admin_user_updated',{userId:target.id, roleChanged, teamChanged, managerChanged});
    persist(); closeModal(); toast('User updated'); renderPageInto(u);
  });
}

function openAddSalesUserModal(u){
  const SALES_ROLES = ['salesperson','teamleader','manager','director','headofsales','ceo'];
  const mgrOptions = DB.users.slice().sort((a,b)=>a.name.localeCompare(b.name));
  openModal(`
  <div class="modal-head"><div style="font-weight:800;">Add sales user</div><button class="close-x" id="modalCloseX">${ic('x')}</button></div>
  <div class="modal-body">
    <div class="field"><label class="field-label">Full name</label><input id="nu_name" placeholder="e.g. Mona Adel"></div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
      <div class="field"><label class="field-label">Role</label><select id="nu_role">${SALES_ROLES.map(r=>`<option value="${r}">${esc(ROLE_LABELS[r])}</option>`).join('')}</select></div>
      <div class="field"><label class="field-label">Department</label><select id="nu_team"><option value="residential">Residential</option><option value="commercial">Commercial</option></select></div>
    </div>
    <div class="field"><label class="field-label">Reports to</label>
      <select id="nu_manager"><option value="">— No manager (top of hierarchy)</option>${mgrOptions.map(m=>`<option value="${m.id}">${esc(m.name)} — ${esc(ROLE_LABELS[m.role])}</option>`).join('')}</select>
    </div>
    <div class="divider"></div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
      <div class="field"><label class="field-label">Phone (for calls)</label><input id="nu_phone" inputmode="numeric" placeholder="e.g. 01012345678"></div>
      <div class="field"><label class="field-label">WhatsApp number</label><input id="nu_wa" inputmode="numeric" placeholder="e.g. 01012345678"></div>
    </div>
  </div>
  <div class="modal-foot"><button class="btn btn-primary" id="saveNewSalesUserBtn">Add user</button></div>`);
  document.getElementById('modalCloseX').addEventListener('click', closeModal);
  const roleSel = document.getElementById('nu_role'), teamSel = document.getElementById('nu_team');
  function syncTeamApplicability(){
    const applicable = roleTeamApplicable(roleSel.value);
    teamSel.disabled = !applicable;
  }
  roleSel.addEventListener('change', syncTeamApplicability); syncTeamApplicability();
  ['nu_phone','nu_wa'].forEach(id=> document.getElementById(id).addEventListener('input', (e)=>{ e.target.value = e.target.value.replace(/[^0-9]/g,''); }));
  document.getElementById('saveNewSalesUserBtn').addEventListener('click', ()=>{
    const name = document.getElementById('nu_name').value.trim();
    const role = roleSel.value;
    const team = roleTeamApplicable(role) ? teamSel.value : null;
    const managerId = document.getElementById('nu_manager').value || null;
    const phone = document.getElementById('nu_phone').value.trim();
    const wa = document.getElementById('nu_wa').value.trim();
    if(!name){ toast('Name is required'); return; }
    const willBeEligible = isSalesActive({role}) && !!team;
    if(willBeEligible){
      if(!isDigitsOnly(phone) || !normalizeEgyptPhone(phone)){ toast('Enter a valid phone number (digits only)'); return; }
      if(!isDigitsOnly(wa) || !normalizeEgyptPhone(wa)){ toast('Enter a valid WhatsApp number (digits only)'); return; }
    }
    const newUser = { id: uid('u'), name, role, team, managerId, avatar: avatarColor(name) };
    DB.users.push(newUser);
    syncRefForUser(newUser);
    if(willBeEligible){
      const ref = DB.refs.find(r=>r.userId===newUser.id);
      if(ref){ ref.phone = phoneLocalDisplay(normalizeEgyptPhone(phone)); ref.whatsapp = phoneLocalDisplay(normalizeEgyptPhone(wa)); }
    }
    log(u.id,'admin_user_added',{userId:newUser.id, role, team});
    persist(); closeModal(); toast(name+' added'); renderPageInto(u);
  });
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
    const kind = t.type==='claim' ? 'Claim (owner contact already exists with another salesperson)' : 'Transfer (expired relationship)';
    return `<div style="display:flex; align-items:center; gap:12px; padding:12px 16px; border-bottom:1px solid var(--border);">
      <div style="flex:1;"><div style="font-weight:700; font-size:13px;">${esc(o?o.name:'—')} ${unit?'· '+esc(unitLabel(unit)):(t.type==='claim'?' · owner contact, no unit yet':'')}</div><div style="font-size:11.5px; color:var(--text-faint);">${kind} · ${esc(from?from.name:'—')} → ${esc(to?to.name:'—')} · requested ${fmtDateTime(t.at)}</div></div>
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
  const us = document.getElementById('adminUserSearch');
  if(us){
    us.addEventListener('input', ()=>{ session._adminUserSearch = us.value; renderPageInto(u); });
    if(session._adminUserSearchFocused){ us.focus(); us.setSelectionRange(us.value.length, us.value.length); }
    us.addEventListener('focus', ()=>{ session._adminUserSearchFocused = true; });
    us.addEventListener('blur', ()=>{ session._adminUserSearchFocused = false; });
  }
  const rf = document.getElementById('adminRoleFilter'); if(rf) rf.addEventListener('change', ()=>{ session._adminRoleFilter = rf.value; renderPageInto(u); });
  const au = document.getElementById('addSalesUserBtn'); if(au) au.addEventListener('click', ()=> openAddSalesUserModal(u));
  document.querySelectorAll('[data-manageuser]').forEach(b=> b.addEventListener('click', ()=> openUserAdminModal(b.dataset.manageuser, u)));
  document.querySelectorAll('[data-approveunit]').forEach(b=> b.addEventListener('click', ()=>{
    const un = DB.units.find(x=>x.id===b.dataset.approveunit); un.pending=false;
    log(u.id,'unit_approved',{unitId:un.id}); persist(); toast('Unit approved'); renderPageInto(u);
  }));
  document.querySelectorAll('[data-approvetransfer]').forEach(b=> b.addEventListener('click', ()=>{
    const t = DB.transfers.find(x=>x.id===b.dataset.approvetransfer); t.status='approved'; t.decidedAt=now(); t.decidedBy=u.id;
    if(t.type==='claim'){
      if(t.unitId){
        // Creates a NEW relationship for the requesting salesperson on that specific unit only —
        // it never duplicates the owner record and never touches that owner's other relationships.
        DB.ownerUnits.push(makeOwnerUnitRel(t.ownerId, t.unitId, t.toSalespersonId, 0));
      } else {
        // Owner creation is independent of Units now — a claim can be made on the CONTACT
        // itself, with no unit involved yet. Approving it grants the claimant shared access
        // to that one owner record (never a duplicate owner, and the original holder's own
        // relationships are untouched); they can "Add unit" to it afterward like any owner
        // they hold.
        const owner = DB.owners.find(x=>x.id===t.ownerId);
        if(owner && !(owner.sharedWith||[]).includes(t.toSalespersonId)){
          owner.sharedWith = owner.sharedWith || [];
          owner.sharedWith.push(t.toSalespersonId);
        }
      }
      log(u.id,'owner_claim_approved',{ownerId:t.ownerId, unitId:t.unitId||null, to:t.toSalespersonId});
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

