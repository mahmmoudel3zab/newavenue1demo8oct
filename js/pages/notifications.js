/* =========================================================
   NOTIFICATIONS
   ========================================================= */
const NOTIF_ICON = {fresh_lead:'leads', unread_requests:'requests', owner_refresh:'owners', reminder:'clock', system:'notif', daily_report_missing:'calendar', announcement:'announce'};
function renderNotificationsPage(u){
  const list = myNotifications(u);
  return `<div class="card">${list.length? list.map(n=>`
    <div class="notif-row" data-notif="${n.id}" style="display:flex; gap:12px; align-items:flex-start; padding:13px 16px; border-bottom:1px solid var(--border); cursor:${n.link?'pointer':'default'}; ${n.read?'opacity:.6;':''}">
      <div style="width:32px;height:32px;border-radius:50%; background:var(--brand-tint); color:var(--brand-dark); display:flex;align-items:center;justify-content:center; flex-shrink:0;">${ic(NOTIF_ICON[n.type]||'notif')}</div>
      <div style="flex:1;"><div style="font-size:13px; font-weight:${n.read?'500':'700'};">${esc(n.text)}</div><div style="font-size:11px; color:var(--text-faint);">${fmtDateTime(n.at)}</div></div>
      ${!n.read?`<button class="btn btn-sm btn-ghost" data-readnotif="${n.id}">Mark read</button>`:''}
    </div>`).join('') : `<div class="empty-state">${ic('notif')}<div>No notifications yet.</div></div>`}
  </div>`;
}
AFTER_RENDER.notifications = function(u){
  document.querySelectorAll('[data-readnotif]').forEach(b=> b.addEventListener('click', (e)=>{
    e.stopPropagation();
    const n = DB.notifications.find(x=>x.id===b.dataset.readnotif); n.read=true; persist(); renderPageInto(u);
  }));
  document.querySelectorAll('.notif-row').forEach(el=> el.addEventListener('click', ()=>{
    const n = DB.notifications.find(x=>x.id===el.dataset.notif);
    if(!n) return;
    n.read = true; persist();
    if(n.meta && n.meta.date) session._reportDate = n.meta.date;
    if(n.meta && n.meta.announcementId) session._openAnnouncementId = n.meta.announcementId;
    if(n.link) go(n.link); else renderPageInto(u);
  }));
};

