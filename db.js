// src/db.js
// SQLite is used here as a lightweight, zero-ops choice for the MVP phase.
// Swap the connection layer for Postgres/MySQL later without touching route logic,
// as long as the query helpers below are reimplemented against the new driver.
require('dotenv').config();
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || './data/new-avenue-1.sqlite';
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

let db;
let engine;
try {
  // better-sqlite3 remains this project's declared, primary dependency (see package.json) —
  // used whenever it's actually installed (`npm install` in an environment with registry access).
  const Database = require('better-sqlite3');
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  engine = 'better-sqlite3';
} catch (e) {
  // better-sqlite3 isn't installed (e.g. no network access to the npm registry). Node's
  // built-in node:sqlite module exposes a near-identical prepare().run()/get()/all() surface,
  // so this fallback lets the exact same route code run and be verified end-to-end without
  // changing a single query. This is a compatibility shim only — it is not a replacement
  // architecture, and `npm install` will always prefer the real declared dependency above.
  const { DatabaseSync } = require('node:sqlite');
  const raw = new DatabaseSync(DB_PATH);
  raw.exec('PRAGMA journal_mode = WAL');
  raw.exec('PRAGMA foreign_keys = ON');
  db = {
    exec: (sql) => raw.exec(sql),
    pragma: (expr) => { try { raw.exec('PRAGMA ' + expr); } catch (_) { /* no-op on fallback */ } },
    prepare: (sql) => raw.prepare(sql),
    close: () => raw.close && raw.close(),
  };
  engine = 'node:sqlite (fallback — better-sqlite3 not installed in this environment)';
}
console.log(`[db] storage engine: ${engine}`);

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN (
    'salesperson','teamleader','manager','director','headofsales','ceo',
    'junioradmin','senioradmin','headadmin'
  )),
  team TEXT CHECK(team IN ('residential','commercial') OR team IS NULL),
  manager_id TEXT REFERENCES users(id),
  avatar_color TEXT,
  created_at INTEGER NOT NULL
);

-- Leads module is Phase 2 / inactive in the current application. The schema and routes
-- are kept intact (nothing reads/writes here while LEADS_MODULE_ENABLED is false in the
-- app layer) so no data or functionality is deleted, per "do not reintroduce Leads."
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  team TEXT NOT NULL CHECK(team IN ('residential','commercial')),
  salesperson_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  source TEXT,
  status TEXT NOT NULL DEFAULT 'Fresh',
  fresh INTEGER NOT NULL DEFAULT 1,
  interested_unit_id TEXT REFERENCES units(id),
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS lead_history (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by TEXT NOT NULL REFERENCES users(id),
  at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS lead_notes (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  by_user TEXT NOT NULL REFERENCES users(id),
  at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS lead_reminders (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  due_date INTEGER NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS units (
  id TEXT PRIMARY KEY,
  team TEXT NOT NULL CHECK(team IN ('residential','commercial')),
  pending INTEGER NOT NULL DEFAULT 1,
  compound TEXT, phase TEXT, developer TEXT, city TEXT, area TEXT,
  sale_rent TEXT CHECK(sale_rent IN ('Sale','Rent')),
  unit_type TEXT, area_size REAL, garden REAL DEFAULT 0, roof REAL DEFAULT 0,
  bedrooms INTEGER, bathrooms INTEGER,
  delivery_years INTEGER DEFAULT 0,
  down_payment REAL, remaining_amount REAL, remaining_installments INTEGER,
  total_price REAL, extra_fees REAL,
  finishing TEXT, furnished INTEGER DEFAULT 0,
  photos_count INTEGER DEFAULT 0,
  owner_salesperson_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL
);

-- Unique-user, unique-action-type interactions. The UNIQUE constraint is what stops
-- one salesperson from repeatedly calling/viewing/PDF'ing the same unit to inflate popularity.
CREATE TABLE IF NOT EXISTS unit_interactions (
  id TEXT PRIMARY KEY,
  unit_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK(type IN ('view','call','whatsapp','pdf')),
  at INTEGER NOT NULL,
  UNIQUE(unit_id, user_id, type)
);

-- An Owner is a real contact (name + normalized phone), never tied to a bare unit count.
-- phone/phone2 are stored in CANONICAL normalized form (see utils/phone.js) so duplicate
-- detection and search treat equivalent local/international numbers as the same number.
CREATE TABLE IF NOT EXISTS owners (
  id TEXT PRIMARY KEY,
  team TEXT NOT NULL CHECK(team IN ('residential','commercial')),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  phone2 TEXT,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_owners_team_phone ON owners(team, phone);

-- The REAL Owner<->Unit relationship. One owner can have unlimited active rows here
-- (unlimited units); the 30-owner cap is enforced in routes/owners.js by counting
-- DISTINCT owner_id for a salesperson's active rows, never by counting this table's rows.
-- Each relationship carries its OWN 30-day update cycle, independent of any other
-- relationship for the same owner (see last_update_at/next_update_at/reminder_at).
CREATE TABLE IF NOT EXISTS owner_units (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES owners(id),
  unit_id TEXT NOT NULL REFERENCES units(id),
  salesperson_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','transferred')),
  last_update_at INTEGER NOT NULL,
  next_update_at INTEGER NOT NULL,
  reminder_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

-- A transfer request always targets ONE specific owner_unit relationship (type='transfer'),
-- or, when a salesperson adds an owner whose phone already belongs to another salesperson's
-- contact, a new relationship pending admin approval (type='claim', owner_unit_id is NULL
-- until approved). Approving either never touches the owner's other relationships.
CREATE TABLE IF NOT EXISTS owner_transfers (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'transfer' CHECK(type IN ('transfer','claim')),
  owner_unit_id TEXT REFERENCES owner_units(id),
  owner_id TEXT NOT NULL REFERENCES owners(id),
  unit_id TEXT NOT NULL REFERENCES units(id),
  from_salesperson_id TEXT REFERENCES users(id),
  to_salesperson_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  requested_at INTEGER NOT NULL,
  decided_at INTEGER,
  decided_by TEXT REFERENCES users(id)
);

-- Exactly one Daily Performance Report per salesperson per calendar date — UNIQUE(salesperson_id, date)
-- is the DB-level guarantee that no duplicate report can ever be created; every write in
-- routes/dailyReports.js updates this same row rather than inserting a new one.
-- Metric columns are nullable INTEGER: NULL means "not entered yet", 0 is a valid entered value,
-- and the two are never conflated (see is_complete logic in routes/dailyReports.js).
CREATE TABLE IF NOT EXISTS daily_reports (
  id TEXT PRIMARY KEY,
  salesperson_id TEXT NOT NULL REFERENCES users(id),
  date TEXT NOT NULL, -- 'YYYY-MM-DD'
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress','completed')),
  calls_count INTEGER, calls_active INTEGER,
  leads_count INTEGER,
  showings_buyer INTEGER, showings_seller INTEGER,
  meetings_buyer INTEGER, meetings_seller INTEGER, meetings_developer INTEGER,
  other_inventory INTEGER, other_orientation INTEGER, other_closed_deals INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  completed_at INTEGER,
  UNIQUE(salesperson_id, date)
);

CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  team TEXT NOT NULL CHECK(team IN ('residential','commercial')),
  author_id TEXT NOT NULL REFERENCES users(id),
  text TEXT NOT NULL,
  at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS request_replies (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES users(id),
  text TEXT NOT NULL,
  at INTEGER NOT NULL
);

-- One personal read position per user per team feed (not a global position).
CREATE TABLE IF NOT EXISTS request_read_positions (
  user_id TEXT NOT NULL REFERENCES users(id),
  team TEXT NOT NULL CHECK(team IN ('residential','commercial')),
  last_read_request_id TEXT,
  PRIMARY KEY (user_id, team)
);

CREATE TABLE IF NOT EXISTS reference_entries (
  id TEXT PRIMARY KEY,
  team TEXT NOT NULL CHECK(team IN ('residential','commercial')),
  code TEXT, name TEXT, phone TEXT, whatsapp TEXT, note TEXT
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL,
  text TEXT NOT NULL,
  link TEXT,
  meta_json TEXT,
  dedup_key TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  at INTEGER NOT NULL,
  UNIQUE(user_id, dedup_key)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  actor_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  details_json TEXT,
  at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_leads_team_sp ON leads(team, salesperson_id);
CREATE INDEX IF NOT EXISTS idx_units_team ON units(team);
CREATE INDEX IF NOT EXISTS idx_owner_units_sp ON owner_units(salesperson_id, status);
CREATE INDEX IF NOT EXISTS idx_owner_units_owner ON owner_units(owner_id, status);
CREATE INDEX IF NOT EXISTS idx_daily_reports_sp_date ON daily_reports(salesperson_id, date);
CREATE INDEX IF NOT EXISTS idx_requests_team_at ON requests(team, at);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read);
`);

module.exports = db;
