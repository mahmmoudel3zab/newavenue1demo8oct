/* =========================================================
   PROFILE
   ========================================================= */
function renderProfilePage(u){
  return `
  <div class="card card-pad" style="max-width:480px;">
    <div style="display:flex; align-items:center; gap:14px; margin-bottom:16px;">
      <span class="avatar" style="background:${u.avatar}; width:56px;height:56px; font-size:19px;">${initials(u.name)}</span>
      <div><div style="font-weight:800; font-size:17px;">${esc(u.name)}</div><div style="font-size:12.5px; color:var(--text-faint);">${ROLE_LABELS[u.role]}${u.team?' · '+u.team[0].toUpperCase()+u.team.slice(1):''}</div></div>
    </div>
    <div class="section-sub">Your team assignment can only be changed by an authorized administrator.</div>
    <div class="divider"></div>
    <button class="btn" id="switchAccBtn" style="width:100%; justify-content:center; margin-bottom:8px;">${ic('logout')} Switch account</button>
    <button class="btn btn-danger" id="resetDemoBtn" style="width:100%; justify-content:center;">${ic('trash')} Reset demo data</button>
  </div>`;
}
AFTER_RENDER.profile = function(u){
  document.getElementById('switchAccBtn').addEventListener('click', logout);
  document.getElementById('resetDemoBtn').addEventListener('click', ()=>{
    if(confirm('This will reset all demo data (leads, units, requests, owners) back to the original state. Continue?')){
      localStorage.removeItem(STORAGE_KEY); DB = loadDB(); toast('Demo data reset'); render();
    }
  });
};
