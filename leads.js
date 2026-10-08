const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { resolveTeam, visibleSalespersonIds } = require('../middleware/rbac');
const { newId, now, audit } = require('../utils/helpers');

const router = express.Router();
router.use(requireAuth, resolveTeam);

const LEAD_STATUSES = ['Fresh', 'Unreachable', 'Showing', 'Following', 'Seller', 'Referral', 'Postponed', 'Done Deal', 'Meeting'];

function attachSubcollections(lead) {
  lead.history = db.prepare('SELECT * FROM lead_history WHERE lead_id = ? ORDER BY at DESC').all(lead.id);
  lead.notes = db.prepare('SELECT * FROM lead_notes WHERE lead_id = ? ORDER BY at DESC').all(lead.id);
  lead.reminders = db.prepare('SELECT * FROM lead_reminders WHERE lead_id = ? ORDER BY due_date ASC').all(lead.id);
  return lead;
}

// GET /api/leads?team=...&status=Fresh
router.get('/', (req, res) => {
  const ids = visibleSalespersonIds(req.user);
  let sql = 'SELECT * FROM leads WHERE team = ?';
  const params = [req.scopeTeam];
  if (ids) { sql += ` AND salesperson_id IN (${ids.map(() => '?').join(',')})`; params.push(...ids); }
  if (req.query.status) { sql += ' AND status = ?'; params.push(req.query.status); }
  sql += ' ORDER BY fresh DESC, created_at DESC';
  const leads = db.prepare(sql).all(...params);
  res.json(leads.map(attachSubcollections));
});

router.get('/:id', (req, res) => {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead || lead.team !== req.scopeTeam) return res.status(404).json({ error: 'Lead not found' });
  res.json(attachSubcollections(lead));
});

// PATCH /api/leads/:id/status  { status }
// Changing status is the "action" that clears the fresh-lead flag/notification.
router.patch('/:id/status', (req, res) => {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
  if (!lead || lead.team !== req.scopeTeam) return res.status(404).json({ error: 'Lead not found' });
  const { status } = req.body || {};
  if (!LEAD_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const canAct = lead.salesperson_id === req.user.id || require('../middleware/rbac').isMgmt(req.user) || require('../middleware/rbac').isAdmin(req.user);
  if (!canAct) return res.status(403).json({ error: 'You cannot modify this lead' });

  db.prepare('UPDATE leads SET status = ?, fresh = 0 WHERE id = ?').run(status, lead.id);
  db.prepare('INSERT INTO lead_history (id, lead_id, from_status, to_status, changed_by, at) VALUES (?,?,?,?,?,?)')
    .run(newId('lh'), lead.id, lead.status, status, req.user.id, now());
  audit(req.user.id, 'lead_status_change', { leadId: lead.id, from: lead.status, to: status });
  res.json(attachSubcollections(db.prepare('SELECT * FROM leads WHERE id = ?').get(lead.id)));
});

// POST /api/leads/:id/notes  { text }  — notes are always optional
router.post('/:id/notes', (req, res) => {
  const { text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: 'Note text required' });
  db.prepare('INSERT INTO lead_notes (id, lead_id, text, by_user, at) VALUES (?,?,?,?,?)')
    .run(newId('note'), req.params.id, text.trim(), req.user.id, now());
  res.status(201).json({ ok: true });
});

// POST /api/leads/:id/reminders  { text, dueDate }
router.post('/:id/reminders', (req, res) => {
  const { text, dueDate } = req.body || {};
  if (!text || !dueDate) return res.status(400).json({ error: 'text and dueDate are required' });
  db.prepare('INSERT INTO lead_reminders (id, lead_id, text, due_date, done, created_by) VALUES (?,?,?,?,0,?)')
    .run(newId('rem'), req.params.id, text, new Date(dueDate).getTime(), req.user.id);
  res.status(201).json({ ok: true });
});

router.patch('/reminders/:reminderId', (req, res) => {
  db.prepare('UPDATE lead_reminders SET done = ? WHERE id = ?').run(req.body.done ? 1 : 0, req.params.reminderId);
  res.json({ ok: true });
});

module.exports = router;
