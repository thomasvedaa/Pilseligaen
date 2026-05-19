/* ════════════════════════════════════════════
   SUPABASE CLIENT
════════════════════════════════════════════ */
const { createClient } = supabase; // from CDN
let sb  = null;  // supabase client
let CU  = null;  // current user
let lbChannel = null;
let feedChannel = null;
let dtCache   = null;

function initSupabase(anonKey) {
    sb = createClient(SUPABASE_URL, anonKey);
}
