const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { resolveTeam, isAdmin, isMgmt, getDownlineIds } = require('../middleware/rbac');
const { newId, now, audit, notify, ownerExpiryState } = require('../utils/helpers');
const { isDigitsOnly, normalizeEgyptPhone } = require('../utils/phone');

const router = express.Router();
router.use(requireAuth, resolveTeam);

const THIRTY_DAYS = 30 * 86400000;
const TWENTYFIVE_DAYS = 25 * 86400000;

function makeRelationship(ownerId, unitId, salespersonId) {
  const t = now();
  return {
    id: newId('ou'), owner_id: ownerId, unit_id: unitId, salesperson_id: salespersonId,
    status: 'active', last_update_at: t, next_update_at: t + THIRTY_DAYS, reminder_at: t + TWENTYFIVE_DAYS, created_at: t,
  };
}
function insertRelationship(rel) {
  db.prepare(`INSERT INTO owner_units (id, owner_id, unit_id, salesperson_id, status, last_update_at, next_update_at, reminder_at, created_at)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(rel.id, rel.owner_id, rel.unit_id, rel.salesperson_id, rel.status, rel.last_update_at, rel.next_update_at, rel.reminder_at, rel.created_at);
}
// The 30-owner cap counts DISTINCT owners a salesperson has an ACTIVE relationship with —
// never the number of units/relationships, which is unlimited per owner.
function distinctOwnerCount(salespersonId) {
  const row = db.prepare("SELECT COUNT(DISTINCT owner_id) as c FROM owner_units WHERE salesperson_id = ? AND status = 'active'").get(salespersonId);
  return row.c;
}
function salespersonHasOwner(salespersonId, ownerId) {
  return !!db.prepare("SELECT 1 FROM owner_units WHERE salesperson_id = ? AND owner_id = ? AND status = 'active'").get(salespersonId, ownerId);
}
function ownerHeldByOthers(ownerId, excludingSpId) {
  return !!db.prepare("SELECT 1 FROM owner_units WHERE owner_id = ? AND status = 'active' AND salesperson_id != ?").get(ownerId, excludingSpId);
}

// GET /api/owners?team=... — visible owners + their relationships, scoped by hierarchy exactly
// like leads/units already are (own / downline / everyone for admins & top execs).
router.get('/', (req, res) => {
  let rels = db.prepare(`SELECT ou.*, o.name as owner_name, o.phone as owner_phone, o.phone2 as owner_phone2, o.team as owner_team
    FROM owner_units ou JOIN owners o ON o.id = ou.owner_id WHERE o.team = ? AND ou.status = 'active'`).all(req.scopeTeam);
  if (req.user.role === 'salesperson') rels = rels.filter(r => r.salesperson_id === req.user.id);
  else if (isMgmt(req.user)) {
    const down = new Set([req.user.id, ...getDownlineIds(req.user.id)]);
    rels = rels.filter(r => down.has(r.salesperson_id));
  }
  // group by owner for a friendlier response shape
  const byOwner = {};
  rels.forEach(r => {
    if (!byOwner[r.owner_id]) byOwner[r.owner_id] = { id: r.owner_id, name: r.owner_name, phone: r.owner_phone, phone2: r.owner_phone2, team: r.owner_team, relationships: [] };
    byOwner[r.owner_id].relationships.push({
      id: r.id, unitId: r.unit_id, salespersonId: r.salesperson_id, status: r.status,
      lastUpdateAt: r.last_update_at, nextUpdateAt: r.next_update_at, reminderAt: r.reminder_at,
      expiryState: ownerExpiryState(r.last_update_at),
    });
  });
  res.json(Object.values(byOwner));
});

// POST /api/owners  { name, phone, phone2?, unitId }
// Implements the 3-case model: brand new owner / same salesperson adding another unit to
// an owner they already have / owner already held by another salesperson (requires admin
// approval — never silently duplicates the owner record).
router.post('/', (req, res) => {
  const b = req.body || {};
  const name = (b.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Owner name is required' });
  if (!b.unitId) return res.status(400).json({ error: 'unitId is required for the initial relationship' });
  const unit = db.prepare('SELECT * FROM units WHERE id = ?').get(b.unitId);
  if (!unit || unit.team !== req.scopeTeam) return res.status(404).json({ error: 'Unit not found in this team' });

  if (!isDigitsOnly(b.phone)) return res.status(400).json({ error: 'Phone must contain digits only (no +, spaces, dashes or letters)' });
  const canonical = normalizeEgyptPhone(b.phone);
  if (!canonical) return res.status(400).json({ error: 'Enter a valid Egyptian local (01XXXXXXXXX) or international (20XXXXXXXXXXX) number' });
  let canonical2 = null;
  if (b.phone2) {
    if (!isDigitsOnly(b.phone2)) return res.status(400).json({ error: 'Second phone must contain digits only' });
    canonical2 = normalizeEgyptPhone(b.phone2);
    if (!canonical2) return res.status(400).json({ error: 'Second phone is not a valid Egyptian number' });
  }

  const existing = db.prepare('SELECT * FROM owners WHERE team = ? AND (phone = ? OR phone2 = ? OR phone = ? OR phone2 = ?)')
    .get(req.scopeTeam, canonical, canonical, canonical2 || canonical, canonical2 || canonical);

  const wouldBeNewOwnerForMe = !existing || !salespersonHasOwner(req.user.id, existing.id);
  if (wouldBeNewOwnerForMe && distinctOwnerCount(req.user.id) >= 30) {
    return res.status(409).json({ error: 'You are at the 30 active owner limit — remove an owner before adding a new one' });
  }

  if (!existing) {
    const owner = { id: newId('owner'), team: req.scopeTeam, name, phone: canonical, phone2: canonical2, created_at: now() };
    db.prepare('INSERT INTO owners (id, team, name, phone, phone2, created_at) VALUES (?,?,?,?,?,?)')
      .run(owner.id, owner.team, owner.name, owner.phone, owner.phone2, owner.created_at);
    const rel = makeRelationship(owner.id, unit.id, req.user.id);
    insertRelationship(rel);
    audit(req.user.id, 'owner_added', { ownerId: owner.id });
    return res.status(201).json({ owner, relationship: rel, outcome: 'created' });
  }

  if (salespersonHasOwner(req.user.id, existing.id)) {
    const rel = makeRelationship(existing.id, unit.id, req.user.id);
    insertRelationship(rel);
    audit(req.user.id, 'owner_unit_added', { ownerId: existing.id, unitId: unit.id });
    return res.status(201).json({ owner: existing, relationship: rel, outcome: 'unit_added' });
  }

  if (ownerHeldByOthers(existing.id, req.user.id)) {
    const holder = db.prepare("SELECT salesperson_id FROM owner_units WHERE owner_id = ? AND status = 'active' LIMIT 1").get(existing.id);
    const transfer = {
      id: newId('tr'), type: 'claim', owner_unit_id: null, owner_id: existing.id, unit_id: unit.id,
      from_salesperson_id: holder ? holder.salesperson_id : null, to_salesperson_id: req.user.id,
      status: 'pending', requested_at: now(),
    };
    db.prepare(`INSERT INTO owner_transfers (id, type, owner_unit_id, owner_id, unit_id, from_salesperson_id, to_salesperson_id, status, requested_at)
      VALUES (?,?,?,?,?,?,?,?,?)`).run(transfer.id, transfer.type, transfer.owner_unit_id, transfer.owner_id, transfer.unit_id, transfer.from_salesperson_id, transfer.to_salesperson_id, transfer.status, transfer.requested_at);
    audit(req.user.id, 'owner_claim_requested', { ownerId: existing.id, unitId: unit.id });
    return res.status(202).json({ owner: existing, outcome: 'pending_claim', transfer });
  }

  // Owner exists but has no active relationship with anyone right now — free to attach directly.
  const rel = makeRelationship(existing.id, unit.id, req.user.id);
  insertRelationship(rel);
  audit(req.user.id, 'owner_unit_added', { ownerId: existing.id, unitId: unit.id });
  res.status(201).json({ owner: existing, relationship: rel, outcome: 'unit_added' });
});

// POST /api/owners/relationships/:relId/automatic-update — relationship refreshed, unit untouched.
router.post('/relationships/:relId/automatic-update', (req, res) => {
  const rel = db.prepare('SELECT * FROM owner_units WHERE id = ?').get(req.params.relId);
  if (!rel || rel.salesperson_id !== req.user.id) return res.status(404).json({ error: 'Relationship not found for this salesperson' });
  const t = now();
  db.prepare('UPDATE owner_units SET last_update_at = ?, next_update_at = ?, reminder_at = ? WHERE id = ?')
    .run(t, t + THIRTY_DAYS, t + TWENTYFIVE_DAYS, rel.id);
  audit(req.user.id, 'owner_unit_relationship_updated', { ownerUnitId: rel.id, mode: 'automatic' });
  res.json({ ok: true });
});

// PATCH /api/owners/relationships/:relId/unit — edit the unit's info; saving also refreshes
// this relationship's 30-day cycle (and this one only — other relationships for the same
// owner are untouched).
router.patch('/relationships/:relId/unit', (req, res) => {
  const rel = db.prepare('SELECT * FROM owner_units WHERE id = ?').get(req.params.relId);
  if (!rel || rel.salesperson_id !== req.user.id) return res.status(404).json({ error: 'Relationship not found for this salesperson' });
  const b = req.body || {};
  const fields = ['compound', 'developer', 'total_price', 'down_payment', 'finishing'];
  const sets = [], vals = [];
  const map = { compound: b.compound, developer: b.developer, total_price: b.totalPrice, down_payment: b.downPayment, finishing: b.finishing };
  fields.forEach(f => { if (map[f] !== undefined) { sets.push(`${f} = ?`); vals.push(map[f]); } });
  if (sets.length) { vals.push(rel.unit_id); db.prepare(`UPDATE units SET ${sets.join(', ')} WHERE id = ?`).run(...vals); }
  const t = now();
  db.prepare('UPDATE owner_units SET last_update_at = ?, next_update_at = ?, reminder_at = ? WHERE id = ?')
    .run(t, t + THIRTY_DAYS, t + TWENTYFIVE_DAYS, rel.id);
  audit(req.user.id, 'owner_unit_relationship_updated', { ownerUnitId: rel.id, mode: 'edit_unit' });
  res.json({ ok: true });
});

// GET /api/owners/available — expired relationships belonging to OTHER salespeople in the
// scoped team, available to request a transfer for (that specific unit relationship only).
router.get('/available', (req, res) => {
  const rels = db.prepare(`SELECT ou.*, o.name as owner_name, o.team as owner_team FROM owner_units ou
    JOIN owners o ON o.id = ou.owner_id WHERE o.team = ? AND ou.status = 'active' AND ou.salesperson_id != ?`)
    .all(req.scopeTeam, req.user.id)
    .filter(r => ownerExpiryState(r.last_update_at) === 'expired');
  res.json(rels);
});

// POST /api/owners/relationships/:relId/request-transfer — requests a transfer of THIS
// relationship only; the owner's other units for the current holder are never touched.
router.post('/relationships/:relId/request-transfer', (req, res) => {
  const rel = db.prepare('SELECT * FROM owner_units WHERE id = ?').get(req.params.relId);
  if (!rel || rel.status !== 'active') return res.status(404).json({ error: 'Relationship not found' });
  if (ownerExpiryState(rel.last_update_at) !== 'expired') return res.status(400).json({ error: 'This relationship has not expired yet' });
  const existingPending = db.prepare("SELECT 1 FROM owner_transfers WHERE owner_unit_id = ? AND status = 'pending'").get(rel.id);
  if (existingPending) return res.status(409).json({ error: 'A transfer request for this relationship is already pending' });
  const transfer = {
    id: newId('tr'), type: 'transfer', owner_unit_id: rel.id, owner_id: rel.owner_id, unit_id: rel.unit_id,
    from_salesperson_id: rel.salesperson_id, to_salesperson_id: req.user.id, status: 'pending', requested_at: now(),
  };
  db.prepare(`INSERT INTO owner_transfers (id, type, owner_unit_id, owner_id, unit_id, from_salesperson_id, to_salesperson_id, status, requested_at)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(transfer.id, transfer.type, transfer.owner_unit_id, transfer.owner_id, transfer.unit_id, transfer.from_salesperson_id, transfer.to_salesperson_id, transfer.status, transfer.requested_at);
  audit(req.user.id, 'owner_transfer_requested', { ownerUnitId: rel.id });
  res.status(202).json(transfer);
});

module.exports = router;
