const db = require('../db');

const MGMT_ROLES = ['teamleader', 'manager', 'director', 'headofsales', 'ceo'];
const ADMIN_ROLES = ['junioradmin', 'senioradmin', 'headadmin'];
const TOP_ROLES = ['headofsales', 'ceo']; // company-wide, may view either team

const isAdmin = (u) => ADMIN_ROLES.includes(u.role);
const isMgmt = (u) => MGMT_ROLES.includes(u.role);
const isTopExec = (u) => TOP_ROLES.includes(u.role);

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions for this action' });
    }
    next();
  };
}

function requireAdmin(minLevel) {
  // minLevel: 'junioradmin' | 'senioradmin' | 'headadmin' — the minimum tier required
  const order = ['junioradmin', 'senioradmin', 'headadmin'];
  return (req, res, next) => {
    if (!isAdmin(req.user)) return res.status(403).json({ error: 'Admin permissions required' });
    if (order.indexOf(req.user.role) < order.indexOf(minLevel)) {
      return res.status(403).json({ error: `Requires ${minLevel} or higher` });
    }
    next();
  };
}

// Resolves which team's data a request should be scoped to.
// - team-assigned users (salespeople, team leaders, managers, directors) are locked to their own team
// - admins / Head of Sales / CEO have no fixed team, and must pass ?team=residential|commercial
function resolveTeam(req, res, next) {
  if (req.user.team) {
    req.scopeTeam = req.user.team;
    return next();
  }
  const q = req.query.team || req.body.team;
  if (!q || !['residential', 'commercial'].includes(q)) {
    return res.status(400).json({ error: 'This account has no fixed team — pass ?team=residential or ?team=commercial' });
  }
  req.scopeTeam = q;
  next();
}

// Returns every user id in the management chain below `rootId` (recursive downline).
function getDownlineIds(rootId) {
  const direct = db.prepare('SELECT id FROM users WHERE manager_id = ?').all(rootId).map(r => r.id);
  let all = [...direct];
  for (const id of direct) all = all.concat(getDownlineIds(id));
  return all;
}

// A salesperson only ever sees their own leads/owners; management sees their downline;
// admins/top execs see everyone in the scoped team.
function visibleSalespersonIds(user) {
  if (user.role === 'salesperson') return [user.id];
  if (isMgmt(user)) return [user.id, ...getDownlineIds(user.id)];
  return null; // null = no restriction (admins / top execs within the scoped team)
}

module.exports = {
  MGMT_ROLES, ADMIN_ROLES, TOP_ROLES,
  isAdmin, isMgmt, isTopExec,
  requireRole, requireAdmin, resolveTeam,
  getDownlineIds, visibleSalespersonIds,
};
