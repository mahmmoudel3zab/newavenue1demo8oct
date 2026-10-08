const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { resolveTeam } = require('../middleware/rbac');
const { newId, now } = require('../utils/helpers');

const router = express.Router();
router.use(requireAuth, resolveTeam);

function withReplies(request) {
  request.replies = db.prepare('SELECT * FROM request_replies WHERE request_id = ? ORDER BY at ASC').all(request.id);
  return request;
}

// GET /api/requests?team=...
// Returns the whole feed plus this user's personal read position for that feed —
// each salesperson has their own position, never a single shared/global one.
router.get('/', (req, res) => {
  const list = db.prepare('SELECT * FROM requests WHERE team = ? ORDER BY at ASC').all(req.scopeTeam).map(withReplies);
  const posRow = db.prepare('SELECT last_read_request_id FROM request_read_positions WHERE user_id = ? AND team = ?')
    .get(req.user.id, req.scopeTeam);
  const lastReadId = posRow ? posRow.last_read_request_id : null;
  const idx = lastReadId ? list.findIndex(r => r.id === lastReadId) : -1;
  const unreadCount = idx === -1 ? list.length : list.length - 1 - idx;
  res.json({ requests: list, lastReadRequestId: lastReadId, unreadCount });
});

// POST /api/requests  { text }
router.post('/', (req, res) => {
  const { text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: 'text is required' });
  const id = newId('req');
  db.prepare('INSERT INTO requests (id, team, author_id, text, at) VALUES (?,?,?,?,?)')
    .run(id, req.scopeTeam, req.user.id, text.trim(), now());
  res.status(201).json(withReplies(db.prepare('SELECT * FROM requests WHERE id = ?').get(id)));
});

// POST /api/requests/:id/replies  { text }
router.post('/:id/replies', (req, res) => {
  const parent = db.prepare('SELECT * FROM requests WHERE id = ?').get(req.params.id);
  if (!parent || parent.team !== req.scopeTeam) return res.status(404).json({ error: 'Request not found' });
  const { text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: 'text is required' });
  db.prepare('INSERT INTO request_replies (id, request_id, author_id, text, at) VALUES (?,?,?,?,?)')
    .run(newId('reply'), parent.id, req.user.id, text.trim(), now());
  res.status(201).json(withReplies(db.prepare('SELECT * FROM requests WHERE id = ?').get(parent.id)));
});

// PUT /api/requests/read-position  { requestId }
// Updates ONLY this user's personal position for this team's feed.
router.put('/read-position', (req, res) => {
  const { requestId } = req.body || {};
  db.prepare(`INSERT INTO request_read_positions (user_id, team, last_read_request_id) VALUES (?,?,?)
    ON CONFLICT(user_id, team) DO UPDATE SET last_read_request_id = excluded.last_read_request_id`)
    .run(req.user.id, req.scopeTeam, requestId);
  res.json({ ok: true });
});

module.exports = router;
