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
    NA1_API.del('/units/'+encodeURIComponent(un.id), { team: un.team }).then(async ()=>{
      await hydrateOwnersAndUnitsFromServer(u);
      toast('Unit removed from your list'); renderPageInto(u);
    }).catch(e=> reportUnitWriteError(e, 'delete this unit'));
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
/* ---------- Shared unit form (Add + Edit) ----------
   Every business field is entered or chosen by the user — NOTHING is pre-filled with random or
   demo values (no random city/area/size/bathrooms/delivery/finishing, no default prices).
   Free-text fields (compound, developer, city, area) offer suggestions via <datalist> but accept
   any typed value. Selects start on a "Select…" placeholder and are required. Validation runs
   here (friendly toasts) AND again on the backend (routes/units.js), which is the real authority. */
const DELIVERY_OPTIONS = [[0,'Immediate'],[1,'Within 1 year'],[2,'2 years'],[3,'3 years'],[4,'4 years'],[5,'5 years']];
function unitFormFields(p, isRes, un){
  const v = (k, d='') => (un && un[k] !== null && un[k] !== undefined) ? esc(String(un[k])) : d;
  const unitTypes = isRes?UNIT_TYPES_RES:UNIT_TYPES_COM;
  const sel = (id, label, opts, cur) => `<div class="field"><label class="field-label">${label}</label><select id="${p}_${id}"><option value="">Select…</option>${opts.map(o=>{ const val=Array.isArray(o)?o[0]:o, lab=Array.isArray(o)?o[1]:o; return `<option value="${esc(String(val))}" ${cur!==undefined&&cur!==null&&String(cur)===String(val)?'selected':''}>${esc(lab)}</option>`; }).join('')}</select></div>`;
  const txt = (id, label, list, listId, cur, ph) => `<div class="field"><label class="field-label">${label}</label><input id="${p}_${id}" ${listId?`list="${p}_${listId}"`:''} value="${cur}" placeholder="${ph||''}" autocomplete="off">${listId?`<datalist id="${p}_${listId}">${list.map(x=>`<option value="${esc(x)}">`).join('')}</datalist>`:''}</div>`;
  const num = (id, label, cur, min, ph) => `<div class="field"><label class="field-label">${label}</label><input id="${p}_${id}" type="number" min="${min}" value="${cur}" placeholder="${ph||''}"></div>`;
  return `
      ${txt('compound','Compound',(isRes?COMPOUNDS_RES:COMPOUNDS_COM),'cl',v('compound'),'e.g. compound name')}
      ${txt('developer','Developer',(isRes?DEVELOPERS_RES:DEVELOPERS_COM),'dl',v('developer'),'e.g. developer name')}
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
        ${txt('city','City',CITIES,'ct',v('city'),'')}
        ${txt('area','Area',AREAS,'ar',v('area'),'')}
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
        ${sel('type','Unit type',unitTypes,un&&un.unitType)}
        ${sel('saleRent','Sale / Rent',['Sale','Rent'],un&&un.saleRent)}
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
        ${num('size','Unit area (m²)',v('areaSize'),1,'')}
        ${sel('finishing','Finishing',FINISHING,un&&un.finishing)}
      </div>
      <div style="display:grid; grid-template-columns:${isRes?'1fr 1fr':'1fr'}; gap:10px;">
        ${isRes?num('bedrooms','Bedrooms',v('bedrooms'),0,''):''}
        ${num('bathrooms','Bathrooms',v('bathrooms'),1,'')}
      </div>
      ${sel('delivery','Delivery',DELIVERY_OPTIONS,un?un.deliveryYears:undefined)}
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
        ${num('total','Total price (EGP)',v('totalPrice'),1,'')}
        ${num('dp','Down payment (EGP)',v('downPayment'),0,'')}
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
        ${num('installments','Remaining installments (count)',v('remainingInstallments'),0,'0 if none')}
        ${num('fees','Extra fees (EGP, optional)',v('extraFees','' ),0,'leave blank for none')}
      </div>
      <label style="display:flex; gap:8px; align-items:center; font-size:13px; margin-bottom:10px;"><input type="checkbox" id="${p}_furnished" ${un&&un.furnished?'checked':''}> Furnished</label>`;
}
const UNIT_FORM_IDS = (p,isRes)=> ['compound','developer','city','area','type','saleRent','size','finishing',...(isRes?['bedrooms']:[]),'bathrooms','delivery','total','dp','installments','fees','furnished'].map(x=>p+'_'+x);
// Reads + validates the shared form. Returns {error} or {body}. Blank required numbers are
// rejected (a blank is never silently turned into 0 or a random value).
function readUnitForm(p, isRes, team){
  const g = id => document.getElementById(p+'_'+id);
  const text = id => (g(id).value||'').trim();
  const numOrNull = id => { const raw = (g(id).value||'').trim(); if(raw==='') return null; const n = Number(raw); return Number.isFinite(n) ? n : NaN; };
  const compound=text('compound'), developer=text('developer'), city=text('city'), area=text('area');
  if(!compound) return {error:'Compound is required'};
  if(!developer) return {error:'Developer is required'};
  if(!city) return {error:'City is required'};
  if(!area) return {error:'Area is required'};
  if(compound.length>150||developer.length>150||city.length>150||area.length>150) return {error:'Compound, developer, city and area must be 150 characters or fewer'};
  const unitType=text('type'); if(!unitType) return {error:'Select a unit type'};
  const saleRent=text('saleRent'); if(!saleRent) return {error:'Select Sale or Rent'};
  const size=numOrNull('size'); if(size===null||!(size>0)) return {error:'Enter a valid unit area (greater than 0)'};
  const finishing=text('finishing'); if(!finishing) return {error:'Select the finishing'};
  let bedrooms=null;
  if(isRes){ const b=numOrNull('bedrooms'); if(b===null||!Number.isInteger(b)||b<0) return {error:'Enter the number of bedrooms (a whole number, 0 or more)'}; bedrooms=b; }
  const baths=numOrNull('bathrooms'); if(baths===null||!Number.isInteger(baths)||baths<1) return {error:'Enter the number of bathrooms (a whole number, at least 1)'};
  const delRaw=text('delivery'); if(delRaw==='') return {error:'Select the delivery'};
  const delivery=Number(delRaw);
  const total=numOrNull('total'); if(total===null||!(total>0)) return {error:'Enter a valid total price (greater than 0)'};
  const dp=numOrNull('dp'); if(dp===null||Number.isNaN(dp)||dp<0) return {error:'Enter the down payment (0 or more)'};
  if(dp>total) return {error:'Down payment cannot exceed the total price'};
  const inst=numOrNull('installments'); if(inst===null||!Number.isInteger(inst)||inst<0) return {error:'Enter the remaining installments (a whole number, 0 or more)'};
  const fees=numOrNull('fees'); if(Number.isNaN(fees)||(fees!==null&&fees<0)) return {error:'Extra fees must be a number, 0 or more'};
  return {body:{ team, compound, developer, city, area, unitType, saleRent, areaSize:size, finishing, bedrooms, bathrooms:baths,
    deliveryYears:delivery, totalPrice:total, downPayment:dp, remainingAmount:Math.max(total-dp,0), remainingInstallments:inst,
    extraFees: fees===null?0:fees, furnished: g('furnished').checked }};
}
/* ---------- Photo picker (Module F) ----------
   Real image upload for the Add / Edit Unit forms. Each chosen picture is re-encoded in the browser
   (smaller, metadata removed) and uploaded to the server right away as a private "staged" photo; the
   unit form's Save then sends the ordered list of photo ids and the SERVER attaches them in the same
   step that saves the unit. Photos can be reordered (◀ ▶) and removed before saving; nothing about
   them is stored in the browser — only on the server. */
const PHOTO_MIN = 3, PHOTO_MAX = 12;
function photoPickerHTML(prefix, legacyCount){
  return `<div class="field"><label class="field-label">Photos — at least ${PHOTO_MIN}, up to ${PHOTO_MAX}</label>
    <div class="pp-bar">
      <button class="btn btn-sm" id="${prefix}PhotoAddBtn" type="button">${ic('plus')} Add photos</button>
      <input type="file" id="${prefix}PhotoInput" accept="${PHOTO_ACCEPT}" multiple style="display:none;">
      <span id="${prefix}PhotoStatus" class="pp-status"></span>
    </div>
    <div class="pp-grid" id="${prefix}PhotoGrid"></div>
    <div class="pp-hint">JPEG, PNG or WebP. The first photo is the cover. Pictures are resized automatically and kept privately on the company server.</div>
    ${legacyCount ? `<div class="pp-legacy" id="${prefix}PhotoLegacy">This unit was created before real uploads and only has a photo <em>count</em> (${legacyCount}); there are no pictures on file yet. Upload real photos to replace it — or leave this empty to save other changes.</div>` : ''}
  </div>`;
}
// initialIds = photo ids already saved on the unit (edit); returns a controller.
function wirePhotoPicker(prefix, initialIds, onChange){
  const items = (initialIds||[]).map(id=>({key:'e'+id, id, state:'done', thumb:true, saved:true}));
  let seq = 0, destroyed = false;
  const grid = document.getElementById(prefix+'PhotoGrid'), status = document.getElementById(prefix+'PhotoStatus');
  const input = document.getElementById(prefix+'PhotoInput');
  function draw(){
    if(destroyed || !grid) return;
    grid.innerHTML = items.map((it,i)=>`<div class="pp-tile ${it.state==='error'?'pp-err':''}" data-pp="${it.key}">
      ${it.preview ? `<img src="${it.preview}" alt="Photo ${i+1}">` : (it.id ? `<img data-photo-id="${it.id}" data-photo-size="thumb" data-photo-eager alt="Photo ${i+1}">` : '')}
      <span class="pp-num">${i===0?'Cover':(i+1)}</span>
      ${it.state==='uploading' ? '<div class="pp-over">Uploading…</div>' : ''}
      ${it.state==='error' ? `<div class="pp-over pp-over-err">${esc(it.error||'Failed')}</div>` : ''}
      <button type="button" class="pp-x" data-ppdel="${it.key}" aria-label="Remove photo ${i+1}">×</button>
      <div class="pp-move">
        <button type="button" data-ppleft="${it.key}" ${i===0?'disabled':''} aria-label="Move earlier">◀</button>
        <button type="button" data-ppright="${it.key}" ${i===items.length-1?'disabled':''} aria-label="Move later">▶</button>
      </div></div>`).join('');
    const ok = items.filter(x=>x.state==='done').length, busy = items.filter(x=>x.state==='uploading').length;
    status.textContent = items.length ? `${ok} photo${ok===1?'':'s'} ready${busy?` · ${busy} uploading…`:''}` : 'No photos yet';
    grid.querySelectorAll('[data-ppdel]').forEach(b=> b.addEventListener('click', ()=> remove(b.dataset.ppdel)));
    grid.querySelectorAll('[data-ppleft]').forEach(b=> b.addEventListener('click', ()=> move(b.dataset.ppleft, -1)));
    grid.querySelectorAll('[data-ppright]').forEach(b=> b.addEventListener('click', ()=> move(b.dataset.ppright, 1)));
    if(typeof hydratePhotoImages==='function') hydratePhotoImages(grid);
  }
  function move(key, d){ const i = items.findIndex(x=>x.key===key), j = i+d; if(i<0||j<0||j>=items.length) return; const t = items[i]; items[i] = items[j]; items[j] = t; draw(); onChange&&onChange(); }
  function remove(key){
    const i = items.findIndex(x=>x.key===key); if(i<0) return;
    const [it] = items.splice(i,1);
    if(it.preview) try{ URL.revokeObjectURL(it.preview); }catch(e){}
    // A photo uploaded in this form and never saved is discarded on the server right away (best effort).
    if(it.id && !it.saved) NA1_API.del('/unit-photos/'+encodeURIComponent(it.id)).catch(()=>{});
    draw(); onChange&&onChange();
  }
  async function addFiles(files){
    const list = Array.from(files||[]);
    const room = PHOTO_MAX - items.length;
    if(list.length > room){ toast(room>0 ? `Only ${room} more photo${room===1?'':'s'} fit (maximum ${PHOTO_MAX}) — extra pictures were skipped` : `Maximum ${PHOTO_MAX} photos per unit`); }
    const take = list.slice(0, Math.max(room,0));
    const fresh = take.map(f=>({key:'n'+(++seq), file:f, state:'uploading'}));
    fresh.forEach(it=>{ const why = checkPhotoFile(it.file); if(why){ it.state='error'; it.error=why; } });
    items.push(...fresh); draw(); onChange&&onChange();
    let next = 0;
    const worker = async ()=>{
      while(next < fresh.length){
        const it = fresh[next++]; if(it.state!=='uploading') continue;
        try {
          const r = await uploadUnitPhoto(it.file);
          if(!items.includes(it)){ NA1_API.del('/unit-photos/'+encodeURIComponent(r.id)).catch(()=>{}); try{ URL.revokeObjectURL(r.previewUrl); }catch(e){} continue; }   // removed while uploading
          it.id = r.id; it.preview = r.previewUrl; it.state = 'done'; delete it.file;
        } catch(e){
          it.state = 'error'; it.error = (e && e.message) ? e.message : 'Upload failed';
          if(e && e.isNetworkError) it.error = 'No connection';
        }
        draw(); onChange&&onChange();
      }
    };
    await Promise.all([worker(), worker()]);
  }
  document.getElementById(prefix+'PhotoAddBtn').addEventListener('click', ()=> input.click());
  input.addEventListener('change', ()=>{ const f = Array.from(input.files||[]); input.value=''; if(f.length) addFiles(f); });
  draw();
  return {
    ids: ()=> items.filter(x=>x.state==='done').map(x=>x.id),
    busy: ()=> items.some(x=>x.state==='uploading'),
    failed: ()=> items.filter(x=>x.state==='error').length,
    total: ()=> items.length,
    addFiles,
    destroy(){ destroyed = true; items.forEach(it=>{ if(it.preview) try{ URL.revokeObjectURL(it.preview); }catch(e){} }); },
  };
}
// Checks the picker before saving. Returns an error string or null.
function photoPickerProblem(pk, {legacyOk}){
  if(pk.busy()) return 'Please wait — photos are still uploading';
  if(pk.failed()) return 'Remove the photos that failed to upload (or add them again) before saving';
  const n = pk.ids().length;
  if(n===0 && legacyOk) return null;
  if(n < PHOTO_MIN) return `Add at least ${PHOTO_MIN} photos before saving (you have ${n})`;
  return null;
}

function openAddUnitModal(u){
  const tk = myTeamKey(u);
  const isRes = tk==='residential';
  openModal(`
    <div class="modal-head"><div style="font-weight:800;">Add new unit</div><button class="close-x" id="modalCloseX">${ic('x')}</button></div>
    <div class="modal-body">
      ${unitFormFields('nu', isRes, null)}
      ${photoPickerHTML('nu', 0)}
    </div>
    <div class="modal-foot">
      <button class="btn" id="cancelAddUnitBtn">Cancel</button>
      <button class="btn btn-primary" id="saveUnitBtn">Submit unit</button>
    </div>`, {noBackdropClose:true});
  const guard = wireUnsavedChangesGuard(UNIT_FORM_IDS('nu',isRes), ['modalCloseX','cancelAddUnitBtn']);
  const pk = wirePhotoPicker('nu', [], ()=> guard.markDirty());
  document.getElementById('saveUnitBtn').addEventListener('click', async ()=>{
    const r = readUnitForm('nu', isRes, tk);
    if(r.error){ toast(r.error); return; }
    const pp = photoPickerProblem(pk, {legacyOk:false}); if(pp){ toast(pp); return; }
    const body = Object.assign(r.body, { photoIds: pk.ids() });
    const btn = document.getElementById('saveUnitBtn'); btn.disabled = true;
    try {
      await NA1_API.post('/units', body);
    } catch(e){ btn.disabled = false; reportUnitWriteError(e, 'save this unit'); return; }
    await hydrateOwnersAndUnitsFromServer(u);
    guard.markClean(); pk.destroy();
    closeModal(); toast('Unit added — visible now, pending admin review'); renderPageInto(u);
  });
}

/* ---------- PART 2: Edit Unit (from My Units) ----------
   Same fields/validation as Add, pre-filled with the unit's saved values. Saving updates the SAME
   unit record (PATCH) and never touches ownerSalespersonId/team/pending/interaction history or any
   owner relationship. Ownership is enforced by the backend (403 for anyone else); the check below
   is only a courtesy. */
function openEditUnitModal(unitId, u){
  const un = DB.units.find(x=>x.id===unitId);
  if(!un || un.deletedAt){ toast('This unit is no longer available.'); return; }
  if(un.ownerSalespersonId!==u.id){ toast('You can only edit units that belong to you'); return; }
  const isRes = un.team==='residential';
  const legacyOnly = !(un.photoIds && un.photoIds.length);
  openModal(`
    <div class="modal-head"><div style="font-weight:800;">Edit unit — ${esc(un.compound)}</div><button class="close-x" id="modalCloseX">${ic('x')}</button></div>
    <div class="modal-body">
      ${unitFormFields('eu', isRes, un)}
      ${photoPickerHTML('eu', legacyOnly ? un.photos : 0)}
    </div>
    <div class="modal-foot">
      <button class="btn" id="cancelEditUnitBtn">Cancel</button>
      <button class="btn btn-primary" id="saveEditUnitBtn">Save changes</button>
    </div>`, {noBackdropClose:true});
  const guard = wireUnsavedChangesGuard(UNIT_FORM_IDS('eu',isRes), ['modalCloseX','cancelEditUnitBtn']);
  const pk = wirePhotoPicker('eu', un.photoIds||[], ()=> guard.markDirty());
  document.getElementById('saveEditUnitBtn').addEventListener('click', async ()=>{
    const r = readUnitForm('eu', isRes, un.team);
    if(r.error){ toast(r.error); return; }
    const pp = photoPickerProblem(pk, {legacyOk: legacyOnly}); if(pp){ toast(pp); return; }
    const body = r.body;
    // Legacy count-only unit with nothing uploaded: leave its photos alone (other edits still save).
    if(pk.ids().length) body.photoIds = pk.ids();
    const btn = document.getElementById('saveEditUnitBtn'); btn.disabled = true;
    try {
      await NA1_API.patch('/units/'+encodeURIComponent(un.id), body);
    } catch(e){ btn.disabled = false; reportUnitWriteError(e, 'save changes to this unit'); return; }
    await hydrateOwnersAndUnitsFromServer(u);
    guard.markClean(); pk.destroy();
    closeModal(); toast('Unit updated'); renderPageInto(u);
  });
}
