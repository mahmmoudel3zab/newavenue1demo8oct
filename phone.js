// Egyptian phone validation & normalization — mirrors js/data.js on the frontend exactly,
// so the same number typed in either local or international form is always treated as one
// owner's number, in both validation and search. No other country-code rule is implemented.
//
// Accepted raw input: digits only (0-9). '+', spaces, '-', brackets and letters are rejected.
//   Local:         01XXXXXXXXX   (11 digits, starts with 0)
//   International: 201XXXXXXXXX (12 digits, starts with 20, no '+')
// Both normalize to the same 12-digit canonical form, e.g. "201012345678".

function isDigitsOnly(raw) {
  return typeof raw === 'string' && raw.length > 0 && /^[0-9]+$/.test(raw);
}

function normalizeEgyptPhone(raw) {
  if (!isDigitsOnly(raw)) return null;
  if (raw.length === 11 && raw[0] === '0') return '20' + raw.slice(1);
  if (raw.length === 12 && raw.slice(0, 2) === '20') return raw;
  return null;
}

function phoneLocalDisplay(canonical) { return canonical ? '0' + canonical.slice(2) : ''; }
function phoneIntlDisplay(canonical) { return canonical || ''; }

module.exports = { isDigitsOnly, normalizeEgyptPhone, phoneLocalDisplay, phoneIntlDisplay };
