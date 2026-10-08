const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { resolveTeam } = require('../middleware/rbac');
const { newId, now, popularityScore, recordInteraction, audit } = require('../utils/helpers');

const router = express.Router();
router.use(requireAuth, resolveTeam);

// GET /api/units?team=...&sort=popularity|newest|oldest
//   &bedrooms=3,4,5&bathrooms=2,3&unitType=Apartment,Villa&finishing=Finished
//   &saleRent=Sale,Rent&delivery=Immediate,1y,2y,4y&q=search
// Every list filter accepts a comma-separated list so multiple options can be combined.
router.get('/', (req, res) => {
  let units = db.prepare('SELECT * FROM units WHERE team = ?').all(req.scopeTeam);

  const multi = (param) => (req.query[param] ? req.query[param].split(',').filter(Boolean) : []);
  const bedrooms = multi('bedrooms'), bathrooms = multi('bathrooms'), unitType = multi('unitType');
  const finishing = multi('finishing'), saleRent = multi('saleRent'), delivery = multi('delivery');

  const deliveryBucket = (y) => (y === 0 ? 'Immediate' : y <= 1 ? '1y' : y <= 2 ? '2y' : '4y');

  if (bedrooms.length) units = units.filter(u => bedrooms.includes(String(u.bedrooms)));
  if (bathrooms.length) units = units.filter(u => bathrooms.includes(String(u.bathrooms)));
  if (unitType.length) units = units.filter(u => unitType.includes(u.unit_type));
  if (finishing.length) units = units.filter(u => finishing.includes(u.finishing));
  if (saleRent.length) units = units.filter(u => saleRent.includes(u.sale_rent));
  if (delivery.length) units = units.filter(u => delivery.includes(deliveryBucket(u.delivery_years)));
  if (req.query.q) {
    const q = req.query.q.toLowerCase();
    units = units.filter(u => `${u.compound} ${u.developer} ${u.area}`.toLowerCase().includes(q));
  }

  units = units.map(u => ({ ...u, popularity_score: popularityScore(u.id) }));

  const sort = req.query.sort || 'popularity';
  if (sort === 'popularity') units.sort((a, b) => b.popularity_score - a.popularity_score);
  else if (sort === 'newest') units.sort((a, b) => b.created_at - a.created_at);
  else units.sort((a, b) => a.created_at - b.created_at);

  // Popularity score is used for ordering only; strip it before sending to
  // non-admins so the raw ranking mechanism isn't exposed to salespeople.
  const { isAdmin } = require('../middleware/rbac');
  if (!isAdmin(req.user)) units.forEach(u => delete u.popularity_score);

  res.json(units);
});

router.get('/:id', (req, res) => {
  const unit = db.prepare('SELECT * FROM units WHERE id = ?').get(req.params.id);
  if (!unit || unit.team !== req.scopeTeam) return res.status(404).json({ error: 'Unit not found' });
  // Viewing full unit details counts as a "view" interaction for popularity purposes.
  recordInteraction(unit.id, req.user.id, 'view');
  res.json(unit);
});

// POST /api/units — a salesperson lists their own new unit.
// It is visible immediately with pending=true; admins approve it later (see routes/admin.js).
router.post('/', (req, res) => {
  const b = req.body || {};
  if (!Array.isArray(b.photos) && !(b.photosCount >= 3)) {
    return res.status(400).json({ error: 'At least 3 photos are required for a new unit' });
  }
  const id = newId('unit');
  db.prepare(`INSERT INTO units (
    id, team, pending, compound, phase, developer, city, area, sale_rent, unit_type,
    area_size, garden, roof, bedrooms, bathrooms, delivery_years, down_payment,
    remaining_amount, remaining_installments, total_price, extra_fees, finishing,
    furnished, photos_count, owner_salesperson_id, created_at
  ) VALUES (?,?,1,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    id, req.scopeTeam, b.compound, b.phase || 'Phase 1', b.developer, b.city, b.area,
    b.saleRent, b.unitType, b.areaSize, b.garden || 0, b.roof || 0, b.bedrooms ?? null,
    b.bathrooms, b.deliveryYears ?? 0, b.downPayment, b.remainingAmount, b.remainingInstallments,
    b.totalPrice, b.extraFees || 0, b.finishing, b.furnished ? 1 : 0,
    b.photosCount ?? (b.photos || []).length, req.user.id, now()
  );
  audit(req.user.id, 'unit_created', { unitId: id });
  res.status(201).json(db.prepare('SELECT * FROM units WHERE id = ?').get(id));
});

// POST /api/units/:id/interactions  { type: 'call'|'whatsapp'|'pdf' }
// Deduplicated per (unit, user, type) at the DB layer — see unit_interactions UNIQUE constraint.
router.post('/:id/interactions', (req, res) => {
  const { type } = req.body || {};
  if (!['call', 'whatsapp', 'pdf'].includes(type)) return res.status(400).json({ error: 'Invalid interaction type' });
  const unit = db.prepare('SELECT * FROM units WHERE id = ?').get(req.params.id);
  if (!unit || unit.team !== req.scopeTeam) return res.status(404).json({ error: 'Unit not found' });
  const created = recordInteraction(unit.id, req.user.id, type);
  res.json({ ok: true, newInteraction: created });
});

module.exports = router;
