/* =========================================================
   DAILY PERFORMANCE REPORT  (+ Monthly Reports)
   One report per salesperson per date (getOrCreateDailyReport never
   creates a second row for the same salesperson+date). Exactly 11
   required metrics, grouped into 5 sections. 0 is valid; empty is not.
   No data exists before the 2026-11-01 launch date.
   ========================================================= */
const REPORT_SECTIONS = [
  { key:'calls', title:'Calls', fields:[['count','Calls Count'],['active','Active Calls']] },
  { key:'leads', title:'Leads', fields:[['count','Leads']] },
  { key:'showings', title:'Showings', fields:[['buyer','Buyer'],['seller','Seller']] },
  { key:'meetings', title:'Meetings', fields:[['buyer','Buyer'],['seller','Seller'],['developer','Developer']] },
  { key:'other', title:'Other Activities', fields:[['inventory','Inventory'],['orientation','Orientation'],['closedDeals','Closed Deals']] },
];

function renderDailyReportPage(u){
  if(u.role!=='salesperson'){
    return `<div class="empty-state">${ic('calendar')}<div>Daily Performance Reports are filed by salespeople. A Team Overview for managers is planned for a future phase.</div></div>`;
  }
  const view = session._reportView || 'daily';
  const today = effectiveTodayStr();
  if(!isOnOrAfterLaunch(today)){
    return `<div class="card card-pad" style="text-align:center;">
      <div style="width:46px;height:46px;border-radius:50%; background:var(--brand-tint); color:var(--brand-dark); display:flex;align-items:center;justify-content:center; margin:0 auto 12px;">${ic('calendar')}</div>
      <div class="section-title">Daily Performance Reports begin ${DAILY_REPORT_LAUNCH_DATE}</div>
      <div class="section-sub">There is no historical data to show before the launch date — reporting starts from zero on day one.</div>
      <button class="btn btn-sm" id="simLaunchBtn">Preview the module using ${DAILY_REPORT_LAUNCH_DATE} (for testing only)</button>
    </div>`;
  }
  const tabs = `<div class="tabs">
    <button class="tab-btn ${view==='daily'?'active':''}" data-reportview="daily">Daily Report</button>
    <button class="tab-btn ${view==='monthly'?'active':''}" data-reportview="monthly">Monthly Reports</button>
  </div>`;
  return tabs + (view==='monthly' ? renderMonthlyView(u) : renderDailyView(u, session._reportDate || today));
}

function renderDailyView(u, ds){
  const today = effectiveTodayStr();
  const report = getOrCreateDailyReport(u.id, ds);
  const complete = isReportComplete(report);
  const statusBadge = report.status==='completed'
    ? '<span class="badge badge-success">Completed</span>'
    : '<span class="badge badge-pending">In Progress</span>';
  const isToday = ds===today;
  return `
  <div class="card card-pad" style="margin-bottom:16px;">
    <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
      <div>
        <div class="section-title" style="margin-bottom:4px;">Daily Performance Report</div>
        <div class="section-sub" style="margin-bottom:0;">${esc(ds)}${isToday?' · Today':''} ${statusBadge}</div>
      </div>
      <div style="display:flex; gap:8px; align-items:center;">
        ${!isToday?`<button class="btn btn-sm" id="backToTodayBtn">Back to today</button>`:''}
        <button class="btn btn-primary" id="completeReportBtn" ${complete?'':'disabled title="Fill in every field (0 counts) before completing"'}>${ic('check')} ${report.status==='completed'?'Completed':'Complete Report'}</button>
      </div>
    </div>
  </div>
  <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:14px;">
    ${REPORT_SECTIONS.map(sec=>reportSectionCard(report, sec)).join('')}
  </div>`;
}

function reportSectionCard(report, sec){
  return `<div class="card card-pad">
    <div class="section-title" style="font-size:14px; margin-bottom:10px;">${esc(sec.title)}</div>
    <div style="display:flex; flex-direction:column; gap:10px;">
      ${sec.fields.map(([key,label])=>{
        const val = report[sec.key][key];
        return `<div>
          <label class="field-label">${esc(label)}</label>
          <div style="display:flex; align-items:center; gap:8px;">
            <button class="btn btn-sm" data-step="-1" data-sec="${sec.key}" data-key="${key}" aria-label="Decrease">${ic('minus')}</button>
            <input type="number" min="0" inputmode="numeric" data-field="${sec.key}.${key}" value="${val===null?'':val}" placeholder="—" style="text-align:center; font-weight:700;">
            <button class="btn btn-sm" data-step="1" data-sec="${sec.key}" data-key="${key}" aria-label="Increase">${ic('plus')}</button>
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

function renderMonthlyView(u){
  const months = availableMonthsFor(u.id);
  const activeMonth = session._reportMonth && months.includes(session._reportMonth) ? session._reportMonth : months[months.length-1];
  const reports = activeMonth ? reportsForMonth(u.id, activeMonth) : [];
  const totals = monthlyTotals(reports);
  return `
  <div style="display:flex; align-items:center; gap:8px; margin-bottom:14px; overflow-x:auto;">
    ${months.map(m=>`<button class="chip-select ${m===activeMonth?'on':''}" data-month="${m}">${monthLabel(m)}</button>`).join('')}
  </div>
  <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:10px; margin-bottom:18px;">
    ${MONTHLY_TOTAL_FIELDS.map(([s,k,label])=>`<div class="card card-pad" style="text-align:center;">
      <div style="font-size:24px; font-weight:800; font-family:var(--font-head);">${totals[s+'.'+k]}</div>
      <div style="font-size:11px; color:var(--text-faint);">${esc(label)}</div>
    </div>`).join('')}
  </div>
  <div class="card" style="overflow-x:auto;">
    <table>
      <thead><tr><th>Date</th><th>Calls</th><th>Active</th><th>Leads</th><th>Buyer Show.</th><th>Seller Show.</th><th>Buyer Mtg.</th><th>Seller Mtg.</th><th>Dev. Mtg.</th><th>Inventory</th><th>Orientation</th><th>Closed</th><th>Status</th></tr></thead>
      <tbody>
      ${reports.length ? reports.slice().reverse().map(r=>`<tr class="report-row" data-opendate="${r.date}" style="cursor:pointer;">
        <td style="font-weight:700;">${esc(r.date)}</td>
        <td>${fmtVal(r.calls.count)}</td><td>${fmtVal(r.calls.active)}</td><td>${fmtVal(r.leads.count)}</td>
        <td>${fmtVal(r.showings.buyer)}</td><td>${fmtVal(r.showings.seller)}</td>
        <td>${fmtVal(r.meetings.buyer)}</td><td>${fmtVal(r.meetings.seller)}</td><td>${fmtVal(r.meetings.developer)}</td>
        <td>${fmtVal(r.other.inventory)}</td><td>${fmtVal(r.other.orientation)}</td><td>${fmtVal(r.other.closedDeals)}</td>
        <td>${r.status==='completed'?'<span class="badge badge-success">Completed</span>':'<span class="badge badge-pending">In Progress</span>'}</td>
      </tr>`).join('') : `<tr><td colspan="13">${emptyRow('No daily reports in this month yet.')}</td></tr>`}
      </tbody>
    </table>
  </div>`;
}
function fmtVal(v){ return v===null||v===undefined ? '—' : v; }

AFTER_RENDER.reports = function(u){
  const simBtn = document.getElementById('simLaunchBtn');
  if(simBtn) simBtn.addEventListener('click', ()=>{ session.simToday = DAILY_REPORT_LAUNCH_DATE; renderPageInto(u); });

  document.querySelectorAll('[data-reportview]').forEach(b=> b.addEventListener('click', ()=>{ session._reportView = b.dataset.reportview; renderPageInto(u); }));
  document.querySelectorAll('[data-month]').forEach(b=> b.addEventListener('click', ()=>{ session._reportMonth = b.dataset.month; renderPageInto(u); }));
  document.querySelectorAll('.report-row').forEach(el=> el.addEventListener('click', ()=>{ session._reportDate = el.dataset.opendate; session._reportView='daily'; renderPageInto(u); }));

  const backBtn = document.getElementById('backToTodayBtn');
  if(backBtn) backBtn.addEventListener('click', ()=>{ session._reportDate = null; renderPageInto(u); });

  const ds = session._reportDate || effectiveTodayStr();
  if(!isOnOrAfterLaunch(effectiveTodayStr())) return;
  const report = getOrCreateDailyReport(u.id, ds);

  document.querySelectorAll('[data-field]').forEach(inp=>{
    inp.addEventListener('input', ()=>{
      const [sec,key] = inp.dataset.field.split('.');
      const raw = inp.value;
      const value = raw===''? null : Math.max(0, Math.round(Number(raw)));
      setReportField(report, sec, key, value);
      persist();
      updateCompleteButton(report);
    });
  });
  document.querySelectorAll('[data-step]').forEach(b=> b.addEventListener('click', ()=>{
    const sec=b.dataset.sec, key=b.dataset.key, dir=Number(b.dataset.step);
    const cur = report[sec][key];
    const next = Math.max(0, (cur||0) + dir);
    setReportField(report, sec, key, next);
    persist();
    renderPageInto(u);
  }));
  const completeBtn = document.getElementById('completeReportBtn');
  if(completeBtn) completeBtn.addEventListener('click', ()=>{
    if(completeReport(report)){
      log(u.id,'daily_report_completed',{reportId:report.id, date:report.date});
      persist(); toast('Daily Report completed'); renderPageInto(u);
    } else {
      toast('Every field must have a value (0 is fine) before completing');
    }
  });
};
function updateCompleteButton(report){
  const btn = document.getElementById('completeReportBtn');
  if(!btn) return;
  const complete = isReportComplete(report);
  btn.disabled = !complete;
  btn.title = complete ? '' : 'Fill in every field (0 counts) before completing';
}
