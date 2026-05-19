/* ════════════════════════════════════════════
   AUTH
════════════════════════════════════════════ */
function showAuthTab(tab, btn) {
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active');
    document.getElementById('login-form').style.display    = tab==='login'    ? 'block' : 'none';
    document.getElementById('register-form').style.display = tab==='register' ? 'block' : 'none';
}

async function handleLogin() {
    const u=document.getElementById('li-user').value.trim();
    const p=document.getElementById('li-pass').value;
    const e=document.getElementById('li-err'); e.textContent='';
    if (!u||!p){e.textContent='Fyll inn brukernavn og passord.';return;}
    setLoading(true,'Logger inn…');
    const {data,error}=await sb.from('pl_users').select('*').eq('username_lc',u.toLowerCase()).single();
    setLoading(false);
    if (error||!data){e.textContent='Feil brukernavn eller passord.';return;}
    if (data.password!==p){e.textContent='Feil brukernavn eller passord.';return;}
    localStorage.setItem('pl_uid',data.id);
    document.getElementById('auth-screen').style.display='none';
    await startApp(data);
}

async function handleRegister() {
    const u=document.getElementById('reg-user').value.trim();
    const p=document.getElementById('reg-pass').value;
    const e=document.getElementById('reg-err'); e.textContent='';
    if (!u||!p)     {e.textContent='Fyll inn brukernavn og passord.';return;}
    if (u.length<2) {e.textContent='Brukernavn må ha minst 2 tegn.';return;}
    if (p.length<3) {e.textContent='Passord må ha minst 3 tegn.';return;}
    setLoading(true,'Oppretter konto…');
    // Check if username taken
    const {data:existing}=await sb.from('pl_users').select('id').eq('username_lc',u.toLowerCase()).maybeSingle();
    if (existing){setLoading(false);e.textContent='Brukernavnet er allerede i bruk.';return;}
    // Assign color
    const {count}=await sb.from('pl_users').select('*',{count:'exact',head:true});
    const color=USER_COLORS[(count||0)%USER_COLORS.length];
    const {data,error}=await sb.from('pl_users').insert({username:u,username_lc:u.toLowerCase(),password:p,color}).select().single();
    setLoading(false);
    if (error){e.textContent='Feil: '+error.message;return;}
    localStorage.setItem('pl_uid',data.id);
    document.getElementById('auth-screen').style.display='none';
    await startApp(data);
}

function handleLogout() {
    if (lbChannel){sb.removeChannel(lbChannel);lbChannel=null;}
    if (feedChannel){sb.removeChannel(feedChannel);feedChannel=null;}
    localStorage.removeItem('pl_uid');
    CU=null; dtCache=null;
    document.getElementById('app').style.display='none';
    document.getElementById('auth-screen').style.display='flex';
    document.getElementById('li-user').value=''; document.getElementById('li-pass').value='';
    document.getElementById('li-err').textContent='';
}

document.addEventListener('keydown',e=>{
    if (e.key!=='Enter') return;
    if (document.getElementById('auth-screen').style.display==='flex') {
        if (document.getElementById('login-form').style.display!=='none') handleLogin();
        else handleRegister();
    }
    const setupScreen=document.getElementById('setup-screen');
    if (setupScreen && setupScreen.style.display==='flex') handleSetup();
});
