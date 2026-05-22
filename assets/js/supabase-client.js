/* ════════════════════════════════════════════
   SUPABASE CLIENT
════════════════════════════════════════════ */
const { createClient } = supabase; // from CDN
let sb  = null;  // supabase client
let CU  = null;  // current user
let lbChannel = null;
let feedChannel = null;
let dtCache   = null;
let eventChannel = null;
let eventCache = [];
let allEventsById = {};
let eventSchemaReady = true;
let currentEventId = localStorage.getItem('pl_event_filter') || '';

function initSupabase(anonKey) {
    sb = createClient(SUPABASE_URL, anonKey);
}
