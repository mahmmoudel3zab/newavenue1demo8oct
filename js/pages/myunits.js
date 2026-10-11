/* =========================================================
   MY UNITS  (+ Team Units for management — kept strictly separate)
   ========================================================= */
function renderMyUnitsPage(u){
  const mgmt = isMgmt(u);
  const scope = mgmt ? (session._unitsScope || 'my') : 'my';
  const mine = myUnits(u);
  const team = mgmt ? teamUnits(u) : [];
  const list = scope==='my' ? mine : team;
  const scopeTabs = mgmt ? `<div class="scope-tabs">
      <button class="scope-tab ${scope==='my'?'active':''}" data-unitsscope="my">My Units (${mine.length})</button>
      <button class="scope-tab ${scope==='team'?'active':''}" data-unitsscope="team">${ic('team')} Team Units (${team.length})</button>
    </div>` : '';
  return `
  ${scopeTabs}
  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
    <div class="section-sub" style="margin-bottom:0;">${list.length} unit${list.length===1?'':'s'}${scope==='my'?' belong to you':' across your team'}</div>
    ${scope==='my'?`<button class="btn btn-primary btn-sm" id="addUnitBtn">${ic('plus')} Add new unit</button>`:''}
  </div>
  <div class="grid-3">
    ${list.length? list.map(un=>myUnitCardWrap(un, scope==='my')).join('') : `<div class="empty-state" style="grid-column:1/-1;">${ic('myunits')}<div>${scope==='my'?"You don't have any units yet.":'No units from your team yet.'}</div></div>`}
  </div>`;
}
// PART 2 — Edit Units in My Units: wraps the existing unitCard() (clicking it still opens the
// normal view-only detail modal, unchanged) with a clearly visible Edit / Delete action row,
// shown only for units that belong to the viewer (never on the Team Units scope, where these
// actions aren't the viewer's to take). The action row is a SIBLING of the card, not nested
// inside it, so these buttons never trigger the card's own "open detail modal" click handler.
function myUnitCardWrap(un, mine){
  return `<div>
    ${unitCard(un)}
    ${mine ? `<div style="display:flex; gap:8px; margin-top:8px;">
      <button class="btn btn-sm" style="flex:1; justify-content:center;" data-editunit="${un.id}">${ic('edit')} Edit</button>
      <button class="btn btn-sm btn-danger" style="flex:1; justify-content:center;" data-deleteunit="${un.id}">${ic('x')} Delete</button>
    </div>` : ''}
  </div>`;
}
AFTER_RENDER.myunits = function(u){
  document.querySelectorAll('[data-unitsscope]').forEach(b=> b.addEventListener('click', ()=>{ session._unitsScope=b.dataset.unitsscope; renderPageInto(u); }));
  document.querySelectorAll('.unit-card').forEach(el=> el.addEventListener('click', ()=> openUnitModal(el.dataset.unit, u)));
  const ab = document.getElementById('addUnitBtn'); if(ab) ab.addEventListener('click', ()=> openAddUnitModal(u));
  document.querySelectorAll('[data-editunit]').forEach(b=> b.addEventListener('click', (e)=>{ e.stopPropagation(); openEditUnitModal(b.dataset.editunit, u); }));
  document.querySelectorAll('[data-deleteunit]').forEach(b=> b.addEventListener('click', (e)=>{
    e.stopPropagation();
    const un = DB.units.find(x=>x.id===b.dataset.deleteunit);
    if(!un) return;
    if(un.ownerSalespersonId!==u.id){ toast('You can only delete units that belong to you'); return; }
    const ok = confirm(
      `Remove ${un.compound} — ${un.unitType} from your My Units list?\n\n`+
      `It will disappear from your normal inventory and My Units views. Its data, photos and owner relationships are kept safely and are NOT deleted — only a Head Admin can restore it.`
    );
    if(!ok) return;
    softDeleteUnit(un, u.id);
    log(u.id,'unit_soft_deleted',{unitId:un.id});
    persist(); toast('Unit removed from your list'); renderPageInto(u);
  }));
};
// Shared "leave with unsaved changes?" guard for the Add/Edit Unit forms (Part 2 / Part 6).
// Wires a dirty flag to every field, intercepts the modal's Close(X) + Cancel buttons (the
// backdrop is opened with noBackdropClose so a stray outside click can never silently discard a
// half-filled form — Close/Cancel stay the clear, always-visible way out) and only asks for
// confirmation when something has actually changed.
function wireUnsavedChangesGuard(fieldIds, closeBtnIds){
  let dirty = false;
  fieldIds.forEach(id=>{
    const el = document.getElementById(id);
    if(el){ el.addEventListener('input', ()=>{ dirty = true; }); el.addEventListener('change', ()=>{ dirty = true; }); }
  });
  function attemptClose(){
    if(dirty && !confirm('You have unsaved changes. Discard them and close this form?')) return;
    closeModal();
  }
  closeBtnIds.forEach(id=>{ const el = document.getElementById(id); if(el) el.addEventListener('click', attemptClose); });
  return { markClean(){ dirty = false; }, markDirty(){ dirty = true; } };
}
function openAddUnitModal(u){
  const tk = myTeamKey(u);
  const isRes = tk==='residential';
  const unitTypes = isRes?UNIT_TYPES_RES:UNIT_TYPES_COM;
  session._newUnitPhotos = 0;
  openModal(`
    <div class="modal-head"><div style="font-weight:800;">Add new unit</div><button class="close-x" id="modalCloseX">${ic('x')}</button></div>
    <div class="modal-body">
      <div class="field"><label class="field-label">Compound</label><input id="nu_compound" value="${esc(pick(isRes?COMPOUNDS_RES:COMPOUNDS_COM))}"></div>
      <div class="field"><label class="field-label">Developer</label><input id="nu_developer" value="${esc(pick(isRes?DEVELOPERS_RES:DEVELOPERS_COM))}"></div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
        <div class="field"><label class="field-label">Unit type</label><select id="nu_type">${unitTypes.map(t=>`<option>${t}</option>`).join('')}</select></div>
        <div class="field"><label class="field-label">Sale / Rent</label><select id="nu_saleRent"><option>Sale</option><option>Rent</option></select></div>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
        <div class="field"><label class="field-label">Total price (EGP)</label><input id="nu_total" type="number" value="4500000"></div>
        <div class="field"><label class="field-label">Down payment (EGP)</label><input id="nu_dp" type="number" value="900000"></div>
      </div>
      <div class="field"><label class="field-label">Photos — add at least 3</label>
        <div style="display:flex; gap:8px; align-items:center;">
          <button class="btn btn-sm" id="addPhotoBtn" type="button">${ic('plus')} Add photo</button>
          <span id="photoCount" style="font-size:12px; color:var(--text-faint);">0 photos added</span>
        </div>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn" id="cancelAddUnitBtn">Cancel</button>
      <button class="btn btn-primary" id="saveUnitBtn">Submit unit</button>
    </div>`, {noBackdropClose:true});
  const guard = wireUnsavedChangesGuard(
    ['nu_compound','nu_developer','nu_type','nu_saleRent','nu_total','nu_dp'],
    ['modalCloseX','cancelAddUnitBtn']
  );
  document.getElementById('addPhotoBtn').addEventListener('click', ()=>{ session._newUnitPhotos++; document.getElementById('photoCount').textContent = session._newUnitPhotos+' photos added'; guard.markDirty(); });
  document.getElementById('saveUnitBtn').addEventListener('click', ()=>{
    if(session._newUnitPhotos<3){ toast('Add at least 3 photos before submitting'); return; }
    const total = Number(document.getElementById('nu_total').value)||0;
    const dp = Number(document.getElementById('nu_dp').value)||0;
    if(total<=0){ toast('Enter a valid total price'); return; }
    if(dp<0 || dp>total){ toast('Down payment must be between 0 and the total price'); return; }
    const newUnit = {
      id: uid('u'), team: tk, pending:true,
      compound: document.getElementById('nu_compound').value || 'Untitled Compound',
      phase:'Phase 1', developer: document.getElementById('nu_developer').value,
      city: pick(CITIES), area: pick(AREAS), saleRent: document.getElementById('nu_saleRent').value,
      unitType: document.getElementById('nu_type').value,
      areaSize: rndInt(90,300), garden:0, roof:0,
      bedrooms: isRes?rndInt(1,4):null, bathrooms: rndInt(1,3),
      deliveryYears: pick([0,1,2]),
      downPayment: dp, remainingAmount: Math.max(total-dp,0), remainingInstallments: 36,
      totalPrice: total, extraFees: Math.round(total*0.03), finishing: pick(FINISHING), furnished:false,
      photos: session._newUnitPhotos, ownerSalespersonId: u.id, createdAt: now(), updatedAt: now(),
      deletedAt: null, deletedBy: null,
      views:[], calls:[], whatsapps:[], pdfs:[]
    };
    DB.units.push(newUnit);
    log(u.id,'unit_created',{unitId:newUnit.id});
    guard.markClean();
    persist(); closeModal(); toast('Unit added — visible now, pending admin review'); renderPageInto(u);
  });
}

/* ---------- PART 2: Edit Unit (from My Units) ----------
   Reuses the same field set/layout as "Add new unit" above, pre-filled with the unit's current
   values. Saving updates the SAME unit record in place (never creates a new one) and never
   touches its ownerSalespersonId/team/pending/interaction-history/photos-beyond-count or any
   owner relationship that references it — only the fields actually shown here can change.
   Backend ownership/editing permission is mirrored here: only the unit's own salesperson may
   open this modal (see the data-editunit handler in AFTER_RENDER.myunits above), and this
   frontend check is a demo-level guard only — the same caveat already documented for every
   other permission check in this prototype; real enforcement belongs server-side. */
function openEditUnitModal(unitId, u){
  const un = DB.units.find(x=>x.id===unitId);
  if(!un || un.deletedAt){ toast('This unit is no longer available.'); return; }
  if(un.ownerSalespersonId!==u.id){ toast('You can only edit units that belong to you'); return; }
  const isRes = un.team==='residential';
  const unitTypes = isRes?UNIT_TYPES_RES:UNIT_TYPES_COM;
  session._editUnitPhotos = un.photos;
  openModal(`
    <div class="modal-head"><div style="font-weight:800;">Edit unit — ${esc(un.compound)}</div><button class="close-x" id="modalCloseX">${ic('x')}</button></div>
    <div class="modal-body">
      <div class="field"><label class="field-label">Compound</label><input id="eu2_compound" value="${esc(un.compound)}"></div>
      <div class="field"><label class="field-label">Developer</label><input id="eu2_developer" value="${esc(un.developer)}"></div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
        <div class="field"><label class="field-label">Unit type</label><select id="eu2_type">${unitTypes.map(t=>`<option ${t===un.unitType?'selected':''}>${t}</option>`).join('')}</select></div>
        <div class="field"><label class="field-label">Sale / Rent</label><select id="eu2_saleRent"><option ${un.saleRent==='Sale'?'selected':''}>Sale</option><option ${un.saleRent==='Rent'?'selected':''}>Rent</option></select></div>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
        <div class="field"><label class="field-label">Total price (EGP)</label><input id="eu2_total" type="number" value="${un.totalPrice}"></div>
        <div class="field"><label class="field-label">Down payment (EGP)</label><input id="eu2_dp" type="number" value="${un.downPayment}"></div>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
        <div class="field"><label class="field-label">Area size (m²)</label><input id="eu2_area" type="number" min="1" value="${un.areaSize}"></div>
        <div class="field"><label class="field-label">Finishing</label><select id="eu2_finishing">${FINISHING.map(f=>`<option ${f===un.finishing?'selected':''}>${f}</option>`).join('')}</select></div>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
        ${isRes?`<div class="field"><label class="field-label">Bedrooms</label><input id="eu2_bedrooms" type="number" min="0" value="${un.bedrooms!=null?un.bedrooms:0}"></div>`:''}
        <div class="field"><label class="field-label">Bathrooms</label><input id="eu2_bathrooms" type="number" min="1" value="${un.bathrooms}"></div>
      </div>
      <div class="field"><label class="field-label">Photos — at least 3</label>
        <div style="display:flex; gap:8px; align-items:center;">
          <button class="btn btn-sm" id="eu2AddPhotoBtn" type="button">${ic('plus')} Add photo</button>
          <span id="eu2PhotoCount" style="font-size:12px; color:var(--text-faint);">${un.photos} photos</span>
        </div>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn" id="cancelEditUnitBtn">Cancel</button>
      <button class="btn btn-primary" id="saveEditUnitBtn">Save changes</button>
    </div>`, {noBackdropClose:true});
  const guard = wireUnsavedChangesGuard(
    ['eu2_compound','eu2_developer','eu2_type','eu2_saleRent','eu2_total','eu2_dp','eu2_area','eu2_finishing','eu2_bedrooms','eu2_bathrooms'],
    ['modalCloseX','cancelEditUnitBtn']
  );
  document.getElementById('eu2AddPhotoBtn').addEventListener('click', ()=>{ session._editUnitPhotos++; document.getElementById('eu2PhotoCount').textContent = session._editUnitPhotos+' photos'; guard.markDirty(); });
  document.getElementById('saveEditUnitBtn').addEventListener('click', ()=>{
    if(session._editUnitPhotos<3){ toast('At least 3 photos are required'); return; }
    const total = Number(document.getElementById('eu2_total').value)||0;
    const dp = Number(document.getElementById('eu2_dp').value)||0;
    if(total<=0){ toast('Enter a valid total price'); return; }
    if(dp<0 || dp>total){ toast('Down payment must be between 0 and the total price'); return; }
    const compound = document.getElementById('eu2_compound').value.trim();
    const developer = document.getElementById('eu2_developer').value.trim();
    if(!compound){ toast('Compound is required'); return; }
    if(!developer){ toast('Developer is required'); return; }
    const area = Number(document.getElementById('eu2_area').value)||0;
    if(area<=0){ toast('Enter a valid area size'); return; }
    const bathrooms = Number(document.getElementById('eu2_bathrooms').value)||0;
    if(bathrooms<=0){ toast('Enter a valid number of bathrooms'); return; }
    un.compound = compound; un.developer = developer;
    un.unitType = document.getElementById('eu2_type').value;
    un.saleRent = document.getElementById('eu2_saleRent').value;
    un.totalPrice = total; un.downPayment = dp; un.remainingAmount = Math.max(total-dp,0);
    un.areaSize = area;
    un.finishing = document.getElementById('eu2_finishing').value;
    if(isRes){ const bd = document.getElementById('eu2_bedrooms'); if(bd) un.bedrooms = Math.max(0, Number(bd.value)||0); }
    un.bathrooms = bathrooms;
    un.photos = session._editUnitPhotos;
    un.updatedAt = now();
    guard.markClean();
    log(u.id,'unit_edited',{unitId:un.id});
    persist(); closeModal(); toast('Unit updated'); renderPageInto(u);
  });
}

