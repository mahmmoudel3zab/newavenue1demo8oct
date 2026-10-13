/* =========================================================
   NEW AVENUE 1 — APPLICATION MODE  (the ONE switch between the two modes)
   =========================================================
   'full' = Full Application Mode. Sign-in and all data go through the real backend API
            (js/api.js). This is the mode for the real company deployment.
   'demo' = Frontend Demo Mode. For a static preview site with NO backend (e.g. the public
            Vercel demo). Uses the built-in sample data, signs in by clicking a demo account,
            and never contacts any server. Nothing is saved anywhere.

   If this file is missing, or the value is anything other than 'demo', the app runs in
   Full Application Mode. Demo Mode is never switched on automatically — not even when the
   backend cannot be reached.
   ========================================================= */
window.NA1_APP_MODE = 'demo';
