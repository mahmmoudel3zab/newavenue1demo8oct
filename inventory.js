/* =========================================================
   INVENTORY / NEWS FEED
   ========================================================= */
function deliveryLabel(y){ return y===0?'Immediate': y===1?'Within 1 year': y+' years'; }
function deliveryBucket(y){ return y===0?'Immediate': y<=1?'1y': y<=2?'2y':'4y'; }

function renderInventoryPage(u){
  const tk = myTeamKey(u);
  const unitTypes = tk==='residential'?UNIT_TYPES_RES:UNIT_TYPES_COM;
  const f = session.invFilters;
  let list = DB.units.filter(x=>x.team===tk);
  if(session.invSearch){
    const q = session.invSearch.toLowerCase();
    list = list.filter(x=> (x.compound+x.developer+x.area).toLowerCase().includes(q));
  }
  if(f.bedrooms.length) list = list.filter(x=> f.bedrooms.includes(String(x.bedrooms)));
  if(f.bathrooms.length) list = list.filter(x=> f.bathrooms.includes(String(x.bathrooms)));
  if(f.unitType.length) list = list.filter(x=> f.unitType.includes(x.unitType));
  if(f.finishing.length) list = list.filter(x=> f.finishing.includes(x.finishing));
  if(f.saleRent.length) list = list.filter(x=> f.saleRent.includes(x.saleRent));
  if(f.delivery.length) list = list.filter(x=> f.delivery.includes(deliveryBucket(x.deliveryYears)));

  if(session.invSort==='popularity') list = list.slice().sort((a,b)=>popularityScore(b)-popularityScore(a));
  else if(session.invSort==='newest') list = list.slice().sort((a,b)=>b.createdAt-a.createdAt);
  else list = list.slice().sort((a,b)=>a.createdAt-b.createdAt);

  const bedroomOpts = tk==='residential' ? ['0','1','2','3','4','5'] : [];
  const bathroomOpts = ['1','2','3','4'];

  return `
  <div style="display:flex; gap:10px; margin-bottom:14px; flex-wrap:wrap; align-items:center;">
    <div style="position:relative; flex:1; min-width:200px;">
      <input id="invSearch" placeholder="Search compound, developer, or area…" value="${esc(session.invSearch)}">
    </div>
    <select id="invSort" style="width:auto;">
      <option value="popularity" ${session.invSort==='popularity'?'selected':''}>Sort: Popularity</option>
      <option value="newest" ${session.invSort==='newest'?'selected':''}>Sort: Newest</option>
      <option value="oldest" ${session.invSort==='oldest'?'selected':''}>Sort: Oldest</option>
    </select>
    <button class="btn btn-sm" id="toggleFiltersBtn">${ic('search')} Filters</button>
  </div>
  <div id="filterPanel" class="card card-pad" style="display:${session._showFilters?'block':'none'}; margin-bottom:14px;">
    ${bedroomOpts.length?filterGroup('Bedrooms','bedrooms',bedroomOpts,f.bedrooms):''}
    ${filterGroup('Bathrooms','bathrooms',bathroomOpts,f.bathrooms)}
    ${filterGroup('Unit type','unitType',unitTypes,f.unitType)}
    ${filterGroup('Finishing','finishing',FINISHING,f.finishing)}
    ${filterGroup('Sale / Rent','saleRent',['Sale','Rent'],f.saleRent)}
    ${filterGroup('Delivery','delivery',['Immediate','1y','2y','4y'],f.delivery)}
    <button class="btn btn-ghost btn-sm" id="clearFiltersBtn">Reset all filters</button>
  </div>
  <div class="section-sub">${list.length} units found</div>
  <div class="grid-3" id="unitGrid">
    ${list.length? list.map(un=>unitCard(un)).join('') : `<div class="empty-state" style="grid-column:1/-1;">${ic('inventory')}<div>No units match these filters.</div></div>`}
  </div>`;
}
function filterGroup(label, key, opts, selected){
  return `<div style="margin-bottom:14px;"><div class="field-label" style="margin-bottom:7px;">${label}</div>
    <div style="display:flex; gap:6px; flex-wrap:wrap;">
    ${opts.map(o=>`<button class="chip-select ${selected.includes(o)?'on':''}" data-filter-key="${key}" data-filter-val="${o}">${key==='bedrooms'&&o==='0'?'Studio':o}</button>`).join('')}
    </div></div>`;
}
function unitCard(un){
  const sp = DB.users.find(x=>x.id===un.ownerSalespersonId);
  return `<div class="card unit-card" data-unit="${un.id}" style="overflow:hidden; cursor:pointer;">
    <div class="scrim-photo" style="border-radius:0; aspect-ratio:16/10;">${un.photos} photos</div>
    <div class="card-pad" style="padding-top:12px;">
      <div style="display:flex; justify-content:space-between; gap:6px;">
        <div style="font-weight:800; font-size:13.5px;">${esc(un.compound)}</div>
        ${un.pending?'<span class="badge badge-pending">Pending</span>':''}
      </div>
      <div style="font-size:11.5px; color:var(--text-faint); margin:2px 0 8px;">${esc(un.unitType)} · ${esc(un.area)} · ${un.saleRent}</div>
      <div style="display:flex; gap:10px; font-size:11px; color:var(--text-muted); margin-bottom:8px;">
        ${un.bedrooms!=null?`<span>${ic('bed')} ${un.bedrooms}</span>`:''}
        <span>${ic('bath')} ${un.bathrooms}</span>
        <span>${ic('area')} ${un.areaSize}m²</span>
        ${un.garden?`<span>🌿 ${un.garden}m²</span>`:''}
      </div>
      <div class="divider" style="margin:8px 0;"></div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:11.5px;">
        <div><div style="color:var(--text-faint);">Down payment</div><div style="font-weight:800;">${fmtMoney(un.downPayment)}</div></div>
        <div><div style="color:var(--text-faint);">Total price</div><div style="font-weight:800;">${fmtMoney(un.totalPrice)}</div></div>
        <div><div style="color:var(--text-faint);">Remaining</div><div style="font-weight:700;">${fmtMoney(un.remainingAmount)}</div></div>
        <div><div style="color:var(--text-faint);">Installments</div><div style="font-weight:700;">${un.remainingInstallments} mo</div></div>
      </div>
    </div>
  </div>`;
}
AFTER_RENDER.inventory = function(u){
  const s = document.getElementById('invSearch'); if(s) s.addEventListener('input', ()=>{ session.invSearch = s.value; renderPageInto(u); });
  const so = document.getElementById('invSort'); if(so) so.addEventListener('change', ()=>{ session.invSort = so.value; renderPageInto(u); });
  const tf = document.getElementById('toggleFiltersBtn'); if(tf) tf.addEventListener('click', ()=>{ session._showFilters = !session._showFilters; renderPageInto(u); });
  const cf = document.getElementById('clearFiltersBtn'); if(cf) cf.addEventListener('click', ()=>{ session.invFilters = {bedrooms:[],bathrooms:[],unitType:[],finishing:[],saleRent:[],delivery:[]}; renderPageInto(u); });
  document.querySelectorAll('[data-filter-key]').forEach(b=> b.addEventListener('click', ()=>{
    const k = b.dataset.filterKey, v = b.dataset.filterVal;
    const arr = session.invFilters[k];
    const i = arr.indexOf(v);
    if(i>=0) arr.splice(i,1); else arr.push(v);
    renderPageInto(u);
  }));
  document.querySelectorAll('.unit-card').forEach(el=> el.addEventListener('click', ()=> openUnitModal(el.dataset.unit, u)));
};

function recordInteraction(un, u, type){
  const arr = un[type];
  if(!arr.includes(u.id)) arr.push(u.id); // unique-user dedup prevents self-manipulation
  persist();
}
function openUnitModal(unitId, u){
  const un = DB.units.find(x=>x.id===unitId);
  const sp = DB.users.find(x=>x.id===un.ownerSalespersonId);
  recordInteraction(un, u, 'views');
  openModal(`
    <div class="modal-head">
      <div><div style="font-weight:800; font-size:16px;">${esc(un.compound)} — ${esc(un.unitType)}</div><div style="font-size:11.5px; color:var(--text-faint);">${esc(un.area)}, ${esc(un.city)} · ${esc(un.phase)}</div></div>
      <button class="close-x" id="modalCloseX">${ic('x')}</button>
    </div>
    <div class="modal-body">
      <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:6px; margin-bottom:14px;">
        ${Array.from({length:Math.min(un.photos,6)}).map((_,i)=>`<div class="scrim-photo">Photo ${i+1}</div>`).join('')}
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
      <a class="btn btn-sm" style="background:#25D366; border-color:#25D366; color:#fff;" href="https://wa.me/2${sp?sp.id:''}" target="_blank" id="unitWaBtn">${ic('whatsapp')} WhatsApp</a>
      <a class="btn btn-teal btn-sm" href="tel:0100000000" id="unitCallBtn">${ic('phone')} Call</a>
      <button class="btn btn-primary btn-sm" id="unitPdfBtn">${ic('pdf')} Create PDF</button>
    </div>`);
  document.getElementById('modalCloseX').addEventListener('click', closeModal);
  document.getElementById('unitWaBtn').addEventListener('click', ()=>{ recordInteraction(un,u,'whatsapps'); toast('Opening WhatsApp chat with '+(sp?sp.name:'agent')+'…'); });
  document.getElementById('unitCallBtn').addEventListener('click', ()=>{ recordInteraction(un,u,'calls'); toast('Dialing '+(sp?sp.name:'agent')+'…'); });
  document.getElementById('unitPdfBtn').addEventListener('click', ()=>{ recordInteraction(un,u,'pdfs'); openUnitPdfPreview(un,sp); });
}

function openUnitPdfPreview(un, sp){
  const photos = Array.from({length:Math.min(un.photos,4)}).map((_,i)=>`<div class="scrim-photo" style="aspect-ratio:16/10;">Photo ${i+1}</div>`).join('');
  openModal(`
    <div class="modal-head"><div style="font-weight:800;">Unit PDF summary</div><button class="close-x" id="modalCloseX">${ic('x')}</button></div>
    <div class="modal-body" id="pdfArea">
      <div style="border:1px solid var(--border); border-radius:12px; padding:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <div style="font-family:var(--font-head); font-weight:700; font-size:18px;">New Avenue — Unit Summary</div>
          <div style="font-size:11px; color:var(--text-faint);">${fmtDate(now())}</div>
        </div>
        <div style="display:grid; grid-template-columns:repeat(2,1fr); gap:6px; margin-bottom:14px;">${photos}</div>
        <h3 style="font-size:15px; margin-bottom:8px;">${esc(un.compound)} — ${esc(un.unitType)}, ${esc(un.phase)}</h3>
        <table>
          <tr><td>Developer</td><td style="text-align:right;">${esc(un.developer)}</td></tr>
          <tr><td>Area</td><td style="text-align:right;">${esc(un.area)}, ${esc(un.city)}</td></tr>
          ${un.bedrooms!=null?`<tr><td>Bedrooms / Bathrooms</td><td style="text-align:right;">${un.bedrooms} / ${un.bathrooms}</td></tr>`:`<tr><td>Bathrooms</td><td style="text-align:right;">${un.bathrooms}</td></tr>`}
          <tr><td>Area size</td><td style="text-align:right;">${un.areaSize} m²</td></tr>
          <tr><td>Finishing</td><td style="text-align:right;">${un.finishing}</td></tr>
          <tr><td>Delivery</td><td style="text-align:right;">${deliveryLabel(un.deliveryYears)}</td></tr>
          <tr><td>Down payment</td><td style="text-align:right; font-weight:800;">${fmtMoney(un.downPayment)}</td></tr>
          <tr><td>Remaining</td><td style="text-align:right;">${fmtMoney(un.remainingAmount)} over ${un.remainingInstallments} months</td></tr>
          <tr><td>Total price</td><td style="text-align:right; font-weight:800;">${fmtMoney(un.totalPrice)}</td></tr>
        </table>
        <div style="margin-top:14px; font-size:11.5px; color:var(--text-faint);">Presented by ${esc(sp?sp.name:'New Avenue')} · New Avenue Real Estate Consultancy</div>
      </div>
    </div>
    <div class="modal-foot"><button class="btn btn-primary btn-sm" id="printPdfBtn">Print / Save as PDF</button></div>`);
  document.getElementById('modalCloseX').addEventListener('click', closeModal);
  document.getElementById('printPdfBtn').addEventListener('click', ()=>{
    const w = window.open('', '_blank');
    w.document.write('<html><head><title>Unit PDF</title></head><body style="font-family:sans-serif;">'+document.getElementById('pdfArea').innerHTML+'</body></html>');
    w.document.close(); w.focus(); setTimeout(()=>w.print(), 300);
  });
}

