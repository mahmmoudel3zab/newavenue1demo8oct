/* =========================================================
   ADMIN
   ========================================================= */
function renderAdminPage(u){
  if(!isAdmin(u)) return `<div class="empty-state">${ic('admin')}<div>Access denied — administrative permissions required.</div></div>`;
  const isHeadAdmin = u.role==='headadmin';
  let tab = session._adminTab || 'users';
  const HEAD_ADMIN_ONLY_TABS = ['ownertransfer','pool','deletedowners','deletedunits'];
  // Server-equivalent enforcement doesn't exist on this frontend-only prototype (as already
  // documented throughout this app for every other role check), but we still never RENDER a
  // Head-Admin-only tab's content for a non-Head-Admin — if session state somehow points at one
  // (e.g. a stale tab from switching accounts), fall back to Users rather than show it.
  if(HEAD_ADMIN_ONLY_TABS.includes(tab) && !isHeadAdmin) tab = 'users';
  const tabs = [['users','Users'],['units','Pending Units'],['transfers','Owner Transfers'],['audit','Audit Log']];
  if(isHeadAdmin) tabs.push(['ownertransfer','Transfer Owner'],['pool','Available Pool'],['deletedowners','Deleted Owners'],['deletedunits','Deleted Units']);
  let body = '';
  if(tab==='users') body = renderAdminUsers(u);
  else if(tab==='units') body = renderAdminUnits(u);
  else if(tab==='transfers') body = renderAdminTransfers(u);
  else if(tab==='audit') body = renderAdminAudit(u);
  else if(tab==='ownertransfer') body = renderAdminOwnerTransfer(u);
  else if(tab==='pool') body = renderAdminAvailablePool(u);
  else if(tab==='deletedowners') body = renderAdminDeletedOwners(u);
  else if(tab==='deletedunits') body = renderAdminDeletedUnits(u);
  return `
  <div style="margin-bottom:10px;"><span class="badge badge-brand">${esc(displayTitle(u))}</span></div>
  <div class="tabs" style="overflow-x:auto; flex-wrap:nowrap;">${tabs.map(([k,l])=>`<button class="tab-btn ${tab===k?'active':''}" data-admintab="${k}" style="white-space:nowrap;">${l}</button>`).join('')}</div>
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
  ['headhr','Head of HR'],
];
function renderAdminUsers(u){
  const canManage = canManageUsers(u);
  const q = (session._adminUserSearch||'').trim().toLowerCase();
  const roleFilter = session._adminRoleFilter || '';
  const reviewOnly = !!session._adminReviewOnly;
  let list = DB.users.slice();
  if(roleFilter) list = list.filter(x=>x.role===roleFilter);
  if(reviewOnly) list = list.filter(x=>x.titleNeedsReview);
  if(q){
    list = list.filter(x=>{
      const ref = DB.refs.find(r=>r.userId===x.id);
      return x.name.toLowerCase().includes(q) || (ref && ref.code.toLowerCase().includes(q));
    });
  }
  list = list.slice().sort((a,b)=>a.name.localeCompare(b.name));
  const reviewCount = DB.users.filter(x=>x.titleNeedsReview).length;
  return `
  <div style="display:flex; gap:10px; margin-bottom:14px; flex-wrap:wrap; align-items:center;">
    <div class="search-field" style="flex:1; min-width:200px;">
      ${ic('search')}<input id="adminUserSearch" placeholder="Search by name or reference code…" value="${esc(session._adminUserSearch||'')}">
    </div>
    <select id="adminRoleFilter" style="width:auto;">${ADMIN_ROLE_FILTER_GROUPS.map(([v,l])=>`<option value="${v}" ${roleFilter===v?'selected':''}>${l}</option>`).join('')}</select>
    ${canManage?`<button class="btn btn-primary btn-sm" id="addSalesUserBtn">${ic('plus')} Add sales user</button>`:''}
  </div>
  ${!canManage?`<div class="card card-pad" style="margin-bottom:14px; font-size:12.5px; color:var(--text-faint);">You have read-only access to the directory. Role, department, job title and hierarchy changes require Senior Admin or Head Admin.</div>`:''}
  ${reviewCount? `<div class="card card-pad" style="margin-bottom:14px; background:var(--warning-tint); border-color:var(--warning); display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
    <div style="flex:1; font-size:12.5px; color:var(--warning);"><b>${reviewCount}</b> account${reviewCount===1?'':'s'} ${reviewCount===1?'has':'have'} a default job title (Junior/Senior Sales) that a Senior or Head Admin should confirm or correct — these were not arbitrarily assigned as final.</div>
    <button class="btn btn-sm ${reviewOnly?'btn-primary':''}" id="toggleReviewOnlyBtn">${reviewOnly?'Showing review-only — show all':'Show accounts needing review'}</button>
  </div>` : ''}
  <div class="card" style="overflow-x:auto;"><table><thead><tr><th>Name</th><th>Role</th><th>Job Title</th><th>Department</th><th>Reports to</th><th>Reference</th>${canManage?'<th></th>':''}</tr></thead><tbody>
  ${list.length? list.map(x=>{
    const mgr = DB.users.find(m=>m.id===x.managerId);
    const ref = DB.refs.find(r=>r.userId===x.id);
    return `<tr>
      <td style="font-weight:700;">${esc(x.name)}${x.id===u.id?' <span class="badge badge-muted">You</span>':''}</td>
      <td>${esc(ROLE_LABELS[x.role])}</td>
      <td>${esc(displayTitle(x))}${x.titleNeedsReview?' <span class="badge badge-pending" title="Default title — needs Senior/Head Admin confirmation">Review</span>':''}</td>
      <td>${x.team?`<span class="team-pill ${x.team}">${x.team}</span>`:'—'}</td>
      <td>${esc(mgr?mgr.name:'—')}</td>
      <td>${ref?`<span class="badge badge-brand">${esc(ref.code)}</span>`:'—'}</td>
      ${canManage?`<td><button class="btn btn-sm" data-manageuser="${x.id}">Manage</button></td>`:''}
    </tr>`;
  }).join('') : `<tr><td colspan="7">${emptyRow('No users match this search/filter.')}</td></tr>`}
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
    ${isSelf?`<div class="card card-pad" style="background:var(--warning-tint); border-color:var(--warning); margin-bottom:14px; font-size:12px; color:var(--warning);">You're editing your own account. Role, department, manager and job title cannot be changed here — an administrative action can't grant its own user higher privileges or confirm its own job title.</div>`:''}
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
    <div class="field"><label class="field-label">Job title${target.titleNeedsReview?' <span class="badge badge-pending" style="margin-left:4px;">Needs review</span>':''}</label>
      <select id="ua_jobtitle" ${isSelf?'disabled':''}>
        <option value="">— No sales job title (administrative role)</option>
        ${JOB_TITLES.map(t=>`<option value="${t}" ${target.jobTitle===t?'selected':''}>${t}</option>`).join('')}
      </select>
      <div style="font-size:11px; color:var(--text-faint); margin-top:4px;">This is purely descriptive — it never changes what this account can do. Permissions come from Role above.</div>
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
    const newJobTitle = isSelf ? target.jobTitle : (document.getElementById('ua_jobtitle').value || null);

    const roleChanged = newRole!==target.role;
    const teamChanged = newTeam!==target.team;
    const managerChanged = newManagerId!==target.managerId;
    const jobTitleChanged = newJobTitle!==target.jobTitle;

    if(roleChanged || teamChanged || managerChanged || jobTitleChanged){
      const lines = [];
      if(roleChanged) lines.push(`Role: ${ROLE_LABELS[target.role]} → ${ROLE_LABELS[newRole]}`);
      if(teamChanged) lines.push(`Department: ${target.team?target.team:'—'} → ${newTeam?newTeam:'—'}`);
      if(managerChanged){
        const oldMgr = DB.users.find(m=>m.id===target.managerId), newMgr = DB.users.find(m=>m.id===newManagerId);
        lines.push(`Reports to: ${oldMgr?oldMgr.name:'—'} → ${newMgr?newMgr.name:'—'}`);
      }
      if(jobTitleChanged) lines.push(`Job title: ${target.jobTitle||'—'} → ${newJobTitle||'—'}`);
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
    if(!isSelf){
      target.role = newRole; target.team = newTeam; target.managerId = newManagerId;
      if(jobTitleChanged){ target.jobTitle = newJobTitle; target.titleNeedsReview = false; }
    }
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
    <div class="field"><label class="field-label">Job title</label>
      <select id="nu_jobtitle"><option value="">— Set later / not applicable</option>${JOB_TITLES.map(t=>`<option value="${t}">${t}</option>`).join('')}</select>
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
    const jobTitle = document.getElementById('nu_jobtitle').value || null;
    const newUser = { id: uid('u'), name, role, team, managerId, avatar: avatarColor(name), jobTitle, titleNeedsReview:false };
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
  const pending = DB.units.filter(x=>x.pending && !x.deletedAt);
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
/* =========================================================
   PART 1 (admin side) — Deleted Owners / Deleted Units management — Head Admin only.
   Reachable only via the Admin page's own Head-Admin-only tabs (renderAdminPage already blocks
   a non-Head-Admin from ever rendering this body). Restoring always updates the SAME row — see
   restoreOwner()/restoreUnit() in data.js — so it can never create a duplicate record.
   ========================================================= */
function renderAdminDeletedOwners(u){
  const list = deletedOwnersList();
  return `<div class="section-sub">${list.length} deleted owner${list.length===1?'':'s'} — hidden from normal Owners views, not erased. Restoring brings back the exact same record with its full history and relationships intact.</div>
  <div class="card">${list.length? list.map(o=>{
    const by = DB.users.find(x=>x.id===o.deletedBy);
    const rels = activeOwnerUnitsFor(o.id);
    return `<div style="display:flex; align-items:center; gap:12px; padding:12px 16px; border-bottom:1px solid var(--border); flex-wrap:wrap;">
      <span class="avatar" style="background:${avatarColor(o.name)}; width:34px;height:34px;">${initials(o.name)}</span>
      <div style="flex:1; min-width:200px;">
        <div style="font-weight:700; font-size:13px;">${esc(o.name)} <span class="team-pill ${o.team}" style="margin-left:4px;">${o.team}</span></div>
        <div style="font-size:11.5px; color:var(--text-faint);">${ownerPhoneDisplay(o)} · ${rels.length} linked unit${rels.length===1?'':'s'} (preserved) · deleted by ${esc(by?by.name:'—')} on ${fmtDateTime(o.deletedAt)}</div>
      </div>
      <button class="btn btn-sm btn-primary" data-restoreowner="${o.id}">${ic('refresh')} Restore</button>
    </div>`;
  }).join('') : emptyRow('No deleted owners.')}</div>`;
}
function renderAdminDeletedUnits(u){
  const list = deletedUnitsList();
  return `<div class="section-sub">${list.length} deleted unit${list.length===1?'':'s'} — hidden from normal inventory/My Units views, not erased. Restoring brings back the exact same record, including its owner relationships.</div>
  <div class="card">${list.length? list.map(un=>{
    const by = DB.users.find(x=>x.id===un.deletedBy);
    const sp = DB.users.find(x=>x.id===un.ownerSalespersonId);
    return `<div style="display:flex; align-items:center; gap:12px; padding:12px 16px; border-bottom:1px solid var(--border); flex-wrap:wrap;">
      <div style="flex:1; min-width:200px;">
        <div style="font-weight:700; font-size:13px;">${esc(un.compound)} · ${esc(un.unitType)} <span class="team-pill ${un.team}" style="margin-left:4px;">${un.team}</span></div>
        <div style="font-size:11.5px; color:var(--text-faint);">${fmtMoney(un.totalPrice)} · belongs to ${esc(sp?sp.name:'—')} · deleted by ${esc(by?by.name:'—')} on ${fmtDateTime(un.deletedAt)}</div>
      </div>
      <button class="btn btn-sm btn-primary" data-restoreunit="${un.id}">${ic('refresh')} Restore</button>
    </div>`;
  }).join('') : emptyRow('No deleted units.')}</div>`;
}

/* =========================================================
   PART 4 (admin side) — Available Pool — Head Admin only.
   Company-wide (both teams) view of owner-unit relationships that expired (no update in 30+
   days). Reassigning one here is a direct admin action — effective immediately, unlike the old
   self-service "claim" flow it replaces — and only ever changes that ONE relationship.
   ========================================================= */
function renderAdminAvailablePool(u){
  const list = expiredOwnerUnitsCompanyWide();
  return `<div class="section-sub">${list.length} relationship${list.length===1?'':'s'} expired (not updated in 30+ days) across both teams. Reassigning a relationship only affects that one unit — the owner's other units are untouched.</div>
  <div class="card">${list.length? list.map(r=>{
    const o = DB.owners.find(x=>x.id===r.ownerId);
    const unit = DB.units.find(x=>x.id===r.unitId);
    const sp = DB.users.find(x=>x.id===r.salespersonId);
    const eligible = DB.users.filter(x=>isSalesActive(x) && x.team===(o?o.team:null) && x.id!==r.salespersonId).sort((a,b)=>a.name.localeCompare(b.name));
    return `<div style="padding:13px 16px; border-bottom:1px solid var(--border);">
      <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
        <span class="avatar" style="background:${avatarColor(o?o.name:'?')}; width:34px;height:34px;">${initials(o?o.name:'?')}</span>
        <div style="flex:1; min-width:200px;">
          <div style="font-weight:700; font-size:13px;">${esc(o?o.name:'—')} · ${esc(unitLabel(unit))}</div>
          <div style="font-size:11.5px; color:var(--text-faint);">Currently with ${esc(sp?sp.name:'—')} · not updated for ${daysBetween(r.lastUpdateAt)} days · ${o?esc(o.team):''}</div>
        </div>
        <select class="pool-dest" data-pooldest="${r.id}" style="width:auto; min-width:180px;">
          <option value="">Reassign to…</option>
          ${eligible.map(sp2=>`<option value="${sp2.id}">${esc(sp2.name)} — ${esc(ROLE_LABELS[sp2.role])}</option>`).join('')}
        </select>
        <button class="btn btn-sm btn-primary" data-poolreassign="${r.id}">Reassign</button>
      </div>
    </div>`;
  }).join('') : emptyRow('No relationships currently expired.')}</div>`;
}

/* =========================================================
   PART 3 (admin side) — Transfer Owner — Head Admin only.
   Search any owner company-wide by name or phone, confirm the right one, pick the destination
   salesperson from a searchable, filtered list (same team as the owner, sales-active only,
   excluding whoever currently holds it), and confirm before the transfer happens.
   ========================================================= */
function renderAdminOwnerTransfer(u){
  const q = (session._ownerTransferSearch||'').trim().toLowerCase();
  let results = [];
  if(q){
    results = DB.owners.filter(o=> !o.deletedAt && (o.name.toLowerCase().includes(q) || phoneLocalDisplay(o.phone).includes(q) || (o.phone2 && phoneLocalDisplay(o.phone2).includes(q)))).slice(0,25);
  }
  return `
  <div class="section-sub">Search for an owner (company-wide), then choose a destination salesperson to transfer them to. This moves every unit/relationship currently held by the owner's current salesperson — nothing is duplicated or lost.</div>
  <div class="search-field" style="max-width:420px; margin-bottom:14px;">
    ${ic('search')}<input id="ownerTransferSearch" placeholder="Search owner by name or phone…" value="${esc(session._ownerTransferSearch||'')}">
  </div>
  <div class="card">
    ${!q ? emptyRow('Type a name or phone number to find an owner.') : (results.length? results.map(o=>{
      const rels = activeOwnerUnitsFor(o.id);
      const holderIds = ownerCurrentHolderIds(o);
      const holders = holderIds.map(id=>DB.users.find(x=>x.id===id)).filter(Boolean);
      return `<div style="display:flex; align-items:center; gap:12px; padding:12px 16px; border-bottom:1px solid var(--border); flex-wrap:wrap;">
        <span class="avatar" style="background:${avatarColor(o.name)}; width:34px;height:34px;">${initials(o.name)}</span>
        <div style="flex:1; min-width:200px;">
          <div style="font-weight:700; font-size:13px;">${esc(o.name)} <span class="team-pill ${o.team}" style="margin-left:4px;">${o.team}</span></div>
          <div style="font-size:11.5px; color:var(--text-faint);">${ownerPhoneDisplay(o)} · ${rels.length} unit${rels.length===1?'':'s'} · held by ${holders.map(h=>esc(h.name)).join(', ')||'—'}</div>
        </div>
        <button class="btn btn-sm btn-primary" data-starttransfer="${o.id}">${ic('team')} Transfer…</button>
      </div>`;
    }).join('') : emptyRow('No owners match that search.'))}
  </div>`;
}
function openOwnerTransferModal(ownerId, u){
  const o = DB.owners.find(x=>x.id===ownerId);
  if(!o || o.deletedAt) return;
  const holderIds = ownerCurrentHolderIds(o);
  if(holderIds.length===0){ toast('This owner currently has no holder to transfer from.'); return; }
  const holders = holderIds.map(id=>DB.users.find(x=>x.id===id)).filter(Boolean);
  openModal(`
    <div class="modal-head"><div style="font-weight:800;">Transfer owner — ${esc(o.name)}</div><button class="close-x" id="modalCloseX">${ic('x')}</button></div>
    <div class="modal-body">
      <div class="card card-pad" style="background:var(--surface-2); margin-bottom:14px; font-size:12.5px;">
        <div><b>${esc(o.name)}</b> · ${ownerPhoneDisplay(o)}${o.phone2?' / '+phoneLocalDisplay(o.phone2):''}</div>
        <div style="color:var(--text-faint); margin-top:2px;">${activeOwnerUnitsFor(o.id).length} linked unit(s) · ${o.team}</div>
      </div>
      ${holders.length>1 ? `<div class="field"><label class="field-label">Transfer FROM (this owner has more than one current holder — choose which one)</label>
        <select id="ot_from">${holders.map(h=>`<option value="${h.id}">${esc(h.name)} — ${esc(ROLE_LABELS[h.role])}</option>`).join('')}</select>
      </div>` : `<input type="hidden" id="ot_from" value="${holders[0].id}">
        <div class="section-sub" style="margin-bottom:10px;">Currently with <b>${esc(holders[0].name)}</b></div>`}
      <div class="field"><label class="field-label">Transfer TO</label>
        <div class="search-field" style="margin-bottom:8px;">${ic('search')}<input id="ot_destSearch" placeholder="Search destination salesperson…"></div>
        <select id="ot_to" size="6" style="height:auto;"></select>
      </div>
    </div>
    <div class="modal-foot"><button class="btn btn-primary" id="confirmTransferBtn">Transfer owner</button></div>`, {noBackdropClose:true});
  document.getElementById('modalCloseX').addEventListener('click', closeModal);
  function destCandidates(){
    const fromId = document.getElementById('ot_from').value;
    const q = (document.getElementById('ot_destSearch').value||'').trim().toLowerCase();
    return DB.users.filter(x=> isSalesActive(x) && x.team===o.team && x.id!==fromId && (!q || x.name.toLowerCase().includes(q)))
      .sort((a,b)=>a.name.localeCompare(b.name));
  }
  function renderDestOptions(){
    const sel = document.getElementById('ot_to');
    const cands = destCandidates();
    sel.innerHTML = cands.length ? cands.map(c=>`<option value="${c.id}">${esc(c.name)} — ${esc(ROLE_LABELS[c.role])}</option>`).join('') : `<option value="" disabled>No matching salesperson</option>`;
  }
  renderDestOptions();
  document.getElementById('ot_destSearch').addEventListener('input', renderDestOptions);
  const fromSel = document.getElementById('ot_from');
  if(fromSel.tagName==='SELECT') fromSel.addEventListener('change', renderDestOptions);
  document.getElementById('confirmTransferBtn').addEventListener('click', ()=>{
    const fromId = document.getElementById('ot_from').value;
    const toSel = document.getElementById('ot_to');
    const toId = toSel.value;
    if(!toId){ toast('Choose a destination salesperson'); return; }
    const fromUser = DB.users.find(x=>x.id===fromId), toUser = DB.users.find(x=>x.id===toId);
    const ok = confirm(`Transfer ${o.name} from ${fromUser?fromUser.name:'—'} to ${toUser?toUser.name:'—'}?\n\nAll units and history currently held by ${fromUser?fromUser.name:'this salesperson'} for this owner will move to ${toUser?toUser.name:'the new salesperson'}. Nothing is duplicated or deleted.`);
    if(!ok) return;
    const moved = transferOwnerFromTo(o, fromId, toId, u.id);
    closeModal(); toast(`${o.name} transferred to ${toUser?toUser.name:'—'} (${moved} unit relationship${moved===1?'':'s'} moved)`); renderPageInto(u);
  });
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
  const trb = document.getElementById('toggleReviewOnlyBtn'); if(trb) trb.addEventListener('click', ()=>{ session._adminReviewOnly = !session._adminReviewOnly; renderPageInto(u); });
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

  // ---- Head-Admin-only tabs (renderAdminPage already blocks these from rendering for anyone else) ----
  document.querySelectorAll('[data-restoreowner]').forEach(b=> b.addEventListener('click', ()=>{
    const o = DB.owners.find(x=>x.id===b.dataset.restoreowner);
    if(!o) return;
    if(!confirm(`Restore ${o.name}? They will reappear in their salesperson's normal Owners list with all history and linked units intact.`)) return;
    restoreOwner(o);
    log(u.id,'owner_restored',{ownerId:o.id});
    persist(); toast('Owner restored'); renderPageInto(u);
  }));
  document.querySelectorAll('[data-restoreunit]').forEach(b=> b.addEventListener('click', ()=>{
    const un = DB.units.find(x=>x.id===b.dataset.restoreunit);
    if(!un) return;
    if(!confirm(`Restore ${un.compound} — ${un.unitType}? It will reappear in normal inventory/My Units.`)) return;
    restoreUnit(un);
    log(u.id,'unit_restored',{unitId:un.id});
    persist(); toast('Unit restored'); renderPageInto(u);
  }));
  document.querySelectorAll('[data-poolreassign]').forEach(b=> b.addEventListener('click', ()=>{
    const relId = b.dataset.poolreassign;
    const rel = DB.ownerUnits.find(x=>x.id===relId);
    const destSel = document.querySelector(`[data-pooldest="${relId}"]`);
    const toId = destSel ? destSel.value : '';
    if(!rel || !toId){ toast('Choose a salesperson to reassign to first'); return; }
    const o = DB.owners.find(x=>x.id===rel.ownerId);
    const unit = DB.units.find(x=>x.id===rel.unitId);
    const fromUser = DB.users.find(x=>x.id===rel.salespersonId);
    const toUser = DB.users.find(x=>x.id===toId);
    if(!confirm(`Reassign ${o?o.name:'this owner'} — ${unitLabel(unit)} from ${fromUser?fromUser.name:'—'} to ${toUser?toUser.name:'—'}?\n\nOnly this one relationship changes — the owner's other units are untouched.`)) return;
    const fromId = rel.salespersonId;
    rel.salespersonId = toId;
    log(u.id,'owner_unit_relationship_reassigned',{ownerUnitId:rel.id, from:fromId, to:toId});
    notify(toId,'system','An owner relationship was reassigned to you: '+(o?o.name:''),'owners','poolreassign_'+rel.id+'_'+now());
    persist(); toast('Relationship reassigned'); renderPageInto(u);
  }));
  document.querySelectorAll('[data-starttransfer]').forEach(b=> b.addEventListener('click', ()=> openOwnerTransferModal(b.dataset.starttransfer, u)));
  const ots = document.getElementById('ownerTransferSearch');
  if(ots){
    ots.addEventListener('input', ()=>{ session._ownerTransferSearch = ots.value; renderPageInto(u); });
    if(session._ownerTransferSearchFocused){ ots.focus(); ots.setSelectionRange(ots.value.length, ots.value.length); }
    ots.addEventListener('focus', ()=>{ session._ownerTransferSearchFocused = true; });
    ots.addEventListener('blur', ()=>{ session._ownerTransferSearchFocused = false; });
  }
};

