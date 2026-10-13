/* =========================================================
   Session & routing
   ========================================================= */
// A stored na1_user id is only honored if a real backend session (JWT) is also present —
// otherwise a leftover/forged sessionStorage value could reach the app without ever having
// passed real authentication. See api.js (token storage) and setAuthenticatedUser() below.
const _storedUserId = sessionStorage.getItem('na1_user') || null;
const _hasToken = (typeof NA1_API !== 'undefined') && NA1_API.isLoggedIn();
if(_storedUserId && !_hasToken){ sessionStorage.removeItem('na1_user'); }
let session = { userId: (_storedUserId && _hasToken) ? _storedUserId : null, page: 'dashboard', tab:{}, activeTeamView:null, requestsFilter:'all',
  invFilters:{bedrooms:[],bathrooms:[],unitType:[],finishing:[],saleRent:[],delivery:[], dpMin:'',dpMax:'', totalMin:'',totalMax:''},
  invSort:'popularity', invSearch:'', simToday:null };
function blankInvFilters(){ return {bedrooms:[],bathrooms:[],unitType:[],finishing:[],saleRent:[],delivery:[], dpMin:'',dpMax:'', totalMin:'',totalMax:''}; }

// The Daily Report module launches 2026-11-01 — before that date, real usage shows a
// "coming soon" notice. `effectiveTodayStr` lets a user explicitly preview the module
// using a simulated date (see the Daily Reports page) without changing the real clock or
// affecting any other part of the app; nothing else in New Avenue 1 reads session.simToday.
function effectiveTodayStr(){ return session.simToday || todayStr(); }

function currentUser(){ return DB.users.find(u=>u.id===session.userId); }
// setUser(id) is kept ONLY for the test/demo harnesses and any legacy call sites — real login
// now goes through setAuthenticatedUser() below, which is the only path that stores a verified
// backend session. Direct setUser() calls no longer happen from the login screen.
function setUser(id){ session.userId = id; sessionStorage.setItem('na1_user', id); session.page='dashboard'; render(); }
// Called after a successful NA1_API.login() call. `backendUser` is the safe user object the
// backend returned (id/name/role/team/... with no password hash). The frontend's own DB.users
// (still the local prototype dataset while the full data-layer rewire is in progress — see
// api.js's header comment and the project README) is matched by id so every existing page keeps
// working unmodified; if a backend account has no matching local record this fails loudly rather
// than silently logging in as nobody.
async function setAuthenticatedUser(backendUser){
  // The user directory is served by the backend; load it before resolving the signed-in user.
  if(typeof hydrateUsersFromServer === 'function'){
    const ok = await hydrateUsersFromServer();
    if(!ok){ NA1_API.logout(); throw new Error('Signed in, but the user directory could not be loaded from the server. Please try again.'); }
  }
  const local = DB.users.find(u=>u.id===backendUser.id);
  if(!local){
    throw new Error('Signed in as ' + backendUser.email + ' but no matching local profile was found (id "' + backendUser.id + '"). This demo account is not yet mirrored in the frontend dataset.');
  }
  session.userId = local.id;
  sessionStorage.setItem('na1_user', local.id);
  session.page = 'dashboard';
  // Owners (and the units they can link to) now come from the real backend — see js/sync.js.
  // This is awaited before the first render so the Owners page never flashes stale/empty data.
  if(typeof hydrateSessionData === 'function'){
    await hydrateSessionData(local);
  }
  render();
}
function logout(){
  session.userId=null;
  sessionStorage.removeItem('na1_user');
  if(typeof NA1_API !== 'undefined') NA1_API.logout();
  // Drop everything the previous account loaded from the server (incl. the admin-only directory
  // fields such as emails) so the next sign-in on this device starts clean.
  if(typeof stopRequestsPolling === 'function') stopRequestsPolling();
  resetServerOwned();
  if(typeof clearPhotoCache === 'function') clearPhotoCache();
  DB.users = buildUsers(); DB._usersHydrated = false;
  render();
}
function go(page){ session.page = page; render(); window.scrollTo(0,0); }

function toast(msg){
  const wrap = document.getElementById('toastWrap');
  const el = document.createElement('div'); el.className='toast'; el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(()=>el.remove(), 3200);
}

/* team-scoped data helpers */
function myTeamKey(u, overrideTeam){
  if(overrideTeam) return overrideTeam;
  if(u.team) return u.team;
  return session.activeTeamView || 'residential'; // admins/top execs default view
}
function requestsFor(teamKey){ return DB.requests[teamKey] || []; }

function visibleUnits(u){ const tk = myTeamKey(u); return DB.units.filter(x=>x.team===tk && !x.deletedAt); }

/* =========================================================
   PERSONAL ("My") vs TEAM data
   This separation is load-bearing: a management user's own Owners/Units/Leads/Daily Reports
   must never be mixed together with the ones belonging to the salespeople underneath them.
   "My X" = records personally created/owned by the logged-in user, full stop, regardless of
   role. "Team X" = the same kind of record belonging to the user's DOWNLINE ONLY (never
   including the user's own), and only meaningful for management roles.
   ========================================================= */
function downlineIds(u){ return getDownlineIds(DB.users, u.id); }

function myLeads(u){ return DB.leads.filter(l=>l.salespersonId===u.id); }
function teamLeads(u){ const down = new Set(downlineIds(u)); return DB.leads.filter(l=>down.has(l.salespersonId)); }
function visibleLeads(u){
  const tk = myTeamKey(u);
  let pool = DB.leads.filter(l=>l.team===tk);
  if(u.role==='salesperson') return pool.filter(l=>l.salespersonId===u.id);
  if(isMgmt(u)){ const down = getDownlineIds(DB.users, u.id); return pool.filter(l=>down.includes(l.salespersonId)); }
  return pool; // admins see all in active team view
}
// Returns the Owner<->Unit relationships (not bare owners) visible to this user,
// respecting the same hierarchy rules as before (own / downline / everyone for admins).
function visibleOwnerUnits(u){
  const tk = myTeamKey(u);
  let pool = DB.ownerUnits.filter(r=>{ const o = DB.owners.find(x=>x.id===r.ownerId); return o && !o.deletedAt && o.team===tk; });
  if(u.role==='salesperson') return pool.filter(r=>r.salespersonId===u.id);
  if(isMgmt(u)){ const down = getDownlineIds(DB.users, u.id); return pool.filter(r=>down.includes(r.salespersonId)); }
  return pool; // admins / top execs see all in active team view
}
// Returns distinct Owner records visible to this user (derived from visible relationships).
function visibleOwners(u){
  const relIds = new Set(visibleOwnerUnits(u).filter(r=>r.status==='active').map(r=>r.ownerId));
  return DB.owners.filter(o=>relIds.has(o.id) && !o.deletedAt);
}
// My Owners: the owners THIS user personally created/holds (home, shared-by-approval, or has
// an active unit relationship for) — unlimited units per owner, zero units allowed.
function myOwners(u){ return ownersForSalesperson(u.id); }
// Team Owners: the owners belonging to this user's DOWNLINE only — never mixed with My Owners,
// even when an owner happens to also be shared with the manager themselves (excluded here).
function teamOwners(u){
  const down = new Set(downlineIds(u));
  const mine = new Set(myOwners(u).map(o=>o.id));
  const ids = new Set();
  DB.owners.forEach(o=>{
    if(o.deletedAt) return;
    if(mine.has(o.id)) return;
    if(down.has(o.salespersonId) || (o.sharedWith||[]).some(id=>down.has(id))) ids.add(o.id);
  });
  DB.ownerUnits.filter(r=>r.status==='active' && down.has(r.salespersonId)).forEach(r=>{ if(!mine.has(r.ownerId)) ids.add(r.ownerId); });
  return DB.owners.filter(o=>ids.has(o.id) && !o.deletedAt);
}
function myUnits(u){ return DB.units.filter(x=>x.ownerSalespersonId===u.id && !x.deletedAt); }
function teamUnits(u){ const down = new Set(downlineIds(u)); return DB.units.filter(x=>down.has(x.ownerSalespersonId) && !x.deletedAt); }
// ownerExpiryState takes a raw timestamp (an Owner<->Unit relationship's lastUpdateAt) —
// this is the relationship-level 30-day cycle, soon = 28+ days (2-day reminder), expired = 30+ days
// that previously applied to the whole owner.
function ownerExpiryState(lastUpdateAt){
  const d = daysBetween(lastUpdateAt);
  if(d>=30) return 'expired';
  if(d>=28) return 'soon';
  return 'ok';
}
function unreadCountFor(u){
  const tk = myTeamKey(u);
  // Exact count computed by the server over the whole feed (the page only holds the latest window).
  return DB.requestUnread[tk] || 0;
}
function freshLeadsFor(u){ return visibleLeads(u).filter(l=>l.fresh); }
function myNotifications(u){ return DB.notifications.filter(n=>n.userId===u.id); }
function unreadNotifCount(u){ return DB.notifUnread || 0; } // exact count from the server

/* =========================================================
   Modal helper
   ========================================================= */
function openModal(html, opts){
  closeModal();
  const bd = document.createElement('div'); bd.className='modal-backdrop'; bd.id='modalBackdrop';
  bd.innerHTML = `<div class="modal">${html}</div>`;
  bd.addEventListener('click', e=>{ if(e.target===bd && !(opts&&opts.noBackdropClose)) closeModal(); });
  document.body.appendChild(bd);
}
function closeModal(){ const m = document.getElementById('modalBackdrop'); if(m) m.remove(); }

/* =========================================================
   NAV CONFIG
   ========================================================= */
function navItems(u){
  const items = [
    {key:'dashboard', label:'Dashboard', icon:'dashboard'},
  ];
  // Leads is Phase 2 / inactive — kept out of navigation entirely while LEADS_MODULE_ENABLED is false.
  if(LEADS_MODULE_ENABLED) items.push({key:'leads', label:'Leads', icon:'leads', badge: ()=>freshLeadsFor(u).length});
  items.push(
    {key:'inventory', label:'News Feed', icon:'inventory'},
    {key:'myunits', label:'My Units', icon:'myunits'},
    {key:'requests', label:'Requests', icon:'requests', badge: ()=>unreadCountFor(u)},
    {key:'owners', label:'Owners', icon:'owners'}
  );
  // Daily Reports: every sales-active person files their OWN report — role never removes this.
  if(isSalesActive(u)) items.push({key:'reports', label:'Daily Reports', icon:'calendar', badge: ()=> { const ds=effectiveTodayStr(); return personalReportStatus(u, ds)==='missing' && isOnOrAfterLaunch(ds) ? 1 : 0; }});
  items.push(
    {key:'reference', label:'Reference', icon:'reference'},
    {key:'notifications', label:'Notifications', icon:'notif', badge: ()=>unreadNotifCount(u)}
  );
  // Company Announcements: the compose/send screen is reachable from navigation ONLY for Head of
  // HR — every other employee only ever reaches it by clicking the notification an announcement
  // generates (see notifications.js), never from a nav item of their own.
  if(isHeadHR(u)) items.push({key:'announcements', label:'Company Announcements', icon:'announce'});
  if(isAdmin(u)) items.push({key:'admin', label:'Admin', icon:'admin'});
  items.push({key:'profile', label:'Profile', icon:'profile'});
  return items;
}
// Mobile bottom bar: a fixed 4 slots + a "More" drawer. This is NOT a reduced-feature mode —
// every item from navItems() is reachable, either directly or one tap into the "More" sheet
// (explicitly allowed by spec: "If there is not enough room... use a More menu. But ALL core
// features must remain accessible."). Dashboard, News Feed (Inventory), Requests and Reference
// get the fixed, always-visible primary slots; everything else (Owners, My Units, Leads, Daily
// Reports, Notifications, Admin, Profile) lives one tap away in the "More" drawer.
const MOBILE_TABS = ['dashboard','inventory','requests','reference'];
function mobileMoreItems(u){
  const items = navItems(u);
  return items.filter(it=> !MOBILE_TABS.includes(it.key));
}
function mobileMoreBadgeTotal(u){
  return mobileMoreItems(u).reduce((sum,it)=> sum + (it.badge?Number(it.badge())||0:0), 0);
}

