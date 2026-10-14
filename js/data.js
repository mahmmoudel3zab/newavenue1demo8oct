/* =========================================================
   NEW AVENUE 1 — prototype data layer
   ========================================================= */
const STORAGE_KEY = 'na1_db_v1';
const uid = (p) => p + '_' + Math.random().toString(36).slice(2,9);
const now = () => Date.now();
const daysAgo = (n) => now() - n*86400000;
const fmtMoney = (n) => 'EGP ' + Math.round(n).toLocaleString('en-US');
const fmtDate = (t) => new Date(t).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
const fmtDateTime = (t) => new Date(t).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
const daysBetween = (t) => Math.floor((now()-t)/86400000);
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

/* ---------- Leads module flag (Phase 2 — inactive in the current app) ---------- */
// Leads code/data remain in the codebase (buildLeads, pages/leads.js, lead notifications)
// but are not reachable from navigation and do not generate notifications while this is false.
const LEADS_MODULE_ENABLED = false;

/* =========================================================
   Phone number validation & normalization (Egyptian numbers)
   - Digits only: no '+', spaces, '-', brackets or letters.
   - Local format:  01XXXXXXXXX   (11 digits, starts with 0)
   - Intl format:   201XXXXXXXXX  (12 digits, starts with 20, no '+')
   - Both normalize to the same 12-digit canonical form so duplicate
     checks and search treat them as the same owner's number.
   No other country-code or formatting rule is implemented.
   ========================================================= */
function isDigitsOnly(raw){
  return typeof raw === 'string' && raw.length>0 && /^[0-9]+$/.test(raw);
}
// Returns the canonical 12-digit ("201XXXXXXXXX") form, or null if invalid/unrecognized.
function normalizeEgyptPhone(raw){
  if(!isDigitsOnly(raw)) return null;
  const d = raw;
  if(d.length===11 && d[0]==='0') return '20'+d.slice(1); // 01XXXXXXXXX -> 201XXXXXXXXX
  if(d.length===12 && d.slice(0,2)==='20') return d;      // already international
  return null;
}
function phoneLocalDisplay(canonical){ return canonical ? '0'+canonical.slice(2) : ''; }
function phoneIntlDisplay(canonical){ return canonical || ''; }
function phonesEqual(a,b){
  const na = normalizeEgyptPhone(a), nb = normalizeEgyptPhone(b);
  return !!na && !!nb && na===nb;
}

const AVATAR_COLORS = ['#8A6A3B','#25505A','#7A5C8A','#3F7D58','#B0463F','#4C6B8A','#8A7A3B'];
function avatarColor(seed){ let h=0; for(const c of seed) h=(h*31+c.charCodeAt(0))>>>0; return AVATAR_COLORS[h%AVATAR_COLORS.length]; }
function initials(name){ return name.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase(); }

/* ---------- Roles ---------- */
const ROLE_LABELS = {
  salesperson:'Salesperson', teamleader:'Team Leader', manager:'Sales Manager',
  director:'Director', headofsales:'Head of Sales', ceo:'CEO',
  junioradmin:'Junior Admin', senioradmin:'Senior Admin', headadmin:'Head Admin',
  headhr:'Head of HR'
};
const MGMT_ROLES = ['teamleader','manager','director','headofsales','ceo'];
const ADMIN_ROLES = ['junioradmin','senioradmin','headadmin'];
const TOP_ROLES = ['headofsales','ceo']; // company-wide, can view both teams
const HR_ROLES = ['headhr'];

/* ---------- Official job titles (PART 1 — Account Hierarchy & Job Titles) ----------
   These 9 titles are the company's official sales job titles, ordered lowest to highest.
   JOB TITLE != SYSTEM ROLE/PERMISSION: `role` above (salesperson/teamleader/manager/.../headadmin)
   is still the ONLY thing any permission check (isAdmin/isMgmt/isTopExec/isHeadHR/requireAdmin on
   the backend) ever reads. `jobTitle` is a separate, purely descriptive field — changing it can
   never grant or remove any access. This mirrors the backend's job_title column (na1-backend/src/db.js),
   which carries the identical 9-value CHECK constraint, kept in sync by hand since the two layers
   are not wired together yet (see README "frontend/backend remain unwired").
   "Salesperson" is intentionally NOT in this list — it is no longer an available job title,
   though `role:'salesperson'` remains the permission-granting value (renaming the role enum
   itself would be an unnecessary, risk-adding rewrite of the whole authorization system, which
   the spec explicitly says to avoid — "retain existing internal role identifiers wherever
   practical"). */
const JOB_TITLES = [
  'Junior Sales','Senior Sales','Sales Supervisor','Team Leader','Sales Manager',
  'Senior Sales Manager','Director','Head of Sales','CEO'
];
function jobTitleIndex(title){ return JOB_TITLES.indexOf(title); }
// The label shown everywhere a person's "title" appears (Reference, Admin, profile, badges,
// dashboards). Falls back sensibly for accounts that don't hold one of the 9 sales titles:
// pure administrative roles (Junior/Senior/Head Admin) and Head of HR show their functional
// position instead (they are not part of the sales hierarchy and were never asked to be), and
// a salesperson-role account whose title is still ambiguous (see migrateTitlesV6toV7 below)
// clearly says so rather than silently showing nothing or a guessed value as if it were final.
function displayTitle(u){
  if(u.jobTitle) return u.jobTitle;
  if(u.titleNeedsReview) return 'Title pending review';
  if(isAdmin(u) || isHeadHR(u)) return ROLE_LABELS[u.role];
  return ROLE_LABELS[u.role]; // safety fallback — should not normally be reached
}

function isAdmin(u){ return ADMIN_ROLES.includes(u.role); }
function isMgmt(u){ return MGMT_ROLES.includes(u.role); }
function isTopExec(u){ return TOP_ROLES.includes(u.role); }
// Head of HR is its own, separate role — not a sales role and not part of the admin hierarchy
// (ADMIN_ROLES/isAdmin). It exists only to own the Company Announcements feature below.
function isHeadHR(u){ return HR_ROLES.includes(u.role); }
// CORE BUSINESS RULE: role !== sales activity. Every member of the sales hierarchy — a plain
// salesperson AND every management role above them (team leader, sales manager, director,
// head of sales, CEO) — can personally hold Owners, Units, Leads, a Daily Report and sales
// activity of their own, in addition to whatever team/subordinate visibility their role grants.
// Only the administrative roles (junior/senior/head admin) are not personally sales-active.
function isSalesActive(u){ return u.role==='salesperson' || isMgmt(u); }

/* ---------- Static reference lists ---------- */
const COMPOUNDS_RES = ['Marina Bay Residences','Palm Hills Gardens','Sodic Waterway','Mivida Green Court','Zed East','Hyde Park Views','Al Rehab Extension','Cairo Gate'];
const DEVELOPERS_RES = ['Palm Hills Developments','SODIC','Emaar Misr','Ora Developers','Hyde Park','Talaat Moustafa Group','Madinet Masr'];
const COMPOUNDS_COM = ['Downtown Business Hub','Nile Corniche Tower','Capital Business Park','New Cairo Trade Center','Smart Village Offices','Mall of Arabia Retail Wing'];
const DEVELOPERS_COM = ['Al Ahly Sabbour','Arabia Holding','Mountain View','Master Group','Nasr City Development'];
const AREAS = ['New Cairo','6th of October','Sheikh Zayed','North Coast','Mostakbal City','Zayed','Maadi','Nasr City','Downtown Cairo','5th Settlement'];
const CITIES = ['Cairo','Giza','Alexandria'];
const UNIT_TYPES_RES = ['Apartment','Villa','Twin House','Townhouse','Chalet','Studio'];
const UNIT_TYPES_COM = ['Office','Retail Store','Showroom','Clinic','Warehouse','Administrative Unit'];
const FINISHING = ['Finished','Semi-Finished','Unfinished','Super Lux'];

/* ---------- Seeded random ---------- */
let _seed = 42;
function rnd(){ _seed = (_seed*1103515245+12345) & 0x7fffffff; return _seed/0x7fffffff; }
function rndInt(a,b){ return a+Math.floor(rnd()*(b-a+1)); }
function pick(arr){ return arr[rndInt(0,arr.length-1)]; }
function pickMany(arr,n){ const c=[...arr]; const out=[]; for(let i=0;i<n && c.length;i++){ out.push(c.splice(rndInt(0,c.length-1),1)[0]); } return out; }

/* ---------- Build demo users ---------- */
// title: one of JOB_TITLES, or null. needsReview: true for accounts whose title is a
// best-effort default, not yet confirmed by an admin (see PART 1.1 — "Report accounts with
// missing, obsolete, or ambiguous titles for review" / migrateTitlesV6toV7 below for the
// identical logic applied to accounts saved under the pre-this-round data version).
function buildUsers(){
  const u = [];
  // `email` mirrors na1-backend/src/seed/seed.js exactly (same ids, same emails) so the real
  // login screen (shell.js) can authenticate against the real backend and land on the matching
  // local profile. See api.js / session.js setAuthenticatedUser() for how the two are joined.
  const add = (id,name,email,role,team,managerId,title,needsReview)=> u.push({id,name,email,role,team,managerId,avatar:avatarColor(name),jobTitle:title||null,titleNeedsReview:!!needsReview});
  // Residential
  add('ceo1','Ahmed El Sayed','ceo@newavenue.demo','ceo',null,null,'CEO',false);
  add('hos1','Rania Fahmy','hos@newavenue.demo','headofsales',null,'ceo1','Head of Sales',false);
  add('dir1','Amr Hassan','dir.res@newavenue.demo','director','residential','hos1','Director',false);
  add('m1','Dina Youssef','manager.res@newavenue.demo','manager','residential','dir1','Sales Manager',false);
  add('tl1','Hossam Nabil','tl.res@newavenue.demo','teamleader','residential','m1','Team Leader',false);
  // role:'salesperson' has no unambiguous mapping to Junior vs Senior Sales (nothing in the
  // existing data distinguishes tenure) — each gets a sensible default so the app and the new
  // Title Review admin screen both have real, varied examples, but is flagged needsReview so a
  // Senior/Head Admin must confirm or correct it (see admin.js "Title review" tab).
  add('s1','Mona Adel','s1@newavenue.demo','salesperson','residential','tl1','Senior Sales',true);
  add('s2','Karim Fathy','s2@newavenue.demo','salesperson','residential','tl1','Junior Sales',true);
  add('s3','Yara Ali','s3@newavenue.demo','salesperson','residential','tl1','Senior Sales',true);
  add('s6','Omar Sherif','s6@newavenue.demo','salesperson','residential','tl1','Junior Sales',true);
  // Commercial
  add('dir2','Heba El Nagar','dir.com@newavenue.demo','director','commercial','hos1','Director',false);
  add('m2','Sherif Adel','manager.com@newavenue.demo','manager','commercial','dir2','Sales Manager',false);
  add('tl2','Nour Khaled','tl.com@newavenue.demo','teamleader','commercial','m2','Team Leader',false);
  add('s4','Tarek Samir','s4@newavenue.demo','salesperson','commercial','tl2','Junior Sales',true);
  add('s5','Lobna Adly','s5@newavenue.demo','salesperson','commercial','tl2','Senior Sales',true);
  add('s7','Farida Gamal','s7@newavenue.demo','salesperson','commercial','tl2','Junior Sales',true);
  // Admins — pure administrative positions, not sales job titles (see displayTitle()); left null.
  add('ja1','Salma Ezz','junioradmin@newavenue.demo','junioradmin',null,null,null,false);
  add('sa1','Mostafa Reda','senioradmin@newavenue.demo','senioradmin',null,null,null,false);
  add('ha1','Laila Mansour','headadmin@newavenue.demo','headadmin',null,null,null,false);
  // Human Resources — a separate function from the admin hierarchy above; this is the only
  // account the Company Announcements compose screen is available to (see pages/announcements.js).
  add('hr1','Yasmin Adly','headhr@newavenue.demo','headhr',null,null,null,false);
  return u;
}

function getDownlineIds(users, rootId){
  const kids = users.filter(u=>u.managerId===rootId).map(u=>u.id);
  let all = [...kids];
  kids.forEach(k=> all = all.concat(getDownlineIds(users,k)));
  return all;
}

/* ---------- Build demo units ---------- */
function buildUnits(users){
  const units = [];
  // Management roles are ALSO salespeople (role !== sales activity) — team-assigned managers
  // (team leader, sales manager, director) personally own Units too, not just their downline.
  // Company-wide execs (headofsales/ceo, team:null) keep team-wide VISIBILITY via the
  // Residential/Commercial view switcher but aren't given generated personal inventory here,
  // matching the worked examples in the spec (Team Leader, Sales Manager).
  const salesRes = users.filter(u=> isSalesActive(u) && u.team==='residential');
  const salesCom = users.filter(u=> isSalesActive(u) && u.team==='commercial');
  function makeUnit(team, sp){
    const isRes = team==='residential';
    const total = rndInt(isRes?2800000:5200000, isRes?18500000:42000000);
    const dp = Math.round(total*(rndInt(10,30)/100));
    const remaining = total-dp;
    const installments = pick([12,18,24,36,48,60]);
    const unitType = pick(isRes?UNIT_TYPES_RES:UNIT_TYPES_COM);
    const bedrooms = isRes ? (unitType==='Studio'?0:rndInt(1,5)) : null;
    const bathrooms = isRes ? rndInt(1,Math.max(2,bedrooms)) : rndInt(1,3);
    const delivery = pick([0,0,1,1,2,4]); // years, 0=immediate
    return {
      id: uid('u'), team, pending: rnd()<0.16,
      compound: pick(isRes?COMPOUNDS_RES:COMPOUNDS_COM),
      phase: 'Phase '+rndInt(1,4),
      developer: pick(isRes?DEVELOPERS_RES:DEVELOPERS_COM),
      city: pick(CITIES), area: pick(AREAS),
      saleRent: rnd()<0.85?'Sale':'Rent',
      unitType, areaSize: isRes? rndInt(90,420): rndInt(60,900),
      garden: isRes && rnd()<0.3 ? rndInt(50,200) : 0,
      roof: isRes && rnd()<0.2 ? rndInt(40,150) : 0,
      bedrooms, bathrooms,
      deliveryYears: delivery,
      downPayment: dp, remainingAmount: remaining, remainingInstallments: installments,
      totalPrice: total, extraFees: Math.round(total*0.03),
      finishing: pick(FINISHING), furnished: rnd()<0.35,
      photos: rndInt(3,6),
      ownerSalespersonId: sp.id,
      createdAt: now() - rndInt(0,60)*86400000,
      updatedAt: now() - rndInt(0,60)*86400000,
      deletedAt: null, deletedBy: null,
      views:[], calls:[], whatsapps:[], pdfs:[]
    };
  }
  salesRes.forEach(sp=>{ for(let i=0;i<rndInt(4,6);i++) units.push(makeUnit('residential',sp)); });
  salesCom.forEach(sp=>{ for(let i=0;i<rndInt(3,5);i++) units.push(makeUnit('commercial',sp)); });
  // seed some interaction history for popularity variety
  const allViewers = users.filter(u=>u.role==='salesperson').map(u=>u.id);
  units.forEach(un=>{
    const n = rndInt(0,10);
    for(let i=0;i<n;i++){ const v = pick(allViewers); if(!un.views.includes(v)) un.views.push(v); }
    if(rnd()<0.4) un.calls.push(pick(allViewers));
    if(rnd()<0.3) un.whatsapps.push(pick(allViewers));
    if(rnd()<0.2) un.pdfs.push(pick(allViewers));
  });
  return units;
}

function popularityScore(u){
  return u.views.length*1 + u.calls.length*3 + u.whatsapps.length*4 + u.pdfs.length*5;
}

/* ---------- Build demo leads ---------- */
const FIRST_NAMES = ['Mohamed','Ahmed','Sara','Nadia','Hana','Youssef','Laila','Khaled','Mariam','Adham','Rasha','Wael','Dalia','Tamer','Salma','Ziad'];
const LAST_NAMES = ['Ibrahim','Fouad','Kamal','Naguib','Aziz','Rashad','Sabry','Zaki','Farouk','Hegazy','Shawky','Anwar'];
const LEAD_SOURCES = ['Facebook Ad','Website Form','Walk-in','Referral','Property Portal','Phone Inquiry'];
const LEAD_STATUSES = ['Fresh','Unreachable','Showing','Following','Seller','Referral','Postponed','Done Deal','Meeting'];

function buildLeads(users, units){
  const leads = [];
  function makeLead(team, sp, forceFresh){
    const status = forceFresh ? 'Fresh' : pick(LEAD_STATUSES.slice(1));
    const createdAt = forceFresh ? now()-rndInt(0,6)*3600000 : daysAgo(rndInt(1,45));
    const l = {
      id: uid('l'), team, salespersonId: sp.id,
      name: pick(FIRST_NAMES)+' '+pick(LAST_NAMES),
      phone: '01' + rndInt(0,2) + rndInt(10000000,99999999),
      source: pick(LEAD_SOURCES),
      status, fresh: status==='Fresh',
      interestedUnitId: rnd()<0.6 ? pick(units.filter(u=>u.team===team)).id : null,
      createdAt,
      history: [{from:null,to:status,by:sp.id,at:createdAt}],
      notes: [], reminders: []
    };
    if(!forceFresh && rnd()<0.5){
      l.notes.push({text: pick(['Client prefers ground floor.','Budget flexible by 5%.','Wants garden view unit.','Needs financing options explained.']), by:sp.id, at: createdAt+3600000});
    }
    if(!forceFresh && rnd()<0.3){
      l.reminders.push({id:uid('rm'), text:'Follow up call', date: now()+rndInt(-2,5)*86400000, done:false});
    }
    return l;
  }
  // Management roles are ALSO salespeople and personally work leads of their own, separate
  // from the leads belonging to the salespeople underneath them.
  users.filter(u=>isSalesActive(u) && u.team).forEach(sp=>{
    // guarantee 1-2 fresh leads per salesperson for demo
    leads.push(makeLead(sp.team, sp, true));
    if(rnd()<0.5) leads.push(makeLead(sp.team, sp, true));
    for(let i=0;i<rndInt(3,6);i++) leads.push(makeLead(sp.team, sp, false));
  });
  return leads;
}

/* ---------- Build demo requests ---------- */
const REQUEST_TEMPLATES = [
  'Looking for a 3BR apartment in {area}, budget up to {price}. Any options?',
  'Client needs immediate delivery unit, ready to move, cash buyer.',
  'Do we have any villas with garden in {area}?',
  'Sharing a fresh listing: {area} unit just came in, DM me for details.',
  'Need a unit with 40% down payment plan for a client meeting tomorrow.',
  'Any owners looking to sell in {area}? Client is flexible on price.',
  'Looking for office space around 150m2, semi-finished.',
  'Urgent: client wants to view units this weekend in {area}.',
  'Does anyone have inventory from {area} with rent option?',
  'Posting a new exclusive from my owner — will share PDF shortly.'
];
function buildRequests(users, teamKey){
  const reqs = [];
  const sales = users.filter(u=>u.team===teamKey);
  let t = daysAgo(20);
  for(let i=0;i<70;i++){
    const author = pick(sales);
    let text = pick(REQUEST_TEMPLATES).replace('{area}',pick(AREAS)).replace('{price}',fmtMoney(rndInt(3,15)*1000000));
    t += rndInt(1,7)*3600000;
    const r = { id: uid('r'), team: teamKey, authorId: author.id, text, at: t, replies: [] };
    if(rnd()<0.35){
      const replier = pick(sales);
      r.replies.push({id:uid('rr'), authorId:replier.id, text: pick(['I have something similar, calling you now.','Sent you the unit code on WhatsApp.','Yes available, check reference dictionary for my number.','Following up with my owner on this.']), at: t+rndInt(1,4)*3600000});
    }
    reqs.push(r);
  }
  return reqs;
}

/* ---------- Build demo owners + real Owner<->Unit relationships ----------
   An Owner is a real contact (name + normalized phone) that EXISTS INDEPENDENTLY of any
   Unit — it is created on its own (owner.salespersonId is the salesperson who created/"owns"
   this contact) and can later have zero, one, or many Units linked to it. A Unit belongs to
   company Inventory (DB.units). The link between an Owner and a specific Unit — including
   which salesperson is actively working that owner on that unit, and that relationship's own
   30-day update cycle — lives in DB.ownerUnits. One owner can have many active ownerUnits
   (unlimited units); the 30-cap applies to DISTINCT OWNERS a salesperson has (created or holds
   a relationship for), never to units.
   owner.sharedWith holds the ids of OTHER salespeople who were admin-approved to also work
   this same owner contact (a "claim" with no specific unit yet) — this is how a cross-
   salesperson claim is granted without ever silently duplicating the owner record. */
function makeOwnerUnitRel(ownerId, unitId, salespersonId, lastUpdateDaysAgo){
  const lastUpdateAt = daysAgo(lastUpdateDaysAgo);
  return {
    id: uid('ou'), ownerId, unitId, salespersonId,
    status: 'active', // active | transferred
    lastUpdateAt,
    nextUpdateAt: lastUpdateAt + 30*86400000,
    reminderAt: lastUpdateAt + 28*86400000,
    createdAt: lastUpdateAt
  };
}
function buildOwnersAndRelationships(users, units){
  const owners = [];
  const ownerUnits = [];
  const usedPhones = new Set();
  function freshPhone(){
    let p;
    // Canonical Egyptian format is 12 digits: "20" + the local number with its leading 0
    // stripped (e.g. local "010XXXXXXXX" -> canonical "2010XXXXXXXX"). Must match what
    // normalizeEgyptPhone() produces, or owner phone numbers silently fail to normalize.
    do { p = '201'+rndInt(0,2)+rndInt(10000000,99999999); } while(usedPhones.has(p));
    usedPhones.add(p);
    return p;
  }
  // Team-assigned sales-active users (salespeople AND their team leaders/managers/directors —
  // role never removes personal sales activity) each personally create and hold some Owners.
  users.filter(u=>isSalesActive(u) && u.team).forEach(sp=>{
    const spUnits = units.filter(un=>un.team===sp.team && un.ownerSalespersonId===sp.id);
    const ownerCount = rndInt(2,5);
    const unitPool = [...spUnits];
    for(let i=0;i<ownerCount;i++){
      const phone = freshPhone();
      const owner = {
        id: uid('o'), team: sp.team, salespersonId: sp.id, sharedWith: [],
        name: pick(FIRST_NAMES)+' '+pick(LAST_NAMES),
        phone, phone2: rnd()<0.3 ? freshPhone() : null,
        createdAt: daysAgo(rndInt(10,60)),
        deletedAt: null, deletedBy: null
      };
      owners.push(owner);
      // Most owners have at least one unit; some are deliberately left with zero units so the
      // demo clearly shows "the Owner exists independently from the Units" (Add Unit is then
      // the obvious next action on that owner's card).
      const ownerUnitCount = unitPool.length && rnd()<0.8 ? Math.min(rndInt(1,3), unitPool.length) : 0;
      if(ownerUnitCount){
        const takenUnits = unitPool.splice(0, ownerUnitCount);
        takenUnits.forEach(un=>{
          ownerUnits.push(makeOwnerUnitRel(owner.id, un.id, sp.id, rndInt(0,32)));
        });
      }
    }
  });
  // force a couple of demo states: one relationship "soon", one "expired" (available for transfer)
  const active = ownerUnits.filter(r=>r.status==='active');
  if(active[0]){ active[0].lastUpdateAt = daysAgo(29); active[0].nextUpdateAt = active[0].lastUpdateAt+30*86400000; active[0].reminderAt = active[0].lastUpdateAt+28*86400000; }
  if(active[1]){ active[1].lastUpdateAt = daysAgo(31); active[1].nextUpdateAt = active[1].lastUpdateAt+30*86400000; active[1].reminderAt = active[1].lastUpdateAt+28*86400000; }
  return { owners, ownerUnits };
}

/* ---------- Owner / Owner-Unit relationship helpers ---------- */
function ownerUnitsFor(ownerId){ return DB.ownerUnits.filter(r=>r.ownerId===ownerId); }
function activeOwnerUnitsFor(ownerId){ return ownerUnitsFor(ownerId).filter(r=>r.status==='active'); }
function ownerUnitsForSalesperson(spId){ return DB.ownerUnits.filter(r=>r.salespersonId===spId && r.status==='active'); }
// Every Owner this salesperson "has" — either they created/hold it (home salespersonId), they
// were admin-approved to share it (sharedWith), or they have at least one active Unit
// relationship for it. An owner with zero Units still counts once it's been created/shared.
function ownersForSalesperson(spId){
  const ids = new Set(ownerUnitsForSalesperson(spId).map(r=>r.ownerId));
  DB.owners.forEach(o=>{ if(o.salespersonId===spId || (o.sharedWith||[]).includes(spId)) ids.add(o.id); });
  return DB.owners.filter(o=>ids.has(o.id) && !o.deletedAt);
}
// Count of DISTINCT owners this salesperson currently "has" (the 30-owner cap — unlimited
// units per owner never count against it, and an owner with zero units still counts once).
function distinctOwnerCountForSalesperson(spId){
  return ownersForSalesperson(spId).length;
}
// Only matches ACTIVE (non-deleted) owners — a soft-deleted owner's phone is reserved (see
// findArchivedOwnerByCanonicalPhone below) but must never silently resolve as "this owner
// already exists" for normal add/edit flows while it's archived.
function findOwnerByCanonicalPhone(canonical, team){
  if(!canonical) return null;
  return DB.owners.find(o=> o.team===team && !o.deletedAt && (o.phone===canonical || o.phone2===canonical)) || null;
}
// Finds a SOFT-DELETED owner matching this phone, so Add Owner can give a clear, specific
// error ("ask a Head Admin to restore it") instead of silently creating a second record with
// the same phone number once the active-owner check above has been passed.
function findArchivedOwnerByCanonicalPhone(canonical, team){
  if(!canonical) return null;
  return DB.owners.find(o=> o.team===team && o.deletedAt && (o.phone===canonical || o.phone2===canonical)) || null;
}
// Does this salesperson already "have" this owner (home, shared, or an active unit relationship)?
function salespersonHasOwner(spId, ownerId){
  const o = DB.owners.find(x=>x.id===ownerId);
  if(!o || o.deletedAt) return false;
  if(o.salespersonId===spId || (o.sharedWith||[]).includes(spId)) return true;
  return DB.ownerUnits.some(r=>r.salespersonId===spId && r.ownerId===ownerId && r.status==='active');
}
// Is this owner currently "held" (home, shared, or an active relationship) by some OTHER salesperson?
function ownerHeldByOthers(ownerId, excludingSpId){
  const o = DB.owners.find(x=>x.id===ownerId);
  if(!o || o.deletedAt) return false;
  if(o.salespersonId && o.salespersonId!==excludingSpId) return true;
  if((o.sharedWith||[]).some(id=>id!==excludingSpId)) return true;
  return DB.ownerUnits.some(r=>r.ownerId===ownerId && r.status==='active' && r.salespersonId!==excludingSpId);
}

/* =========================================================
   PART 1 — Soft delete for Owners and Units
   A soft-deleted record is never erased: only `deletedAt`/`deletedBy` are set. The row, its
   phone/history, and every relationship that references it (DB.ownerUnits for an owner,
   nothing references a unit by id except DB.ownerUnits.unitId and DB.leads.interestedUnitId)
   are left completely untouched — deleting an owner does NOT delete or detach its units, and
   deleting a unit does NOT delete the owner relationships that reference it (they simply show
   "(unit removed)" via unitLabel(), exactly as an already-handled case in this codebase).
   Restoring always UPDATES the same row (never re-creates it), so duplication on restore is
   structurally impossible — reinforced by findOwnerByCanonicalPhone() excluding deleted owners
   and findArchivedOwnerByCanonicalPhone() catching the "already archived" case explicitly.
   Every normal data-access helper above/below (ownersForSalesperson, visibleOwners, myOwners,
   teamOwners, visibleUnits, myUnits, teamUnits, the News Feed source list, etc.) excludes
   deleted rows — restricted, Head-Admin-only views (see admin.js) are the only place a deleted
   row is ever read back.
   ========================================================= */
function isOwnerDeleted(o){ return !!(o && o.deletedAt); }
function isUnitDeleted(un){ return !!(un && un.deletedAt); }
// DEPRECATED local mutators (softDeleteOwner / restoreOwner / softDeleteUnit / restoreUnit /
// transferOwnerFromTo below): since the backend integration NO screen calls them — owner and unit
// changes are made by the server (DELETE/restore/transfer endpoints) and the screen then reloads.
// They are kept only because older automated tests exercise them; never call them from the UI.
function softDeleteOwner(owner, actorId){
  owner.deletedAt = now(); owner.deletedBy = actorId;
}
function restoreOwner(owner){
  owner.deletedAt = null; owner.deletedBy = null;
}
function softDeleteUnit(unit, actorId){
  unit.deletedAt = now(); unit.deletedBy = actorId; unit.updatedAt = now();
}
function restoreUnit(unit){
  unit.deletedAt = null; unit.deletedBy = null; unit.updatedAt = now();
}
function deletedOwnersList(){ return DB.owners.filter(o=>o.deletedAt).slice().sort((a,b)=>b.deletedAt-a.deletedAt); }
function deletedUnitsList(){ return DB.units.filter(x=>x.deletedAt).slice().sort((a,b)=>b.deletedAt-a.deletedAt); }

/* =========================================================
   PART 3 — Owner transfer between salespeople (Head Admin only — see admin.js for the
   permission gate on the UI itself).
   An Owner has NO single "owning salesperson" column in this data model: a salesperson can
   "have" an owner via being its home salespersonId, via an admin-approved sharedWith entry, or
   via holding one or more active DB.ownerUnits relationships for it — and different
   relationships on the SAME owner can be held by DIFFERENT salespeople at once. So "transfer
   this owner" is ambiguous unless we say whose claim is moving — ownerCurrentHolderIds() below
   lists everyone who currently has a claim; the caller (the admin UI) must resolve exactly one
   `fromSpId` before calling transferOwnerFromTo() — asking the admin to pick when there's more
   than one, rather than silently guessing and possibly moving the wrong person's relationships
   or breaking another salesperson's still-active work on the same owner.
   ========================================================= */
function ownerCurrentHolderIds(owner){
  const ids = new Set();
  if(owner.salespersonId) ids.add(owner.salespersonId);
  (owner.sharedWith||[]).forEach(id=>ids.add(id));
  activeOwnerUnitsFor(owner.id).forEach(r=>ids.add(r.salespersonId));
  return [...ids];
}
// Reassigns everything `fromSpId` currently holds on this owner (home ownership if theirs,
// shared access if theirs, and every active unit relationship they hold) to `toSpId`, in one
// atomic step. Never creates a second owner record, never touches relationships held by anyone
// else, and never deletes/recreates anything — only the holder fields change, so phone/notes/
// history/relationship records are fully preserved exactly as Part 3 requires.
function transferOwnerFromTo(owner, fromSpId, toSpId, actorId){
  let movedRelCount = 0;
  if(owner.salespersonId===fromSpId) owner.salespersonId = toSpId;
  owner.sharedWith = (owner.sharedWith||[]).filter(id=>id!==fromSpId);
  activeOwnerUnitsFor(owner.id).forEach(r=>{
    if(r.salespersonId===fromSpId){ r.salespersonId = toSpId; movedRelCount++; }
  });
  log(actorId,'owner_full_transfer',{ownerId:owner.id, from:fromSpId, to:toSpId, relationshipsMoved:movedRelCount});
  notify(toSpId,'system','An owner was transferred to you: '+owner.name,'owners','ownertransfer_to_'+owner.id+'_'+now());
  notify(fromSpId,'system','An owner was transferred from you: '+owner.name,'owners','ownertransfer_from_'+owner.id+'_'+now());
  persist();
  return movedRelCount;
}
// PART 4 — company-wide (both teams), Head-Admin-only view of expired owner-unit relationships.
// Previously self-service (see the removed "Available Pool" section of pages/owners.js); now an
// admin directly reassigns a specific relationship to a chosen salesperson — this changes ONLY
// that one relationship, never the owner's other units, matching the original feature's own
// documented behavior ("claiming one does not affect the owner's other units").
function expiredOwnerUnitsCompanyWide(){
  return DB.ownerUnits.filter(r=>{
    if(r.status!=='active') return false;
    const o = DB.owners.find(x=>x.id===r.ownerId);
    if(!o || o.deletedAt) return false;
    const un = DB.units.find(x=>x.id===r.unitId);
    if(un && un.deletedAt) return false;
    return ownerExpiryState(r.lastUpdateAt)==='expired';
  });
}

/* ---------- Automatic duplicate-owner detection ----------
   Live detection of an existing Owner matching a phone number being typed into "Add owner" (or
   any other place a phone gets attached to a new Owner/Unit). This reuses the exact same
   matching rule already enforced at save-time (findOwnerByCanonicalPhone, scoped to the same
   team) — it only adds doing the check AS THE USER TYPES, before any record is created, and
   surfacing full context (who already has this owner, and what units they hold) so the employee
   never has to guess or manually search. Formatting differences (spaces/dashes/local vs
   international) are handled by normalizeEgyptPhone, the same normalizer used everywhere else. */
function findDuplicateOwnerByRawPhone(raw, team){
  if(!raw) return null;
  const digitsOnly = String(raw).replace(/[^0-9]/g,''); // tolerate spaces/dashes typed live, same as the "+"/space-stripping already done on these inputs
  if(!digitsOnly) return null;
  const canonical = normalizeEgyptPhone(digitsOnly);
  if(!canonical) return null; // not (yet) a complete/valid number — no false-positive warning while still typing
  return findOwnerByCanonicalPhone(canonical, team);
}
// Builds the "who already has this owner" context for the duplicate-detection warning, shaped by
// what the VIEWER is permitted to see. Every sales-active, team-assigned person's contact info
// (phone/WhatsApp) is already visible to their whole team via the Reference directory, so showing
// it again here isn't a new exposure — but the manager/team-hierarchy line is limited to the
// record's own owner, admins, and management roles, consistent with "show a limited duplicate
// warning if the user is not permitted to view the full record" in the spec.
function ownerDuplicateContext(owner, viewer){
  const rels = activeOwnerUnitsFor(owner.id);
  const holderId = owner.salespersonId || (rels[0]||{}).salespersonId || null;
  const holder = holderId ? DB.users.find(x=>x.id===holderId) : null;
  const ref = holder ? DB.refs.find(r=>r.userId===holder.id) : null;
  const isSelf = !!(holder && viewer && holder.id===viewer.id);
  const canSeeHierarchy = isSelf || isAdmin(viewer) || isMgmt(viewer);
  const units = rels.map(r=>{
    const un = DB.units.find(x=>x.id===r.unitId);
    if(!un) return null;
    return { unitId: un.id, compound: un.compound, phase: un.phase, unitType: un.unitType, areaSize: un.areaSize, saleRent: un.saleRent, pending: !!un.pending };
  }).filter(Boolean);
  return {
    ownerId: owner.id, ownerName: owner.name, phone: owner.phone, phone2: owner.phone2 || null,
    holderId: holder ? holder.id : null,
    holderName: holder ? holder.name : null,
    holderRefCode: ref ? ref.code : null,
    holderPhone: ref ? ref.phone : null,
    holderWhatsapp: ref ? ref.whatsapp : null,
    holderTeamLabel: (canSeeHierarchy && holder && holder.team) ? (holder.team[0].toUpperCase()+holder.team.slice(1)) : null,
    holderManagerName: (canSeeHierarchy && holder && holder.managerId) ? ((DB.users.find(x=>x.id===holder.managerId)||{}).name || null) : null,
    isSelf,
    heldByOthers: viewer ? ownerHeldByOthers(owner.id, viewer.id) : true,
    isMine: viewer ? salespersonHasOwner(viewer.id, owner.id) : false,
    units
  };
}

/* ---------- Reference dictionary ----------
   The Reference section is a SALESPERSON CONTACT DIRECTORY — not a general project/compound
   reference sheet. Every sales-active person (plain salespeople AND every management role,
   since role never removes personal sales activity) gets an entry with a distinct reference
   code and SEPARATE phone/WhatsApp numbers (they may differ) so the directory can offer real
   one-tap Call / WhatsApp actions.
   DB.refs intentionally stores ONLY the contact-specific fields (code, phone, whatsapp) plus
   `userId`/`team` — never a cached copy of the person's name, role or manager. Those are always
   resolved live from DB.users via refUser()/refManager() below, so an admin renaming a user,
   changing their role, or reassigning their manager can never leave a stale name/role/manager
   behind in the directory — there is nothing here to go stale. */
function buildReferenceDict(users){
  const refs = [];
  users.filter(u=>isSalesActive(u) && u.team).forEach(u=>{
    refs.push({
      id: uid('rf'), team: u.team, userId: u.id,
      code: (u.team==='residential'?'RES-':'COM-')+u.id.toUpperCase(),
      phone: '01'+rndInt(0,2)+rndInt(10000000,99999999),
      whatsapp: '01'+rndInt(0,2)+rndInt(10000000,99999999),
    });
  });
  return refs;
}
function refUser(r){ return DB.users.find(x=>x.id===r.userId) || null; }
function refManager(r){ const u = refUser(r); return u ? DB.users.find(x=>x.id===u.managerId) : null; }

/* ---------- Admin: full sales-user management (Head Admin / Senior Admin) ----------
   Keeps DB.users and the denormalized-free DB.refs directory in sync whenever an admin adds a
   user, changes a role, reassigns a manager, or switches a department — so Reference, My/Team
   data visibility, and every other screen that reads DB.users/DB.refs stay consistent without
   needing their own separate "did this change?" logic. */
const ADMIN_ASSIGNABLE_ROLES = ['salesperson','teamleader','manager','director','headofsales','ceo','junioradmin','senioradmin','headadmin','headhr'];
// Only Senior Admin and Head Admin may manage user accounts, roles and hierarchy — Junior Admin
// stays operational-only (inventory/owners), matching the existing admin tiering.
function canManageUsers(u){ return isAdmin(u) && (u.role==='senioradmin' || u.role==='headadmin'); }
// Ensures DB.refs has exactly one entry for this user if-and-only-if they're currently
// sales-active with a team assigned — creates one (fresh code/phone/whatsapp) if newly
// eligible, removes it if no longer eligible (e.g. moved to an admin role), and otherwise just
// keeps its `team` in sync. Call this after ANY change to a user's role/team.
function syncRefForUser(user){
  const existing = DB.refs.find(r=>r.userId===user.id);
  const eligible = isSalesActive(user) && !!user.team;
  if(eligible){
    if(existing){ existing.team = user.team; }
    else {
      DB.refs.push({
        id: uid('rf'), team: user.team, userId: user.id,
        code: (user.team==='residential'?'RES-':'COM-')+user.id.toUpperCase(),
        phone: '01'+rndInt(0,2)+rndInt(10000000,99999999),
        whatsapp: '01'+rndInt(0,2)+rndInt(10000000,99999999),
      });
    }
  } else if(existing){
    DB.refs = DB.refs.filter(r=>r.id!==existing.id);
  }
}
// Sets a user's official job title. Mirrors the backend's self-escalation guard
// (PATCH /api/users/:id/job-title in na1-backend) — this frontend check is a convenience only,
// consistent with how the rest of this prototype already works (no real server sits behind it);
// the backend route is the actual enforcement. Returns {ok:true} or {ok:false, error}.
function setUserJobTitle(actor, target, newTitle){
  if(!canManageUsers(actor)) return {ok:false, error:'Only Senior Admin or Head Admin can edit job titles'};
  if(actor.id===target.id) return {ok:false, error:'You cannot change your own job title'};
  if(newTitle!==null && !JOB_TITLES.includes(newTitle)) return {ok:false, error:'Invalid job title'};
  target.jobTitle = newTitle;
  target.titleNeedsReview = false;
  log(actor.id, 'user_job_title_changed', {userId:target.id, jobTitle:newTitle});
  persist();
  return {ok:true};
}
// Every role a user COULD report to, i.e. not themselves and not anyone already in their own
// downline (prevents creating a reporting cycle, e.g. assigning your own subordinate as your
// manager). Used to populate the "Reports to" selector sensibly rather than just excluding self.
function possibleManagersFor(userId){
  const down = new Set(getDownlineIds(DB.users, userId));
  return DB.users.filter(x=> x.id!==userId && !down.has(x.id) && x.active!==false);
}

function buildDemoData(){
  _seed = 42;
  const users = buildUsers();
  const units = buildUnits(users);
  const leads = buildLeads(users, units);
  const requestsResidential = buildRequests(users,'residential');
  const requestsCommercial = buildRequests(users,'commercial');
  const { owners, ownerUnits } = buildOwnersAndRelationships(users, units);
  const refs = buildReferenceDict(users);
  // personal read positions: set to roughly 15 requests back from latest, per user, so "unread" is demonstrable
  const readPositions = {};
  users.forEach(u=>{
    const list = u.team==='residential'?requestsResidential:(u.team==='commercial'?requestsCommercial:[]);
    if(list.length) readPositions[u.id] = list[Math.max(0,list.length-1-rndInt(4,14))].id;
  });
  return {
    users, units, leads,
    requests: { residential: requestsResidential, commercial: requestsCommercial },
    readPositions, owners, ownerUnits, transfers: [], refs,
    // Daily Performance Report launches from zero on 2026-11-01 — intentionally empty, no historical import.
    dailyReports: [],
    // Simplified management Daily Report (Daily Comments + Daily Activities) — a separate
    // collection from dailyReports (the full salesperson form), never mixed with it. Also
    // starts empty; one row per management user per date.
    mgmtReports: [],
    // Company-wide Announcements (Head of HR only can create/send — see isHeadHR() and
    // pages/announcements.js). Starts empty; one row per sent announcement, newest first in use.
    announcements: [],
    notifications: [], auditLog: [],
    // version 7: users gained jobTitle/titleNeedsReview (official job titles, this round's PART 1)
    // and announcements gained an `audience` field (recipient targeting, this round's PART 2).
    // version 6: owners/units gained deletedAt/deletedBy (soft delete, Part 1) and units gained
    // updatedAt (set on edit/delete/restore). Additive-only — see loadDB() for the migration note.
    meta: { version: 7 }
  };
}

/* =========================================================
   Daily Performance Report — data model & helpers
   One report per salesperson per calendar date (enforced here by
   getOrCreateDailyReport, which never creates a second row for the
   same salesperson+date — it finds-or-creates, mirroring the DB-level
   UNIQUE(salesperson_id, date) constraint on the backend).
   Exactly 11 required numeric metrics. 0 is a valid value; null means
   "not entered yet" and blocks completion. No historical data before
   the launch date exists or is ever generated.
   ========================================================= */
const DAILY_REPORT_LAUNCH_DATE = '2026-11-01';
const DAILY_REPORT_FIELDS = [
  ['calls','count'], ['calls','active'],
  ['leads','count'],
  ['showings','buyer'], ['showings','seller'],
  ['meetings','buyer'], ['meetings','seller'], ['meetings','developer'],
  ['other','inventory'], ['other','orientation'], ['other','closedDeals']
];
function pad2(n){ return String(n).padStart(2,'0'); }
function dateStr(d){ d=d||new Date(); return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate()); }
// "Today" for Daily Reports is the EGYPT calendar date (Africa/Cairo), not the browser's local
// date, so every user — wherever their device clock/zone is — files against the same business day
// the server uses (see na1-backend/src/utils/clock.js).
function todayStr(){
  try { return new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); }
  catch(e){ return dateStr(new Date()); }
}
function isOnOrAfterLaunch(ds){ return ds >= DAILY_REPORT_LAUNCH_DATE; }
function previousDateStr(ds){
  const [y,m,d] = ds.split('-').map(Number);
  const dt = new Date(y, m-1, d); dt.setDate(dt.getDate()-1);
  return dateStr(dt);
}
function monthKeyOf(ds){ return ds.slice(0,7); } // 'YYYY-MM'
function blankReportFields(){
  return { calls:{count:null,active:null}, leads:{count:null}, showings:{buyer:null,seller:null},
    meetings:{buyer:null,seller:null,developer:null}, other:{inventory:null,orientation:null,closedDeals:null} };
}
function getDailyReport(spId, ds){ return DB.dailyReports.find(r=>r.salespersonId===spId && r.date===ds) || null; }
// Finds the existing report for this salesperson+date, or creates exactly one new row.
// This is the single choke point that guarantees one report per salesperson per date.
function getOrCreateDailyReport(spId, ds){
  let r = getDailyReport(spId, ds);
  if(r) return r;
  // `_draft` marks a blank, NOT-yet-saved view-model row: it has no server record, so for status
  // purposes it counts as "missing" until the first value is actually saved (see reportStatusOf).
  r = { id: uid('dr'), salespersonId: spId, date: ds, status:'in_progress', _draft:true,
    ...blankReportFields(), createdAt: now(), updatedAt: now(), completedAt: null };
  DB.dailyReports.push(r);
  return r;
}
function setReportField(report, section, key, value){
  report[section][key] = value; // value is a Number or null — 0 is stored and treated as present
  report.updatedAt = now();
  if(report.status==='completed' && !isReportComplete(report)) { report.status='in_progress'; report.completedAt=null; }
}
function isFieldFilled(v){ return v!==null && v!==undefined && v!==''; }
function isReportComplete(report){
  return DAILY_REPORT_FIELDS.every(([s,k])=> isFieldFilled(report[s][k]));
}
function completeReport(report){
  if(!isReportComplete(report)) return false;
  report.status = 'completed'; report.completedAt = now(); report.updatedAt = now();
  return true;
}
function reportStatusOf(spId, ds){
  const r = getDailyReport(spId, ds);
  if(!r || r._draft) return 'missing';
  return r.status; // 'in_progress' | 'completed'
}
// Status of a PERSON's own report for a date, routed to the right collection for their role:
// management roles file the simple Comments+Activities report (DB.mgmtReports, 'completed' once
// both fields are non-empty, otherwise 'missing' — there's no partial/"in_progress" state for a
// two-field form), everyone else files the detailed salesperson form (DB.dailyReports, via
// reportStatusOf). Anything that shows a user's OWN "did you file today's report" status
// (dashboard banner, the Daily Reports nav badge) must use this, not reportStatusOf directly —
// calling reportStatusOf for a management user would always read 'missing' since they never
// write to DB.dailyReports at all.
function personalReportStatus(user, ds){
  if(isMgmt(user)){
    const r = getMgmtReport(user.id, ds);
    return (r && r.comments.trim() && r.activities.trim()) ? 'completed' : 'missing';
  }
  return reportStatusOf(user.id, ds);
}
function reportsForMonth(spId, monthKey){
  return DB.dailyReports.filter(r=>r.salespersonId===spId && monthKeyOf(r.date)===monthKey).sort((a,b)=> a.date<b.date?-1:1);
}
// Months are derived purely from existing report dates (plus the current month) — never
// manually created. First possible month is November 2026 (the launch month).
function availableMonthsFor(spId){
  const keys = new Set(DB.dailyReports.filter(r=>r.salespersonId===spId).map(r=>monthKeyOf(r.date)));
  const cur = monthKeyOf(todayStr());
  if(isOnOrAfterLaunch(todayStr())) keys.add(cur);
  return [...keys].filter(k=>k>=monthKeyOf(DAILY_REPORT_LAUNCH_DATE)).sort();
}
function monthLabel(monthKey){
  const [y,m] = monthKey.split('-').map(Number);
  return new Date(y, m-1, 1).toLocaleDateString('en-US',{month:'long',year:'numeric'});
}
const MONTHLY_TOTAL_FIELDS = [
  ['calls','count','Total Calls'], ['calls','active','Total Active Calls'],
  ['leads','count','Total Leads'],
  ['showings','buyer','Total Buyer Showings'], ['showings','seller','Total Seller Showings'],
  ['meetings','buyer','Total Buyer Meetings'], ['meetings','seller','Total Seller Meetings'], ['meetings','developer','Total Developer Meetings'],
  ['other','inventory','Total Inventory'], ['other','orientation','Total Orientation'], ['other','closedDeals','Total Closed Deals']
];
// Totals are always computed live from the daily reports — never hardcoded/stored.
function monthlyTotals(reports){
  const totals = {};
  MONTHLY_TOTAL_FIELDS.forEach(([s,k,label])=>{
    totals[s+'.'+k] = reports.reduce((sum,r)=> sum + (isFieldFilled(r[s][k]) ? Number(r[s][k]) : 0), 0);
  });
  return totals;
}

/* =========================================================
   Management Daily Report — simplified personal report for management roles
   Managers are also salespeople (role never removes personal sales activity), but they are NOT
   required to fill the full 11-metric salesperson form. Each management user instead files a
   short personal report of their own: Daily Comments + Daily Activities (both free text), one
   per date (find-or-create, same one-row-per-person-per-date guarantee as the salesperson
   report). This is a SEPARATE collection (DB.mgmtReports) from DB.dailyReports — never merged,
   never read by the salesperson report UI, and never mixed with a manager's Team Reports view
   (which only ever reads the DOWNLINE's dailyReports, never this collection).
   ========================================================= */
function getMgmtReport(userId, ds){ return DB.mgmtReports.find(r=>r.userId===userId && r.date===ds) || null; }
function getOrCreateMgmtReport(userId, ds){
  let r = getMgmtReport(userId, ds);
  if(r) return r;
  r = { id: uid('mr'), userId, date: ds, comments:'', activities:'', createdAt: now(), updatedAt: now() };
  DB.mgmtReports.push(r);
  return r;
}
function saveMgmtReport(report, comments, activities){
  report.comments = comments; report.activities = activities; report.updatedAt = now();
}
function mgmtReportsForUser(userId){
  return DB.mgmtReports.filter(r=>r.userId===userId).sort((a,b)=> a.date<b.date?1:-1);
}

/* =========================================================
   Company Announcements (Head of HR only — see isHeadHR())
   A simple, HR-authored broadcast: title + free-text message. Sending one creates exactly one
   DB.announcements row and, using the EXISTING notification system (notify(), DB.notifications —
   the same mechanism every other notification in this app already uses, not a new or simulated
   delivery layer), one real in-app notification for every other employee. notify()'s existing
   `key` de-duplication guarantees each employee gets exactly one notification per announcement,
   even if sendAnnouncement were ever called twice for the same id. Employees read the full
   message by clicking that notification (see notifications.js + pages/announcements.js), and a
   full send history is kept in DB.announcements for the Head of HR to review at any time.
   ========================================================= */
function announcementsHistory(){
  return DB.announcements.slice().sort((a,b)=> b.at-a.at);
}
function getAnnouncement(id){
  return DB.announcements.find(a=>a.id===id) || null;
}
/* ---------- Recipient targeting (PART 2 — HR Announcement Recipient Selection) ----------
   `audience` shape: {type:'everyone'} | {type:'job_titles', jobTitles:[...]} |
   {type:'team', team:'residential'|'commercial'} | {type:'employees', employeeIds:[...]}.
   computeAnnouncementRecipients ALWAYS resolves against the live DB.users — never against a
   list the composer UI might pass in directly — so the exact same criteria re-evaluated later
   (e.g. for a dry-run summary) always reflects the real, current directory. The sender
   themselves is never included (matches the previous "sent to all employees" behavior, which
   also excluded the sender). Recipients are deduplicated automatically since this returns a
   Set-backed list even when a user could match more than one criterion (not reachable today
   since each announcement has exactly one audience type, but kept safe for future combining). */
function computeAnnouncementRecipients(audience, authorId){
  const a = audience || {type:'everyone'};
  let pool;
  if(a.type==='everyone'){
    pool = DB.users.slice();
  } else if(a.type==='job_titles'){
    const titles = (a.jobTitles||[]).filter(t=>JOB_TITLES.includes(t));
    pool = DB.users.filter(u=>titles.includes(u.jobTitle));
  } else if(a.type==='team'){
    pool = DB.users.filter(u=>u.team===a.team);
  } else if(a.type==='employees'){
    const ids = new Set(a.employeeIds||[]);
    pool = DB.users.filter(u=>ids.has(u.id));
  } else {
    pool = [];
  }
  const seen = new Set();
  const out = [];
  pool.forEach(u=>{ if(u.id!==authorId && !seen.has(u.id)){ seen.add(u.id); out.push(u); } });
  return out;
}
// Human-readable one-line summary of an audience, used in the compose confirmation dialog and
// in the Head of HR's sent-history list (e.g. "2 job titles selected", "Everyone").
function audienceSummaryLabel(audience){
  const a = audience || {type:'everyone'};
  if(a.type==='everyone') return 'Everyone';
  if(a.type==='job_titles') return (a.jobTitles||[]).length+' job title'+((a.jobTitles||[]).length===1?'':'s')+' selected';
  if(a.type==='team') return (a.team==='residential'?'Residential':'Commercial')+' team selected';
  if(a.type==='employees') return (a.employeeIds||[]).length+' employee'+((a.employeeIds||[]).length===1?'':'s')+' selected';
  return 'Unknown audience';
}
// Is this user one of the resolved recipients of this already-sent announcement? Recipients are
// recomputed live from the STORED audience criteria (not a frozen id list) so this stays correct
// even for old data — see migrateV6toV7, which backfills audience:{type:'everyone'} on every
// announcement sent before this round, matching their actual historical behavior exactly.
function isAnnouncementRecipient(announcement, userId){
  if(announcement.byId===userId) return true; // the sender can always re-open their own sends
  return computeAnnouncementRecipients(announcement.audience, announcement.byId).some(u=>u.id===userId);
}
// Announcements a given user is allowed to see: Head of HR sees everything they sent (their own
// full history); everyone else sees only announcements whose resolved audience includes them.
// This mirrors the backend's enforced GET /api/announcements behavior (routes/announcements.js)
// so the frontend demo layer cannot show more than the real API would ever return.
function visibleAnnouncementsFor(u){
  // The server already returns ONLY what this user may see (HR: their own sends; everyone else:
  // announcements addressed to them), so there is no client-side filtering to get wrong.
  return announcementsHistory();
}
// Sends an announcement to a SPECIFIC, resolved audience AND the real notifications that go with
// it, in one atomic step — there is no "sent" state that isn't backed by both the announcement
// record and an actual notification per resolved recipient; this app has no separate server to
// fail independently of the local persistence both already share (persist()), so there is
// nothing here that could report success while silently not delivering.
// Recipients are frozen as a NOTIFICATION list at send time (each recipient gets exactly one
// notify() call, deduped by key same as every other notification type), but the announcement's
// VISIBILITY (who can open/read it later, via isAnnouncementRecipient above) recomputes the
// audience criteria live. In this demo data model audience criteria are immutable after send —
// there is no "edit recipients" action — so the two always agree in practice; this matches the
// backend's design choice (see routes/announcements.js) of never changing recipients after
// publish, which avoids ever silently exposing a restricted announcement to a new employee or
// silently revoking it from someone already notified.
// Publishing now goes through the server (publishAnnouncementOnServer in sync.js): the server
// resolves the real recipients, stores the announcement and creates one notification per
// recipient in a single transaction. The old browser-side implementation was removed.
function sendAnnouncement(){ throw new Error('Announcements are published by the server — use publishAnnouncementOnServer()'); }

// Migration v5 -> v6: adds owners.deletedAt/deletedBy and units.deletedAt/deletedBy/updatedAt
// (Part 1 — soft delete). This is an IN-PLACE, additive-only migration: every existing owner
// and unit is kept exactly as-is, only missing fields are filled in with their "not deleted"
// default — nothing is dropped, regenerated, or reordered, so any data already saved in this
// browser (including anything a user created in a prior session) survives the upgrade.
function migrateV5toV6(parsed){
  (parsed.owners||[]).forEach(o=>{
    if(!('deletedAt' in o)) o.deletedAt = null;
    if(!('deletedBy' in o)) o.deletedBy = null;
  });
  (parsed.units||[]).forEach(x=>{
    if(!('deletedAt' in x)) x.deletedAt = null;
    if(!('deletedBy' in x)) x.deletedBy = null;
    if(!('updatedAt' in x)) x.updatedAt = x.createdAt || now();
  });
  parsed.meta.version = 6;
  return parsed;
}
// Migration v6 -> v7: adds users.jobTitle/titleNeedsReview (PART 1 — official job titles) and
// announcements.audience (PART 2 — recipient targeting). Additive-only and in-place, same
// guarantee as v5->v6: every existing user and announcement is kept exactly as-is, only the new
// fields are filled in with a value equivalent to their actual prior behavior.
//   - Users: role is mapped to the matching official title wherever that mapping is unambiguous
//     (teamleader/manager/director/headofsales/ceo); role:'salesperson' accounts get a default
//     (alternating Junior/Senior Sales, deterministic by id so a given saved user always lands
//     on the same default) and are flagged titleNeedsReview so an admin confirms/corrects via
//     the Admin > Title review screen, never silently treated as final — identical policy to
//     buildUsers() above for brand-new demo data. Admin-only accounts (junior/senior/head admin)
//     and Head of HR are left with jobTitle:null (they hold no sales job title).
//   - Announcements: every announcement sent before this round WAS, in fact, sent to all
//     employees (the only behavior that existed), so audience:{type:'everyone'} here is not a
//     guess — it is the historically accurate record of what already happened.
function migrateTitlesV6toV7(parsed){
  (parsed.users||[]).forEach(u=>{
    if('jobTitle' in u) return; // already migrated
    if(u.role==='ceo') { u.jobTitle='CEO'; u.titleNeedsReview=false; }
    else if(u.role==='headofsales') { u.jobTitle='Head of Sales'; u.titleNeedsReview=false; }
    else if(u.role==='director') { u.jobTitle='Director'; u.titleNeedsReview=false; }
    else if(u.role==='manager') { u.jobTitle='Sales Manager'; u.titleNeedsReview=false; }
    else if(u.role==='teamleader') { u.jobTitle='Team Leader'; u.titleNeedsReview=false; }
    else if(u.role==='salesperson'){
      // deterministic alternation by id so this default is stable across repeated migrations
      let h=0; for(const c of u.id) h=(h*31+c.charCodeAt(0))>>>0;
      u.jobTitle = (h%2===0) ? 'Junior Sales' : 'Senior Sales';
      u.titleNeedsReview = true;
    } else {
      u.jobTitle = null; u.titleNeedsReview = false; // admin / Head of HR accounts
    }
  });
  (parsed.announcements||[]).forEach(a=>{
    if(!('audience' in a)) a.audience = {type:'everyone'};
    if(!('recipientCount' in a)) a.recipientCount = (parsed.users||[]).filter(u=>u.id!==a.byId).length;
  });
  parsed.meta.version = 7;
  return parsed;
}
function loadDB(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){
      const parsed = JSON.parse(raw);
      if(parsed && parsed.meta && parsed.meta.version===7) return parsed;
      if(parsed && parsed.meta && parsed.meta.version===6){
        const migrated = migrateTitlesV6toV7(parsed);
        saveDB(migrated);
        return migrated;
      }
      if(parsed && parsed.meta && parsed.meta.version===5){
        const migratedV6 = migrateV5toV6(parsed);
        const migrated = migrateTitlesV6toV7(migratedV6);
        saveDB(migrated);
        return migrated;
      }
    }
  }catch(e){ console.warn('load failed', e); }
  // Any other/older version (or no saved data yet) — Version 1 (bare owner "units" count, no
  // Daily Report module, no owner/unit relationship model) predates a structural change too
  // large to migrate field-by-field, so demo data is regenerated rather than migrated, since it
  // is seeded/demo data only, not real production records. v5 -> v6 (above) is a real migration
  // because the v5 shape is otherwise still fully compatible.
  const fresh = buildDemoData();
  saveDB(fresh);
  return fresh;
}
// Collections whose source of truth is the BACKEND DATABASE (Owners, Units, Owner transfers/claims,
// Daily Reports). They are held in memory only: never written to localStorage (so owners' phone
// numbers and report data do not linger in the browser after logout / on shared devices), and
// emptied at page load so neither stale cached copies nor the built-in demo dataset can ever be
// shown as if they were real. They are filled by js/sync.js after a verified login; if the server
// cannot be reached the screens stay empty and an error is shown — there is NO silent fallback.
const SERVER_OWNED_KEYS = ['owners','ownerUnits','units','transfers','dailyReports','mgmtReports','refs','notifications','announcements','auditLog'];
function withoutServerOwned(db){
  const copy = Object.assign({}, db);
  SERVER_OWNED_KEYS.forEach(k=>{ copy[k] = []; });
  copy.requests = { residential: [], commercial: [] }; copy.readPositions = {}; copy.requestRead = {}; copy.requestUnread = {}; copy.notifUnread = 0;
  copy.users = buildUsers(); // the real directory is server-owned: only the built-in demo roster is ever stored locally
  delete copy._usersHydrated;
  delete copy.ownerCap; delete copy._ownersHydrated; delete copy._ownersHydratedTeam; delete copy._teamSummary;
  return copy;
}
function saveDB(db){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(withoutServerOwned(db))); }catch(e){ console.warn('save failed', e); }
}

let DB = loadDB();
// Requests are server-owned too (object-shaped, so reset separately): the feed, each user's read
// position and the unread counts all come from the server after sign-in.
function resetServerOwned(){
  SERVER_OWNED_KEYS.forEach(k=>{ DB[k] = []; });
  DB.requests = { residential: [], commercial: [] };
  DB.readPositions = {};                  // legacy demo field, unused
  DB.notifUnread = 0;
  DB.requestRead = {}; DB.requestUnread = {};   // per team: last-read request id / unread count
}
resetServerOwned();
function persist(){ saveDB(DB); }

function log(actor, action, details){
  DB.auditLog.unshift({id:uid('log'), actor, action, details, at: now()});
}
function notify(userId, type, text, link, key, meta){
  if(key && DB.notifications.some(n=>n.userId===userId && n.key===key)) return;
  DB.notifications.unshift({id:uid('n'), userId, type, text, link, read:false, at: now(), key, meta: meta||null});
}
// Notifications are generated and stored by the SERVER (owner-refresh reminders, missing Daily
// Report, admin approvals, transfers…). The browser no longer creates, stores or de-duplicates
// them: it only fetches them (hydrateNotificationsFromServer in sync.js). Kept as a no-op so the
// existing render() call site is unchanged.
function syncNotifications(u){ /* server-owned — see sync.js */ }

