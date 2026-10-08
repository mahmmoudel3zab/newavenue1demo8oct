const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const newId = (prefix) => `${prefix}_${uuidv4()}`;
const now = () => Date.now();

// Weighted, de-duplicated popularity score. Weights are intentionally not exposed
// via any API response consumed by salespeople, to avoid encouraging gaming.
const INTERACTION_WEIGHTS = { view: 1, call: 3, whatsapp: 4, pdf: 5 };

function popularityScore(unitId) {
  const rows = db.prepare('SELECT type, COUNT(*) as c FROM unit_interactions WHERE unit_id = ? GROUP BY type').all(unitId);
  return rows.reduce((sum, r) => sum + (INTERACTION_WEIGHTS[r.type] || 0) * r.c, 0);
}

// Recording an interaction is idempotent per (unit, user, type) thanks to the
// UNIQUE constraint — repeated calls from the same user do not add extra weight.
function recordInteraction(unitId, userId, type) {
  try {
    db.prepare('INSERT INTO unit_interactions (id, unit_id, user_id, type, at) VALUES (?,?,?,?,?)')
      .run(newId('int'), unitId, userId, type, now());
    return true;
  } catch (e) {
    return false; // already recorded for this user — silently ignored
  }
}

function audit(actorId, action, details) {
  db.prepare('INSERT INTO audit_log (id, actor_id, action, details_json, at) VALUES (?,?,?,?,?)')
    .run(newId('log'), actorId, action, JSON.stringify(details || {}), now());
}

// dedupKey prevents duplicate notifications for the same underlying event
// (e.g. the same fresh lead, the same owner-refresh warning on the same day).
// meta (optional) carries small structured data for deep-linking, e.g. { date: '2026-11-01' }
// so a click can open the exact missing Daily Report instead of just the Reports tab.
function notify(userId, type, text, link, dedupKey, meta) {
  try {
    db.prepare('INSERT INTO notifications (id, user_id, type, text, link, meta_json, dedup_key, is_read, at) VALUES (?,?,?,?,?,?,?,0,?)')
      .run(newId('notif'), userId, type, text, link || null, meta ? JSON.stringify(meta) : null, dedupKey || null, now());
  } catch (e) {
    // duplicate dedup_key for this user — notification already exists, ignore
  }
}

// Leads module is Phase 2 / inactive in the current application. Code/schema remain intact
// (see routes/leads.js and the leads* tables) but dormant — nothing reads or writes through
// them while this is false, and no fresh-lead/lead-reminder notifications are generated.
const LEADS_MODULE_ENABLED = false;

function ownerExpiryState(refreshedAt) {
  const days = Math.floor((now() - refreshedAt) / 86400000);
  if (days >= 30) return 'expired';
  if (days >= 25) return 'soon';
  return 'ok';
}

module.exports = { newId, now, popularityScore, recordInteraction, audit, notify, ownerExpiryState, INTERACTION_WEIGHTS, LEADS_MODULE_ENABLED };
