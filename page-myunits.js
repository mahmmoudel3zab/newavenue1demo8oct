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
    ${list.length? list.map(un=>unitCard(un)).join('') : `<div class="empty-state" style="grid-column:1/-1;">${ic('myunits')}<div>${scope==='my'?"You don't have any units yet.":'No units from your team yet.'}</div></div>`}
  </div>`;
}
AFTER_RENDER.myunits = function(u){
  document.querySelectorAll('[data-unitsscope]').forEach(b=> b.addEventListener('click', ()=>{ session._unitsScope=b.dataset.unitsscope; renderPageInto(u); }));
  document.querySelectorAll('.unit-card').forEach(el=> el.addEventListener('click', ()=> openUnitModal(el.dataset.unit, u)));
  const ab = document.getElementById('addUnitBtn'); if(ab) ab.addEventListener('click', ()=> openAddUnitModal(u));
};
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
          <button class="btn btn-sm" id="addPhotoBtn">${ic('plus')} Add photo</button>
          <span id="photoCount" style="font-size:12px; color:var(--text-faint);">0 photos added</span>
        </div>
      </div>
    </div>
    <div class="modal-foot"><button class="btn btn-primary" id="saveUnitBtn">Submit unit</button></div>`);
  document.getElementById('modalCloseX').addEventListener('click', closeModal);
  document.getElementById('addPhotoBtn').addEventListener('click', ()=>{ session._newUnitPhotos++; document.getElementById('photoCount').textContent = session._newUnitPhotos+' photos added'; });
  document.getElementById('saveUnitBtn').addEventListener('click', ()=>{
    if(session._newUnitPhotos<3){ toast('Add at least 3 photos before submitting'); return; }
    const total = Number(document.getElementById('nu_total').value)||0;
    const dp = Number(document.getElementById('nu_dp').value)||0;
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
      photos: session._newUnitPhotos, ownerSalespersonId: u.id, createdAt: now(),
      views:[], calls:[], whatsapps:[], pdfs:[]
    };
    DB.units.push(newUnit);
    log(u.id,'unit_created',{unitId:newUnit.id});
    persist(); closeModal(); toast('Unit added — visible now, pending admin review'); renderPageInto(u);
  });
}

