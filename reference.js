const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { resolveTeam, isAdmin } = require('../middleware/rbac');
const { newId, audit } = require('../utils/helpers');

const router = express.Router();
router.use(requireAuth, resolveTeam);

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM reference_entries WHERE team = ?').all(req.scopeTeam));
});

router.post('/', (req, res) => {
  if (!isAdmin(req.user)) return res.status(403).json({ error: 'Admin permissions required' });
  const b = req.body || {};
  const id = newId('ref');
  db.prepare('INSERT INTO reference_entries (id, team, code, name, phone, whatsapp, note) VALUES (?,?,?,?,?,?,?)')
    .run(id, req.scopeTeam, b.code, b.name, b.phone, b.whatsapp, b.note);
  audit(req.user.id, 'reference_added', { id });
  res.status(201).json(db.prepare('SELECT * FROM reference_entries WHERE id = ?').get(id));
});

router.delete('/:id', (req, res) => {
  if (!isAdmin(req.user)) return res.status(403).json({ error: 'Admin permissions required' });
  db.prepare('DELETE FROM reference_entries WHERE id = ?').run(req.params.id);
  audit(req.user.id, 'reference_deleted', { id: req.params.id });
  res.json({ ok: true });
});

module.exports = router;
