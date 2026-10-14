/* =========================================================
   REQUESTS
   ========================================================= */
function renderRequestsPage(u){
  const tk = myTeamKey(u);
  const list = requestsFor(tk);
  const pos = DB.requestRead[tk];
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
        <div style="margin:6px 0 0 14px;">
          ${session._replyOpen===r.id
            ? `<div style="display:flex; gap:6px; align-items:center;"><input class="reply-input" data-replyinput="${esc(r.id)}" placeholder="Write a reply…" maxlength="2000" style="flex:1; min-width:0;"><button class="btn btn-sm btn-primary" data-replysend="${esc(r.id)}">Reply</button><button class="btn btn-sm" data-replycancel="1" aria-label="Cancel reply">✕</button></div>`
            : `<button class="btn btn-sm" data-replyopen="${esc(r.id)}" style="padding:2px 10px; font-size:11.5px;">${r.replies.length?`Reply · ${r.replies.length} repl${r.replies.length===1?'y':'ies'}`:'Reply'}</button>`}
        </div>
      </div>
    </div>
  </div>`;
}
AFTER_RENDER.requests = function(u){
  const tk = myTeamKey(u);
  const list = requestsFor(tk);
  const scroll = document.getElementById('reqScroll');
  // The read position is stored on the SERVER (personal, per team feed, forward-only).
  const markRead = async ()=>{ await markRequestsReadOnServer(u, tk); };
  if(scroll) scroll.scrollTop = scroll.scrollHeight; // jump to latest/unread area
  // Opening the page re-fetches the feed so messages from other people are shown (at most every 5 s).
  if(!session._reqLastFetch || Date.now()-session._reqLastFetch > 5000){
    session._reqLastFetch = Date.now();
    const before = (list[list.length-1]||{}).id + ':' + list.length + ':' + DB.requestUnread[tk];
    hydrateRequestsFromServer(u, tk).then(ok=>{
      const l2 = requestsFor(tk);
      const after = (l2[l2.length-1]||{}).id + ':' + l2.length + ':' + DB.requestUnread[tk];
      const input = document.getElementById('reqInput');
      const rin = document.querySelector('[data-replyinput]');
      if(ok && before!==after && session.page==='requests' && !(input && input.value) && !(rin && rin.value)) render();
    });
  }
  // ---- replies (inline, per request) ----
  document.querySelectorAll('[data-replyopen]').forEach(b=> b.addEventListener('click', ()=>{ session._replyOpen = b.dataset.replyopen; const keep = scroll ? scroll.scrollTop : 0; render(); const sc = document.getElementById('reqScroll'); if(sc) sc.scrollTop = keep; const inp = document.querySelector('[data-replyinput]'); if(inp) inp.focus(); }));
  document.querySelectorAll('[data-replycancel]').forEach(b=> b.addEventListener('click', ()=>{ session._replyOpen = null; const keep = scroll ? scroll.scrollTop : 0; render(); const sc = document.getElementById('reqScroll'); if(sc) sc.scrollTop = keep; }));
  const sendReply = async (reqId)=>{
    const inp = document.querySelector(`[data-replyinput="${CSS.escape(reqId)}"]`); const btn = document.querySelector(`[data-replysend="${CSS.escape(reqId)}"]`);
    const txt = inp ? inp.value.trim() : ''; if(!txt || (btn && btn.disabled)) return;
    if(btn) btn.disabled = true;
    try{ await postReplyOnServer(u, tk, reqId, txt); }
    catch(e){ if(btn) btn.disabled = false; toast(e && e.isNetworkError ? 'Could not reach the server — your reply was NOT sent.' : ((e && e.message) || 'Could not send the reply')); return; }
    session._replyOpen = null; render(); toast('Reply sent');
  };
  document.querySelectorAll('[data-replysend]').forEach(b=> b.addEventListener('click', ()=> sendReply(b.dataset.replysend)));
  document.querySelectorAll('[data-replyinput]').forEach(i=> i.addEventListener('keydown', e=>{ if(e.key==='Enter') sendReply(i.dataset.replyinput); }));
  const jump = document.getElementById('jumpUnreadBtn');
  if(jump) jump.addEventListener('click', ()=>{
    const div = document.getElementById('unreadDivider'); if(div) div.scrollIntoView({behavior:'smooth', block:'center'});
    markRead().then(()=> setTimeout(()=>render(),600));
  });
  const sendBtn = document.getElementById('reqSendBtn');
  const input = document.getElementById('reqInput');
  let sending = false;
  const send = async ()=>{
    const txt = input.value.trim(); if(!txt || sending) return;
    sending = true; sendBtn.disabled = true;
    try{
      await postRequestOnServer(u, tk, txt);   // server stores it, then the feed is re-fetched
    }catch(e){
      sending = false; sendBtn.disabled = false;
      toast(e && e.isNetworkError ? 'Could not reach the server — your request was NOT posted.' : ((e && e.message) || 'Could not post the request'));
      return; // text stays in the box so nothing is lost
    }
    render(); toast('Request posted');
  };
  if(sendBtn) sendBtn.addEventListener('click', send);
  if(input) input.addEventListener('keydown', e=>{ if(e.key==='Enter') send(); });
  // mark read when the page is viewed and user scrolls near bottom
  if(scroll) scroll.addEventListener('scroll', ()=>{
    if(scroll.scrollTop + scroll.clientHeight >= scroll.scrollHeight - 20) markRead();
  });
};
