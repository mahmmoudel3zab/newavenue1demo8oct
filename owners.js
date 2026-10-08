/* =========================================================
   OWNERS
   Real Owner <-> Unit relationships: an Owner is a contact; each
   relationship to a specific Unit carries its own 30-day update
   cycle, its own status, and belongs to one salesperson at a time.
   The 30-owner cap counts DISTINCT owners per salesperson, never units.
   ========================================================= */
function unitLabel(unit){ return unit ? (unit.compound+' · '+unit.unitType) : '(unit removed)'; }

function renderOwnersPage(u){
  const tk = myTeamKey(u);
  const isSales = u.role==='salesperson';
  const myRelations = isSales ? ownerUnitsForSalesperson(u.id) : [];
  const myOwnerIds = [...new Set(myRelations.map(r=>r.ownerId))];
  const ownerCount = myOwnerIds.length;
  const atCap = isSales && ownerCount>=30;

  // visible owners (mine, or downline's, or everyone in team for admins)
  const visibleRelations = visibleOwnerUnits(u).filter(r=>r.status==='active');
  const groupIds = isSales ? myOwnerIds : [...new Set(visibleRelations.map(r=>r.ownerId))];
  const groups = groupIds.map(oid=>({
    owner: DB.owners.find(o=>o.id===oid),
    relations: (isSales? myRelations : visibleRelations).filter(r=>r.ownerId===oid)
  })).filter(g=>g.owner);

  const availablePool = isSales ? DB.ownerUnits.filter(r=>
    r.status==='active' && r.salespersonId!==u.id && ownerExpiryState(r.lastUpdateAt)==='expired' &&
    (DB.owners.find(o=>o.id===r.ownerId)||{}).team===tk
  ) : [];

  return `
  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
    <div class="section-sub" style="margin-bottom:0;">${isSales?`${ownerCount} / 30 active owners`:`${groups.length} owners visible`}</div>
    ${isSales?`<button class="btn btn-primary btn-sm" id="addOwnerBtn" ${atCap?'disabled title="Remove an owner first — 30 active owner limit reached"':''}>${ic('plus')} Add owner</button>`:''}
  </div>
  ${atCap?`<div class="card card-pad" style="background:var(--warning-tint); border-color:var(--warning); margin-bottom:14px; font-size:12.5px; color:var(--warning);">You're at the 30 active owner limit. Remove an existing owner (end all of their relationships) before adding a new one.</div>`:''}
  <div class="card" style="margin-bottom:18px;">
    ${groups.length? groups.map(g=>ownerGroupRow(g,u)).join('') : emptyRow('No owners yet.')}
  </div>
  ${isSales ? `<div class="section-title" style="margin-top:20px;">Available pool</div>
  <div class="section-sub">Specific owner-unit relationships that became available because that relationship wasn't updated in time — claiming one does not affect the owner's other units</div>
  <div class="card">${availablePool.length? availablePool.map(r=>ownerAvailableRow(r,u)).join('') : emptyRow('No relationships currently available.')}</div>` : ''}
  `;
}

function ownerGroupRow(g,u){
  const o = g.owner;
  const isMineGroup = g.relations.some(r=>r.salespersonId===u.id);
  return `<div style="padding:13px 16px; border-bottom:1px solid var(--border);">
    <div style="display:flex; align-items:center; gap:12px;">
      <span class="avatar" style="background:${avatarColor(o.name)}; width:34px;height:34px;">${initials(o.name)}</span>
      <div style="flex:1; min-width:0;">
        <div style="font-weight:700; font-size:13px;">${esc(o.name)}</div>
        <div style="font-size:11.5px; color:var(--text-faint);">${phoneLocalDisplay(o.phone)} (${phoneIntlDisplay(o.phone)})${o.phone2?' · 2nd: '+phoneLocalDisplay(o.phone2):''} · ${g.relations.length} unit(s)</div>
      </div>
      ${isMineGroup?`<button class="btn btn-sm" data-updateowner="${o.id}">${ic('refresh')} Update</button>`:''}
    </div>
    <div style="margin-top:9px; display:flex; flex-direction:column; gap:6px;">
      ${g.relations.map(r=>relationChip(r,u)).join('')}
    </div>
  </div>`;
}
function relationChip(r,u){
  const unit = DB.units.find(x=>x.id===r.unitId);
  const state = ownerExpiryState(r.lastUpdateAt);
  const badge = state==='expired'?'<span class="badge badge-fresh">Expired</span>':state==='soon'?'<span class="badge badge-pending">Update soon</span>':'<span class="badge badge-success">Up to date</span>';
  const sp = DB.users.find(x=>x.id===r.salespersonId);
  return `<div style="display:flex; align-items:center; gap:8px; padding:6px 10px; background:var(--surface-2); border-radius:7px; font-size:12px;">
    <span style="flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(unitLabel(unit))}</span>
    ${badge}
    <span style="color:var(--text-faint);">last update ${daysBetween(r.lastUpdateAt)}d ago</span>
    ${sp && sp.id!==u.id ? `<span style="color:var(--text-faint);">· ${esc(sp.name)}</span>` : ''}
  </div>`;
}
function ownerAvailableRow(r,u){
  const o = DB.owners.find(x=>x.id===r.ownerId);
  const unit = DB.units.find(x=>x.id===r.unitId);
  const prevSp = DB.users.find(x=>x.id===r.salespersonId);
  const pending = DB.transfers.find(t=>t.ownerUnitId===r.id && t.status==='pending');
  return `<div style="display:flex; align-items:center; gap:12px; padding:13px 16px; border-bottom:1px solid var(--border);">
    <span class="avatar" style="background:${avatarColor(o?o.name:'?')}; width:34px;height:34px;">${initials(o?o.name:'?')}</span>
    <div style="flex:1;"><div style="font-weight:700; font-size:13px;">${esc(o?o.name:'—')} · ${esc(unitLabel(unit))}</div><div style="font-size:11.5px; color:var(--text-faint);">Previously with ${esc(prevSp?prevSp.name:'—')} · Not updated for ${daysBetween(r.lastUpdateAt)} days</div></div>
    ${pending ? `<span class="badge badge-pending">Transfer pending admin approval</span>` : `<button class="btn btn-sm btn-primary" data-claimrel="${r.id}">Request transfer</button>`}
  </div>`;
}

AFTER_RENDER.owners = function(u){
  document.querySelectorAll('[data-updateowner]').forEach(b=> b.addEventListener('click', ()=> openUpdateOwnerModal(b.dataset.updateowner, u)));
  document.querySelectorAll('[data-claimrel]').forEach(b=> b.addEventListener('click', ()=>{
    const rel = DB.ownerUnits.find(x=>x.id===b.dataset.claimrel);
    if(!rel) return;
    DB.transfers.push({id:uid('tr'), type:'transfer', ownerUnitId:rel.id, ownerId:rel.ownerId, unitId:rel.unitId, fromSalespersonId:rel.salespersonId, toSalespersonId:u.id, status:'pending', at:now()});
    log(u.id,'owner_transfer_requested',{ownerUnitId:rel.id});
    persist(); toast('Transfer requested for this unit — awaiting admin approval'); renderPageInto(u);
  }));
  const ab = document.getElementById('addOwnerBtn'); if(ab) ab.addEventListener('click', ()=> openAddOwnerModal(u));
};

/* ---------- Update Owner flow ----------
   1) Pick which of this owner's units to update.
   2) Choose Automatic Update (relationship refreshed, unit untouched) or Edit Unit
      (change unit info; saving also refreshes the relationship). */
function openUpdateOwnerModal(ownerId, u, step, relId){
  step = step || 'pick-unit';
  const o = DB.owners.find(x=>x.id===ownerId);
  const relations = DB.ownerUnits.filter(r=>r.ownerId===ownerId && r.salespersonId===u.id && r.status==='active');
  if(step==='pick-unit'){
    openModal(`
      <div class="modal-head"><div style="font-weight:800;">Update owner — ${esc(o.name)}</div><button class="close-x" id="modalCloseX">${ic('x')}</button></div>
      <div class="modal-body">
        <div class="section-sub">Which unit's relationship do you want to update?</div>
        ${relations.map(r=>{
          const unit = DB.units.find(x=>x.id===r.unitId);
          return `<button class="btn" data-pickrel="${r.id}" style="width:100%; justify-content:space-between; margin-bottom:8px;"><span>${esc(unitLabel(unit))}</span><span style="color:var(--text-faint); font-weight:500;">last update ${daysBetween(r.lastUpdateAt)}d ago</span></button>`;
        }).join('') || emptyRow('No active units for this owner.')}
      </div>`);
    document.getElementById('modalCloseX').addEventListener('click', closeModal);
    document.querySelectorAll('[data-pickrel]').forEach(b=> b.addEventListener('click', ()=> openUpdateOwnerModal(ownerId,u,'choose-mode',b.dataset.pickrel)));
    return;
  }
  const rel = DB.ownerUnits.find(x=>x.id===relId);
  const unit = DB.units.find(x=>x.id===rel.unitId);
  if(step==='choose-mode'){
    openModal(`
      <div class="modal-head"><div style="font-weight:800;">${esc(unitLabel(unit))}</div><button class="close-x" id="modalCloseX">${ic('x')}</button></div>
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

/* ---------- Add Owner flow ---------- */
function openAddOwnerModal(u){
  const tk = myTeamKey(u);
  // Units in this salesperson's team not currently tied to an active owner relationship.
  const linkedUnitIds = new Set(DB.ownerUnits.filter(r=>r.status==='active').map(r=>r.unitId));
  const availableUnits = DB.units.filter(x=>x.team===tk && !linkedUnitIds.has(x.id));
  openModal(`
    <div class="modal-head"><div style="font-weight:800;">Add owner</div><button class="close-x" id="modalCloseX">${ic('x')}</button></div>
    <div class="modal-body">
      <div class="field"><label class="field-label">Owner name</label><input id="ow_name"></div>
      <div class="field"><label class="field-label">Phone (digits only — local 01XXXXXXXXX or international 20XXXXXXXXXXX)</label><input id="ow_phone" inputmode="numeric" placeholder="e.g. 01012345678 or 201012345678"></div>
      <div class="field"><label class="field-label">Second phone (optional)</label><input id="ow_phone2" inputmode="numeric"></div>
      <div class="field"><label class="field-label">Unit for this relationship</label>
        <select id="ow_unit">${availableUnits.length? availableUnits.map(x=>`<option value="${x.id}">${esc(unitLabel(x))}</option>`).join('') : '<option value="">No available units</option>'}</select>
      </div>
    </div>
    <div class="modal-foot"><button class="btn btn-primary" id="saveOwnerBtn">Save owner</button></div>`);
  document.getElementById('modalCloseX').addEventListener('click', closeModal);
  ['ow_phone','ow_phone2'].forEach(id=>{
    document.getElementById(id).addEventListener('input', (e)=>{ e.target.value = e.target.value.replace(/[^0-9]/g,''); });
  });
  document.getElementById('saveOwnerBtn').addEventListener('click', ()=>{
    const name = document.getElementById('ow_name').value.trim();
    const rawPhone = document.getElementById('ow_phone').value.trim();
    const rawPhone2 = document.getElementById('ow_phone2').value.trim();
    const unitId = document.getElementById('ow_unit').value;
    if(!name){ toast('Owner name is required'); return; }
    if(!unitId){ toast('Select a unit for this owner relationship'); return; }
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
    const wouldBeNewOwnerForMe = !existing || !salespersonHasOwner(u.id, existing.id);
    if(wouldBeNewOwnerForMe && distinctOwnerCountForSalesperson(u.id)>=30){
      toast('You are at the 30 active owner limit — remove an owner before adding a new one'); return;
    }
    if(!existing){
      // Brand new owner — no duplicate by normalized phone exists. Create immediately, no approval needed.
      const owner = {id:uid('o'), team:tk, name, phone:canonical, phone2:canonical2, createdAt:now()};
      DB.owners.push(owner);
      DB.ownerUnits.push(makeOwnerUnitRel(owner.id, unitId, u.id, 0));
      log(u.id,'owner_added',{ownerId:owner.id});
      persist(); closeModal(); toast('Owner added'); renderPageInto(u);
      return;
    }
    if(salespersonHasOwner(u.id, existing.id)){
      // Same owner, another unit — add directly. One owner can have unlimited units.
      DB.ownerUnits.push(makeOwnerUnitRel(existing.id, unitId, u.id, 0));
      log(u.id,'owner_unit_added',{ownerId:existing.id, unitId});
      persist(); closeModal(); toast('New unit linked to existing owner'); renderPageInto(u);
      return;
    }
    if(ownerHeldByOthers(existing.id, u.id)){
      // This phone number already belongs to another salesperson's owner contact — don't silently
      // duplicate the owner record; require admin approval before this salesperson can claim it.
      DB.transfers.push({id:uid('tr'), type:'claim', ownerUnitId:null, ownerId:existing.id, unitId, fromSalespersonId: (DB.ownerUnits.find(r=>r.ownerId===existing.id && r.status==='active')||{}).salespersonId || null, toSalespersonId:u.id, status:'pending', at:now()});
      log(u.id,'owner_claim_requested',{ownerId:existing.id, unitId});
      persist(); closeModal(); toast('That owner already exists with another salesperson — claim sent for admin approval'); renderPageInto(u);
      return;
    }
    // Owner exists but currently has no active relationships with anyone — free to attach directly.
    DB.ownerUnits.push(makeOwnerUnitRel(existing.id, unitId, u.id, 0));
    log(u.id,'owner_unit_added',{ownerId:existing.id, unitId});
    persist(); closeModal(); toast('Owner added'); renderPageInto(u);
  });
}
