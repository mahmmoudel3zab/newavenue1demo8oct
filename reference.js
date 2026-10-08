/* =========================================================
   REFERENCE DICTIONARY
   ========================================================= */
function renderReferencePage(u){
  const tk = myTeamKey(u);
  const list = DB.refs.filter(r=>r.team===tk);
  const canEdit = isAdmin(u);
  return `
  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
    <div class="section-sub" style="margin-bottom:0;">${tk[0].toUpperCase()+tk.slice(1)} team internal contacts</div>
    ${canEdit?`<button class="btn btn-primary btn-sm" id="addRefBtn">${ic('plus')} Add entry</button>`:''}
  </div>
  <div class="card">
    <table><thead><tr><th>Code</th><th>Name</th><th>Phone</th><th>WhatsApp</th><th>Note</th>${canEdit?'<th></th>':''}</tr></thead><tbody>
    ${list.map(r=>`<tr><td style="font-weight:700;">${esc(r.code)}</td><td>${esc(r.name)}</td><td>${esc(r.phone)}</td><td>${esc(r.whatsapp)}</td><td>${esc(r.note)}</td>${canEdit?`<td><button class="btn btn-sm btn-ghost" data-delref="${r.id}">${ic('trash')}</button></td>`:''}</tr>`).join('')}
    </tbody></table>
  </div>`;
}
AFTER_RENDER.reference = function(u){
  document.querySelectorAll('[data-delref]').forEach(b=> b.addEventListener('click', ()=>{
    DB.refs = DB.refs.filter(r=>r.id!==b.dataset.delref); log(u.id,'reference_deleted',{}); persist(); renderPageInto(u); toast('Entry removed');
  }));
  const ab = document.getElementById('addRefBtn'); if(ab) ab.addEventListener('click', ()=>{
    openModal(`<div class="modal-head"><div style="font-weight:800;">Add reference entry</div><button class="close-x" id="modalCloseX">${ic('x')}</button></div>
    <div class="modal-body">
      <div class="field"><label class="field-label">Code</label><input id="rf_code"></div>
      <div class="field"><label class="field-label">Name</label><input id="rf_name"></div>
      <div class="field"><label class="field-label">Phone</label><input id="rf_phone"></div>
      <div class="field"><label class="field-label">WhatsApp</label><input id="rf_wa"></div>
      <div class="field"><label class="field-label">Note</label><input id="rf_note"></div>
    </div><div class="modal-foot"><button class="btn btn-primary" id="saveRefBtn">Save</button></div>`);
    document.getElementById('modalCloseX').addEventListener('click', closeModal);
    document.getElementById('saveRefBtn').addEventListener('click', ()=>{
      DB.refs.push({id:uid('rf'), team:myTeamKey(u), code:document.getElementById('rf_code').value, name:document.getElementById('rf_name').value, phone:document.getElementById('rf_phone').value, whatsapp:document.getElementById('rf_wa').value, note:document.getElementById('rf_note').value});
      log(u.id,'reference_added',{}); persist(); closeModal(); renderPageInto(u); toast('Entry added');
    });
  });
};

