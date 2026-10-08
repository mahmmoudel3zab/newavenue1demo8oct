const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { newId, now, audit } = require('../utils/helpers');

const router = express.Router();
router.use(requireAuth);

const LAUNCH_DATE = '2026-11-01';
// Exactly 11 required metrics, grouped into 5 sections — do not add or remove fields.
const FIELD_COLUMNS = [
  ['calls', 'count', 'calls_count'], ['calls', 'active', 'calls_active'],
  ['leads', 'count', 'leads_count'],
  ['showings', 'buyer', 'showings_buyer'], ['showings', 'seller', 'showings_seller'],
  ['meetings', 'buyer', 'meetings_buyer'], ['meetings', 'seller', 'meetings_seller'], ['meetings', 'developer', 'meetings_developer'],
  ['other', 'inventory', 'other_inventory'], ['other', 'orientation', 'other_orientation'], ['other', 'closedDeals', 'other_closed_deals'],
];

function rowToReport(row) {
  if (!row) return null;
  const out = { id: row.id, salespersonId: row.salesperson_id, date: row.date, status: row.status,
    calls: {}, leads: {}, showings: {}, meetings: {}, other: {},
    createdAt: row.created_at, updatedAt: row.updated_at, completedAt: row.completed_at };
  FIELD_COLUMNS.forEach(([section, key, col]) => { out[section][key] = row[col] === null || row[col] === undefined ? null : row[col]; });
  return out;
}
function isComplete(row) { return FIELD_COLUMNS.every(([, , col]) => row[col] !== null && row[col] !== undefined); }

// Finds-or-creates — this is the single choke point that, combined with the
// UNIQUE(salesperson_id, date) constraint, guarantees exactly one report per
// salesperson per date. A racing double-click/double-request cannot create two rows:
// the INSERT either succeeds once or fails with a UNIQUE violation, which is swallowed
// and followed by a normal SELECT of the now-existing row.
function getOrCreateReport(salespersonId, date) {
  let row = db.prepare('SELECT * FROM daily_reports WHERE salesperson_id = ? AND date = ?').get(salespersonId, date);
  if (row) return row;
  const id = newId('dr');
  const t = now();
  try {
    db.prepare(`INSERT INTO daily_reports (id, salesperson_id, date, status, created_at, updated_at) VALUES (?,?,?,?,?,?)`)
      .run(id, salespersonId, date, 'in_progress', t, t);
  } catch (e) {
    // another request already created it concurrently — fall through to re-select
  }
  row = db.prepare('SELECT * FROM daily_reports WHERE salesperson_id = ? AND date = ?').get(salespersonId, date);
  return row;
}
function previousDateStr(ds) {
  const [y, m, d] = ds.split('-').map(Number);
  const dt = new Date(y, m - 1, d); dt.setDate(dt.getDate() - 1);
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
}

// Salespeople only — reports are per-salesperson. (Manager personal reports are a future phase.)
router.use((req, res, next) => {
  if (req.user.role !== 'salesperson') return res.status(403).json({ error: 'Daily Reports are filed by salespeople' });
  next();
});

router.get('/today', (req, res) => {
  const ds = req.query.date || new Date().toISOString().slice(0, 10);
  if (ds < LAUNCH_DATE) return res.json({ launched: false, launchDate: LAUNCH_DATE });
  const row = getOrCreateReport(req.user.id, ds);
  res.json({ launched: true, report: rowToReport(row) });
});

// IMPORTANT: fixed-path routes ('/months', '/previous-incomplete/check', '/monthly/:month')
// must be registered BEFORE the generic single-segment '/:date' route below. Express (and
// this app's router) matches routes in registration order, and '/:date' matches any single
// path segment — including the literal word "months" — so registering it first would
// silently swallow GET /months as if date === 'months'. Keeping the specific routes first
// is what makes /months, etc. reachable at all.

// GET /previous-incomplete/check — used on login/launch to drive the "you didn't complete
// yesterday's report" notification; the report stays editable even after the day ends.
router.get('/previous-incomplete/check', (req, res) => {
  const today = req.query.date || new Date().toISOString().slice(0, 10);
  const yesterday = previousDateStr(today);
  if (yesterday < LAUNCH_DATE) return res.json({ missing: false });
  const row = db.prepare('SELECT * FROM daily_reports WHERE salesperson_id = ? AND date = ?').get(req.user.id, yesterday);
  const missing = !row || row.status !== 'completed';
  res.json({ missing, date: yesterday });
});

// GET /monthly/:month  ('YYYY-MM') — daily rows + totals computed live, never stored.
router.get('/monthly/:month', (req, res) => {
  const rows = db.prepare("SELECT * FROM daily_reports WHERE salesperson_id = ? AND date LIKE ? ORDER BY date")
    .all(req.user.id, req.params.month + '-%');
  const reports = rows.map(rowToReport);
  const totals = {};
  FIELD_COLUMNS.forEach(([s, k]) => { totals[s + '.' + k] = reports.reduce((sum, r) => sum + (r[s][k] || 0), 0); });
  res.json({ month: req.params.month, reports, totals });
});

// GET /months — distinct months that have data, plus the current month (never requires
// manual month creation).
router.get('/months', (req, res) => {
  const rows = db.prepare("SELECT DISTINCT substr(date,1,7) as m FROM daily_reports WHERE salesperson_id = ? ORDER BY m").all(req.user.id);
  const months = new Set(rows.map(r => r.m));
  const today = new Date().toISOString().slice(0, 10);
  if (today >= LAUNCH_DATE) months.add(today.slice(0, 7));
  res.json([...months].filter(m => m >= LAUNCH_DATE.slice(0, 7)).sort());
});

router.get('/:date', (req, res) => {
  const row = db.prepare('SELECT * FROM daily_reports WHERE salesperson_id = ? AND date = ?').get(req.user.id, req.params.date);
  if (!row) return res.status(404).json({ error: 'No report for that date yet' });
  res.json(rowToReport(row));
});

// PUT /:date  { section, key, value } — value may be 0 (valid) or null (clears a field).
// Never creates a second row for an existing salesperson+date — always updates the one row.
router.put('/:date', (req, res) => {
  const ds = req.params.date;
  if (ds < LAUNCH_DATE) return res.status(400).json({ error: `Daily Reports begin ${LAUNCH_DATE}` });
  const { section, key, value } = req.body || {};
  const col = (FIELD_COLUMNS.find(([s, k]) => s === section && k === key) || [])[2];
  if (!col) return res.status(400).json({ error: 'Unknown field' });
  if (value !== null && (typeof value !== 'number' || value < 0 || !Number.isFinite(value))) {
    return res.status(400).json({ error: 'Value must be a non-negative number, or null to clear it' });
  }
  const row = getOrCreateReport(req.user.id, ds);
  const t = now();
  db.prepare(`UPDATE daily_reports SET ${col} = ?, updated_at = ?,
      status = CASE WHEN status = 'completed' AND ? IS NULL THEN 'in_progress' ELSE status END,
      completed_at = CASE WHEN status = 'completed' AND ? IS NULL THEN NULL ELSE completed_at END
    WHERE id = ?`).run(value, t, value, value, row.id);
  res.json(rowToReport(db.prepare('SELECT * FROM daily_reports WHERE id = ?').get(row.id)));
});

// POST /:date/complete — only succeeds when every one of the 11 fields has a value (0 counts).
router.post('/:date/complete', (req, res) => {
  const row = db.prepare('SELECT * FROM daily_reports WHERE salesperson_id = ? AND date = ?').get(req.user.id, req.params.date);
  if (!row) return res.status(404).json({ error: 'No report for that date yet' });
  if (!isComplete(row)) return res.status(400).json({ error: 'Every field must have a value (0 is valid) before completing' });
  const t = now();
  db.prepare("UPDATE daily_reports SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?").run(t, t, row.id);
  audit(req.user.id, 'daily_report_completed', { reportId: row.id, date: row.date });
  res.json(rowToReport(db.prepare('SELECT * FROM daily_reports WHERE id = ?').get(row.id)));
});

module.exports = router;
