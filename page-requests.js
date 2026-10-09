/* =========================================================
   REQUESTS
   ========================================================= */
function renderRequestsPage(u){
  const tk = myTeamKey(u);
  const list = requestsFor(tk);
  const pos = DB.readPositions[u.id];
  const idx = pos ? list.findIndex(r=>r.id===pos) : -1;
  const unreadStart = idx+1;
  const hasUnread = unreadStart < list.length;
  return `
  <div class="card" style="display:flex; flex-direction:column; height:calc(100vh - 160px); max-height:720px;">
    <div style="padding:12px 16px; border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between;">
      <div><div style="font-weight:800; font-size:14px;">${tk[0].toUpperCase()+tk.slice(1)} Requests</div><div style="font-size:11.5px; color:var(--text-faint);">Shared feed for the whole team</div></div>
      ${hasUnread?`<button class="btn btn-sm btn-primary" id="jumpUnreadBtn">${list.length-unreadStart} new ↓</button>`:`<span class="badge badge-success">All caught up</span>`}
    </div>
    <div id="reqScroll" style="flex:1; overflow-y:auto; padding:14px 16px;">
      ${list.map((r,i)=>{
        const showDivider = i===unreadStart && hasUnread;
        return (showDivider? `<div id="unreadDivider" style="text-align:center; margin:14px 0;"><span class="badge badge-fresh">New requests</span></div>`:'') + requestBubble(r);
      }).join('') || emptyRow('No requests yet.')}
    </div>
    <div style="padding:12px 16px; border-top:1px solid var(--border); display:flex; gap:8px;">
      <input id="reqInput" placeholder="Write a request or share inventory news…">
      <button class="btn btn-primary" id="reqSendBtn">Send</button>
    </div>
  </div>`;
}
function requestBubble(r){
  const a = DB.users.find(x=>x.id===r.authorId);
  return `<div style="margin-bottom:14px;">
    <div style="display:flex; gap:9px;">
      <span class="avatar" style="background:${a?a.avatar:'#999'}; width:30px;height:30px; font-size:11px; flex-shrink:0;">${a?initials(a.name):'?'}</span>
      <div style="flex:1;">
        <div style="display:flex; gap:8px; align-items:baseline;"><span style="font-weight:700; font-size:12.5px;">${esc(a?a.name:'Unknown')}</span><span style="font-size:10.5px; color:var(--text-faint);">${fmtDateTime(r.at)}</span></div>
        <div style="font-size:13px; margin-top:2px; background:var(--surface-2); display:inline-block; padding:8px 11px; border-radius:10px;">${esc(r.text)}</div>
        ${r.replies.map(rp=>{
          const ra = DB.users.find(x=>x.id===rp.authorId);
          return `<div style="display:flex; gap:8px; margin-top:6px; margin-left:14px;">
            <span class="avatar" style="background:${ra?ra.avatar:'#999'}; width:22px;height:22px; font-size:9.5px; flex-shrink:0;">${ra?initials(ra.name):'?'}</span>
            <div><div style="font-size:11px; font-weight:700;">${esc(ra?ra.name:'?')} <span style="font-weight:400; color:var(--text-faint);">${fmtDateTime(rp.at)}</span></div>
            <div style="font-size:12.5px; background:var(--surface-2); display:inline-block; padding:6px 10px; border-radius:8px; margin-top:2px;">${esc(rp.text)}</div></div>
          </div>`;
        }).join('')}
      </div>
    </div>
  </div>`;
}
AFTER_RENDER.requests = function(u){
  const tk = myTeamKey(u);
  const list = requestsFor(tk);
  const scroll = document.getElementById('reqScroll');
  const markRead = ()=>{ if(list.length){ DB.readPositions[u.id] = list[list.length-1].id; persist(); } };
  if(scroll) scroll.scrollTop = scroll.scrollHeight; // jump to latest/unread area
  const jump = document.getElementById('jumpUnreadBtn');
  if(jump) jump.addEventListener('click', ()=>{
    const div = document.getElementById('unreadDivider'); if(div) div.scrollIntoView({behavior:'smooth', block:'center'});
    markRead(); setTimeout(()=>render(),600);
  });
  const sendBtn = document.getElementById('reqSendBtn');
  const input = document.getElementById('reqInput');
  const send = ()=>{
    const txt = input.value.trim(); if(!txt) return;
    DB.requests[tk].push({id:uid('r'), team:tk, authorId:u.id, text:txt, at:now(), replies:[]});
    markRead(); persist(); render(); go('requests');
    toast('Request posted');
  };
  if(sendBtn) sendBtn.addEventListener('click', send);
  if(input) input.addEventListener('keydown', e=>{ if(e.key==='Enter') send(); });
  // mark read when the page is viewed and user scrolls near bottom
  if(scroll) scroll.addEventListener('scroll', ()=>{
    if(scroll.scrollTop + scroll.clientHeight >= scroll.scrollHeight - 20) markRead();
  });
};

