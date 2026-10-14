// Bootstraps the application once every module above has loaded.
if(typeof NA1_API !== 'undefined'){
  // Any API call that comes back 401 (expired/invalid token) forces a clean logout rather than
  // leaving the app sitting on stale, no-longer-authenticated data.
  NA1_API.onUnauthorized = (body)=>{
    if(typeof logout === 'function') logout();
    if(body && body.code === 'ACCOUNT_DEACTIVATED' && typeof session !== 'undefined'){ session._loginError = 'Your account has been deactivated. Please contact an administrator.'; if(typeof render === 'function') render(); }
  };
  // A temporary password must be replaced before anything else works (enforced by the server too).
  NA1_API.onPasswordChangeRequired = ()=>{ if(typeof showForcedPasswordChange === 'function') showForcedPasswordChange({ reloadAfter: true }); };
}
// A restored session (page refresh with a still-valid token) reloads ALL server data first, so the
// first screen never shows stale localStorage data. If the token turned out to be expired the 401
// handler above logs out cleanly.
if(typeof restoreSessionOnLoad === 'function'){
  restoreSessionOnLoad().catch(e=>console.error('Session restore failed', e)).then(()=>render());
} else {
  render();
}
