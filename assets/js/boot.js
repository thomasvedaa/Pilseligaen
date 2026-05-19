/* ════════════════════════════════════════════
   BOOT
════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
    initSupabase(SUPABASE_ANON);

    const savedId = localStorage.getItem('pl_uid');
    if (savedId) {
        setLoading(true,'Logger inn…');
        const { data, error } = await sb.from('pl_users').select('*').eq('id',savedId).single();
        setLoading(false);
        if (!error && data) { await startApp(data); return; }
        localStorage.removeItem('pl_uid');
    }
    document.getElementById('auth-screen').style.display='flex';
});
