/* =========================================================
   OWNERS
   An Owner EXISTS INDEPENDENTLY of any Unit: it is created on its own (name + phone), then
   Units are linked to it afterward via "Add Unit" — never the other way around. Each Owner<->
   Unit relationship carries its own 30-day update cycle and belongs to one salesperson at a
   time. The 30-owner cap counts DISTINCT owners per salesperson (created/shared/held), never
   units — one owner can have unlimited units.
   Personal ("My Owners") vs Team ("Team Owners") data is kept strictly separate: a management
   user's own owners are never mixed into the table of owners belonging to their downline.
   ========================================================= */
function unitLabel(unit){ return unit ? (unit.compound+' · '+unit.unitType) : '(unit removed)'; }
function ownerPhoneDisplay(o){ return phoneLocalDisplay(o.phone); } // shown ONCE, local format only

function renderOwnersPage(u){
  const tk = myTeamKey(u);
  const salesActive = isSalesActive(u);
  const mgmt = isMgmt(u);
  const scope = salesActive ? (mgmt ? (session._ownersScope || 'my') : 'my') : 'team';

  const myList = salesActive ? myOwners(u).filter(o=>o.team===tk) : [];
  const teamList = mgmt ? teamOwners(u).filter(o=>o.team===tk) : (!salesActive ? visibleOwners(u) : []);
  const list = scope==='my' ? myList : teamList;
  const ownerCount = myList.length;
  const atCap = salesActive && ownerCount>=30;

  const availablePool = salesActive ? DB.ownerUnits.filter(r=>
    r.status==='active' && r.salespersonId!==u.id && ownerExpiryState(r.lastUpdateAt)==='expired' &&
    (DB.owners.find(o=>o.id===r.ownerId)||{}).team===tk
  ) : [];

  const scopeTabs = mgmt ? `<div class="scope-tabs">
      <button class="scope-tab ${scope==='my'?'active':''}" data-ownerscope="my">My Owners (${myList.length})</button>
      <button class="scope-tab ${scope==='team'?'active':''}" data-ownerscope="team">${ic('team')} Team Owners (${teamList.length})</button>
    </div>` : '';

  return `
  ${scopeTabs}
  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; gap:10px; flex-wrap:wrap;">
    <div class="section-sub" style="margin-bottom:0;">
      ${salesActive && scope==='my' ? `${ownerCount} / 30 active owners` : `${list.length} owner${list.length===1?'':'s'}${scope==='team'?' across your team':''}`}
    </div>
    ${salesActive && scope==='my' ? `<button class="btn btn-primary btn-sm" id="addOwnerBtn" ${atCap?'disabled title="Remove an owner first — 30 active owner limit reached"':''}>${ic('plus')} Add owner</button>` : ''}
  </div>
  ${atCap?`<div class="card card-pad" style="background:var(--warning-tint); border-color:var(--warning); margin-bottom:14px; font-size:12.5px; color:var(--warning);">You're at the 30 active owner limit. Remove an existing owner (end all of their relationships) before adding a new one.</div>`:''}
  <div class="card" style="margin-bottom:18px;">
    ${list.length? list.map(o=>ownerCard(o,u,scope)).join('') : emptyRow(scope==='my' ? 'No owners yet — click "Add owner" to create your first one.' : 'No team owners yet.')}
  </div>
  ${salesActive && scope==='my' ? `<div class="section-title" style="margin-top:20px;">Available pool</div>
  <div class="section-sub">Specific owner-unit relationships that became available because that relationship wasn't updated in time — claiming one does not affect the owner's other units</div>
  <div class="card">${availablePool.length? availablePool.map(r=>ownerAvailableRow(r,u)).join('') : emptyRow('No relationships currently available.')}</div>` : ''}
  `;
}

function ownerCard(o,u,scope){
  const rels = activeOwnerUnitsFor(o.id);
  const isMine = salespersonHasOwner(u.id, o.id);
  const canEdit = isMine || isAdmin(u);
  const expanded = session._expandedOwner===o.id;
  const home = DB.users.find(x=>x.id===o.salespersonId);
  return `<div class="owner-card" style="padding:13px 16px; border-bottom:1px solid var(--border);">
    <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
      <span class="avatar" style="background:${avatarColor(o.name)}; width:34px;height:34px; flex-shrink:0;">${initials(o.name)}</span>
      <div style="flex:1; min-width:160px;">
        <div style="font-weight:700; font-size:13px;">${esc(o.name)}</div>
        <div style="font-size:11.5px; color:var(--text-faint);">${ownerPhoneDisplay(o)}${o.phone2?' · 2nd: '+phoneLocalDisplay(o.phone2):''} · ${rels.length} unit${rels.length===1?'':'s'}${scope==='team' && home ? ' · '+esc(home.name) : ''}</div>
      </div>
      <div class="contact-actions">
        ${rels.length ? `<button class="btn btn-sm" data-toggleunits="${o.id}">${ic('chevDown')} ${expanded?'Hide':'View'} units</button>` : ''}
        ${canEdit ? `<button class="btn btn-sm" data-addunit="${o.id}">${ic('plus')} Add unit</button>` : ''}
        ${canEdit ? `<button class="btn btn-sm btn-ghost" data-editowner="${o.id}">${ic('edit')} Edit</button>` : ''}
      </div>
    </div>
    ${expanded && rels.length ? `<div style="margin-top:10px; display:flex; flex-direction:column; gap:6px;">
      ${rels.map(r=>relationChip(r,u)).join('')}
    </div>` : ''}
  </div>`;
}
function relationChip(r,u){
  const unit = DB.units.find(x=>x.id===r.unitId);
  const state = ownerExpiryState(r.lastUpdateAt);
  const badge = state==='expired'?'<span class="badge badge-fresh">Expired</span>':state==='soon'?'<span class="badge badge-pending">Update soon</span>':'<span class="badge badge-success">Up to date</span>';
  const sp = DB.users.find(x=>x.id===r.salespersonId);
  const canUpdate = r.salespersonId===u.id;
  return `<div style="display:flex; align-items:center; gap:8px; padding:6px 10px; background:var(--surface-2); border-radius:7px; font-size:12px; flex-wrap:wrap;">
    <span style="flex:1; min-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(unitLabel(unit))}</span>
    ${badge}
    <span style="color:var(--text-faint);">last update ${daysBetween(r.lastUpdateAt)}d ago</span>
    ${sp && sp.id!==u.id ? `<span style="color:var(--text-faint);">· ${esc(sp.name)}</span>` : ''}
    ${canUpdate ? `<button class="btn btn-sm" data-updaterel="${r.id}">${ic('refresh')} Update</button>` : ''}
  </div>`;
}
function ownerAvailableRow(r,u){
  const o = DB.owners.find(x=>x.id===r.ownerId);
  const unit = DB.units.find(x=>x.id===r.unitId);
  const prevSp = DB.users.find(x=>x.id===r.salespersonId);
  const pending = DB.transfers.find(t=>t.ownerUnitId===r.id && t.status==='pending');
  return `<div style="display:flex; align-items:center; gap:12px; padding:13px 16px; border-bottom:1px solid var(--border); flex-wrap:wrap;">
    <span class="avatar" style="background:${avatarColor(o?o.name:'?')}; width:34px;height:34px;">${initials(o?o.name:'?')}</span>
    <div style="flex:1;"><div style="font-weight:700; font-size:13px;">${esc(o?o.name:'—')} · ${esc(unitLabel(unit))}</div><div style="font-size:11.5px; color:var(--text-faint);">Previously with ${esc(prevSp?prevSp.name:'—')} · Not updated for ${daysBetween(r.lastUpdateAt)} days</div></div>
    ${pending ? `<span class="badge badge-pending">Transfer pending admin approval</span>` : `<button class="btn btn-sm btn-primary" data-claimrel="${r.id}">Request transfer</button>`}
  </div>`;
}

AFTER_RENDER.owners = function(u){
  document.querySelectorAll('[data-ownerscope]').forEach(b=> b.addEventListener('click', ()=>{ session._ownersScope=b.dataset.ownerscope; renderPageInto(u); }));
  document.querySelectorAll('[data-toggleunits]').forEach(b=> b.addEventListener('click', ()=>{
    session._expandedOwner = session._expandedOwner===b.dataset.toggleunits ? null : b.dataset.toggleunits;
    renderPageInto(u);
  }));
  document.querySelectorAll('[data-updaterel]').forEach(b=> b.addEventListener('click', ()=>{
    const rel = DB.ownerUnits.find(x=>x.id===b.dataset.updaterel);
    if(rel) openUpdateOwnerModal(rel.ownerId, u, 'choose-mode', rel.id);
  }));
  document.querySelectorAll('[data-addunit]').forEach(b=> b.addEventListener('click', ()=> openAddUnitToOwnerModal(b.dataset.addunit, u)));
  document.querySelectorAll('[data-editowner]').forEach(b=> b.addEventListener('click', ()=> openEditOwnerModal(b.dataset.editowner, u)));
  document.querySelectorAll('[data-claimrel]').forEach(b=> b.addEventListener('click', ()=>{
    const rel = DB.ownerUnits.find(x=>x.id===b.dataset.claimrel);
    if(!rel) return;
    DB.transfers.push({id:uid('tr'), type:'transfer', ownerUnitId:rel.id, ownerId:rel.ownerId, unitId:rel.unitId, fromSalespersonId:rel.salespersonId, toSalespersonId:u.id, status:'pending', at:now()});
    log(u.id,'owner_transfer_requested',{ownerUnitId:rel.id});
    persist(); toast('Transfer requested for this unit — awaiting admin approval'); renderPageInto(u);
  }));
  const ab = document.getElementById('addOwnerBtn'); if(ab) ab.addEventListener('click', ()=> openAddOwnerModal(u));
};

/* ---------- Update Owner flow (per relationship) ----------
   Choose Automatic Update (relationship refreshed, unit untouched) or Edit Unit
   (change unit info; saving also refreshes the relationship). */
function openUpdateOwnerModal(ownerId, u, step, relId){
  step = step || 'choose-mode';
  const o = DB.owners.find(x=>x.id===ownerId);
  const rel = DB.ownerUnits.find(x=>x.id===relId);
  const unit = rel ? DB.units.find(x=>x.id===rel.unitId) : null;
  if(step==='choose-mode'){
    openModal(`
      <div class="modal-head"><div style="font-weight:800;">${esc(unitLabel(unit))} — ${esc(o.name)}</div><button class="close-x" id="modalCloseX">${ic('x')}</button></div>
      <div class="modal-body">
        <div class="section-sub">Do you want to modify the unit information, or just confirm you've checked in with the owner?</div>
        <button class="btn btn-primary" id="autoUpdateBtn" style="width:100%; justify-content:center; margin-bottom:10px;">${ic('check')} Automatic Update — unit unchanged, relationship refreshed</button>
        <button class="btn" id="editUnitBtn" style="width:100%; justify-content:center;">${ic('edit')} Edit Unit — change the unit's information</button>
      </div>`);
    document.getElementById('modalCloseX').addEventListener('click', closeModal);
    document.getElementById('autoUpdateBtn').addEventListener('click', ()=>{
      refreshRelationship(rel, u, 'automatic');
      closeModal(); toast('Owner relationship updated'); renderPageInto(u);
    });
    document.getElementById('editUnitBtn').addEventListener('click', ()=> openUpdateOwnerModal(ownerId,u,'edit-unit',relId));
    return;
  }
  if(step==='edit-unit'){
    openModal(`
      <div class="modal-head"><div style="font-weight:800;">Edit unit — ${esc(unit.compound)}</div><button class="close-x" id="modalCloseX">${ic('x')}</button></div>
      <div class="modal-body">
        <div class="field"><label class="field-label">Compound</label><input id="eu_compound" value="${esc(unit.compound)}"></div>
        <div class="field"><label class="field-label">Developer</label><input id="eu_developer" value="${esc(unit.developer)}"></div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
          <div class="field"><label class="field-label">Total price (EGP)</label><input id="eu_total" type="number" value="${unit.totalPrice}"></div>
          <div class="field"><label class="field-label">Down payment (EGP)</label><input id="eu_dp" type="number" value="${unit.downPayment}"></div>
        </div>
        <div class="field"><label class="field-label">Finishing</label><select id="eu_finishing">${FINISHING.map(f=>`<option ${f===unit.finishing?'selected':''}>${f}</option>`).join('')}</select></div>
      </div>
      <div class="modal-foot"><button class="btn btn-primary" id="saveUnitEditBtn">Save & mark relationship updated</button></div>`);
    document.getElementById('modalCloseX').addEventListener('click', closeModal);
    document.getElementById('saveUnitEditBtn').addEventListener('click', ()=>{
      unit.compound = document.getElementById('eu_compound').value || unit.compound;
      unit.developer = document.getElementById('eu_developer').value || unit.developer;
      unit.totalPrice = Number(document.getElementById('eu_total').value)||unit.totalPrice;
      unit.downPayment = Number(document.getElementById('eu_dp').value)||unit.downPayment;
      unit.finishing = document.getElementById('eu_finishing').value;
      refreshRelationship(rel, u, 'edit_unit');
      log(u.id,'unit_edited_via_owner_update',{unitId:unit.id, ownerUnitId:rel.id});
      closeModal(); toast('Unit updated — relationship marked as updated'); renderPageInto(u);
    });
  }
}
function refreshRelationship(rel, u, mode){
  rel.lastUpdateAt = now();
  rel.nextUpdateAt = rel.lastUpdateAt + 30*86400000;
  rel.reminderAt = rel.lastUpdateAt + 25*86400000;
  log(u.id,'owner_unit_relationship_updated',{ownerUnitId:rel.id, mode});
  persist();
}

/* ---------- Automatic duplicate-owner detection UI (Add Owner) ----------
   Checks live, as the salesperson types either phone field, whether the number already matches
   an existing Owner in the same team — normalizing formatting differences the same way the final
   save-time check always has. A match held by someone else blocks the normal Save button (no
   silent duplicate record); the only ways past it are the existing admin-approved "claim" request
   (unchanged) or, for Senior/Head Admin only, an explicit override with a typed reason and a
   confirmation dialog. A match that's already the current user's own owner is shown as a plain
   reassurance, never a blocker. */
function ownerDupUnitRow(un){
  return `<div style="padding:5px 0; border-top:1px solid var(--border); font-size:12px; display:flex; flex-wrap:wrap; gap:6px; align-items:center;">
    <span style="font-weight:600;">${esc(un.compound)}</span><span style="color:var(--text-faint);">· ${esc(un.phase)} · ${esc(un.unitType)} · ${un.areaSize}m² · ${esc(un.saleRent)}</span>
    ${un.pending?'<span class="badge badge-pending">Pending review</span>':'<span class="badge badge-success">Active</span>'}
  </div>`;
}
function renderOwnerDupWarning(ctx, viewer, opts){
  opts = opts || {};
  if(!ctx) return '';
  if(ctx.isMine){
    return `<div class="card card-pad" id="dupWarnCard" style="background:var(--success-tint); border:1px solid var(--success); margin:4px 0 14px; font-size:12.5px;">
      <div style="font-weight:800; margin-bottom:3px;">${ic('check')} Already in your list</div>
      <div>${esc(ctx.ownerName)} (${phoneLocalDisplay(ctx.phone)}) is already one of your owners — saving will open the existing record rather than create a new one.</div>
    </div>`;
  }
  const unitsHtml = ctx.units.length ? ctx.units.map(ownerDupUnitRow).join('') : `<div style="font-size:12px; color:var(--text-faint); padding:4px 0;">No units linked to this owner yet.</div>`;
  const canOverride = !opts.readOnly && isAdmin(viewer) && typeof canManageUsers==='function' && canManageUsers(viewer);
  return `<div class="card card-pad" id="dupWarnCard" style="background:var(--danger-tint); border:1px solid var(--danger); margin:4px 0 14px; font-size:12.5px;">
    <div style="font-weight:800; color:var(--danger); margin-bottom:4px;">${ic('notif')} Existing Owner Found</div>
    <div style="margin-bottom:8px;">This phone number is already registered in New Avenue 1${opts.readOnly?' with a different owner record':''}.</div>
    <div style="margin-bottom:3px;"><b>${esc(ctx.ownerName)}</b> · ${phoneLocalDisplay(ctx.phone)}${ctx.phone2?' / '+phoneLocalDisplay(ctx.phone2):''}</div>
    <div style="margin-bottom:3px;">Registered salesperson: <b>${esc(ctx.holderName||'—')}</b>${ctx.holderRefCode?' · Ref '+esc(ctx.holderRefCode):''}</div>
    ${ctx.holderTeamLabel ? `<div style="margin-bottom:6px; color:var(--text-faint);">${esc(ctx.holderTeamLabel)}${ctx.holderManagerName?' · Reports to '+esc(ctx.holderManagerName):''}</div>` : ''}
    <div style="font-weight:700; margin:8px 0 2px;">Associated units (${ctx.units.length})</div>
    ${unitsHtml}
    ${opts.readOnly ? `<div style="margin-top:10px; font-size:12px; color:var(--text-faint);">Saving is blocked while this matches another owner's phone number — this would otherwise merge two distinct owner records.</div>` : `
    <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;">
      ${ctx.holderPhone?`<a class="btn btn-sm" href="${telHref(ctx.holderPhone)}">${ic('phone')} Call ${esc((ctx.holderName||'').split(' ')[0]||'')}</a>`:''}
      ${ctx.holderWhatsapp?`<a class="btn btn-sm" href="${waHref(ctx.holderWhatsapp)}" target="_blank" rel="noopener">${ic('whatsapp')} WhatsApp</a>`:''}
      <button class="btn btn-sm btn-primary" id="dupRequestAccessBtn" type="button">Request access (admin approval)</button>
      ${canOverride?`<button class="btn btn-sm btn-ghost" id="dupOverrideBtn" type="button">Create separate record anyway</button>`:''}
    </div>
    <div id="dupOverridePanel"></div>`}
  </div>`;
}
function overridePanelHTML(){
  return `<div style="margin-top:10px; padding-top:10px; border-top:1px dashed var(--danger);">
    <label class="field-label">Reason for creating a separate record (required)</label>
    <textarea id="dupOverrideReason" rows="2" style="width:100%;" placeholder="e.g. Different individual sharing a family phone line — confirmed with owner"></textarea>
    <button class="btn btn-sm btn-primary" id="dupOverrideConfirmBtn" type="button" style="margin-top:8px;">Confirm override & create separate owner</button>
  </div>`;
}
function wireOwnerDupWarningEvents(u, tk, getNamePhones){
  const reqBtn = document.getElementById('dupRequestAccessBtn');
  if(reqBtn) reqBtn.addEventListener('click', ()=>{
    const ctx = session._addOwnerDupCtx;
    if(!ctx) return;
    DB.transfers.push({id:uid('tr'), type:'claim', ownerUnitId:null, ownerId:ctx.ownerId, unitId:null, fromSalespersonId:ctx.holderId, toSalespersonId:u.id, status:'pending', at:now()});
    log(u.id,'owner_claim_requested',{ownerId:ctx.ownerId});
    persist(); closeModal(); toast('Claim sent for admin approval — that owner already exists with another salesperson'); renderPageInto(u);
  });
  const ovBtn = document.getElementById('dupOverrideBtn');
  if(ovBtn) ovBtn.addEventListener('click', ()=>{
    const panel = document.getElementById('dupOverridePanel');
    if(panel) panel.innerHTML = overridePanelHTML();
    const confirmBtn = document.getElementById('dupOverrideConfirmBtn');
    if(confirmBtn) confirmBtn.addEventListener('click', ()=>{
      const ctx = session._addOwnerDupCtx;
      const reason = (document.getElementById('dupOverrideReason')||{}).value || '';
      if(!reason.trim()){ toast('A reason is required to create a separate record'); return; }
      if(!confirm('Create a separate Owner record with the same phone number as an existing Owner?\n\nReason: '+reason.trim()+'\n\nThis is an administrative exception — use it only when you are certain these are genuinely different owners.')) return;
      const { name, canonical, canonical2 } = getNamePhones();
      if(!name){ toast('Owner name is required'); return; }
      if(!canonical){ toast('Enter a valid phone number'); return; }
      const owner = {id:uid('o'), team:tk, salespersonId:u.id, sharedWith:[], name, phone:canonical, phone2:canonical2, createdAt:now(), duplicateOverride:{of:ctx.ownerId, reason:reason.trim(), by:u.id, at:now()}};
      DB.owners.push(owner);
      log(u.id,'owner_added_duplicate_override',{ownerId:owner.id, matchedOwnerId:ctx.ownerId, reason:reason.trim()});
      persist(); closeModal(); toast('Separate owner record created (administrative exception)'); session._expandedOwner=null; renderPageInto(u);
    });
  });
}

/* ---------- Add Owner flow — INDEPENDENT of any Unit ----------
   1) User enters name + phone and saves. No unit is required or asked for here.
   2) The Owner now exists on its own. Units are linked to it afterward via "Add unit".
   3) As the phone is typed, an existing matching Owner (if any) is detected live and shown with
      full context — see the duplicate-detection block above. */
function openAddOwnerModal(u){
  const tk = myTeamKey(u);
  session._addOwnerDupCtx = null;
  openModal(`
    <div class="modal-head"><div style="font-weight:800;">Add owner</div><button class="close-x" id="modalCloseX">${ic('x')}</button></div>
    <div class="modal-body">
      <div class="section-sub" style="margin-bottom:16px;">Create the owner contact first — you can link one or more units to them afterward.</div>
      <div class="field"><label class="field-label">Owner name</label><input id="ow_name"></div>
      <div class="field"><label class="field-label">Phone (digits only — local 01XXXXXXXXX or international 20XXXXXXXXXXX)</label><input id="ow_phone" inputmode="numeric" placeholder="e.g. 01012345678 or 201012345678"></div>
      <div id="ow_dupWarning"></div>
      <div class="field"><label class="field-label">Second phone (optional)</label><input id="ow_phone2" inputmode="numeric"></div>
    </div>
    <div class="modal-foot"><button class="btn btn-primary" id="saveOwnerBtn">Save owner</button></div>`);
  document.getElementById('modalCloseX').addEventListener('click', closeModal);

  function currentNamePhones(){
    const name = document.getElementById('ow_name').value.trim();
    const rawPhone = document.getElementById('ow_phone').value.trim();
    const rawPhone2 = document.getElementById('ow_phone2').value.trim();
    const canonical = isDigitsOnly(rawPhone) ? normalizeEgyptPhone(rawPhone) : null;
    const canonical2 = rawPhone2 && isDigitsOnly(rawPhone2) ? normalizeEgyptPhone(rawPhone2) : null;
    return { name, rawPhone, rawPhone2, canonical, canonical2 };
  }
  function runDupCheck(){
    const { rawPhone, rawPhone2 } = currentNamePhones();
    const match = findDuplicateOwnerByRawPhone(rawPhone, tk) || findDuplicateOwnerByRawPhone(rawPhone2, tk);
    const ctx = match ? ownerDuplicateContext(match, u) : null;
    session._addOwnerDupCtx = ctx;
    const box = document.getElementById('ow_dupWarning');
    if(box){
      box.innerHTML = renderOwnerDupWarning(ctx, u);
      wireOwnerDupWarningEvents(u, tk, ()=>{ const r = currentNamePhones(); return { name:r.name, canonical:r.canonical, canonical2:r.canonical2 }; });
    }
    const saveBtn = document.getElementById('saveOwnerBtn');
    if(saveBtn) saveBtn.disabled = !!(ctx && ctx.heldByOthers);
  }
  ['ow_phone','ow_phone2'].forEach(id=>{
    document.getElementById(id).addEventListener('input', (e)=>{ e.target.value = e.target.value.replace(/[^0-9]/g,''); runDupCheck(); });
  });

  document.getElementById('saveOwnerBtn').addEventListener('click', ()=>{
    const { name, rawPhone, rawPhone2 } = currentNamePhones();
    if(!name){ toast('Owner name is required'); return; }
    if(!isDigitsOnly(rawPhone)){ toast('Phone must contain digits only (no +, spaces, dashes or letters)'); return; }
    const canonical = normalizeEgyptPhone(rawPhone);
    if(!canonical){ toast('Enter a valid Egyptian local (01XXXXXXXXX) or international (20XXXXXXXXXXX) number'); return; }
    let canonical2 = null;
    if(rawPhone2){
      if(!isDigitsOnly(rawPhone2)){ toast('Second phone must contain digits only'); return; }
      canonical2 = normalizeEgyptPhone(rawPhone2);
      if(!canonical2){ toast('Second phone is not a valid Egyptian number'); return; }
    }
    const existing = findOwnerByCanonicalPhone(canonical, tk) || (canonical2 && findOwnerByCanonicalPhone(canonical2, tk));
    if(existing && salespersonHasOwner(u.id, existing.id)){
      closeModal(); toast('You already have this owner in your list'); session._expandedOwner=existing.id; renderPageInto(u);
      return;
    }
    if(existing && ownerHeldByOthers(existing.id, u.id)){
      // Don't silently duplicate the owner record — the live warning above already surfaced this
      // and offers "Request access" / admin override; the plain Save button is a dead end here by
      // design (also disabled by runDupCheck) so this only fires if that validation is bypassed.
      toast('This owner already exists with another salesperson — use "Request access" above, or an admin override, instead of Save');
      return;
    }
    if(distinctOwnerCountForSalesperson(u.id)>=30){
      toast('You are at the 30 active owner limit — remove an owner before adding a new one'); return;
    }
    const owner = {id:uid('o'), team:tk, salespersonId:u.id, sharedWith:[], name, phone:canonical, phone2:canonical2, createdAt:now()};
    DB.owners.push(owner);
    log(u.id,'owner_added',{ownerId:owner.id});
    persist(); closeModal(); toast('Owner added — link a unit whenever you’re ready'); session._expandedOwner=null; renderPageInto(u);
  });
}

/* ---------- Add Unit (to an existing owner) ---------- */
function openAddUnitToOwnerModal(ownerId, u){
  const o = DB.owners.find(x=>x.id===ownerId);
  if(!o) return;
  const tk = o.team;
  const linkedUnitIds = new Set(DB.ownerUnits.filter(r=>r.status==='active').map(r=>r.unitId));
  const availableUnits = DB.units.filter(x=>x.team===tk && !linkedUnitIds.has(x.id));
  openModal(`
    <div class="modal-head"><div style="font-weight:800;">Add unit — ${esc(o.name)}</div><button class="close-x" id="modalCloseX">${ic('x')}</button></div>
    <div class="modal-body">
      ${availableUnits.length ? `<div class="field"><label class="field-label">Unit</label>
        <select id="au_unit">${availableUnits.map(x=>`<option value="${x.id}">${esc(unitLabel(x))}</option>`).join('')}</select>
      </div>` : `<div class="section-sub">No available units right now. Add a new unit from My Units first, then come back here to link it.</div>`}
    </div>
    ${availableUnits.length ? `<div class="modal-foot"><button class="btn btn-primary" id="saveAddUnitBtn">Link unit</button></div>` : ''}`);
  document.getElementById('modalCloseX').addEventListener('click', closeModal);
  const save = document.getElementById('saveAddUnitBtn');
  if(save) save.addEventListener('click', ()=>{
    const unitId = document.getElementById('au_unit').value;
    if(!unitId) return;
    DB.ownerUnits.push(makeOwnerUnitRel(o.id, unitId, u.id, 0));
    log(u.id,'owner_unit_added',{ownerId:o.id, unitId});
    persist(); closeModal(); toast('Unit linked to owner'); session._expandedOwner=o.id; renderPageInto(u);
  });
}

/* ---------- Edit Owner ---------- */
function openEditOwnerModal(ownerId, u){
  const o = DB.owners.find(x=>x.id===ownerId);
  if(!o) return;
  openModal(`
    <div class="modal-head"><div style="font-weight:800;">Edit owner</div><button class="close-x" id="modalCloseX">${ic('x')}</button></div>
    <div class="modal-body">
      <div class="field"><label class="field-label">Owner name</label><input id="eo_name" value="${esc(o.name)}"></div>
      <div class="field"><label class="field-label">Phone</label><input id="eo_phone" inputmode="numeric" value="${phoneLocalDisplay(o.phone)}"></div>
      <div id="eo_dupWarning"></div>
      <div class="field"><label class="field-label">Second phone (optional)</label><input id="eo_phone2" inputmode="numeric" value="${o.phone2?phoneLocalDisplay(o.phone2):''}"></div>
    </div>
    <div class="modal-foot"><button class="btn btn-primary" id="saveEditOwnerBtn">Save changes</button></div>`);
  document.getElementById('modalCloseX').addEventListener('click', closeModal);

  function runEditDupCheck(){
    const rawPhone = document.getElementById('eo_phone').value.trim();
    const rawPhone2 = document.getElementById('eo_phone2').value.trim();
    const m1 = findDuplicateOwnerByRawPhone(rawPhone, o.team);
    const m2 = findDuplicateOwnerByRawPhone(rawPhone2, o.team);
    const match = (m1 && m1.id!==o.id) ? m1 : ((m2 && m2.id!==o.id) ? m2 : null);
    const ctx = match ? ownerDuplicateContext(match, u) : null;
    session._editOwnerDupCtx = ctx;
    const box = document.getElementById('eo_dupWarning');
    if(box) box.innerHTML = ctx ? renderOwnerDupWarning(ctx, u, {readOnly:true}) : '';
    const saveBtn = document.getElementById('saveEditOwnerBtn');
    if(saveBtn) saveBtn.disabled = !!ctx;
  }
  ['eo_phone','eo_phone2'].forEach(id=>{
    document.getElementById(id).addEventListener('input', (e)=>{ e.target.value = e.target.value.replace(/[^0-9]/g,''); runEditDupCheck(); });
  });
  document.getElementById('saveEditOwnerBtn').addEventListener('click', ()=>{
    const name = document.getElementById('eo_name').value.trim();
    const rawPhone = document.getElementById('eo_phone').value.trim();
    const rawPhone2 = document.getElementById('eo_phone2').value.trim();
    if(!name){ toast('Owner name is required'); return; }
    if(!isDigitsOnly(rawPhone)){ toast('Phone must contain digits only'); return; }
    const canonical = normalizeEgyptPhone(rawPhone);
    if(!canonical){ toast('Enter a valid Egyptian local or international number'); return; }
    let canonical2 = null;
    if(rawPhone2){
      if(!isDigitsOnly(rawPhone2)){ toast('Second phone must contain digits only'); return; }
      canonical2 = normalizeEgyptPhone(rawPhone2);
      if(!canonical2){ toast('Second phone is not a valid Egyptian number'); return; }
    }
    const clash = DB.owners.find(x=>x.id!==o.id && x.team===o.team && (x.phone===canonical || x.phone2===canonical || (canonical2 && (x.phone===canonical2 || x.phone2===canonical2))));
    if(clash){ toast('That phone number already belongs to another owner ('+clash.name+')'); return; }
    o.name = name; o.phone = canonical; o.phone2 = canonical2;
    log(u.id,'owner_edited',{ownerId:o.id});
    persist(); closeModal(); toast('Owner updated'); renderPageInto(u);
  });
}
