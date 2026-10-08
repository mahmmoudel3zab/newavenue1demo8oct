const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { ownerExpiryState, notify, LEADS_MODULE_ENABLED } = require('../utils/helpers');

const router = express.Router();
router.use(requireAuth);

const LAUNCH_DATE = '2026-11-01';
function previousDateStr(ds) {
  const [y, m, d] = ds.split('-').map(Number);
  const dt = new Date(y, m - 1, d); dt.setDate(dt.getDate() - 1);
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
}

// Ensures notifications exist for the current state of this user's owner-relationship
// refresh warnings and missing-Daily-Report reminder. Safe to call often — dedup_key stops
// repeats. Leads notifications are gated behind LEADS_MODULE_ENABLED (Phase 2 / inactive).
function syncNotifications(user) {
  if (user.role === 'salesperson') {
    if (LEADS_MODULE_ENABLED) {
      const freshLeads = db.prepare('SELECT * FROM leads WHERE salesperson_id = ? AND fresh = 1').all(user.id);
      freshLeads.forEach(l => notify(user.id, 'fresh_lead', `You have a fresh lead: ${l.name}`, 'leads', `fresh_${l.id}`));

      const due = db.prepare(`SELECT r.* FROM lead_reminders r JOIN leads l ON l.id = r.lead_id
        WHERE l.salesperson_id = ? AND r.done = 0 AND r.due_date <= ?`).all(user.id, Date.now());
      due.forEach(r => notify(user.id, 'reminder', `Reminder due: ${r.text}`, 'leads', `reminder_${r.id}`));
    }

    // Owner refresh reminders are PER Owner<->Unit relationship, each with its own 30-day cycle.
    const rels = db.prepare(`SELECT ou.*, o.name as owner_name FROM owner_units ou JOIN owners o ON o.id = ou.owner_id
      WHERE ou.salesperson_id = ? AND ou.status = 'active'`).all(user.id);
    rels.forEach(r => {
      const state = ownerExpiryState(r.last_update_at);
      const bucket = Math.floor(r.last_update_at / 86400000);
      if (state === 'soon') notify(user.id, 'owner_refresh', `Owner ${r.owner_name} needs an update soon`, 'owners', `relsoon_${r.id}_${bucket}`);
      if (state === 'expired') notify(user.id, 'owner_refresh', `Owner ${r.owner_name} has expired and may become available to others`, 'owners', `relexp_${r.id}_${bucket}`);
    });

    // Daily Performance Report — previous day missing/incomplete (stays editable, never locks).
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = previousDateStr(today);
    if (today >= LAUNCH_DATE && yesterday >= LAUNCH_DATE) {
      const row = db.prepare('SELECT * FROM daily_reports WHERE salesperson_id = ? AND date = ?').get(user.id, yesterday);
      if (!row || row.status !== 'completed') {
        notify(user.id, 'daily_report_missing', `You didn't complete yesterday's Daily Report (${yesterday})`, 'reports', `drmiss_${user.id}_${yesterday}`, { date: yesterday });
      }
    }
  }
  if (['junioradmin', 'senioradmin', 'headadmin'].includes(user.role)) {
    const pending = db.prepare("SELECT * FROM owner_transfers WHERE status = 'pending'").all();
    pending.forEach(t => notify(user.id, 'system', 'An owner transfer/claim request is awaiting your approval', 'admin', `transfer_${t.id}`));
  }
}

router.get('/', (req, res) => {
  syncNotifications(req.user);
  const rows = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY at DESC').all(req.user.id);
  res.json(rows.map(r => ({ ...r, meta: r.meta_json ? JSON.parse(r.meta_json) : null })));
});

router.patch('/:id/read', (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

module.exports = router;
