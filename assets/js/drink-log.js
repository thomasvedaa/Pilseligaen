/* ════════════════════════════════════════════
   LOG DRINK
════════════════════════════════════════════ */
async function handleLogDrink() {
    const tid=document.getElementById('log-type').value;
    const qty=parseFloat(document.getElementById('log-qty').value);
    const dt=document.getElementById('log-dt').value;
    const note=document.getElementById('log-note').value.trim();
    if (!tid)       {showToast('Velg en drikketype!',false);return;}
    if (!qty||qty<=0){showToast('Ugyldig antall!',false);return;}
    if (!dt)        {showToast('Velg dato og tid!',false);return;}
    const types=await getAllDtypes();
    const t=types.find(x=>x.id===tid); if (!t) return;
    const g=grams(t.vol_ml,t.abv,qty);
    const btn=document.getElementById('log-btn'); btn.disabled=true; btn.textContent='Lagrer…';
    const {error}=await sb.from('pl_drinks').insert({user_id:CU.id,type_name:t.name,vol_ml:t.vol_ml,abv:t.abv,qty,grams:g,ts:new Date(dt).toISOString(),note});
    btn.disabled=false; btn.textContent='Registrer 🍺';
    if (error){showToast('Feil: '+error.message,false);return;}
    showToast(`+${formatAlcohol(g)} registrert! 🍺`);
    document.getElementById('log-type').value=''; document.getElementById('log-qty').value='1';
    document.getElementById('log-note').value=''; document.getElementById('log-prev').style.display='none';
    resetDt();
}
