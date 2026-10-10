/* =========================================================
   COMPANY ANNOUNCEMENTS
   Composing and sending an announcement is available to ONE account only — Head of HR
   (isHeadHR(u); see data.js) — via its own nav item. Every other employee never sees that
   compose screen from navigation; they reach this same page only by clicking the real in-app
   notification sendAnnouncement() generates for them (through the existing DB.notifications/
   notify() system — see notifications.js), and what they land on here is a read-only history
   they can open and read in full, any time, not only right when it arrives.
   ========================================================= */
function announcementRow(a, u, isNew){
  const author = DB.users.find(x=>x.id===a.byId);
  const expanded = session._expandedAnnouncement===a.id;
  const recipientCount = DB.users.length - 1; // everyone except the sender
  return `<div class="report-row" data-toggleannouncement="${a.id}" style="cursor:pointer; padding:13px 16px; border-bottom:1px solid var(--border);">
    <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
      <div style="width:32px;height:32px;border-radius:50%; background:var(--brand-tint); color:var(--brand-dark); display:flex;align-items:center;justify-content:center; flex-shrink:0;">${ic('announce')}</div>
      <div style="flex:1; min-width:160px;">
        <div style="font-size:13.5px; font-weight:800;">${esc(a.title)}${isNew?' <span class="badge badge-fresh">New</span>':''}</div>
        <div style="font-size:11.5px; color:var(--text-faint);">${fmtDateTime(a.at)} · ${esc(author?author.name:'—')}${isHeadHR(u)?' · Sent to '+recipientCount+' employee'+(recipientCount===1?'':'s'):''}</div>
      </div>
      ${ic('chevDown')}
    </div>
    ${expanded ? `<div style="margin-top:10px; padding-top:10px; border-top:1px solid var(--border); font-size:13px; white-space:pre-wrap; line-height:1.5;">${esc(a.message)}</div>` : ''}
  </div>`;
}

function renderAnnouncementsPage(u){
  const hr = isHeadHR(u);
  const history = announcementsHistory();
  const myUnreadAnnouncementIds = new Set(DB.notifications.filter(n=>n.userId===u.id && n.type==='announcement' && !n.read).map(n=>n.meta && n.meta.announcementId));

  const composeCard = hr ? `<div class="card card-pad" style="margin-bottom:18px;">
    <div class="section-title">New announcement</div>
    <div class="section-sub">Sent to every employee as an in-app notification — official holidays, policy changes, important updates.</div>
    <div class="field"><label class="field-label">Title</label><input id="an_title" placeholder="e.g. Public Holiday — Thursday, Oct 15"></div>
    <div class="field"><label class="field-label">Message</label><textarea id="an_message" rows="5" placeholder="Write the full announcement here…"></textarea></div>
    <button class="btn btn-primary" id="sendAnnouncementBtn">${ic('announce')} Send to all employees</button>
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
  // If we arrived here via a notification click, auto-expand the matching announcement once,
  // then clear the flag so it doesn't keep forcing itself open on every later visit.
  if(session._openAnnouncementId){
    session._expandedAnnouncement = session._openAnnouncementId;
    session._openAnnouncementId = null;
  }
  document.querySelectorAll('[data-toggleannouncement]').forEach(el=> el.addEventListener('click', ()=>{
    const id = el.dataset.toggleannouncement;
    session._expandedAnnouncement = session._expandedAnnouncement===id ? null : id;
    renderPageInto(u);
  }));
  const sendBtn = document.getElementById('sendAnnouncementBtn');
  if(sendBtn) sendBtn.addEventListener('click', ()=>{
    if(!isHeadHR(u)) return; // defense in depth — this button only ever renders for Head of HR
    const title = document.getElementById('an_title').value.trim();
    const message = document.getElementById('an_message').value.trim();
    if(!title){ toast('Announcement title is required'); return; }
    if(!message){ toast('Announcement message is required'); return; }
    const recipientCount = DB.users.length - 1;
    const ok = confirm(`Send this announcement to all ${recipientCount} employees?\n\n"${title}"\n\nEvery employee will get an in-app notification immediately.`);
    if(!ok) return;
    sendAnnouncement(u, title, message);
    toast('Announcement sent to '+recipientCount+' employee'+(recipientCount===1?'':'s'));
    renderPageInto(u);
  });
};
