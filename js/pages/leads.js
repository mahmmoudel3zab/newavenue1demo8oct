/* =========================================================
   LEADS PAGE
   ========================================================= */
const STATUS_COLORS = {
  Fresh:'badge-fresh', Unreachable:'badge-muted', Showing:'badge-teal', Following:'badge-brand',
  Seller:'badge-brand', Referral:'badge-teal', Postponed:'badge-muted', 'Done Deal':'badge-success', Meeting:'badge-teal'
};
function renderLeadsPage(u){
  const all = visibleLeads(u).slice().sort((a,b)=> (b.fresh-a.fresh) || (b.createdAt-a.createdAt));
  const filter = session.requestsFilter==='all'?null:null; // unused placeholder
  const activeStatus = session._leadStatusFilter || 'All';
  const statuses = ['All','Fresh',...LEAD_STATUSES.filter(s=>s!=='Fresh')];
  const list = activeStatus==='All' ? all : all.filter(l=>l.status===activeStatus);
  return `
  <div style="display:flex; align-items:center; gap:8px; margin-bottom:14px; overflow-x:auto; padding-bottom:4px;">
    ${statuses.map(s=>`<button class="chip-select ${activeStatus===s?'on':''}" data-status="${s}">${s}${s==='Fresh'?' ('+all.filter(l=>l.fresh).length+')':''}</button>`).join('')}
  </div>
  <div class="card">
    ${list.length? list.map(l=>leadRow(l,u)).join('') : `<div class="empty-state">${ic('leads')}<div>No leads in this filter.</div></div>`}
  </div>`;
}
function leadRow(l,u){
  const sp = DB.users.find(x=>x.id===l.salespersonId);
  const unit = l.interestedUnitId ? DB.units.find(x=>x.id===l.interestedUnitId) : null;
  const hasReminder = l.reminders.some(r=>!r.done);
  return `<div class="lead-row" data-lead="${l.id}" style="display:flex; align-items:center; gap:12px; padding:14px 16px; border-bottom:1px solid var(--border); cursor:pointer;">
    <span class="avatar" style="background:${avatarColor(l.name)}; width:36px;height:36px;">${initials(l.name)}</span>
    <div style="flex:1; min-width:0;">
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="font-weight:700; font-size:13.5px;">${esc(l.name)}</span>
        ${l.fresh?'<span class="badge badge-fresh">Fresh</span>':`<span class="badge ${STATUS_COLORS[l.status]||'badge-muted'}">${l.status}</span>`}
        ${hasReminder?`<span title="Has reminder" style="color:var(--warning);">${ic('clock')}</span>`:''}
      </div>
      <div style="font-size:11.5px; color:var(--text-faint); margin-top:2px;">${esc(l.phone)} · ${esc(l.source)}${unit?' · '+esc(unit.compound):''}${sp && sp.id!==u.id?' · '+esc(sp.name):''}</div>
    </div>
    <div style="font-size:11px; color:var(--text-faint); flex-shrink:0;">${fmtDate(l.createdAt)}</div>
    ${ic('chevron')}
  </div>`;
}
AFTER_RENDER.leads = function(u){
  document.querySelectorAll('[data-status]').forEach(b=> b.addEventListener('click', ()=>{ session._leadStatusFilter = b.dataset.status; renderPageInto(u); }));
  document.querySelectorAll('.lead-row').forEach(el=> el.addEventListener('click', ()=> openLeadModal(el.dataset.lead, u)));
};

function openLeadModal(leadId, u){
  const l = DB.leads.find(x=>x.id===leadId);
  const sp = DB.users.find(x=>x.id===l.salespersonId);
  const unit = l.interestedUnitId ? DB.units.find(x=>x.id===l.interestedUnitId) : null;
  const canAct = u.id===l.salespersonId || isMgmt(u) || isAdmin(u);
  const tab = session._leadTab || 'details';
  const tabs = [['details','Details'],['history','History'],['notes','Notes'],['reminders','Reminders']];
  let body = '';
  if(tab==='details'){
    body = `
      <div class="field"><label class="field-label">Phone</label><div>${esc(l.phone)}</div></div>
      <div class="field"><label class="field-label">Source</label><div>${esc(l.source)}</div></div>
      <div class="field"><label class="field-label">Interested unit</label><div>${unit?esc(unit.compound+' · '+unit.unitType+' · '+fmtMoney(unit.totalPrice)):'—'}</div></div>
      <div class="field"><label class="field-label">Assigned salesperson</label><div>${esc(sp?sp.name:'—')}</div></div>
      <div class="field"><label class="field-label">Status</label>
        <select id="leadStatusSel" ${canAct?'':'disabled'}>${LEAD_STATUSES.map(s=>`<option value="${s}" ${s===l.status?'selected':''}>${s}</option>`).join('')}</select>
      </div>
      ${canAct?`<button class="btn btn-primary btn-sm" id="applyStatusBtn">Update status</button>`:''}`;
  } else if(tab==='history'){
    body = l.history.slice().reverse().map(h=>{
      const by = DB.users.find(x=>x.id===h.by);
      return `<div style="padding:9px 0; border-bottom:1px solid var(--border);">
        <div style="font-size:12.5px;"><b>${h.from?esc(h.from):'Created'}</b> ${h.from?'→ <b>'+esc(h.to)+'</b>':'as <b>'+esc(h.to)+'</b>'}</div>
        <div style="font-size:11px; color:var(--text-faint);">${esc(by?by.name:'—')} · ${fmtDateTime(h.at)}</div>
      </div>`;
    }).join('') || emptyRow('No history yet');
  } else if(tab==='notes'){
    body = `
      <div style="margin-bottom:12px;">${l.notes.length? l.notes.slice().reverse().map(n=>{
        const by = DB.users.find(x=>x.id===n.by);
        return `<div style="padding:9px 0; border-bottom:1px solid var(--border);"><div style="font-size:12.5px;">${esc(n.text)}</div><div style="font-size:11px; color:var(--text-faint);">${esc(by?by.name:'—')} · ${fmtDateTime(n.at)}</div></div>`;
      }).join('') : emptyRow('No notes yet — notes are optional.')}</div>
      ${canAct?`<textarea id="newNoteText" placeholder="Add an optional note…" rows="2"></textarea><button class="btn btn-sm btn-primary" id="addNoteBtn" style="margin-top:8px;">Add note</button>`:''}`;
  } else if(tab==='reminders'){
    body = `
      <div style="margin-bottom:12px;">${l.reminders.length? l.reminders.map(r=>`<div style="display:flex; align-items:center; gap:8px; padding:8px 0; border-bottom:1px solid var(--border);">
        <input type="checkbox" data-rem="${r.id}" ${r.done?'checked':''} ${canAct?'':'disabled'}>
        <div style="flex:1;"><div style="font-size:12.5px; text-decoration:${r.done?'line-through':'none'}; color:${r.done?'var(--text-faint)':'var(--text)'};">${esc(r.text)}</div><div style="font-size:11px; color:var(--text-faint);">Due ${fmtDate(r.date)}</div></div>
      </div>`).join('') : emptyRow('No reminders set.')}</div>
      ${canAct?`<input id="newRemText" placeholder="Reminder text" style="margin-bottom:8px;"><input id="newRemDate" type="date" style="margin-bottom:8px;"><button class="btn btn-sm btn-primary" id="addRemBtn">Add reminder</button>`:''}`;
  }
  openModal(`
    <div class="modal-head">
      <span class="avatar" style="background:${avatarColor(l.name)}">${initials(l.name)}</span>
      <div><div style="font-weight:800; font-size:15px;">${esc(l.name)}</div><div style="font-size:11.5px; color:var(--text-faint);">${esc(l.phone)}</div></div>
      <button class="close-x" id="modalCloseX">${ic('x')}</button>
    </div>
    <div class="modal-body">
      <div style="display:flex; gap:8px; margin-bottom:16px;">
        <a class="btn btn-teal btn-sm" href="tel:${l.phone}" id="callBtn" style="flex:1; justify-content:center;">${ic('phone')} Call</a>
        <a class="btn btn-sm" style="flex:1; justify-content:center; background:#25D366; border-color:#25D366; color:#fff;" href="https://wa.me/2${l.phone}" target="_blank" id="waBtn">${ic('whatsapp')} WhatsApp</a>
      </div>
      <div class="tabs">${tabs.map(([k,label])=>`<button class="tab-btn ${tab===k?'active':''}" data-tab="${k}">${label}</button>`).join('')}</div>
      ${body}
    </div>`);
  document.getElementById('modalCloseX').addEventListener('click', closeModal);
  document.querySelectorAll('[data-tab]').forEach(b=> b.addEventListener('click', ()=>{ session._leadTab=b.dataset.tab; openLeadModal(leadId,u); }));
  const callBtn = document.getElementById('callBtn'); if(callBtn) callBtn.addEventListener('click', ()=> toast('Dialing '+l.phone+'…'));
  const waBtn = document.getElementById('waBtn'); if(waBtn) waBtn.addEventListener('click', ()=> toast('Opening WhatsApp chat…'));
  const applyBtn = document.getElementById('applyStatusBtn');
  if(applyBtn) applyBtn.addEventListener('click', ()=>{
    const newStatus = document.getElementById('leadStatusSel').value;
    if(newStatus===l.status) return;
    l.history.push({from:l.status, to:newStatus, by:u.id, at:now()});
    l.status = newStatus;
    l.fresh = false; // taking an action on the lead clears the "fresh" state
    log(u.id,'lead_status_change',{leadId:l.id, to:newStatus});
    persist(); toast('Lead status updated to '+newStatus);
    render();
  });
  const addNoteBtn = document.getElementById('addNoteBtn');
  if(addNoteBtn) addNoteBtn.addEventListener('click', ()=>{
    const txt = document.getElementById('newNoteText').value.trim();
    if(!txt) return;
    l.notes.push({text:txt, by:u.id, at:now()});
    persist(); toast('Note added'); openLeadModal(leadId,u); renderPageInto(u);
  });
  const addRemBtn = document.getElementById('addRemBtn');
  if(addRemBtn) addRemBtn.addEventListener('click', ()=>{
    const txt = document.getElementById('newRemText').value.trim();
    const dt = document.getElementById('newRemDate').value;
    if(!txt || !dt) { toast('Add reminder text and date'); return; }
    l.reminders.push({id:uid('rm'), text:txt, date:new Date(dt).getTime(), done:false});
    notify(u.id,'reminder','Reminder set for '+l.name+': '+txt, 'leads');
    persist(); toast('Reminder created'); openLeadModal(leadId,u); renderPageInto(u);
  });
  document.querySelectorAll('[data-rem]').forEach(cb=> cb.addEventListener('change', ()=>{
    const rem = l.reminders.find(r=>r.id===cb.dataset.rem); rem.done = cb.checked; persist();
  }));
}

