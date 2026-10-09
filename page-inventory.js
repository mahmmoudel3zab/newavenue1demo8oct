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
  const spRef = sp ? DB.refs.find(r=>r.userId===sp.id) : null;
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
      <a class="btn btn-sm btn-wa" href="${spRef?waHref(spRef.whatsapp):'#'}" target="_blank" rel="noopener" id="unitWaBtn">${ic('whatsapp')} WhatsApp</a>
      <a class="btn btn-sm btn-call" href="${spRef?telHref(spRef.phone):'#'}" id="unitCallBtn">${ic('phone')} Call</a>
      <button class="btn btn-primary btn-sm" id="unitPdfBtn">${ic('pdf')} Create PDF</button>
    </div>`);
  document.getElementById('modalCloseX').addEventListener('click', closeModal);
  document.getElementById('unitWaBtn').addEventListener('click', ()=>{ recordInteraction(un,u,'whatsapps'); toast('Opening WhatsApp chat with '+(sp?sp.name:'agent')+'…'); });
  document.getElementById('unitCallBtn').addEventListener('click', ()=>{ recordInteraction(un,u,'calls'); toast('Dialing '+(sp?sp.name:'agent')+'…'); });
  document.getElementById('unitPdfBtn').addEventListener('click', ()=>{ recordInteraction(un,u,'pdfs'); openUnitPdfPreview(un,sp); });
}

/* =========================================================
   Unit PDF / Property Sheet — a premium, branded New Avenue sheet suitable for sending to
   clients (WhatsApp, print, internal use), not a plain browser printout.
   ========================================================= */
function unitSheetHTML(un, sp){
  const photoCount = Math.min(un.photos, 5);
  const heroPhoto = `<div class="ns-hero-photo">${ic('area')}<span>${un.photos} photo${un.photos===1?'':'s'} on file</span></div>`;
  const stripPhotos = Array.from({length:Math.max(photoCount-1,0)}).map((_,i)=>`<div class="ns-thumb">Photo ${i+2}</div>`).join('');
  const specs = [
    un.bedrooms!=null ? ['bed','Bedrooms', un.bedrooms] : null,
    ['bath','Bathrooms', un.bathrooms],
    ['area','Area', un.areaSize+' m²'],
    ['calendar','Delivery', deliveryLabel(un.deliveryYears)],
  ].filter(Boolean);
  const extraSpecs = [
    ['Finishing', un.finishing],
    ['Furnished', un.furnished?'Yes':'No'],
    un.garden ? ['Garden', un.garden+' m²'] : null,
    un.roof ? ['Roof', un.roof+' m²'] : null,
    ['Sale / Rent', un.saleRent],
    ['Phase', un.phase],
  ].filter(Boolean);
  const ref = sp ? DB.refs.find(r=>r.userId===sp.id) : null;
  const spPhone = ref ? ref.phone : '0100000000';
  const spWa = ref ? ref.whatsapp : '0100000000';

  return `
  <div class="ns-sheet">
    <div class="ns-header">
      <div class="ns-brand"><span class="ns-mark">N</span><div><div class="ns-brand-name">New Avenue</div><div class="ns-brand-sub">Real Estate Consultancy</div></div></div>
      <div class="ns-doc-meta"><div>Property Sheet</div><div>${esc(fmtDate(now()))}</div></div>
    </div>
    <div class="ns-hero">
      ${heroPhoto}
      <div class="ns-hero-info">
        <div class="ns-tag">${esc(un.saleRent)} ${un.pending?' · Pending review':''}</div>
        <h1>${esc(un.compound)}</h1>
        <div class="ns-sub">${esc(un.unitType)} · ${esc(un.phase)} · ${esc(un.area)}, ${esc(un.city)}</div>
        <div class="ns-dev">Developed by ${esc(un.developer)}</div>
      </div>
    </div>
    ${stripPhotos?`<div class="ns-thumbstrip">${stripPhotos}</div>`:''}
    <div class="ns-specs">
      ${specs.map(([icon,label,val])=>`<div class="ns-spec"><div class="ns-spec-ic">${ic(icon)}</div><div><div class="ns-spec-val">${esc(val)}</div><div class="ns-spec-label">${esc(label)}</div></div></div>`).join('')}
    </div>
    <div class="ns-extra">
      ${extraSpecs.map(([k,v])=>`<div class="ns-extra-row"><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join('')}
    </div>
    <div class="ns-pricing">
      <div class="ns-price-main"><div class="ns-price-label">Total Price</div><div class="ns-price-val">${esc(fmtMoney(un.totalPrice))}</div></div>
      <div class="ns-price-split">
        <div><div class="ns-price-label">Down Payment</div><div class="ns-price-sub">${esc(fmtMoney(un.downPayment))}</div></div>
        <div><div class="ns-price-label">Remaining</div><div class="ns-price-sub">${esc(fmtMoney(un.remainingAmount))}</div></div>
        <div><div class="ns-price-label">Installments</div><div class="ns-price-sub">${un.remainingInstallments} months</div></div>
      </div>
    </div>
    <div class="ns-footer">
      <div class="ns-agent">
        <span class="ns-agent-avatar">${esc(initials(sp?sp.name:'NA'))}</span>
        <div>
          <div class="ns-agent-name">${esc(sp?sp.name:'New Avenue Consultant')}</div>
          <div class="ns-agent-role">${esc(sp?ROLE_LABELS[sp.role]:'')}</div>
          <div class="ns-agent-contact">${esc(spPhone)} · WhatsApp ${esc(spWa)}</div>
        </div>
      </div>
      <div class="ns-disclaimer">Prices and availability are subject to change without notice. This sheet is for client presentation purposes and does not constitute a binding offer. &copy; New Avenue Real Estate Consultancy.</div>
    </div>
  </div>`;
}
const UNIT_SHEET_CSS = `
  *{box-sizing:border-box;}
  body{font-family:'Manrope',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; margin:0; background:#F5F4F0; color:#20211E; padding:28px;}
  .ns-sheet{max-width:720px; margin:0 auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 2px 30px rgba(0,0,0,.08); border:1px solid #DCD7CA;}
  .ns-header{display:flex; justify-content:space-between; align-items:center; padding:20px 28px; background:linear-gradient(135deg,#6E5330,#8A6A3B);}
  .ns-brand{display:flex; align-items:center; gap:11px;}
  .ns-mark{width:38px;height:38px;border-radius:9px; background:rgba(255,255,255,.18); color:#fff; display:flex; align-items:center; justify-content:center; font-family:Georgia,serif; font-weight:700; font-size:19px;}
  .ns-brand-name{color:#fff; font-family:Georgia,serif; font-weight:700; font-size:17px; line-height:1.1;}
  .ns-brand-sub{color:rgba(255,255,255,.75); font-size:10px; letter-spacing:.04em; text-transform:uppercase; margin-top:2px;}
  .ns-doc-meta{color:rgba(255,255,255,.85); font-size:11px; text-align:right; line-height:1.5;}
  .ns-hero{display:flex; gap:16px; padding:22px 28px 10px;}
  .ns-hero-photo{flex:0 0 150px; height:120px; border-radius:10px; background:linear-gradient(135deg,#E4E0D6,#F1E9DA); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; color:#95937F; font-size:10.5px; font-weight:700;}
  .ns-hero-photo svg{width:26px;height:26px;}
  .ns-hero-info{flex:1; min-width:0;}
  .ns-tag{display:inline-block; font-size:10px; font-weight:800; letter-spacing:.05em; text-transform:uppercase; color:#8A6A3B; background:#F1E9DA; padding:3px 9px; border-radius:20px; margin-bottom:6px;}
  .ns-hero-info h1{font-family:Georgia,serif; font-size:23px; font-weight:700; margin:0 0 4px; color:#20211E; line-height:1.15;}
  .ns-sub{font-size:12.5px; color:#6B6A5F; margin-bottom:3px;}
  .ns-dev{font-size:11.5px; color:#95937F;}
  .ns-thumbstrip{display:grid; grid-template-columns:repeat(4,1fr); gap:6px; padding:0 28px 18px;}
  .ns-thumb{aspect-ratio:4/3; border-radius:7px; background:#EDEAE2; display:flex; align-items:center; justify-content:center; color:#95937F; font-size:10px; font-weight:700;}
  .ns-specs{display:grid; grid-template-columns:repeat(4,1fr); gap:1px; background:#DCD7CA; margin:0 28px; border-radius:10px; overflow:hidden; border:1px solid #DCD7CA;}
  .ns-spec{background:#fff; padding:12px 10px; display:flex; align-items:center; gap:8px;}
  .ns-spec-ic{width:26px;height:26px; border-radius:7px; background:#F1E9DA; color:#8A6A3B; display:flex; align-items:center; justify-content:center; flex-shrink:0;}
  .ns-spec-ic svg{width:14px;height:14px;}
  .ns-spec-val{font-weight:800; font-size:13.5px; line-height:1.2;}
  .ns-spec-label{font-size:9.5px; color:#95937F; text-transform:uppercase; letter-spacing:.03em;}
  .ns-extra{margin:18px 28px 0; border-top:1px solid #EDEAE2;}
  .ns-extra-row{display:flex; justify-content:space-between; padding:8px 2px; font-size:12px; border-bottom:1px solid #EDEAE2;}
  .ns-extra-row span:first-child{color:#6B6A5F;}
  .ns-extra-row span:last-child{font-weight:700;}
  .ns-pricing{margin:20px 28px; background:linear-gradient(135deg,#25505A,#1A3A42); border-radius:12px; padding:18px 22px; color:#fff; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px;}
  .ns-price-label{font-size:9.5px; text-transform:uppercase; letter-spacing:.05em; opacity:.75; margin-bottom:3px;}
  .ns-price-val{font-family:Georgia,serif; font-size:26px; font-weight:700;}
  .ns-price-split{display:flex; gap:22px;}
  .ns-price-sub{font-weight:700; font-size:13px;}
  .ns-footer{padding:16px 28px 24px; border-top:1px solid #EDEAE2;}
  .ns-agent{display:flex; align-items:center; gap:10px; margin-bottom:12px;}
  .ns-agent-avatar{width:32px;height:32px;border-radius:50%; background:#8A6A3B; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:12px; flex-shrink:0;}
  .ns-agent-name{font-weight:700; font-size:12.5px;}
  .ns-agent-role{font-size:10.5px; color:#95937F;}
  .ns-agent-contact{font-size:11px; color:#6B6A5F; margin-top:1px;}
  .ns-disclaimer{font-size:9.5px; color:#95937F; line-height:1.5;}
  @media print{ body{background:#fff; padding:0;} .ns-sheet{box-shadow:none; border:none; border-radius:0; max-width:100%;} }
`;
function openUnitPdfPreview(un, sp){
  openModal(`
    <div class="modal-head"><div style="font-weight:800;">Unit property sheet</div><button class="close-x" id="modalCloseX">${ic('x')}</button></div>
    <div class="modal-body" id="pdfArea" style="background:var(--surface-2); padding:18px;">
      ${unitSheetHTML(un, sp)}
    </div>
    <div class="modal-foot">
      <a class="btn btn-sm" style="background:#25D366; border-color:#25D366; color:#fff;" id="pdfWaShareBtn">${ic('whatsapp')} Share on WhatsApp</a>
      <button class="btn btn-primary btn-sm" id="printPdfBtn">${ic('pdf')} Print / Save as PDF</button>
    </div>`);
  document.getElementById('modalCloseX').addEventListener('click', closeModal);
  document.getElementById('printPdfBtn').addEventListener('click', ()=>{
    const w = window.open('', '_blank');
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>New Avenue — '+esc(un.compound)+'</title><style>'+UNIT_SHEET_CSS+'</style></head><body>'+unitSheetHTML(un,sp)+'</body></html>');
    w.document.close(); w.focus(); setTimeout(()=>w.print(), 300);
  });
  document.getElementById('pdfWaShareBtn').addEventListener('click', (e)=>{
    e.preventDefault();
    const msg = encodeURIComponent('New Avenue — '+un.compound+' ('+un.unitType+'), '+un.area+'. '+fmtMoney(un.totalPrice)+'. Ask me for the full sheet!');
    window.open('https://wa.me/?text='+msg, '_blank');
  });
}

