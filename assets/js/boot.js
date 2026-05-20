/* BOOT */
document.addEventListener('DOMContentLoaded', async () => {
    initSupabase(SUPABASE_ANON);

    setLoading(true,'Logger inn...');
    const {data:authData,error:authError}=await sb.auth.getUser();
    if (!authError && authData.user) {
        const {data:profile,error:profileError}=await loadProfileForAuthUser(authData.user.id);
        setLoading(false);
        if (!profileError && profile) {
            localStorage.removeItem('pl_uid');
            await startApp(profile);
            return;
        }
        await sb.auth.signOut();
    } else {
        setLoading(false);
    }

    localStorage.removeItem('pl_uid');
    document.getElementById('auth-screen').style.display='flex';
});
