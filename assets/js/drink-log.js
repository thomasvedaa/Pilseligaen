/* ════════════════════════════════════════════
   LOG DRINK
════════════════════════════════════════════ */
async function handleLogDrink() {
    const tid=document.getElementById('log-type').value;
    const qty=parseFloat(document.getElementById('log-qty').value);
    const dt=document.getElementById('log-dt').value;
    const note=document.getElementById('log-note').value.trim();
    const eventId=eventSchemaReady ? (document.getElementById('log-event')?.value||'') : '';
    if (!tid)       {showToast('Velg en drikketype!',false);return;}
    if (!qty||qty<=0){showToast('Ugyldig antall!',false);return;}
    if (!dt)        {showToast('Velg dato og tid!',false);return;}
    const types=await getAllDtypes();
    const t=types.find(x=>x.id===tid); if (!t) return;
    const g=grams(t.vol_ml,t.abv,qty);
    const btn=document.getElementById('log-btn'); btn.disabled=true; btn.textContent='Lagrer…';
    const payload={user_id:CU.id,type_name:t.name,vol_ml:t.vol_ml,abv:t.abv,qty,grams:g,ts:new Date(dt).toISOString(),note};
    if (eventId) payload.event_id=eventId;
    const {error}=await sb.from('pl_drinks').insert(payload);
    btn.disabled=false; btn.textContent='Registrer 🍺';
    if (error){showToast('Feil: '+error.message,false);return;}
    showToast(`+${formatAlcohol(g)} registrert! 🍺`);
    document.getElementById('log-type').value=''; document.getElementById('log-qty').value='1';
    document.getElementById('log-note').value=''; document.getElementById('log-prev').style.display='none';
    resetDt();
    await renderMyDrinksList();
}

async function renderMyDrinksList() {
    const el=document.getElementById('my-drinks-list');
    if (!el || !CU) return;
    el.innerHTML='<div class="vload"><div class="spinner"></div>Laster…</div>';
    const {data,error}=await sb.from('pl_drinks').select('*').eq('user_id',CU.id).order('ts',{ascending:false});
    if (error){el.innerHTML=`<div class="empty">Feil: ${esc(error.message)}</div>`;return;}
    const drinks=visibleDrinksForScope(data||[]);
    if (!drinks.length){el.innerHTML='<div class="empty">Ingen registreringer ennå.</div>';return;}
    el.innerHTML=drinks.map(d=>`
        <div class="di manage-drink">
            <span class="dico">${drinkIcon(d.abv)}</span>
            <div class="dinf">
                <div class="dn">${esc(d.type_name)}${d.qty!==1?` ×${d.qty}`:''}</div>
                <div class="dm">${fmtDate(d.ts)}${eventMeta(d)}${d.note?' · '+esc(d.note):''}</div>
            </div>
            <div class="dr">
                <span class="dg">${formatAlcohol(d.grams)}</span>
                <button class="del del-txt" onclick="deleteDrink('${d.id}')">Slett</button>
            </div>
        </div>`).join('');
}
