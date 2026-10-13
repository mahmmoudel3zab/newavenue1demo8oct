/* =========================================================
   NEW AVENUE 1 — real backend API client (Phase Two rewire)
   =========================================================
   This is the ONLY place in the frontend that is allowed to call
   fetch() against the backend. Every other file goes through the
   functions exported here (window.NA1_API) so there is exactly one
   place that knows about base URLs, auth headers, and error shapes.

   Configuration:
   - window.NA1_API_BASE can be set (e.g. in a small inline <script> in
     index.html, BEFORE this file loads) to point at a deployed backend,
     for example: <script>window.NA1_API_BASE = 'https://api.example.com/api';</script>
   - If not set, this defaults to http://localhost:4000/api, which matches
     na1-backend's default PORT (see na1-backend/.env.example).
   - In production this MUST be set to the real deployed backend URL, and
     that backend's CORS_ORIGIN env var must include the frontend's real
     origin (see na1-backend/src/middleware/security.js) or the browser
     will block every request.
   ========================================================= */
(function(){
  const DEFAULT_BASE = 'http://localhost:4000/api';
  const BASE = (typeof window !== 'undefined' && window.NA1_API_BASE) ? window.NA1_API_BASE : DEFAULT_BASE;

  const TOKEN_KEY = 'na1_token';
  const USER_KEY = 'na1_auth_user';

  function getToken(){
    try { return sessionStorage.getItem(TOKEN_KEY) || null; } catch(e){ return null; }
  }
  function setToken(token){
    try {
      if(token) sessionStorage.setItem(TOKEN_KEY, token);
      else sessionStorage.removeItem(TOKEN_KEY);
    } catch(e){ /* sessionStorage unavailable — auth simply won't persist across reload */ }
  }
  function getAuthUser(){
    try {
      const raw = sessionStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch(e){ return null; }
  }
  function setAuthUser(user){
    try {
      if(user) sessionStorage.setItem(USER_KEY, JSON.stringify(user));
      else sessionStorage.removeItem(USER_KEY);
    } catch(e){ /* ignore */ }
  }

  // Thrown for any non-2xx response. `.status` lets callers branch (e.g. 401 -> force logout),
  // `.body` carries whatever JSON error payload the backend sent (usually { error: '...' }).
  class ApiError extends Error {
    constructor(status, body){
      const msg = (body && (body.error || body.message)) || ('Request failed with status ' + status);
      super(msg);
      this.name = 'ApiError';
      this.status = status;
      this.body = body;
    }
  }

  // Called whenever a request comes back 401 (expired/invalid token). Pages can override this
  // via NA1_API.onUnauthorized = fn to redirect to the login screen / clear local session state.
  let onUnauthorized = null;

  async function request(method, path, { body, query } = {}){
    let url = BASE + path;
    if(query && Object.keys(query).length){
      const qs = Object.entries(query)
        .filter(([,v])=> v !== undefined && v !== null && v !== '')
        .map(([k,v])=> encodeURIComponent(k)+'='+encodeURIComponent(v))
        .join('&');
      if(qs) url += (url.includes('?') ? '&' : '?') + qs;
    }
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if(token) headers['Authorization'] = 'Bearer ' + token;

    let res;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch(networkErr){
      // Network-level failure (backend unreachable, DNS, CORS preflight block, offline, etc.)
      // Distinguish this from a real server-returned error so callers/UI can show
      // "can't reach the server" rather than a validation-style message.
      const err = new ApiError(0, { error: 'Could not reach the server. Check your connection and try again.' });
      err.isNetworkError = true;
      throw err;
    }

    let data = null;
    const text = await res.text();
    if(text){
      try { data = JSON.parse(text); } catch(e){ data = { error: text }; }
    }

    if(!res.ok){
      if(res.status === 401 && typeof onUnauthorized === 'function') onUnauthorized();
      throw new ApiError(res.status, data);
    }
    return data;
  }

  // Authenticated binary download (unit photos). <img src> cannot send the Authorization header,
  // so the app fetches the bytes here and displays a blob: URL. Throws ApiError like request().
  async function requestBlob(path, query){
    let url = BASE + path;
    if(query && Object.keys(query).length) url += (url.includes('?') ? '&' : '?') + Object.entries(query).map(([k,v])=> encodeURIComponent(k)+'='+encodeURIComponent(v)).join('&');
    const headers = {};
    const token = getToken();
    if(token) headers['Authorization'] = 'Bearer ' + token;
    let res;
    try { res = await fetch(url, { method:'GET', headers }); }
    catch(e){ const err = new ApiError(0, { error: 'Could not reach the server.' }); err.isNetworkError = true; throw err; }
    if(!res.ok){
      if(res.status === 401 && typeof onUnauthorized === 'function') onUnauthorized();
      throw new ApiError(res.status, null);
    }
    return res.blob();
  }

  const NA1_API = {
    ApiError,
    getToken, getAuthUser,
    isLoggedIn: () => !!getToken(),
    set onUnauthorized(fn){ onUnauthorized = fn; },

    async login(email, password){
      const data = await request('POST', '/auth/login', { body: { email, password } });
      setToken(data.token);
      setAuthUser(data.user);
      return data.user;
    },
    async changePassword(currentPassword, newPassword){
      const data = await request('POST', '/auth/change-password', { body: { currentPassword, newPassword } });
      setToken(data.token); // older tokens are invalidated server-side; keep this session alive
      return true;
    },
    async me(){
      return request('GET', '/auth/me');
    },
    logout(){
      setToken(null);
      setAuthUser(null);
    },

    // Generic verbs for every other module to build on as the rewire proceeds.
    get:   (path, query) => request('GET', path, { query }),
    blob:  (path, query) => requestBlob(path, query),
    post:  (path, body)  => request('POST', path, { body }),
    put:   (path, body)  => request('PUT', path, { body }),
    patch: (path, body)  => request('PATCH', path, { body }),
    del:   (path, body)  => request('DELETE', path, { body }),
  };

  if(typeof window !== 'undefined') window.NA1_API = NA1_API;
  if(typeof module !== 'undefined' && module.exports) module.exports = NA1_API;
})();
