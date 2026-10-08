const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { isAdmin, isMgmt, getDownlineIds } = require('../middleware/rbac');

const router = express.Router();
router.use(requireAuth);

function safe(u) { const { password_hash, ...rest } = u; return rest; }

// GET /api/users — admins see everyone; managers see themselves + downline; salespeople see themselves.
router.get('/', (req, res) => {
  const all = db.prepare('SELECT * FROM users').all();
  if (isAdmin(req.user)) return res.json(all.map(safe));
  if (isMgmt(req.user)) {
    const ids = new Set([req.user.id, ...getDownlineIds(req.user.id)]);
    return res.json(all.filter(u => ids.has(u.id)).map(safe));
  }
  return res.json([safe(req.user)]);
});

// GET /api/users/:id/team-summary — quick counts for the manager dashboard rollup
router.get('/:id/team-summary', (req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'Not found' });
  const freshLeads = db.prepare('SELECT COUNT(*) c FROM leads WHERE salesperson_id = ? AND fresh = 1').get(target.id).c;
  const totalLeads = db.prepare('SELECT COUNT(*) c FROM leads WHERE salesperson_id = ?').get(target.id).c;
  const units = db.prepare('SELECT COUNT(*) c FROM units WHERE owner_salesperson_id = ?').get(target.id).c;
  const owners = db.prepare("SELECT COUNT(*) c FROM owners WHERE salesperson_id = ? AND status='active'").get(target.id).c;
  res.json({ freshLeads, totalLeads, units, owners });
});

module.exports = router;
