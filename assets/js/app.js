/* ════════════════════════════════════════════
   START APP
════════════════════════════════════════════ */
async function startApp(user) {
    CU=user;
    updateUserHeader();
    document.getElementById('app').style.display='block';
    updateAlcoholModeButton();
    resetDt();
    await renderDashboard();
    await populateLogSelect();
    renderLeaderboard('all');
}

function updateUserHeader() {
    if (!CU) return;
    const av=document.getElementById('usr-av');
    av.textContent=userInitial(CU);
    av.style.background=CU.color||USER_COLORS[0];
    document.getElementById('usr-nm').textContent=displayName(CU);
}

async function editNickname() {
    if (!CU) return;
    const current=displayName(CU);
    const next=prompt('Velg kallenavn som vises i ligaen:', current);
    if (next===null) return;
    const nickname=next.trim();
    if (!nickname){showToast('Kallenavn kan ikke være tomt.',false);return;}
    if (nickname.length>32){showToast('Maks 32 tegn.',false);return;}

    setLoading(true,'Lagrer kallenavn…');
    const {data,error}=await sb.from('pl_users').update({nickname}).eq('id',CU.id).select('*').single();
    setLoading(false);
    if (error){
        showToast('Kunne ikke lagre. Kjør oppdatert schema.sql i Supabase først.',false);
        return;
    }
    CU=data;
    updateUserHeader();
    await refreshActiveViewForAlcoholMode();
    showToast('Kallenavn oppdatert!');
}

/* ════════════════════════════════════════════
   NAVIGATION
════════════════════════════════════════════ */
function showView(name, btn) {
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'));
    document.getElementById('view-'+name).classList.add('active');
    if (btn) btn.classList.add('active');
    if (name==='dashboard') renderDashboard();
    if (name==='stats')     {tlPeriod=30; renderStats();}
    if (name==='lb')        renderLeaderboard(lbFilter);
    if (name==='drinks')    renderDtList();
    if (name==='log')       {populateLogSelect(); resetDt();}
}

function activeViewName() {
    const active=document.querySelector('.view.active');
    return active ? active.id.replace('view-','') : 'dashboard';
}

function updateAlcoholModeButton() {
    const btn=document.getElementById('unit-toggle');
    if (!btn) return;
    btn.textContent=alcoholMode==='units'?'enheter':'g';
    btn.title=alcoholMode==='units'?'Vis gram alkohol':'Vis alkoholenheter';
}

async function refreshActiveViewForAlcoholMode() {
    updateAlcoholModeButton();
    const view=activeViewName();
    if (view==='dashboard') await renderDashboard();
    if (view==='stats') await renderStats();
    if (view==='lb') await fetchAndRenderLb(lbFilter);
    if (view==='drinks') await renderDtList();
    if (view==='log') {
        await populateLogSelect();
        await updateLogPreview();
    }
}

function toggleAlcoholMode() {
    alcoholMode=alcoholMode==='grams'?'units':'grams';
    localStorage.setItem('pl_alcohol_mode',alcoholMode);
    refreshActiveViewForAlcoholMode();
}
