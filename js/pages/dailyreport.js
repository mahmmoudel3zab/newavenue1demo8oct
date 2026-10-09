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
  // Role never removes personal sales activity — every sales-active person (plain salespeople
  // AND every management role above them) files their OWN Daily Report. Management additionally
  // gets a "Team Reports" view of their downline's reports — kept strictly separate from their
  // own personal report, never merged into one combined view.
  if(!isSalesActive(u)){
    return `<div class="empty-state">${ic('calendar')}<div>Daily Performance Reports are filed by sales-active users. A company-wide rollup for admins is planned for a future phase.</div></div>`;
  }
  const mgmt = isMgmt(u);
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
  // Management roles get a SIMPLE personal report (Daily Comments + Daily Activities) instead
  // of the full 11-metric salesperson form — so there is no numeric monthly rollup to show them;
  // "My Monthly Reports" only applies to the detailed salesperson form.
  const tabs = `<div class="tabs">
    <button class="tab-btn ${view==='daily'?'active':''}" data-reportview="daily">My Daily Report</button>
    ${!mgmt?`<button class="tab-btn ${view==='monthly'?'active':''}" data-reportview="monthly">My Monthly Reports</button>`:''}
    ${mgmt?`<button class="tab-btn ${view==='team'?'active':''}" data-reportview="team">${ic('team')} Team Reports</button>`:''}
  </div>`;
  let body;
  if(view==='monthly' && !mgmt) body = renderMonthlyView(u);
  else if(view==='team' && mgmt) body = renderTeamReportsView(u);
  else if(mgmt) body = renderSimpleMgmtView(u, session._reportDate || today);
  else body = renderDailyView(u, session._reportDate || today);
  return tabs + body;
}

/* ---------- Management's own report: Daily Comments + Daily Activities (free text) ----------
   Managers are also salespeople, but are NOT required to fill the detailed 11-metric form —
   this is their own, separate, much simpler personal report. One per manager per date
   (getOrCreateMgmtReport), stored in DB.mgmtReports — a completely separate collection from
   DB.dailyReports (the salesperson form), so it is never read by the Team Reports view below
   or mixed with a salesperson's report in any way. */
function renderSimpleMgmtView(u, ds){
  const today = effectiveTodayStr();
  const report = getOrCreateMgmtReport(u.id, ds);
  const isToday = ds===today;
  const submitted = !!(report.comments.trim() && report.activities.trim());
  const history = mgmtReportsForUser(u.id).filter(r=> r.comments.trim() || r.activities.trim());
  return `
  <div class="card card-pad" style="margin-bottom:16px;">
    <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:4px;">
      <div>
        <div class="section-title" style="margin-bottom:4px;">My Daily Report</div>
        <div class="section-sub" style="margin-bottom:0;">${esc(ds)}${isToday?' · Today':''} ${submitted?'<span class="badge badge-success">Submitted</span>':'<span class="badge badge-pending">Draft</span>'}</div>
      </div>
      ${!isToday?`<button class="btn btn-sm" id="backToTodayBtn">Back to today</button>`:''}
    </div>
    <div class="section-sub" style="margin-bottom:0;">This belongs to you personally — ${esc(u.name.split(' ')[0])} — and is kept separate from your team's reports. Quick and simple: just two fields.</div>
  </div>
  <div class="card card-pad" style="margin-bottom:16px;">
    <div class="field"><label class="field-label">Daily Comments</label>
      <textarea id="mr_comments" rows="3" placeholder="e.g. Followed up with the team regarding current inventory priorities.">${esc(report.comments)}</textarea>
    </div>
    <div class="field" style="margin-bottom:0;"><label class="field-label">Daily Activities</label>
      <textarea id="mr_activities" rows="4" placeholder="e.g. Reviewed 12 units, held a team meeting, and followed up on 5 important leads.">${esc(report.activities)}</textarea>
    </div>
  </div>
  <div style="display:flex; justify-content:flex-end; margin-bottom:22px;">
    <button class="btn btn-primary" id="saveMgmtReportBtn">${ic('check')} ${submitted?'Update report':'Submit report'}</button>
  </div>
  <div class="section-title" style="font-size:14px; margin-bottom:2px;">Report history</div>
  <div class="section-sub">Your own past daily reports — never mixed with your team's.</div>
  <div class="card">
    ${history.length ? history.slice(0,30).map(r=>`<div class="report-row" data-opendate="${r.date}" style="cursor:pointer; padding:12px 16px; border-bottom:1px solid var(--border);">
      <div style="display:flex; align-items:center; gap:8px; margin-bottom:3px;"><span style="font-weight:700; font-size:12.5px;">${esc(r.date)}</span>${r.date===today?'<span class="badge badge-brand">Today</span>':''}</div>
      <div style="font-size:12px; color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(r.comments||r.activities||'')}</div>
    </div>`).join('') : emptyRow('No submitted reports yet — fill in the form above to get started.')}
  </div>`;
}

// Team Reports — a management user's DOWNLINE's Daily Report status for a given date, kept
// entirely separate from the manager's own personal report (never merged together). The
// downline can itself include other management users (e.g. a Sales Manager's downline includes
// Team Leaders), so this splits into two sections: salespeople file the detailed 11-metric form
// (DB.dailyReports), management downline members file the simple Comments+Activities form
// (DB.mgmtReports) — each read from its own collection, never conflated.
function renderTeamReportsView(u){
  const ds = session._teamReportDate || effectiveTodayStr();
  const down = getDownlineIds(DB.users, u.id).map(id=>DB.users.find(x=>x.id===id)).filter(x=>x && isSalesActive(x));
  const downSales = down.filter(x=>x.role==='salesperson');
  const downMgmt = down.filter(x=>isMgmt(x));
  return `
  <div class="card card-pad" style="margin-bottom:14px; display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
    <label class="field-label" style="margin:0;">Date</label>
    <input type="date" id="teamReportDate" value="${esc(ds)}" style="width:auto;" min="${DAILY_REPORT_LAUNCH_DATE}">
  </div>
  ${downSales.length?`<div class="section-title" style="font-size:14px; margin-bottom:8px;">Salespeople — detailed reports</div>
  <div class="card" style="overflow-x:auto; margin-bottom:18px;">
    <table><thead><tr><th>Salesperson</th><th>Role</th><th>Status</th><th>Calls</th><th>Showings</th><th>Meetings</th><th>Closed Deals</th></tr></thead><tbody>
    ${downSales.map(su=>{
      const r = getDailyReport(su.id, ds);
      const st = !isOnOrAfterLaunch(ds) ? 'n/a' : (r ? r.status : 'missing');
      const stBadge = st==='completed' ? '<span class="badge badge-success">Completed</span>' : st==='in_progress' ? '<span class="badge badge-pending">In progress</span>' : st==='missing' ? '<span class="badge badge-fresh">Missing</span>' : '<span class="badge badge-muted">—</span>';
      const calls = r ? fmtVal(r.calls.count) : '—';
      const show = r ? (fmtVal(r.showings.buyer)+' / '+fmtVal(r.showings.seller)) : '—';
      const mtg = r ? (fmtVal(r.meetings.buyer)+' / '+fmtVal(r.meetings.seller)+' / '+fmtVal(r.meetings.developer)) : '—';
      const closed = r ? fmtVal(r.other.closedDeals) : '—';
      return `<tr><td style="font-weight:700;">${esc(su.name)}</td><td>${esc(ROLE_LABELS[su.role])}</td><td>${stBadge}</td><td>${calls}</td><td>${show}</td><td>${mtg}</td><td>${closed}</td></tr>`;
    }).join('')}
    </tbody></table>
  </div>` : ''}
  ${downMgmt.length?`<div class="section-title" style="font-size:14px; margin-bottom:8px;">Management team — personal reports</div>
  <div class="card" style="margin-bottom:18px;">
    ${downMgmt.map(mu=>{
      const r = getMgmtReport(mu.id, ds);
      const submitted = !isOnOrAfterLaunch(ds) ? null : !!(r && r.comments.trim() && r.activities.trim());
      const stBadge = submitted===null ? '<span class="badge badge-muted">—</span>' : submitted ? '<span class="badge badge-success">Submitted</span>' : '<span class="badge badge-fresh">Missing</span>';
      return `<div class="card-pad" style="border-bottom:1px solid var(--border);">
        <div style="display:flex; align-items:center; gap:8px; margin-bottom:5px; flex-wrap:wrap;">
          <span style="font-weight:700; font-size:13px;">${esc(mu.name)}</span><span style="font-size:11px; color:var(--text-faint);">${esc(ROLE_LABELS[mu.role])}</span>${stBadge}
        </div>
        ${r && (r.comments||r.activities) ? `
        <div style="font-size:12px; color:var(--text-muted); margin-bottom:3px;"><b>Comments:</b> ${esc(r.comments||'—')}</div>
        <div style="font-size:12px; color:var(--text-muted);"><b>Activities:</b> ${esc(r.activities||'—')}</div>` : `<div style="font-size:12px; color:var(--text-faint);">No report submitted for this date yet.</div>`}
      </div>`;
    }).join('')}
  </div>` : ''}
  ${!downSales.length && !downMgmt.length ? `<div class="card">${emptyRow('No team members with their own report yet.')}</div>` : ''}`;
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

  const teamDateInp = document.getElementById('teamReportDate');
  if(teamDateInp) teamDateInp.addEventListener('change', ()=>{ session._teamReportDate = teamDateInp.value; renderPageInto(u); });
  if((session._reportView||'daily')==='team') return; // Team Reports view has no personal fields to wire up

  const ds = session._reportDate || effectiveTodayStr();
  if(!isOnOrAfterLaunch(effectiveTodayStr())) return;

  if(isMgmt(u)){
    // Simple management report: comments/activities are only written to DB.mgmtReports when
    // the Save button is clicked (not on every keystroke), so typing never triggers a full
    // page re-render and there is no focus-loss issue to work around here.
    const saveBtn = document.getElementById('saveMgmtReportBtn');
    if(saveBtn) saveBtn.addEventListener('click', ()=>{
      const comments = document.getElementById('mr_comments').value;
      const activities = document.getElementById('mr_activities').value;
      const report = getOrCreateMgmtReport(u.id, ds);
      saveMgmtReport(report, comments, activities);
      log(u.id,'mgmt_report_saved',{reportId:report.id, date:report.date});
      persist(); toast('Daily Report saved'); renderPageInto(u);
    });
    return;
  }

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
