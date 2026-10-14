/* =========================================================
   INVENTORY / NEWS FEED
   ========================================================= */
function deliveryLabel(y){ return y===0?'Immediate': y===1?'Within 1 year': y+' years'; }
function deliveryBucket(y){ return y===0?'Immediate': y<=1?'1y': y<=2?'2y':'4y'; }

// Bedroom/bathroom "N or more" buckets: the top option in each list (6 bedrooms, 5 bathrooms)
// means "N or more", not exactly N — so the filter isn't artificially capped below whatever the
// underlying unit data actually supports (buildUnits() can generate up to 5 bedrooms / 5 bathrooms).
function matchesCountFilter(selected, value, maxExactOption){
  if(!selected.length) return true;
  return selected.some(s=>{
    if(s.endsWith('+')) return value >= Number(s.slice(0,-1));
    return String(value)===s;
  });
}
// The filtered + sorted News Feed list (shared by the full page render and the live results
// refresh used while typing, so both always agree).
function inventoryFilteredList(u){
  const tk = myTeamKey(u);
  const f = session.invFilters;
  let list = DB.units.filter(x=>x.team===tk && !x.deletedAt);
  if(session.invSearch){
    const q = session.invSearch.toLowerCase();
    list = list.filter(x=> (x.compound+x.developer+x.area).toLowerCase().includes(q));
  }
  if(f.bedrooms.length) list = list.filter(x=> matchesCountFilter(f.bedrooms, x.bedrooms));
  if(f.bathrooms.length) list = list.filter(x=> matchesCountFilter(f.bathrooms, x.bathrooms));
  if(f.unitType.length) list = list.filter(x=> f.unitType.includes(x.unitType));
  if(f.finishing.length) list = list.filter(x=> f.finishing.includes(x.finishing));
  if(f.saleRent.length) list = list.filter(x=> f.saleRent.includes(x.saleRent));
  if(f.delivery.length) list = list.filter(x=> f.delivery.includes(deliveryBucket(x.deliveryYears)));
  const r = inventoryPriceRange();
  if(r.dpMin!=null) list = list.filter(x=> x.downPayment>=r.dpMin);
  if(r.dpMax!=null) list = list.filter(x=> x.downPayment<=r.dpMax);
  if(r.totalMin!=null) list = list.filter(x=> x.totalPrice>=r.totalMin);
  if(r.totalMax!=null) list = list.filter(x=> x.totalPrice<=r.totalMax);

  if(session.invSort==='popularity') list = list.slice().sort((a,b)=>popularityScore(b)-popularityScore(a));
  else if(session.invSort==='newest') list = list.slice().sort((a,b)=>b.createdAt-a.createdAt);
  else list = list.slice().sort((a,b)=>a.createdAt-b.createdAt);
  return list;
}
function inventoryPriceRange(){
  const f = session.invFilters;
  const num = (v)=> (v!=='' && v!=null && !isNaN(Number(v))) ? Number(v) : null;
  return { dpMin:num(f.dpMin), dpMax:num(f.dpMax), totalMin:num(f.totalMin), totalMax:num(f.totalMax) };
}
function inventoryActiveFilterCount(){
  const f = session.invFilters, r = inventoryPriceRange();
  return f.bedrooms.length+f.bathrooms.length+f.unitType.length+f.finishing.length+f.saleRent.length+f.delivery.length
    + (r.dpMin!=null||r.dpMax!=null?1:0) + (r.totalMin!=null||r.totalMax!=null?1:0);
}
function inventoryFiltersBtnHTML(n){ return `${ic('search')} Filters${n>0?` <span class="badge badge-brand" style="margin-left:2px;">${n}</span>`:''}`; }
function inventoryCountText(n){ return `${n} unit${n===1?'':'s'} found`; }
function inventoryResultsHTML(list, activeFilterCount){
  if(!list.length) return `<div class="empty-state card">${ic('inventory')}<div>No units match these filters.</div>${activeFilterCount>0?`<button class="btn btn-sm" id="emptyClearFiltersBtn" style="margin-top:10px;">Reset all filters</button>`:''}</div>`;
  return unitCollectionHTML(list, un=> unitViewMode()==='list' ? unitRow(un) : unitCard(un));
}
function renderInventoryPage(u){
  const tk = myTeamKey(u);
  const unitTypes = tk==='residential'?UNIT_TYPES_RES:UNIT_TYPES_COM;
  const f = session.invFilters;
  const list = inventoryFilteredList(u);

  // "6 bedrooms or more" / "5 bathrooms or more" — not an artificial cap, just the highest
  // bucket; matchesCountFilter() treats the "+"-suffixed option as "this many or more".
  const bedroomOpts = tk==='residential' ? [['0','Studio'],['1','1'],['2','2'],['3','3'],['4','4'],['5','5'],['6+','6 or more']] : [];
  const bathroomOpts = [['1','1'],['2','2'],['3','3'],['4','4'],['5+','5 or more']];

  const activeFilterCount = inventoryActiveFilterCount();

  return `
  <div style="display:flex; gap:10px; margin-bottom:14px; flex-wrap:wrap; align-items:center;">
    <div style="position:relative; flex:1; min-width:200px;">
      <input id="invSearch" type="search" placeholder="Search compound, developer, or area…" value="${esc(session.invSearch)}" autocomplete="off" aria-label="Search the News Feed">
    </div>
    <select id="invSort" style="width:auto;" aria-label="Sort units">
      <option value="popularity" ${session.invSort==='popularity'?'selected':''}>Sort: Popularity</option>
      <option value="newest" ${session.invSort==='newest'?'selected':''}>Sort: Newest</option>
      <option value="oldest" ${session.invSort==='oldest'?'selected':''}>Sort: Oldest</option>
    </select>
    <button class="btn btn-sm" id="toggleFiltersBtn" aria-expanded="${session._showFilters?'true':'false'}">${inventoryFiltersBtnHTML(activeFilterCount)}</button>
  </div>
  <div id="filterPanel" class="card card-pad filter-panel" style="display:${session._showFilters?'block':'none'}; margin-bottom:14px;">
    <div class="filter-section-label">Price</div>
    <div class="filter-range-row">
      <div class="field" style="margin-bottom:0;"><label class="field-label" for="dpMin">Down payment — min (EGP)</label><input type="number" min="0" inputmode="numeric" id="dpMin" placeholder="e.g. 2,000,000" value="${esc(f.dpMin)}"></div>
      <div class="field" style="margin-bottom:0;"><label class="field-label" for="dpMax">Down payment — max (EGP)</label><input type="number" min="0" inputmode="numeric" id="dpMax" placeholder="e.g. 3,000,000" value="${esc(f.dpMax)}"></div>
    </div>
    <div class="filter-range-row" style="margin-top:10px; margin-bottom:16px;">
      <div class="field" style="margin-bottom:0;"><label class="field-label" for="totalMin">Total price — min (EGP)</label><input type="number" min="0" inputmode="numeric" id="totalMin" placeholder="e.g. 8,000,000" value="${esc(f.totalMin)}"></div>
      <div class="field" style="margin-bottom:0;"><label class="field-label" for="totalMax">Total price — max (EGP)</label><input type="number" min="0" inputmode="numeric" id="totalMax" placeholder="e.g. 12,000,000" value="${esc(f.totalMax)}"></div>
    </div>
    ${bedroomOpts.length?filterGroup('Bedrooms','bedrooms',bedroomOpts,f.bedrooms):''}
    ${filterGroup('Bathrooms','bathrooms',bathroomOpts,f.bathrooms)}
    ${filterGroup('Unit type','unitType',unitTypes.map(t=>[t,t]),f.unitType)}
    ${filterGroup('Finishing','finishing',FINISHING.map(t=>[t,t]),f.finishing)}
    ${filterGroup('Sale / Rent','saleRent',[['Sale','Sale'],['Rent','Rent']],f.saleRent)}
    ${filterGroup('Delivery','delivery',[['Immediate','Immediate'],['1y','Within 1 year'],['2y','Within 2 years'],['4y','2+ years']],f.delivery)}
    <button class="btn btn-ghost btn-sm" id="clearFiltersBtn" ${activeFilterCount===0?'disabled':''}>${ic('x')} Reset all filters</button>
  </div>
  <div class="results-bar">
    <div class="section-sub" id="invCount" aria-live="polite">${inventoryCountText(list.length)}</div>
    ${unitViewSwitcherHTML()}
  </div>
  <div id="invResults">${inventoryResultsHTML(list, activeFilterCount)}</div>`;
}
// Live refresh while typing / switching view: replaces ONLY the results (count, cards, filter
// badge). The search box and filter inputs are never re-created, so they keep focus, caret and
// the on-screen keyboard while the list updates.
function refreshInventoryResults(u){
  const list = inventoryFilteredList(u), n = inventoryActiveFilterCount();
  const res = document.getElementById('invResults'); if(!res) return;
  res.innerHTML = inventoryResultsHTML(list, n);
  const cnt = document.getElementById('invCount'); if(cnt) cnt.textContent = inventoryCountText(list.length);
  const tf = document.getElementById('toggleFiltersBtn'); if(tf) tf.innerHTML = inventoryFiltersBtnHTML(n);
  const cf = document.getElementById('clearFiltersBtn'); if(cf) cf.disabled = n===0;
  syncUnitViewSwitcher();
  bindInventoryResults(u);
}
function bindInventoryResults(u){
  const res = document.getElementById('invResults'); if(!res) return;
  res.querySelectorAll('.unit-card').forEach(el=> el.addEventListener('click', ()=> openUnitModal(el.dataset.unit, u)));
  const ecf = document.getElementById('emptyClearFiltersBtn');
  if(ecf) ecf.addEventListener('click', ()=>{ session.invFilters = blankInvFilters(); renderPageInto(u); });
}

/* ---------- Grid / List view (News Feed and My Units share one remembered choice) ---------- */
function unitViewMode(){
  if(!session.unitView) session.unitView = uiPrefGet('unitView') === 'list' ? 'list' : 'grid';
  return session.unitView;
}
function setUnitViewMode(v){
  session.unitView = v==='list' ? 'list' : 'grid';
  uiPrefSet('unitView', session.unitView);   // display preference only (see uiPrefSet in shell.js)
}
function unitViewSwitcherHTML(){
  const m = unitViewMode();
  return `<div class="view-switch" role="group" aria-label="Choose how units are shown">
    <button type="button" class="${m==='grid'?'on':''}" data-unitview="grid" aria-pressed="${m==='grid'}" title="Grid view">${ic('viewgrid')}<span>Grid</span></button>
    <button type="button" class="${m==='list'?'on':''}" data-unitview="list" aria-pressed="${m==='list'}" title="List view">${ic('viewlist')}<span>List</span></button>
  </div>`;
}
function syncUnitViewSwitcher(){
  const m = unitViewMode();
  document.querySelectorAll('[data-unitview]').forEach(b=>{ const on = b.dataset.unitview===m; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
}
function bindUnitViewSwitcher(onChange){
  document.querySelectorAll('[data-unitview]').forEach(b=> b.addEventListener('click', ()=>{
    if(b.dataset.unitview===unitViewMode()) return;
    setUnitViewMode(b.dataset.unitview); onChange();
  }));
}
function unitCollectionHTML(list, renderItem){
  return unitViewMode()==='list'
    ? `<div class="unit-list" id="unitGrid">${list.map(renderItem).join('')}</div>`
    : `<div class="grid-3" id="unitGrid">${list.map(renderItem).join('')}</div>`;
}
// List-view row: the same unit, same data and same click-to-open behaviour as unitCard(),
// laid out as one compact row (photo · details · price).
function unitRow(un){
  return `<div class="card unit-card unit-row" data-unit="${un.id}">
    ${(un.photoIds&&un.photoIds.length)
      ? `<div class="scrim-photo uc-photo ur-photo uc-photo-real"><img data-photo-id="${un.photoIds[0]}" data-photo-size="thumb" alt="${esc(un.compound)}"></div>`
      : `<div class="scrim-photo uc-photo ur-photo">${un.photos} photos</div>`}
    <div class="ur-main">
      <div class="uc-toprow"><div class="uc-title">${esc(un.compound)}</div>${un.pending?'<span class="badge badge-pending">Pending</span>':''}</div>
      <div class="uc-subline">${esc(un.unitType)} · ${esc(un.area)} · ${un.saleRent} · ${esc(deliveryLabel(un.deliveryYears))}</div>
      <div class="uc-specs">
        ${un.bedrooms!=null?`<span>${ic('bed')} ${un.bedrooms}</span>`:''}
        <span>${ic('bath')} ${un.bathrooms}</span>
        <span>${ic('area')} ${un.areaSize}m²</span>
        ${un.garden?`<span>🌿 ${un.garden}m²</span>`:''}
      </div>
    </div>
    <div class="ur-price">
      <div class="uc-pricelabel">Total price</div>
      <div class="ur-total">${fmtMoney(un.totalPrice)}</div>
      <div class="ur-dp">DP ${fmtMoney(un.downPayment)} · ${un.remainingInstallments} mo</div>
    </div>
  </div>`;
}
function filterGroup(label, key, opts, selected){
  return `<div class="filter-group"><div class="field-label" style="margin-bottom:7px; display:flex; align-items:center; justify-content:space-between;">
      <span>${label}</span>${selected.length?`<button class="filter-clear-one" data-filter-clear="${key}">Clear</button>`:''}
    </div>
    <div style="display:flex; gap:6px; flex-wrap:wrap;">
    ${opts.map(([val,text])=>`<button class="chip-select ${selected.includes(val)?'on':''}" data-filter-key="${key}" data-filter-val="${val}">${text}</button>`).join('')}
    </div></div>`;
}
// Markup uses dedicated uc-* classes (instead of inline styles) specifically so Part 7's mobile
// compacting can be done entirely in CSS (see .unit-card / .uc-* rules in css/styles.css) —
// inline styles can't be overridden by a media query. Desktop appearance is unchanged; only the
// mobile breakpoints shrink photo height, padding and font sizes so more units fit with less
// scrolling, without dropping any field.
function unitCard(un){
  const sp = DB.users.find(x=>x.id===un.ownerSalespersonId);
  return `<div class="card unit-card" data-unit="${un.id}">
    ${(un.photoIds&&un.photoIds.length)
      ? `<div class="scrim-photo uc-photo uc-photo-real"><img data-photo-id="${un.photoIds[0]}" data-photo-size="thumb" alt="${esc(un.compound)}"><span class="uc-photo-count">${ic('area')} ${un.photoIds.length}</span></div>`
      : `<div class="scrim-photo uc-photo">${un.photos} photos</div>`}
    <div class="card-pad uc-body">
      <div class="uc-toprow">
        <div class="uc-title">${esc(un.compound)}</div>
        ${un.pending?'<span class="badge badge-pending">Pending</span>':''}
      </div>
      <div class="uc-subline">${esc(un.unitType)} · ${esc(un.area)} · ${un.saleRent}</div>
      <div class="uc-specs">
        ${un.bedrooms!=null?`<span>${ic('bed')} ${un.bedrooms}</span>`:''}
        <span>${ic('bath')} ${un.bathrooms}</span>
        <span>${ic('area')} ${un.areaSize}m²</span>
        ${un.garden?`<span>🌿 ${un.garden}m²</span>`:''}
      </div>
      <div class="divider uc-divider"></div>
      <div class="uc-pricegrid">
        <div><div class="uc-pricelabel">Down payment</div><div class="uc-priceval">${fmtMoney(un.downPayment)}</div></div>
        <div><div class="uc-pricelabel">Total price</div><div class="uc-priceval">${fmtMoney(un.totalPrice)}</div></div>
        <div><div class="uc-pricelabel">Remaining</div><div class="uc-pricesub">${fmtMoney(un.remainingAmount)}</div></div>
        <div><div class="uc-pricelabel">Installments</div><div class="uc-pricesub">${un.remainingInstallments} mo</div></div>
      </div>
    </div>
  </div>`;
}
AFTER_RENDER.inventory = function(u){
  // Typing in the search box or the price filters only refreshes the results (see
  // refreshInventoryResults) — the inputs themselves are never re-created, so focus, caret,
  // paste and the mobile keyboard all keep working while the list filters live.
  const s = document.getElementById('invSearch'); if(s) s.addEventListener('input', ()=>{ session.invSearch = s.value; refreshInventoryResults(u); });
  const so = document.getElementById('invSort'); if(so) so.addEventListener('change', ()=>{ session.invSort = so.value; refreshInventoryResults(u); });
  const tf = document.getElementById('toggleFiltersBtn'); if(tf) tf.addEventListener('click', ()=>{
    session._showFilters = !session._showFilters;
    const fp = document.getElementById('filterPanel'); if(fp) fp.setAttribute('style', `display:${session._showFilters?'block':'none'}; margin-bottom:14px;`);  // same text as the markup (the desktop CSS keys off it)
    tf.setAttribute('aria-expanded', String(!!session._showFilters));
  });
  const cf = document.getElementById('clearFiltersBtn'); if(cf) cf.addEventListener('click', ()=>{ session.invFilters = blankInvFilters(); renderPageInto(u); });
  document.querySelectorAll('[data-filter-key]').forEach(b=> b.addEventListener('click', ()=>{
    const k = b.dataset.filterKey, v = b.dataset.filterVal;
    const arr = session.invFilters[k];
    const i = arr.indexOf(v);
    if(i>=0) arr.splice(i,1); else arr.push(v);
    renderPageInto(u);
  }));
  document.querySelectorAll('[data-filter-clear]').forEach(b=> b.addEventListener('click', (e)=>{
    e.stopPropagation();
    session.invFilters[b.dataset.filterClear] = [];
    renderPageInto(u);
  }));
  // Price range fields apply live while typing (results only — the panel is not re-drawn).
  ['dpMin','dpMax','totalMin','totalMax'].forEach(id=>{
    const el = document.getElementById(id);
    if(el){
      el.addEventListener('input', ()=>{ session.invFilters[id] = el.value; refreshInventoryResults(u); });
      el.addEventListener('keydown', (e)=>{ if(e.key==='Enter') el.blur(); });
    }
  });
  bindUnitViewSwitcher(()=> refreshInventoryResults(u));
  bindInventoryResults(u);
};

// Interactions are recorded by the backend (unique per unit+user+type, so repeat clicks add no
// extra weight). The local array is updated optimistically ONLY for instant UI feedback; a failure
// is logged, never hidden. Popularity is re-read from the server on the next hydration.
const _INTERACTION_API_TYPE = { views:'view', calls:'call', whatsapps:'whatsapp', pdfs:'pdf' };
function recordInteraction(un, u, type){
  const arr = un[type];
  if(arr.includes(u.id)) return; // unique-user dedup prevents self-manipulation
  arr.push(u.id);
  NA1_API.post('/units/'+encodeURIComponent(un.id)+'/interactions', { type: _INTERACTION_API_TYPE[type], team: un.team })
    .catch(e=> console.warn('Could not record unit interaction on the server', e));
}
function openUnitModal(unitId, u){
  const un = DB.units.find(x=>x.id===unitId);
  if(!un || un.deletedAt){ toast('This unit is no longer available.'); return; }
  const sp = DB.users.find(x=>x.id===un.ownerSalespersonId);
  const spRef = sp ? DB.refs.find(r=>r.userId===sp.id) : null;
  recordInteraction(un, u, 'views');
  openModal(`
    <div class="modal-head">
      <div><div style="font-weight:800; font-size:16px;">${esc(un.compound)} — ${esc(un.unitType)}</div><div style="font-size:11.5px; color:var(--text-faint);">${esc(un.area)}, ${esc(un.city)} · ${esc(un.phase)}</div></div>
      <button class="close-x" id="modalCloseX">${ic('x')}</button>
    </div>
    <div class="modal-body">
      <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:6px; margin-bottom:14px;">
        ${(un.photoIds&&un.photoIds.length)
          ? un.photoIds.map((id,i)=>`<div class="scrim-photo gal-thumb" data-galidx="${i}" role="button" tabindex="0" aria-label="Open photo ${i+1}"><img data-photo-id="${id}" data-photo-size="thumb" alt="Photo ${i+1}"></div>`).join('')
          : Array.from({length:Math.min(un.photos,6)}).map((_,i)=>`<div class="scrim-photo">Photo ${i+1}</div>`).join('')}
      </div>
      ${un.pending?'<div class="badge badge-pending" style="margin-bottom:10px;">Pending admin review</div>':''}
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px;">
        <div class="card card-pad"><div class="field-label">Down payment</div><div style="font-weight:800; font-size:15px;">${fmtMoney(un.downPayment)}</div></div>
        <div class="card card-pad"><div class="field-label">Total price</div><div style="font-weight:800; font-size:15px;">${fmtMoney(un.totalPrice)}</div></div>
        <div class="card card-pad"><div class="field-label">Remaining amount</div><div style="font-weight:700;">${fmtMoney(un.remainingAmount)}</div></div>
        <div class="card card-pad"><div class="field-label">Remaining installments</div><div style="font-weight:700;">${un.remainingInstallments} months</div></div>
      </div>
      <table style="margin-bottom:6px;">
        <tr><td>Developer</td><td style="text-align:right; font-weight:700;">${esc(un.developer)}</td></tr>
        <tr><td>Sale / Rent</td><td style="text-align:right; font-weight:700;">${un.saleRent}</td></tr>
        ${un.bedrooms!=null?`<tr><td>Bedrooms</td><td style="text-align:right; font-weight:700;">${un.bedrooms}</td></tr>`:''}
        <tr><td>Bathrooms</td><td style="text-align:right; font-weight:700;">${un.bathrooms}</td></tr>
        <tr><td>Area size</td><td style="text-align:right; font-weight:700;">${un.areaSize} m²</td></tr>
        ${un.garden?`<tr><td>Garden</td><td style="text-align:right; font-weight:700;">${un.garden} m²</td></tr>`:''}
        ${un.roof?`<tr><td>Roof</td><td style="text-align:right; font-weight:700;">${un.roof} m²</td></tr>`:''}
        <tr><td>Finishing</td><td style="text-align:right; font-weight:700;">${un.finishing}</td></tr>
        <tr><td>Furnished</td><td style="text-align:right; font-weight:700;">${un.furnished?'Yes':'No'}</td></tr>
        <tr><td>Delivery</td><td style="text-align:right; font-weight:700;">${deliveryLabel(un.deliveryYears)}</td></tr>
        <tr><td>Extra fees</td><td style="text-align:right; font-weight:700;">${fmtMoney(un.extraFees)}</td></tr>
        <tr><td>Represented by</td><td style="text-align:right; font-weight:700;">${esc(sp?sp.name:'—')}</td></tr>
      </table>
    </div>
    <div class="modal-foot">
      <a class="btn btn-sm btn-wa" href="${spRef?waHref(spRef.whatsapp):'#'}" target="_blank" rel="noopener" id="unitWaBtn">${ic('whatsapp')} WhatsApp</a>
      <a class="btn btn-sm btn-call" href="${spRef?telHref(spRef.phone):'#'}" id="unitCallBtn">${ic('phone')} Call</a>
      <button class="btn btn-primary btn-sm" id="unitPdfBtn">${ic('pdf')} Create PDF</button>
    </div>`);
  document.getElementById('modalCloseX').addEventListener('click', closeModal);
  if(!spRef){
    ['unitWaBtn','unitCallBtn'].forEach(id=>{ const el=document.getElementById(id); el.setAttribute('aria-disabled','true'); el.style.opacity='.5'; el.addEventListener('click', e=>{ e.preventDefault(); e.stopImmediatePropagation(); toast('No contact details on file for this representative'); }); });
  }
  document.getElementById('unitWaBtn').addEventListener('click', ()=>{ recordInteraction(un,u,'whatsapps'); toast('Opening WhatsApp chat with '+(sp?sp.name:'agent')+'…'); });
  document.getElementById('unitCallBtn').addEventListener('click', ()=>{ recordInteraction(un,u,'calls'); toast('Dialing '+(sp?sp.name:'agent')+'…'); });
  document.querySelectorAll('.gal-thumb').forEach(el=>{ const open=()=>openPhotoViewer(un.photoIds, Number(el.dataset.galidx)); el.addEventListener('click', open); el.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); open(); } }); });
  document.getElementById('unitPdfBtn').addEventListener('click', ()=>{ recordInteraction(un,u,'pdfs'); openUnitPdfPreview(un,sp); });
}

/* =========================================================
   Unit PDF — New Avenue property brochure (A4)
   One template is used for the in-app preview and for the print window ("Print / Save as PDF"),
   so what the salesperson previews is exactly what the client receives. Everything on it comes
   from the unit record and the consultant's own Reference-directory contact; a field that is
   missing is simply left out (no placeholders). Internal data is never printed: no owner
   details, no admin/pending status, no popularity or audit information.
   ========================================================= */
function brochureHas(v){ return v!==null && v!==undefined && v!=='' && !(typeof v==='number' && isNaN(v)); }
function unitSheetHTML(un, sp, dataUrls){
  // Real photos only. dataUrls = already-downloaded images for the print window; without it the
  // preview loads them through the normal authenticated photo loader.
  const ids = (un.photoIds || []).slice(0,5);
  const imgTag = (id, size, alt)=> dataUrls ? (dataUrls[id+'|'+size] ? `<img src="${dataUrls[id+'|'+size]}" alt="${alt}">` : '') : `<img data-photo-id="${id}" data-photo-size="${size}" data-photo-eager alt="${alt}">`;
  const isRent = un.saleRent==='Rent';
  const location = [un.phase, un.area, un.city].filter(brochureHas).map(esc).join(' · ');
  const facts = [
    brochureHas(un.bedrooms) ? ['bed', un.bedrooms===0?'Studio':String(un.bedrooms), un.bedrooms===0?'Layout':'Bedrooms'] : null,
    brochureHas(un.bathrooms) ? ['bath', String(un.bathrooms), 'Bathrooms'] : null,
    brochureHas(un.areaSize) ? ['area', un.areaSize+' m²', 'Built-up area'] : null,
    un.garden>0 ? ['area', un.garden+' m²', 'Garden'] : null,
    un.roof>0 ? ['area', un.roof+' m²', 'Roof'] : null,
    brochureHas(un.deliveryYears) ? ['calendar', deliveryLabel(un.deliveryYears), 'Delivery'] : null,
  ].filter(Boolean);
  const details = [
    ['Developer', un.developer], ['Phase', un.phase],
    ['Location', [un.area, un.city].filter(brochureHas).join(', ')],
    ['Unit type', un.unitType], ['Offer', isRent ? 'For rent' : 'For sale'],
    ['Finishing', un.finishing], ['Furnished', un.furnished===true ? 'Yes' : un.furnished===false ? 'No' : null],
  ].filter(([,v])=> brochureHas(v));
  const pay = [
    brochureHas(un.downPayment) ? ['Down payment', fmtMoney(un.downPayment)] : null,
    brochureHas(un.remainingAmount) && un.remainingAmount>0 ? ['Remaining amount', fmtMoney(un.remainingAmount)] : null,
    brochureHas(un.remainingInstallments) && un.remainingInstallments>0 ? ['Installments', un.remainingInstallments+' months'] : null,
    un.extraFees>0 ? ['Extra fees', fmtMoney(un.extraFees)] : null,
  ].filter(Boolean);
  const ref = sp ? DB.refs.find(r=>r.userId===sp.id) : null;
  const contact = ref ? [ref.phone ? 'Tel. '+ref.phone : '', ref.whatsapp ? 'WhatsApp '+ref.whatsapp : ''].filter(Boolean).join('  ·  ') : '';
  const titleSize = (un.compound||'').length > 26 ? ' ns-title-long' : '';
  return `
  <div class="ns-sheet${ids.length?'':' ns-nophoto'}">
    <div class="ns-band">
      <div class="ns-band-ring"></div>
      <div class="ns-header">
        <div class="ns-brand"><span class="ns-mark">N</span><div><div class="ns-brand-name">New Avenue</div><div class="ns-brand-sub">Real Estate Consultancy</div></div></div>
        <div class="ns-doc-meta"><div class="ns-doc-kind">Property Brochure</div><div>${esc(fmtDate(now()))}</div></div>
      </div>
      <div class="ns-heading">
        <div class="ns-tag">${isRent?'For rent':'For sale'}${brochureHas(un.unitType)?' · '+esc(un.unitType):''}</div>
        <h1 class="${titleSize}">${esc(un.compound)}</h1>
        ${location?`<div class="ns-sub">${location}</div>`:''}
        ${brochureHas(un.developer)?`<div class="ns-dev">Developed by ${esc(un.developer)}</div>`:''}
      </div>
    </div>
    <div class="ns-body">
      ${ids.length ? `<div class="ns-gallery${ids.length>1?'':' ns-gallery-single'}">
        <div class="ns-hero-photo ns-hero-real">${imgTag(ids[0],'full','Main photo')}</div>
        ${ids.length>1 ? `<div class="ns-thumbstrip ns-thumbs-${ids.length-1}">${ids.slice(1).map((id,i)=>`<div class="ns-thumb">${imgTag(id,'thumb','Photo '+(i+2))}</div>`).join('')}</div>` : ''}
      </div>` : ''}
      ${facts.length ? `<div class="ns-facts" style="--n:${facts.length>4?3:facts.length}">${facts.map(([icon,val,label])=>`<div class="ns-fact"><span class="ns-fact-ic">${ic(icon)}</span><div><div class="ns-fact-val">${esc(val)}</div><div class="ns-fact-label">${esc(label)}</div></div></div>`).join('')}</div>` : ''}
      <div class="ns-cols">
        <div class="ns-price">
          <div class="ns-section-label">${isRent?'Rental terms':'Payment plan'}</div>
          <div class="ns-price-label">${isRent?'Price':'Total price'}</div>
          <div class="ns-price-val">${esc(fmtMoney(un.totalPrice))}</div>
          ${pay.length?`<div class="ns-pay">${pay.map(([k,v])=>`<div class="ns-pay-row"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}</div>`:''}
        </div>
        <div class="ns-details">
          <div class="ns-section-label">Property details</div>
          ${details.map(([k,v])=>`<div class="ns-detail-row"><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('')}
        </div>
      </div>
    </div>
    <div class="ns-footer">
      ${sp ? `<div class="ns-agent">
        <span class="ns-agent-avatar">${esc(initials(sp.name))}</span>
        <div>
          <div class="ns-agent-kicker">Your New Avenue consultant</div>
          <div class="ns-agent-name">${esc(sp.name)}${displayTitle(sp)?` <span>· ${esc(displayTitle(sp))}</span>`:''}</div>
          ${contact?`<div class="ns-agent-contact">${esc(contact)}</div>`:''}
        </div>
      </div>` : ''}
      <div class="ns-disclaimer">Prices, payment plans and availability are subject to change without notice. This brochure is for presentation purposes only and does not constitute a binding offer. &copy; New Avenue Real Estate Consultancy.</div>
    </div>
  </div>`;
}
// Scoped to .ns-* so it can live in the app page (preview) and in the print window unchanged.
// Sized in px for an A4 page at 96 dpi (794 × 1123), with a fixed page height so a brochure is
// always exactly one page.
const UNIT_SHEET_CSS = `
  .ns-sheet{--ink:#17191C; --frame:#121417; --gold:#CDAE7E; --gold-deep:#9A7442; --muted:#6E7076; --line:#E4E1DA; --canvas:#F3F2EE;
    box-sizing:border-box; width:794px; height:1123px; position:relative; overflow:hidden; background:#fff; color:var(--ink);
    font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif; font-variant-numeric:lining-nums;
    -webkit-print-color-adjust:exact; print-color-adjust:exact; text-align:left; line-height:1.35;}
  .ns-sheet *{box-sizing:border-box;}
  .ns-sheet svg{width:16px; height:16px;}
  .ns-band{background:var(--frame); color:#ECE9E3; padding:34px 44px 92px; position:relative; overflow:hidden;}
  .ns-nophoto .ns-band{padding-bottom:70px;}
  .ns-band-ring{position:absolute; right:-150px; top:-190px; width:520px; height:520px; border-radius:50%; border:1px solid rgba(205,174,126,.22);}
  .ns-band-ring::after{content:""; position:absolute; inset:90px; border-radius:50%; border:1px solid rgba(205,174,126,.14);}
  .ns-header{display:flex; justify-content:space-between; align-items:center; position:relative;}
  .ns-brand{display:flex; align-items:center; gap:12px;}
  .ns-mark{width:42px; height:42px; border-radius:50%; border:1px solid var(--gold); color:var(--gold); display:flex; align-items:center; justify-content:center; font-family:'Bodoni Moda',Didot,'Times New Roman',serif; font-size:22px;}
  .ns-brand-name{font-family:'Bodoni Moda',Didot,'Times New Roman',serif; font-size:23px; color:#fff; line-height:1.05;}
  .ns-brand-sub{font-size:8.5px; font-weight:700; letter-spacing:.2em; text-transform:uppercase; color:var(--gold); margin-top:4px;}
  .ns-doc-meta{text-align:right; font-size:11px; color:#B8B5AD; line-height:1.6;}
  .ns-doc-kind{font-size:9px; font-weight:800; letter-spacing:.2em; text-transform:uppercase; color:var(--gold);}
  .ns-heading{position:relative; margin-top:40px; max-width:640px;}
  .ns-tag{display:inline-block; font-size:9.5px; font-weight:800; letter-spacing:.16em; text-transform:uppercase; color:var(--gold); border:1px solid rgba(205,174,126,.5); border-radius:999px; padding:5px 12px; margin-bottom:14px;}
  .ns-heading h1{font-family:'Bodoni Moda',Didot,'Times New Roman',serif; font-weight:400; font-size:44px; line-height:1.04; margin:0 0 10px; color:#fff; letter-spacing:-.005em;}
  .ns-heading h1.ns-title-long{font-size:34px;}
  .ns-sub{font-size:13.5px; color:#D6D2CA; font-weight:600;}
  .ns-dev{font-size:12px; color:#9C9A94; margin-top:4px;}
  .ns-body{padding:0 44px; margin-top:-62px; position:relative;}
  .ns-nophoto .ns-body{margin-top:-42px;}
  .ns-gallery{display:grid; grid-template-columns:1.85fr 1fr; gap:8px; height:244px;}
  .ns-gallery-single{grid-template-columns:1fr;}
  .ns-hero-photo{height:100%; border-radius:16px; overflow:hidden; background:var(--canvas); box-shadow:0 10px 30px rgba(18,20,23,.18);}
  .ns-hero-photo img, .ns-thumb img{width:100%; height:100%; object-fit:cover; display:block;}
  .ns-thumbstrip{display:grid; gap:8px; height:100%; grid-template-columns:1fr 1fr; grid-template-rows:1fr 1fr;}
  .ns-thumbs-1{grid-template-columns:1fr; grid-template-rows:1fr;}
  .ns-thumbs-2{grid-template-columns:1fr; grid-template-rows:1fr 1fr;}
  .ns-thumbs-3 .ns-thumb:first-child{grid-column:span 2;}
  .ns-thumb{border-radius:12px; overflow:hidden; background:var(--canvas); min-height:0;}
  .ns-facts{display:grid; grid-template-columns:repeat(var(--n),1fr); gap:0; margin-top:14px; background:#fff; border:1px solid var(--line); border-radius:14px; overflow:hidden;}
  .ns-nophoto .ns-facts{margin-top:0; box-shadow:0 10px 30px rgba(18,20,23,.12);}
  .ns-fact{display:flex; align-items:center; gap:11px; padding:14px 16px; border-right:1px solid var(--line); border-bottom:1px solid var(--line); margin:0 -1px -1px 0;}
  .ns-fact-ic{width:32px; height:32px; border-radius:50%; background:#F5EDE0; color:var(--gold-deep); display:flex; align-items:center; justify-content:center; flex-shrink:0;}
  .ns-fact-val{font-family:'Bodoni Moda',Didot,'Times New Roman',serif; font-size:21px; line-height:1.1;}
  .ns-fact-label{font-size:9.5px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); margin-top:2px;}
  .ns-cols{display:grid; grid-template-columns:1fr 1fr; gap:18px; margin-top:14px; align-items:start;}
  .ns-section-label{font-size:9.5px; font-weight:800; letter-spacing:.16em; text-transform:uppercase; color:var(--gold-deep); margin-bottom:10px;}
  .ns-price{background:var(--frame); color:#ECE9E3; border-radius:16px; padding:20px 22px;}
  .ns-price .ns-section-label{color:var(--gold);}
  .ns-price-label{font-size:11px; color:#B8B5AD; font-weight:600;}
  .ns-price-val{font-family:'Bodoni Moda',Didot,'Times New Roman',serif; font-size:33px; color:#fff; line-height:1.1; margin:2px 0 6px; white-space:nowrap;}
  .ns-pay{border-top:1px solid rgba(255,255,255,.12); margin-top:8px;}
  .ns-pay-row{display:flex; justify-content:space-between; gap:10px; padding:9px 0; border-bottom:1px solid rgba(255,255,255,.08); font-size:12.5px;}
  .ns-pay-row:last-child{border-bottom:0; padding-bottom:0;}
  .ns-pay-row span{color:#B8B5AD;}
  .ns-pay-row b{color:#fff; font-weight:700; white-space:nowrap;}
  .ns-details{border:1px solid var(--line); border-radius:16px; padding:18px 20px;}
  .ns-detail-row{display:flex; justify-content:space-between; gap:12px; padding:7px 0; border-bottom:1px solid var(--line); font-size:12.5px;}
  .ns-detail-row:last-child{border-bottom:0;}
  .ns-detail-row span{color:var(--muted);}
  .ns-detail-row b{font-weight:700; text-align:right;}
  .ns-footer{position:absolute; left:0; right:0; bottom:0; padding:18px 44px 26px; background:var(--canvas); border-top:1px solid var(--line);}
  .ns-agent{display:flex; align-items:center; gap:12px; margin-bottom:12px;}
  .ns-agent-avatar{width:38px; height:38px; border-radius:50%; background:var(--frame); color:var(--gold); display:flex; align-items:center; justify-content:center; font-weight:800; font-size:13px; flex-shrink:0;}
  .ns-agent-kicker{font-size:9px; font-weight:800; letter-spacing:.16em; text-transform:uppercase; color:var(--gold-deep);}
  .ns-agent-name{font-weight:800; font-size:14px; margin-top:1px;}
  .ns-agent-name span{font-weight:600; color:var(--muted);}
  .ns-agent-contact{font-size:12px; color:var(--ink); margin-top:2px; font-weight:600;}
  .ns-disclaimer{font-size:9px; color:var(--muted); line-height:1.5;}
  /* in-app preview: the real A4 sheet, scaled to the modal width (see fitUnitSheetPreview) */
  .ns-preview{position:relative; overflow:hidden; border-radius:10px; box-shadow:0 8px 30px rgba(0,0,0,.14);}
  .ns-preview .ns-sheet{transform-origin:top left; position:absolute; left:0; top:0;}
`;
// The print window: just the sheet, A4, no margins, nothing else on the page.
const UNIT_SHEET_PRINT_CSS = `
  @page{size:A4; margin:0;}
  html,body{margin:0; padding:0;}
  body{background:#E9E7E2; display:flex; justify-content:center; padding:24px 0;}
  .ns-sheet{box-shadow:0 10px 40px rgba(0,0,0,.18);}
  @media print{ body{background:#fff; padding:0; display:block;} .ns-sheet{box-shadow:none; width:210mm; height:297mm;} }
`;
function ensureUnitSheetStyles(){
  if(document.getElementById('nsSheetStyles')) return;
  const st = document.createElement('style'); st.id = 'nsSheetStyles'; st.textContent = UNIT_SHEET_CSS;
  document.head.appendChild(st);
}
function fitUnitSheetPreview(){
  const box = document.getElementById('nsPreview'); if(!box) return;
  const sheet = box.querySelector('.ns-sheet'); if(!sheet) return;
  const k = box.clientWidth / 794;
  sheet.style.transform = `scale(${k})`;
  box.style.height = Math.ceil(1123 * k) + 'px';
}
function unitSheetDocument(un, sp, dataUrls){
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
    + '<title>New Avenue — '+esc(un.compound)+'</title>'
    + '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
    + '<link href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,400&family=Manrope:wght@500;600;700;800&display=swap" rel="stylesheet">'
    + '<style>'+UNIT_SHEET_CSS+UNIT_SHEET_PRINT_CSS+'</style></head><body>'+unitSheetHTML(un,sp,dataUrls)+'</body></html>';
}
function openUnitPdfPreview(un, sp){
  ensureUnitSheetStyles();
  openModal(`
    <div class="modal-head"><div><div style="font-weight:800;">Property brochure</div><div style="font-size:11.5px; color:var(--text-faint);">A4 · ready to save as PDF and share with your client</div></div><button class="close-x" id="modalCloseX">${ic('x')}</button></div>
    <div class="modal-body" id="pdfArea" style="background:var(--surface-2); padding:18px;">
      <div class="ns-preview" id="nsPreview">${unitSheetHTML(un, sp)}</div>
    </div>
    <div class="modal-foot">
      <a class="btn btn-sm" style="background:#25D366; border-color:#25D366; color:#fff;" id="pdfWaShareBtn">${ic('whatsapp')} Share on WhatsApp</a>
      <button class="btn btn-primary btn-sm" id="printPdfBtn">${ic('pdf')} Print / Save as PDF</button>
    </div>`);
  fitUnitSheetPreview();
  const onResize = ()=>{ if(!document.getElementById('nsPreview')) window.removeEventListener('resize', onResize); else fitUnitSheetPreview(); };
  window.addEventListener('resize', onResize);
  document.getElementById('modalCloseX').addEventListener('click', closeModal);
  document.getElementById('printPdfBtn').addEventListener('click', async ()=>{
    const w = window.open('', '_blank');
    if(!w){ toast('Allow pop-ups to print or save the brochure'); return; }
    // The new window cannot log in, so the photos are embedded as data: URLs before printing.
    const dataUrls = {};
    const ids = (un.photoIds || []).slice(0,5);
    try {
      await Promise.all([[ids[0],'full'], ...ids.slice(1).map(id=>[id,'thumb'])].filter(x=>x[0]).map(async ([id,size])=>{ dataUrls[id+'|'+size] = await photoDataUrl(id, size); }));
    } catch(e){ toast('Some photos could not be loaded — the brochure will print without them'); }
    w.document.write(unitSheetDocument(un, sp, dataUrls));
    w.document.close(); w.focus();
    const imgs = Array.from(w.document.images);
    const imagesReady = Promise.all(imgs.map(im=> im.complete ? 0 : new Promise(r=>{ im.onload = im.onerror = r; })));
    // Wait for the brand fonts too (but never longer than 2.5 s — offline, the system fonts are used).
    const fontsReady = (w.document.fonts && w.document.fonts.ready) ? Promise.race([w.document.fonts.ready, new Promise(r=>setTimeout(r, 2500))]) : Promise.resolve();
    Promise.all([imagesReady, fontsReady]).then(()=> setTimeout(()=>w.print(), 150));
  });
  document.getElementById('pdfWaShareBtn').addEventListener('click', (e)=>{
    e.preventDefault();
    const msg = encodeURIComponent('New Avenue — '+un.compound+' ('+un.unitType+'), '+un.area+'. '+fmtMoney(un.totalPrice)+'. Ask me for the full brochure!');
    window.open('https://wa.me/?text='+msg, '_blank');
  });
}


/* ---------- Full-size photo viewer (Module F) ---------- */
function openPhotoViewer(ids, start){
  if(!ids || !ids.length) return;
  let idx = Math.min(Math.max(start||0,0), ids.length-1);
  const ov = document.createElement('div'); ov.className='pv-overlay'; ov.id='photoViewer';
  ov.innerHTML = `<button class="pv-close" id="pvClose" aria-label="Close">×</button>
    <button class="pv-nav pv-prev" id="pvPrev" aria-label="Previous photo">‹</button>
    <img id="pvImg" alt="">
    <button class="pv-nav pv-next" id="pvNext" aria-label="Next photo">›</button>
    <div class="pv-count" id="pvCount"></div>`;
  document.body.appendChild(ov);
  const img = ov.querySelector('#pvImg');
  function show(){
    ov.querySelector('#pvCount').textContent = (idx+1)+' / '+ids.length;
    ov.querySelector('#pvPrev').style.visibility = ids.length>1 ? 'visible' : 'hidden';
    ov.querySelector('#pvNext').style.visibility = ids.length>1 ? 'visible' : 'hidden';
    img.removeAttribute('src'); img.alt = 'Photo '+(idx+1);
    const want = idx;
    photoUrl(ids[idx], 'full').then(url=>{ if(want===idx && url) img.src = url; else if(want===idx) img.alt = 'Photo unavailable'; });
  }
  function close(){ document.removeEventListener('keydown', onKey); ov.remove(); }
  function onKey(e){ if(e.key==='Escape') close(); else if(e.key==='ArrowRight'){ idx=(idx+1)%ids.length; show(); } else if(e.key==='ArrowLeft'){ idx=(idx-1+ids.length)%ids.length; show(); } }
  ov.querySelector('#pvClose').addEventListener('click', close);
  ov.querySelector('#pvPrev').addEventListener('click', ()=>{ idx=(idx-1+ids.length)%ids.length; show(); });
  ov.querySelector('#pvNext').addEventListener('click', ()=>{ idx=(idx+1)%ids.length; show(); });
  ov.addEventListener('click', e=>{ if(e.target===ov) close(); });
  document.addEventListener('keydown', onKey);
  show();
}
