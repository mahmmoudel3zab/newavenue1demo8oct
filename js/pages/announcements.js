/* =========================================================
   COMPANY ANNOUNCEMENTS
   Composing and sending an announcement is available to ONE account only — Head of HR
   (isHeadHR(u); see data.js) — via its own nav item. Every other employee never sees that
   compose screen from navigation; they reach this same page only by clicking the real in-app
   notification sendAnnouncement() generates for them (through the existing DB.notifications/
   notify() system — see notifications.js), and what they land on here is a read-only history
   they can open and read in full, any time, not only right when it arrives — limited to
   announcements THEY were actually sent (see visibleAnnouncementsFor() in data.js).

   PART 2 — Recipient selection (this round): HR chooses exactly who receives each announcement —
   Everyone, one or more Job Titles, a Team, or specific searched-and-selected Employees — before
   publishing. The compose form keeps the chosen audience in session._anAudience (reset each time
   the compose card is freshly opened) and re-renders the relevant picker inline as the audience
   type changes, the same pattern this app already uses for other multi-step forms (see
   session._ownerTransferSearch in admin.js for a precedent). Audience criteria are immutable
   once sent — see sendAnnouncement()/computeAnnouncementRecipients() in data.js for why.
   ========================================================= */
function announcementRow(a, u, isNew){
  const author = DB.users.find(x=>x.id===a.byId);
  const expanded = session._expandedAnnouncement===a.id;
  const hr = isHeadHR(u);
  return `<div class="report-row" data-toggleannouncement="${a.id}" style="cursor:pointer; padding:13px 16px; border-bottom:1px solid var(--border);">
    <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
      <div style="width:32px;height:32px;border-radius:50%; background:var(--brand-tint); color:var(--brand-dark); display:flex;align-items:center;justify-content:center; flex-shrink:0;">${ic('announce')}</div>
      <div style="flex:1; min-width:160px;">
        <div style="font-size:13.5px; font-weight:800;">${esc(a.title)}${isNew?' <span class="badge badge-fresh">New</span>':''}</div>
        <div style="font-size:11.5px; color:var(--text-faint);">${fmtDateTime(a.at)} · ${esc(author?author.name:'—')}${hr?' · '+esc(audienceSummaryLabel(a.audience))+' · '+(a.recipientCount||0)+' recipient'+((a.recipientCount||0)===1?'':'s'):''}</div>
      </div>
      ${ic('chevDown')}
    </div>
    ${expanded ? `<div style="margin-top:10px; padding-top:10px; border-top:1px solid var(--border); font-size:13px; white-space:pre-wrap; line-height:1.5;">${esc(a.message)}</div>` : ''}
  </div>`;
}

// Short label used on each audience-picker option's radio/select row.
const AUDIENCE_TYPE_LABELS = {
  everyone: 'Everyone', job_titles: 'By job title', team: 'By team', employees: 'Specific employees'
};

function initAudienceState(){
  if(!session._anAudience) session._anAudience = {type:'everyone', jobTitles:[], team:'', employeeIds:[]};
  return session._anAudience;
}

// Matching employees for the "Specific employees" picker — refreshed on its own while typing.
function employeeSearchResultsHTML(){
  const aud = initAudienceState();
  const q = (session._anEmployeeSearch||'').trim().toLowerCase();
  const results = q ? DB.users.filter(x=> x.name.toLowerCase().includes(q) && !aud.employeeIds.includes(x.id)).slice(0,8) : [];
  return results.length? `<div class="card" style="margin-top:6px; max-height:180px; overflow-y:auto;">${results.map(x=>`<div data-anaddemp="${x.id}" style="padding:8px 12px; border-bottom:1px solid var(--border); cursor:pointer; font-size:12.5px; display:flex; justify-content:space-between;"><span>${esc(x.name)}</span><span style="color:var(--text-faint);">${esc(displayTitle(x))}</span></div>`).join('')}</div>` : (q?'<div class="section-sub" style="margin-top:6px;">No matching employee.</div>':'');
}
function audiencePickerHtml(){
  const aud = initAudienceState();
  const recipients = computeAnnouncementRecipients(aud, null);
  let picker = '';
  if(aud.type==='job_titles'){
    picker = `<div class="field"><label class="field-label">Select one or more job titles</label>
      <div style="display:flex; flex-wrap:wrap; gap:8px;">
        ${JOB_TITLES.map(t=>`<label style="display:flex; align-items:center; gap:6px; font-size:12.5px; border:1px solid var(--border); border-radius:8px; padding:6px 10px; cursor:pointer;">
          <input type="checkbox" data-anjobtitle value="${esc(t)}" ${aud.jobTitles.includes(t)?'checked':''}> ${esc(t)}
        </label>`).join('')}
      </div></div>`;
  } else if(aud.type==='team'){
    picker = `<div class="field"><label class="field-label">Select a team</label>
      <select id="an_team">
        <option value="" ${!aud.team?'selected':''}>— Choose a team —</option>
        <option value="residential" ${aud.team==='residential'?'selected':''}>Residential</option>
        <option value="commercial" ${aud.team==='commercial'?'selected':''}>Commercial</option>
      </select></div>`;
  } else if(aud.type==='employees'){
    const selected = DB.users.filter(x=>aud.employeeIds.includes(x.id));
    picker = `<div class="field"><label class="field-label">Search and select employees</label>
      <div class="search-field">${ic('search')}<input id="an_empSearch" type="search" placeholder="Search employee by name…" value="${esc(session._anEmployeeSearch||'')}" autocomplete="off" aria-label="Search employees"></div>
      <div id="an_empResults">${employeeSearchResultsHTML()}</div>
      <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:10px;">
        ${selected.length? selected.map(x=>`<span class="badge badge-brand" style="display:inline-flex; align-items:center; gap:5px;">${esc(x.name)} <button type="button" data-anremoveemp="${x.id}" style="border:none; background:none; cursor:pointer; color:inherit; font-weight:800; padding:0;">×</button></span>`).join('') : '<span style="font-size:11.5px; color:var(--text-faint);">No employees selected yet.</span>'}
      </div></div>`;
  }
  return `
    <div class="field"><label class="field-label">Recipients</label>
      <select id="an_audType">
        ${Object.keys(AUDIENCE_TYPE_LABELS).map(k=>`<option value="${k}" ${aud.type===k?'selected':''}>${AUDIENCE_TYPE_LABELS[k]}</option>`).join('')}
      </select>
    </div>
    ${picker}
    <div class="section-sub" id="an_recipientPreview" style="margin-bottom:10px;">${aud.type==='everyone' ? recipients.length+' employee'+(recipients.length===1?'':'s')+' will receive this announcement.' : recipients.length+' matching recipient'+(recipients.length===1?'':'s')+' right now.'}</div>`;
}

function renderAnnouncementsPage(u){
  // Arriving from a notification click: expand that announcement in THIS render (consumed once).
  if(session._openAnnouncementId){ session._expandedAnnouncement = session._openAnnouncementId; session._openAnnouncementId = null; }
  const hr = isHeadHR(u);
  const history = visibleAnnouncementsFor(u);
  const myUnreadAnnouncementIds = new Set(DB.notifications.filter(n=>n.userId===u.id && n.type==='announcement' && !n.read).map(n=>n.meta && n.meta.announcementId));

  const composeCard = hr ? `<div class="card card-pad" style="margin-bottom:18px;">
    <div class="section-title">New announcement</div>
    <div class="section-sub">Choose exactly who should receive it — every employee, by job title, by team, or specific people — then publish as an in-app notification.</div>
    <div class="field"><label class="field-label" for="an_title">Title</label><input id="an_title" placeholder="e.g. Public Holiday — Thursday, Oct 15" value="${esc(session._anDraftTitle||'')}"></div>
    <div class="field"><label class="field-label" for="an_message">Message</label><textarea id="an_message" rows="5" placeholder="Write the full announcement here…">${esc(session._anDraftMessage||'')}</textarea></div>
    <div class="divider"></div>
    <div id="an_audienceBox">${audiencePickerHtml()}</div>
    <button class="btn btn-primary" id="sendAnnouncementBtn">${ic('announce')} Publish announcement</button>
  </div>` : '';

  const historyCard = `
  <div class="section-title" style="margin-top:${hr?'4':'0'}px;">${hr?'Sent announcements':'Company Announcements'}</div>
  <div class="section-sub">${hr? history.length+' announcement'+(history.length===1?'':'s')+' sent so far' : 'Click an announcement to read the full message'}</div>
  <div class="card">
    ${history.length ? history.map(a=>announcementRow(a,u,myUnreadAnnouncementIds.has(a.id))).join('') : `<div class="empty-state">${ic('announce')}<div>No announcements ${hr?'sent':'yet'}.</div></div>`}
  </div>`;

  return `${composeCard}${historyCard}`;
}

AFTER_RENDER.announcements = function(u){
  // Opening the page re-fetches (at most every 5 s) so announcements that arrived since sign-in appear.
  if(!session._anLastFetch || Date.now()-session._anLastFetch > 5000){
    session._anLastFetch = Date.now();
    const sigOf = ()=> DB.announcements.map(a=>a.id).join(',');
    const before = sigOf();
    hydrateAnnouncementsFromServer(u).then(ok=>{ if(ok && sigOf()!==before && session.page==='announcements') renderPageInto(u); });
  }
  document.querySelectorAll('[data-toggleannouncement]').forEach(el=> el.addEventListener('click', ()=>{
    const id = el.dataset.toggleannouncement;
    session._expandedAnnouncement = session._expandedAnnouncement===id ? null : id;
    renderPageInto(u);
  }));
  if(!isHeadHR(u)) return; // nothing else on this page belongs to a non-HR viewer

  // The draft is kept in the session as it is typed, so nothing on this page can erase it (the
  // background refresh, opening an announcement, changing the audience…).
  const tEl = document.getElementById('an_title'), mEl = document.getElementById('an_message');
  if(tEl) tEl.addEventListener('input', ()=>{ session._anDraftTitle = tEl.value; });
  if(mEl) mEl.addEventListener('input', ()=>{ session._anDraftMessage = mEl.value; });
  bindAudiencePicker(u);

  const sendBtn = document.getElementById('sendAnnouncementBtn');
  if(sendBtn) sendBtn.addEventListener('click', async ()=>{
    if(!isHeadHR(u)) return; // convenience only — the server enforces that only Head of HR can publish
    const title = document.getElementById('an_title').value.trim();
    const message = document.getElementById('an_message').value.trim();
    if(!title){ toast('Announcement title is required'); return; }
    if(!message){ toast('Announcement message is required'); return; }

    const chosen = session._anAudience || {type:'everyone'};
    if(chosen.type==='job_titles' && !chosen.jobTitles.length){ toast('Select at least one job title'); return; }
    if(chosen.type==='team' && !chosen.team){ toast('Select a team'); return; }
    if(chosen.type==='employees' && !chosen.employeeIds.length){ toast('Select at least one employee'); return; }

    const recipients = computeAnnouncementRecipients(chosen, u.id); // preview only; the server resolves the real list
    if(!recipients.length){ toast('The selected audience has no eligible recipients'); return; }

    const ok = confirm(`Publish this announcement?\n\n"${title}"\n\nAudience: ${audienceSummaryLabel(chosen)}\nRecipients: ${recipients.length} employee${recipients.length===1?'':'s'}\n\nEach recipient will get an in-app notification immediately. This cannot be changed after publishing — to reach a different audience, send a new announcement.`);
    if(!ok) return;

    sendBtn.disabled = true;
    let res;
    try{
      res = await publishAnnouncementOnServer(title, message, chosen);
    }catch(e){
      sendBtn.disabled = false;
      // Nothing was saved anywhere: the form keeps its text so the same publish can be retried safely.
      toast(e && e.isNetworkError ? 'Could not reach the server — the announcement was NOT sent.' : ((e && e.message) || 'Could not send the announcement'));
      return;
    }
    session._anAudience = null; // reset the compose form's audience picker for next time
    session._anEmployeeSearch = '';
    session._anDraftTitle = ''; session._anDraftMessage = '';
    toast('Announcement sent to '+res.recipientCount+' employee'+(res.recipientCount===1?'':'s'));
    renderPageInto(u);
  });
};

// Audience picker events. Every change re-draws ONLY the audience box (#an_audienceBox), never the
// whole page, so the title and message being written above are left exactly as they are; typing
// in the employee search re-draws only its result list (#an_empResults), so the box keeps focus.
function refreshAudiencePicker(u, focusEmpSearch){
  const box = document.getElementById('an_audienceBox'); if(!box) return;
  box.innerHTML = audiencePickerHtml();
  bindAudiencePicker(u);
  if(focusEmpSearch){ const es = document.getElementById('an_empSearch'); if(es) es.focus(); }
}
function bindEmployeeResults(u){
  const aud = initAudienceState();
  document.querySelectorAll('[data-anaddemp]').forEach(el=> el.addEventListener('click', ()=>{
    if(!aud.employeeIds.includes(el.dataset.anaddemp)) aud.employeeIds.push(el.dataset.anaddemp);
    session._anEmployeeSearch = '';
    refreshAudiencePicker(u, true);
  }));
}
function bindAudiencePicker(u){
  const aud = initAudienceState();
  const typeSel = document.getElementById('an_audType');
  if(typeSel) typeSel.addEventListener('change', ()=>{
    session._anAudience = {type:typeSel.value, jobTitles:[], team:'', employeeIds: aud.type==='employees'?aud.employeeIds:[]};
    refreshAudiencePicker(u);
  });
  document.querySelectorAll('[data-anjobtitle]').forEach(cb=> cb.addEventListener('change', ()=>{
    const t = cb.value;
    if(cb.checked){ if(!aud.jobTitles.includes(t)) aud.jobTitles.push(t); }
    else { aud.jobTitles = aud.jobTitles.filter(x=>x!==t); }
    refreshAudiencePicker(u);
  }));
  const teamSel = document.getElementById('an_team');
  if(teamSel) teamSel.addEventListener('change', ()=>{ aud.team = teamSel.value; refreshAudiencePicker(u); });
  const empSearch = document.getElementById('an_empSearch');
  if(empSearch) empSearch.addEventListener('input', ()=>{
    session._anEmployeeSearch = empSearch.value;
    const r = document.getElementById('an_empResults');
    if(r){ r.innerHTML = employeeSearchResultsHTML(); bindEmployeeResults(u); }
  });
  bindEmployeeResults(u);
  document.querySelectorAll('[data-anremoveemp]').forEach(el=> el.addEventListener('click', ()=>{
    aud.employeeIds = aud.employeeIds.filter(id=>id!==el.dataset.anremoveemp);
    refreshAudiencePicker(u);
  }));
}
