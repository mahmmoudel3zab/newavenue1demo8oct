/* =========================================================
   REFERENCE — salesperson contact directory
   This is NOT a general project/compound reference sheet. It's a real internal directory of
   every sales-active person (salespeople AND every management role — role never removes
   personal sales activity), searchable by name or reference code, with one-tap Call and
   WhatsApp actions. Phone and WhatsApp are separate fields and may differ.
   ========================================================= */
function telHref(localPhone){ return 'tel:+20'+String(localPhone).replace(/^0/,''); }
function waHref(localPhone){ return 'https://wa.me/20'+String(localPhone).replace(/^0/,''); }

function renderReferencePage(u){
  const tk = myTeamKey(u);
  const q = (session._refSearch||'').trim().toLowerCase();
  let list = DB.refs.filter(r=>r.team===tk);
  if(q){ list = list.filter(r=> r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q)); }
  list = list.slice().sort((a,b)=>a.name.localeCompare(b.name));
  return `
  <div class="section-sub" style="margin-bottom:10px;">${tk[0].toUpperCase()+tk.slice(1)} team — search any salesperson or manager to call or message them directly</div>
  <div class="search-field" style="max-width:420px; margin-bottom:16px;">
    ${ic('search')}<input id="refSearch" placeholder="Search by name or reference code…" value="${esc(session._refSearch||'')}">
  </div>
  <div class="card">
    ${list.length? list.map(r=>referenceRow(r,u)).join('') : emptyRow(q?'No one matches that search.':'No directory entries yet.')}
  </div>`;
}

function referenceRow(r,u){
  const self = DB.users.find(x=>x.id===r.userId);
  const canEdit = self && (self.id===u.id || u.role==='senioradmin' || u.role==='headadmin');
  return `<div class="card-pad" style="display:flex; align-items:center; gap:14px; flex-wrap:wrap; border-bottom:1px solid var(--border);">
    <span class="avatar" style="background:${avatarColor(r.name)}; width:38px;height:38px; flex-shrink:0;">${initials(r.name)}</span>
    <div style="flex:1; min-width:180px;">
      <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
        <span style="font-weight:700; font-size:13.5px;">${esc(r.name)}</span>
        <span class="badge badge-brand">${esc(r.code)}</span>
      </div>
      <div style="font-size:11.5px; color:var(--text-faint); margin-top:2px;">${esc(ROLE_LABELS[r.role]||r.role)}${r.managerName?' · reports to '+esc(r.managerName):''}</div>
    </div>
    <div class="contact-actions">
      <a class="btn btn-sm btn-call" href="${telHref(r.phone)}" data-refphone="${r.id}">${ic('phone')} ${esc(r.phone)}</a>
      <a class="btn btn-sm btn-wa" href="${waHref(r.whatsapp)}" target="_blank" rel="noopener" data-refwa="${r.id}">${ic('whatsapp')} WhatsApp</a>
      ${canEdit?`<button class="btn btn-sm btn-ghost" data-editref="${r.id}">${ic('edit')}</button>`:''}
    </div>
  </div>`;
}

AFTER_RENDER.reference = function(u){
  const s = document.getElementById('refSearch');
  if(s){
    s.addEventListener('input', ()=>{ session._refSearch = s.value; renderPageInto(u); });
    // Re-rendering replaces the whole page DOM on every keystroke, which would otherwise drop
    // focus out of the search box mid-type — restore focus + caret position right after.
    if(session._refSearchFocused){ s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
    s.addEventListener('focus', ()=>{ session._refSearchFocused = true; });
    s.addEventListener('blur', ()=>{ session._refSearchFocused = false; });
  }
  document.querySelectorAll('[data-refphone]').forEach(a=> a.addEventListener('click', ()=> toast('Opening phone dialer…')));
  document.querySelectorAll('[data-refwa]').forEach(a=> a.addEventListener('click', ()=> toast('Opening WhatsApp…')));
  document.querySelectorAll('[data-editref]').forEach(b=> b.addEventListener('click', ()=> openEditRefModal(b.dataset.editref, u)));
};

function openEditRefModal(refId, u){
  const r = DB.refs.find(x=>x.id===refId);
  if(!r) return;
  openModal(`<div class="modal-head"><div style="font-weight:800;">Edit contact — ${esc(r.name)}</div><button class="close-x" id="modalCloseX">${ic('x')}</button></div>
  <div class="modal-body">
    <div class="field"><label class="field-label">Phone (for calls)</label><input id="rf_phone" inputmode="numeric" value="${esc(r.phone)}"></div>
    <div class="field"><label class="field-label">WhatsApp number</label><input id="rf_wa" inputmode="numeric" value="${esc(r.whatsapp)}"></div>
    <div class="section-sub" style="margin-top:4px; margin-bottom:0;">These may be different numbers — e.g. a work line for calls and a personal number for WhatsApp.</div>
  </div><div class="modal-foot"><button class="btn btn-primary" id="saveRefBtn">Save</button></div>`);
  document.getElementById('modalCloseX').addEventListener('click', closeModal);
  ['rf_phone','rf_wa'].forEach(id=> document.getElementById(id).addEventListener('input', (e)=>{ e.target.value = e.target.value.replace(/[^0-9]/g,''); }));
  document.getElementById('saveRefBtn').addEventListener('click', ()=>{
    const phone = document.getElementById('rf_phone').value.trim();
    const wa = document.getElementById('rf_wa').value.trim();
    if(!isDigitsOnly(phone) || !normalizeEgyptPhone(phone)){ toast('Enter a valid phone number (digits only)'); return; }
    if(!isDigitsOnly(wa) || !normalizeEgyptPhone(wa)){ toast('Enter a valid WhatsApp number (digits only)'); return; }
    r.phone = phoneLocalDisplay(normalizeEgyptPhone(phone));
    r.whatsapp = phoneLocalDisplay(normalizeEgyptPhone(wa));
    log(u.id,'reference_contact_edited',{refId:r.id});
    persist(); closeModal(); toast('Contact details updated'); renderPageInto(u);
  });
}
