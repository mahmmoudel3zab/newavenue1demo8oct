// Populates the database with the same realistic demo data used in the
// front-end prototype, so both can be exercised against matching accounts.
// Run with: npm run seed   (safe to re-run — it wipes and recreates demo rows)
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { newId, now } = require('../utils/helpers');

const DEFAULT_PASSWORD = 'Demo123!';
const hash = bcrypt.hashSync(DEFAULT_PASSWORD, 10);

const COMPOUNDS_RES = ['Marina Bay Residences', 'Palm Hills Gardens', 'Sodic Waterway', 'Mivida Green Court', 'Zed East', 'Hyde Park Views'];
const DEVELOPERS_RES = ['Palm Hills Developments', 'SODIC', 'Emaar Misr', 'Ora Developers', 'Hyde Park'];
const COMPOUNDS_COM = ['Downtown Business Hub', 'Nile Corniche Tower', 'Capital Business Park', 'Smart Village Offices'];
const DEVELOPERS_COM = ['Al Ahly Sabbour', 'Arabia Holding', 'Mountain View', 'Master Group'];
const AREAS = ['New Cairo', '6th of October', 'Sheikh Zayed', 'North Coast', 'Mostakbal City', 'Maadi', 'Nasr City'];
const UNIT_TYPES_RES = ['Apartment', 'Villa', 'Twin House', 'Townhouse', 'Chalet', 'Studio'];
const UNIT_TYPES_COM = ['Office', 'Retail Store', 'Showroom', 'Clinic', 'Warehouse'];
const FINISHING = ['Finished', 'Semi-Finished', 'Unfinished', 'Super Lux'];
const FIRST_NAMES = ['Mohamed', 'Ahmed', 'Sara', 'Nadia', 'Hana', 'Youssef', 'Laila', 'Khaled', 'Mariam', 'Adham'];
const LAST_NAMES = ['Ibrahim', 'Fouad', 'Kamal', 'Naguib', 'Aziz', 'Rashad', 'Sabry', 'Zaki'];
const LEAD_STATUSES = ['Fresh', 'Unreachable', 'Showing', 'Following', 'Seller', 'Referral', 'Postponed', 'Done Deal', 'Meeting'];

let seed = 42;
function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
function rndInt(a, b) { return a + Math.floor(rnd() * (b - a + 1)); }
function pick(arr) { return arr[rndInt(0, arr.length - 1)]; }
const daysAgo = (n) => now() - n * 86400000;

function wipe() {
  // Child tables (those with FKs into owners/units/users) are cleared before their parents.
  const tables = ['audit_log', 'notifications', 'daily_reports', 'reference_entries', 'request_replies',
    'request_read_positions', 'requests', 'owner_transfers', 'owner_units', 'owners', 'unit_interactions',
    'units', 'lead_reminders', 'lead_notes', 'lead_history', 'leads', 'users'];
  tables.forEach(t => db.prepare(`DELETE FROM ${t}`).run());
}

function makeUser(id, name, email, role, team, managerId) {
  db.prepare(`INSERT INTO users (id, name, email, password_hash, role, team, manager_id, avatar_color, created_at)
    VALUES (?,?,?,?,?,?,?,?,?)`).run(id, name, email, hash, role, team, managerId, '#8A6A3B', now());
}

function seedAll() {
  wipe();

  // --- Users: mirrors the org chart used in the front-end prototype ---
  makeUser('ceo1', 'Ahmed El Sayed', 'ceo@newavenue.demo', 'ceo', null, null);
  makeUser('hos1', 'Rania Fahmy', 'hos@newavenue.demo', 'headofsales', null, 'ceo1');
  makeUser('dir1', 'Amr Hassan', 'dir.res@newavenue.demo', 'director', 'residential', 'hos1');
  makeUser('m1', 'Dina Youssef', 'manager.res@newavenue.demo', 'manager', 'residential', 'dir1');
  makeUser('tl1', 'Hossam Nabil', 'tl.res@newavenue.demo', 'teamleader', 'residential', 'm1');
  makeUser('s1', 'Mona Adel', 's1@newavenue.demo', 'salesperson', 'residential', 'tl1');
  makeUser('s2', 'Karim Fathy', 's2@newavenue.demo', 'salesperson', 'residential', 'tl1');
  makeUser('s3', 'Yara Ali', 's3@newavenue.demo', 'salesperson', 'residential', 'tl1');
  makeUser('dir2', 'Heba El Nagar', 'dir.com@newavenue.demo', 'director', 'commercial', 'hos1');
  makeUser('m2', 'Sherif Adel', 'manager.com@newavenue.demo', 'manager', 'commercial', 'dir2');
  makeUser('tl2', 'Nour Khaled', 'tl.com@newavenue.demo', 'teamleader', 'commercial', 'm2');
  makeUser('s4', 'Tarek Samir', 's4@newavenue.demo', 'salesperson', 'commercial', 'tl2');
  makeUser('s5', 'Lobna Adly', 's5@newavenue.demo', 'salesperson', 'commercial', 'tl2');
  makeUser('ja1', 'Salma Ezz', 'junioradmin@newavenue.demo', 'junioradmin', null, null);
  makeUser('sa1', 'Mostafa Reda', 'senioradmin@newavenue.demo', 'senioradmin', null, null);
  makeUser('ha1', 'Laila Mansour', 'headadmin@newavenue.demo', 'headadmin', null, null);

  const salespeople = db.prepare("SELECT * FROM users WHERE role = 'salesperson'").all();

  // --- Units ---
  salespeople.forEach(sp => {
    const isRes = sp.team === 'residential';
    const count = rndInt(4, 6);
    for (let i = 0; i < count; i++) {
      const total = rndInt(isRes ? 2800000 : 5200000, isRes ? 18500000 : 42000000);
      const dp = Math.round(total * (rndInt(10, 30) / 100));
      const unitType = pick(isRes ? UNIT_TYPES_RES : UNIT_TYPES_COM);
      const bedrooms = isRes ? (unitType === 'Studio' ? 0 : rndInt(1, 5)) : null;
      db.prepare(`INSERT INTO units (id, team, pending, compound, phase, developer, city, area, sale_rent,
        unit_type, area_size, garden, roof, bedrooms, bathrooms, delivery_years, down_payment,
        remaining_amount, remaining_installments, total_price, extra_fees, finishing, furnished,
        photos_count, owner_salesperson_id, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(newId('unit'), sp.team, rnd() < 0.16 ? 1 : 0, pick(isRes ? COMPOUNDS_RES : COMPOUNDS_COM), 'Phase ' + rndInt(1, 4),
          pick(isRes ? DEVELOPERS_RES : DEVELOPERS_COM), 'Cairo', pick(AREAS), rnd() < 0.85 ? 'Sale' : 'Rent',
          unitType, isRes ? rndInt(90, 420) : rndInt(60, 900), isRes && rnd() < 0.3 ? rndInt(50, 200) : 0,
          isRes && rnd() < 0.2 ? rndInt(40, 150) : 0, bedrooms, rndInt(1, Math.max(2, bedrooms || 2)),
          pick([0, 0, 1, 1, 2, 4]), dp, total - dp, pick([12, 18, 24, 36, 48, 60]), total, Math.round(total * 0.03),
          pick(FINISHING), rnd() < 0.35 ? 1 : 0, rndInt(3, 6), sp.id, daysAgo(rndInt(0, 60)));
    }
  });
  const allUnits = db.prepare('SELECT * FROM units').all();
  // seed some interaction history so popularity sorting has variety
  allUnits.forEach(u => {
    const viewers = pick(salespeople).id;
    for (let i = 0; i < rndInt(0, 8); i++) {
      try {
        db.prepare('INSERT INTO unit_interactions (id, unit_id, user_id, type, at) VALUES (?,?,?,?,?)')
          .run(newId('int'), u.id, pick(salespeople).id, 'view', daysAgo(rndInt(0, 20)));
      } catch (e) { /* dedup collision, ignore */ }
    }
  });

  // --- Leads ---
  salespeople.forEach(sp => {
    const unitsForTeam = allUnits.filter(u => u.team === sp.team);
    const makeLead = (forceFresh) => {
      const status = forceFresh ? 'Fresh' : pick(LEAD_STATUSES.slice(1));
      const createdAt = forceFresh ? now() - rndInt(0, 6) * 3600000 : daysAgo(rndInt(1, 45));
      const id = newId('lead');
      db.prepare(`INSERT INTO leads (id, team, salesperson_id, name, phone, source, status, fresh,
        interested_unit_id, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`)
        .run(id, sp.team, sp.id, `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`, `01${rndInt(0,2)}${rndInt(10000000,99999999)}`,
          pick(['Facebook Ad', 'Website Form', 'Walk-in', 'Referral']), status, status === 'Fresh' ? 1 : 0,
          rnd() < 0.6 && unitsForTeam.length ? pick(unitsForTeam).id : null, createdAt);
      db.prepare('INSERT INTO lead_history (id, lead_id, from_status, to_status, changed_by, at) VALUES (?,?,?,?,?,?)')
        .run(newId('lh'), id, null, status, sp.id, createdAt);
    };
    makeLead(true);
    if (rnd() < 0.5) makeLead(true);
    for (let i = 0; i < rndInt(3, 6); i++) makeLead(false);
  });

  // --- Requests ---
  ['residential', 'commercial'].forEach(team => {
    const teamSales = salespeople.filter(s => s.team === team);
    let t = daysAgo(20);
    const templates = [
      'Looking for a unit in {area}, any options?',
      'Client needs immediate delivery, cash buyer.',
      'Sharing a fresh listing in {area}, DM me.',
      'Need a plan with 40% down payment for a client meeting tomorrow.',
    ];
    for (let i = 0; i < 40; i++) {
      t += rndInt(1, 7) * 3600000;
      const author = pick(teamSales);
      const id = newId('req');
      db.prepare('INSERT INTO requests (id, team, author_id, text, at) VALUES (?,?,?,?,?)')
        .run(id, team, author.id, pick(templates).replace('{area}', pick(AREAS)), t);
      if (rnd() < 0.35) {
        db.prepare('INSERT INTO request_replies (id, request_id, author_id, text, at) VALUES (?,?,?,?,?)')
          .run(newId('reply'), id, pick(teamSales).id, 'Following up on this, calling you now.', t + rndInt(1, 4) * 3600000);
      }
    }
    // give each salesperson a read position a few messages back so unread state is visible
    const teamRequests = db.prepare('SELECT * FROM requests WHERE team = ? ORDER BY at ASC').all(team);
    teamSales.forEach(sp => {
      const idx = Math.max(0, teamRequests.length - 1 - rndInt(4, 12));
      db.prepare('INSERT INTO request_read_positions (user_id, team, last_read_request_id) VALUES (?,?,?)')
        .run(sp.id, team, teamRequests[idx].id);
    });
  });

  // --- Owners + real Owner<->Unit relationships ---
  // An owner is a contact (name + normalized phone); the relationship to a specific unit
  // (with its own 30-day update cycle) lives in owner_units — never a bare count on the owner.
  const usedPhones = new Set();
  function freshPhone() {
    let p;
    do { p = '2001' + rndInt(0, 2) + rndInt(10000000, 99999999); } while (usedPhones.has(p));
    usedPhones.add(p);
    return p;
  }
  const allInsertedRelationships = [];
  salespeople.forEach(sp => {
    const spUnits = allUnits.filter(u => u.team === sp.team && u.owner_salesperson_id === sp.id);
    if (!spUnits.length) return;
    const pool = [...spUnits];
    const ownerCount = Math.min(rndInt(2, 5), pool.length);
    for (let i = 0; i < ownerCount && pool.length; i++) {
      const take = Math.min(rndInt(1, 3), pool.length);
      const takenUnits = pool.splice(0, take);
      const ownerId = newId('owner');
      db.prepare('INSERT INTO owners (id, team, name, phone, phone2, created_at) VALUES (?,?,?,?,?,?)')
        .run(ownerId, sp.team, `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`, freshPhone(), rnd() < 0.3 ? freshPhone() : null, daysAgo(rndInt(10, 60)));
      takenUnits.forEach(unit => {
        const lastUpdateDaysAgo = rndInt(0, 32);
        const lastUpdateAt = daysAgo(lastUpdateDaysAgo);
        const relId = newId('ou');
        db.prepare(`INSERT INTO owner_units (id, owner_id, unit_id, salesperson_id, status, last_update_at, next_update_at, reminder_at, created_at)
          VALUES (?,?,?,?,'active',?,?,?,?)`)
          .run(relId, ownerId, unit.id, sp.id, lastUpdateAt, lastUpdateAt + 30 * 86400000, lastUpdateAt + 25 * 86400000, lastUpdateAt);
        allInsertedRelationships.push(relId);
      });
    }
  });
  // force a couple of demo states: one relationship "soon", one "expired" (available for transfer)
  if (allInsertedRelationships[0]) {
    const t = daysAgo(27);
    db.prepare('UPDATE owner_units SET last_update_at=?, next_update_at=?, reminder_at=? WHERE id=?')
      .run(t, t + 30 * 86400000, t + 25 * 86400000, allInsertedRelationships[0]);
  }
  if (allInsertedRelationships[1]) {
    const t = daysAgo(31);
    db.prepare('UPDATE owner_units SET last_update_at=?, next_update_at=?, reminder_at=? WHERE id=?')
      .run(t, t + 30 * 86400000, t + 25 * 86400000, allInsertedRelationships[1]);
  }

  // --- Reference dictionary ---
  [...salespeople, ...db.prepare("SELECT * FROM users WHERE role = 'teamleader'").all()].forEach(u => {
    db.prepare('INSERT INTO reference_entries (id, team, code, name, phone, whatsapp, note) VALUES (?,?,?,?,?,?,?)')
      .run(newId('ref'), u.team, (u.team === 'residential' ? 'RES-' : 'COM-') + u.id.toUpperCase(), u.name,
        `01${rndInt(0,2)}${rndInt(10000000,99999999)}`, `+2001${rndInt(0,2)}${rndInt(10000000,99999999)}`, u.role);
  });

  console.log('Seed complete.');
  console.log(`All demo accounts use the password: ${DEFAULT_PASSWORD}`);
  console.log('Example logins: s1@newavenue.demo (residential salesperson), s4@newavenue.demo (commercial salesperson),');
  console.log('tl1@newavenue.demo (team leader), m1@newavenue.demo (manager), headadmin@newavenue.demo (head admin)');
}

seedAll();
