const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/rbac');
const { newId, now, audit, notify } = require('../utils/helpers');

const router = express.Router();
router.use(requireAuth);

// --- Pending units --------------------------------------------------------
router.get('/units/pending', requireAdmin('junioradmin'), (req, res) => {
  res.json(db.prepare('SELECT * FROM units WHERE pending = 1').all());
});

router.post('/units/:id/approve', requireAdmin('junioradmin'), (req, res) => {
  db.prepare('UPDATE units SET pending = 0 WHERE id = ?').run(req.params.id);
  audit(req.user.id, 'unit_approved', { unitId: req.params.id });
  res.json({ ok: true });
});

// --- Owner transfer requests (require explicit admin approval; never silent) ---
router.get('/owner-transfers', requireAdmin('senioradmin'), (req, res) => {
  const pending = db.prepare("SELECT * FROM owner_transfers WHERE status = 'pending'").all();
  res.json(pending);
});

router.post('/owner-transfers/:id/approve', requireAdmin('senioradmin'), (req, res) => {
  const t = db.prepare('SELECT * FROM owner_transfers WHERE id = ?').get(req.params.id);
  if (!t || t.status !== 'pending') return res.status(404).json({ error: 'No pending transfer with that id' });
  const at = now();
  db.prepare("UPDATE owner_transfers SET status = 'approved', decided_at = ?, decided_by = ? WHERE id = ?")
    .run(at, req.user.id, t.id);
  if (t.type === 'claim') {
    // Creates a NEW relationship for the requester on that specific unit only — never
    // duplicates the owner record, never touches that owner's other relationships.
    const { newId } = require('../utils/helpers');
    const id = newId('ou');
    db.prepare(`INSERT INTO owner_units (id, owner_id, unit_id, salesperson_id, status, last_update_at, next_update_at, reminder_at, created_at)
      VALUES (?,?,?,?,'active',?,?,?,?)`).run(id, t.owner_id, t.unit_id, t.to_salesperson_id, at, at + 30 * 86400000, at + 25 * 86400000, at);
    audit(req.user.id, 'owner_claim_approved', { transferId: t.id, ownerId: t.owner_id, unitId: t.unit_id });
  } else {
    // Transfer applies ONLY to this specific owner-unit relationship, not the owner's other units.
    db.prepare('UPDATE owner_units SET salesperson_id = ?, last_update_at = ?, next_update_at = ?, reminder_at = ? WHERE id = ?')
      .run(t.to_salesperson_id, at, at + 30 * 86400000, at + 25 * 86400000, t.owner_unit_id);
    audit(req.user.id, 'owner_transfer_approved', { transferId: t.id, ownerUnitId: t.owner_unit_id });
  }
  notify(t.to_salesperson_id, 'system', 'Your owner request was approved', 'owners', `xferok_${t.id}`);
  res.json({ ok: true });
});

router.post('/owner-transfers/:id/reject', requireAdmin('senioradmin'), (req, res) => {
  const t = db.prepare('SELECT * FROM owner_transfers WHERE id = ?').get(req.params.id);
  if (!t || t.status !== 'pending') return res.status(404).json({ error: 'No pending transfer with that id' });
  db.prepare("UPDATE owner_transfers SET status = 'rejected', decided_at = ?, decided_by = ? WHERE id = ?")
    .run(now(), req.user.id, t.id);
  audit(req.user.id, 'owner_transfer_rejected', { transferId: t.id });
  notify(t.to_salesperson_id, 'system', 'Your owner request was rejected', 'owners', `xferno_${t.id}`);
  res.json({ ok: true });
});

// --- Team reassignment (Residential <-> Commercial) — senior admin and above ---
router.post('/users/:id/team', requireAdmin('senioradmin'), (req, res) => {
  const { team } = req.body || {};
  if (!['residential', 'commercial'].includes(team)) return res.status(400).json({ error: 'team must be residential or commercial' });
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  db.prepare('UPDATE users SET team = ? WHERE id = ?').run(team, target.id);
  audit(req.user.id, 'team_change', { userId: target.id, from: target.team, to: team });
  res.json({ ok: true });
});

// --- User & role management — head admin only ---
router.post('/users', requireAdmin('headadmin'), (req, res) => {
  const b = req.body || {};
  const id = newId('user');
  const hash = bcrypt.hashSync(b.password || 'ChangeMe123!', 10);
  db.prepare(`INSERT INTO users (id, name, email, password_hash, role, team, manager_id, avatar_color, created_at)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(id, b.name, b.email.toLowerCase(), hash, b.role, b.team || null, b.managerId || null, b.avatarColor || '#8A6A3B', now());
  audit(req.user.id, 'user_created', { userId: id, role: b.role });
  res.status(201).json({ id });
});

router.patch('/users/:id/role', requireAdmin('headadmin'), (req, res) => {
  const { role } = req.body || {};
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  audit(req.user.id, 'user_role_changed', { userId: req.params.id, role });
  res.json({ ok: true });
});

// --- Audit log ---
router.get('/audit-log', requireAdmin('junioradmin'), (req, res) => {
  res.json(db.prepare('SELECT * FROM audit_log ORDER BY at DESC LIMIT 200').all());
});

module.exports = router;
