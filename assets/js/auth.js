/* AUTH */

function showAuthTab(tab, btn) {
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('login-form').style.display = tab==='login' ? 'block' : 'none';
    document.getElementById('register-form').style.display = tab==='register' ? 'block' : 'none';
}

async function withAdminFlag(profile) {
    if (!profile) return profile;
    if (Object.prototype.hasOwnProperty.call(profile,'is_admin')) return profile;
    try {
        const {data,error}=await sb.from('pl_users').select('is_admin').eq('id',profile.id).maybeSingle();
        if (!error && data && typeof data.is_admin==='boolean') return {...profile,is_admin:data.is_admin};
    } catch {}
    return {...profile,is_admin:false};
}

async function loadProfileForAuthUser(authUserId) {
    if (!authUserId) return {data:null,error:new Error('Mangler auth-bruker.')};
    const result=await sb.rpc('get_my_profile').single();
    if (!result.error && result.data) return {...result,data:await withAdminFlag(result.data)};

    const msg=String(result.error?.message||'').toLowerCase();
    if (!msg.includes('function') && !msg.includes('schema cache')) return result;

    const fallback=await sb.from('pl_users')
        .select(PROFILE_SELECT)
        .eq('auth_user_id',authUserId)
        .single();
    if (!fallback.error && fallback.data) return {...fallback,data:await withAdminFlag(fallback.data)};
    return fallback;
}

function authMessage(error) {
    const msg=String(error?.message||'').toLowerCase();
    const code=String(error?.code||'').toLowerCase();
    if (msg.includes('invalid login') || msg.includes('invalid credentials')) return 'Feil brukernavn eller passord.';
    if (msg.includes('email not confirmed')) return 'Brukeren må bekreftes i Supabase Auth først.';
    if ((msg.includes('rate limit') && msg.includes('email')) || code.includes('rate_limit')) return 'Supabase har sendt for mange konto-e-poster akkurat nå. Vent litt, eller skru av e-postbekreftelse / sett opp egen SMTP i Supabase.';
    if (msg.includes('password')) return 'Passordet må være minst 6 tegn.';
    return error?.message ? `Feil: ${error.message}` : 'Noe gikk galt.';
}

function cleanupRealtime() {
    if (lbChannel){sb.removeChannel(lbChannel);lbChannel=null;}
    if (feedChannel){sb.removeChannel(feedChannel);feedChannel=null;}
    if (typeof achChannel!=='undefined' && achChannel){sb.removeChannel(achChannel);achChannel=null;}
    if (eventChannel){sb.removeChannel(eventChannel);eventChannel=null;}
    if (typeof groupChannel!=='undefined' && groupChannel){sb.removeChannel(groupChannel);groupChannel=null;}
    if (seasonChannel){sb.removeChannel(seasonChannel);seasonChannel=null;}
}

async function handleLogin() {
    const u=document.getElementById('li-user').value.trim();
    const p=document.getElementById('li-pass').value;
    const e=document.getElementById('li-err');
    e.textContent='';
    if (!u||!p){e.textContent='Fyll inn brukernavn og passord.';return;}

    setLoading(true,'Logger inn...');
    const {data:authData,error:authError}=await sb.auth.signInWithPassword({
        email:authEmailFromUsername(u),
        password:p
    });
    if (authError){
        setLoading(false);
        e.textContent=authMessage(authError);
        return;
    }

    const {data,error}=await loadProfileForAuthUser(authData.user?.id);
    setLoading(false);
    if (error||!data){
        await sb.auth.signOut();
        e.textContent='Fant ikke en profil koblet til denne Auth-brukeren.';
        return;
    }

    localStorage.removeItem('pl_uid');
    document.getElementById('auth-screen').style.display='none';
    await startApp(data);
}

async function handleRegister() {
    const u=document.getElementById('reg-user').value.trim();
    const p=document.getElementById('reg-pass').value;
    const e=document.getElementById('reg-err');
    e.textContent='';
    if (!u||!p)     {e.textContent='Fyll inn brukernavn og passord.';return;}
    if (u.length<2) {e.textContent='Brukernavn må ha minst 2 tegn.';return;}
    if (p.length<6) {e.textContent='Passord må ha minst 6 tegn.';return;}

    setLoading(true,'Oppretter konto...');
    const {data:authData,error:authError}=await sb.auth.signUp({
        email:authEmailFromUsername(u),
        password:p,
        options:{data:{username:u}}
    });
    if (authError){
        setLoading(false);
        e.textContent=String(authError.message||'').toLowerCase().includes('already') ? 'Brukernavnet er allerede i bruk.' : authMessage(authError);
        return;
    }
    if (!authData.user){
        setLoading(false);
        e.textContent='Kunne ikke opprette Auth-bruker.';
        return;
    }

    const {count}=await sb.from('pl_users').select('id',{count:'exact',head:true});
    const color=USER_COLORS[(count||0)%USER_COLORS.length];
    const {data,error}=await sb.from('pl_users')
        .insert({username:u,username_lc:u.toLowerCase(),nickname:u,auth_user_id:authData.user.id,color})
        .select(PROFILE_SELECT)
        .single();
    setLoading(false);
    if (error){
        e.textContent='Auth-bruker ble laget, men profilen feilet: '+error.message;
        return;
    }

    localStorage.removeItem('pl_uid');
    if (authData.session) {
        document.getElementById('auth-screen').style.display='none';
        await startApp(await withAdminFlag(data));
    } else {
        e.textContent='Konto opprettet. Logg inn etter at brukeren er bekreftet i Supabase Auth.';
    }
}

async function handleLogout() {
    cleanupRealtime();
    if (typeof achProfileUserId!=='undefined') achProfileUserId=null;
    localStorage.removeItem('pl_uid');
    localStorage.removeItem('pl_event_filter');
    localStorage.removeItem('pl_season_filter');
    localStorage.removeItem('pl_group_filter');
    await sb.auth.signOut();
    CU=null; dtCache=null; eventCache=[]; allEventsById={}; seasonCache=[]; currentEventId=''; currentSeasonId='';
    if (typeof groupCache!=='undefined') { groupCache=[]; allGroupsById={}; currentGroupId=''; }
    if (typeof replaceAppRoute==='function') replaceAppRoute('/');
    document.getElementById('app').style.display='none';
    document.getElementById('auth-screen').style.display='flex';
    document.getElementById('li-user').value='';
    document.getElementById('li-pass').value='';
    document.getElementById('li-err').textContent='';
}

document.addEventListener('keydown',e=>{
    if (e.key!=='Enter') return;
    if (document.getElementById('auth-screen').style.display==='flex') {
        if (document.getElementById('login-form').style.display!=='none') handleLogin();
        else handleRegister();
    }
});
