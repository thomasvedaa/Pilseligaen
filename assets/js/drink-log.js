/* ════════════════════════════════════════════
   LOG DRINK
════════════════════════════════════════════ */
function cleanLocationCity(value) {
    return String(value||'')
        .trim()
        .replace(/\s+/g,' ')
        .slice(0,80);
}

function cityFromNominatim(data) {
    const a=data?.address||{};
    return cleanLocationCity(
        a.city || a.town || a.village || a.municipality || a.city_district ||
        a.borough || a.locality || a.suburb || a.county ||
        String(data?.display_name||'').split(',')[0]
    );
}

function logLocationErrorMessage(error) {
    if (error?.code===1) return 'Posisjon ble ikke tillatt.';
    if (error?.code===2) return 'Fant ikke posisjonen din.';
    if (error?.code===3) return 'Posisjon tok for lang tid.';
    return error?.message || 'Kunne ikke finne byen.';
}

function currentPosition() {
    return new Promise((resolve,reject)=>{
        navigator.geolocation.getCurrentPosition(resolve,reject,{
            enableHighAccuracy:false,
            timeout:10000,
            maximumAge:300000
        });
    });
}

async function reverseGeocodeCity(lat,lng) {
    const params=new URLSearchParams({
        format:'jsonv2',
        lat:String(lat),
        lon:String(lng),
        addressdetails:'1',
        zoom:'10',
        'accept-language':'no,en'
    });
    const res=await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`,{
        headers:{Accept:'application/json'}
    });
    if (!res.ok) throw new Error('Kunne ikke slå opp byen.');
    const city=cityFromNominatim(await res.json());
    if (!city) throw new Error('Fant ikke by for posisjonen.');
    return city;
}

async function detectLogCity() {
    const input=document.getElementById('log-city');
    const status=document.getElementById('log-city-status');
    const btn=document.getElementById('log-city-btn');
    if (!navigator.geolocation) {
        const msg='Nettleseren støtter ikke posisjon.';
        if (status) status.textContent=msg;
        showToast(msg,false);
        return;
    }

    btn.disabled=true;
    btn.textContent='Finner...';
    if (status) status.textContent='Tillat posisjon i nettleseren for å hente by.';
    try {
        const pos=await currentPosition();
        if (status) status.textContent='Henter by...';
        const city=await reverseGeocodeCity(pos.coords.latitude,pos.coords.longitude);
        input.value=city;
        if (status) status.textContent=`By lagt til: ${city}`;
        showToast(`By lagt til: ${city}`);
    } catch (error) {
        const msg=logLocationErrorMessage(error);
        if (status) status.textContent=msg;
        showToast(msg,false);
    } finally {
        btn.disabled=false;
        btn.textContent='Finn by';
    }
}

async function handleLogDrink() {
    const tid=document.getElementById('log-type').value;
    const qty=parseFloat(document.getElementById('log-qty').value);
    const dt=document.getElementById('log-dt').value;
    const note=document.getElementById('log-note').value.trim();
    const locationCity=cleanLocationCity(document.getElementById('log-city')?.value);
    const eventId=eventSchemaReady ? (document.getElementById('log-event')?.value||'') : '';
    if (!tid)       {showToast('Velg en drikketype!',false);return;}
    if (!qty||qty<=0){showToast('Ugyldig antall!',false);return;}
    if (!dt)        {showToast('Velg dato og tid!',false);return;}
    const types=await getAllDtypes();
    const t=types.find(x=>x.id===tid); if (!t) return;
    const g=grams(t.vol_ml,t.abv,qty);
    const btn=document.getElementById('log-btn'); btn.disabled=true; btn.textContent='Lagrer…';
    const payload={user_id:CU.id,type_name:t.name,vol_ml:t.vol_ml,abv:t.abv,qty,grams:g,ts:new Date(dt).toISOString(),note};
    if (locationCity) payload.location_city=locationCity;
    if (eventId) payload.event_id=eventId;
    const {error}=await sb.from('pl_drinks').insert(payload);
    btn.disabled=false; btn.textContent='Registrer 🍺';
    if (error){showToast('Feil: '+error.message,false);return;}
    showToast(`+${formatAlcohol(g)} registrert! 🍺`);
    document.getElementById('log-type').value=''; document.getElementById('log-qty').value='1';
    document.getElementById('log-note').value=''; document.getElementById('log-city').value=''; document.getElementById('log-prev').style.display='none';
    document.getElementById('log-city-status').textContent='';
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
                <div class="dm">${fmtDate(d.ts)}${eventMeta(d)}${drinkLocationMeta(d)}${d.note?' · '+esc(d.note):''}</div>
            </div>
            <div class="dr">
                <span class="dg">${formatAlcohol(d.grams)}</span>
                <button class="del del-txt" onclick="deleteDrink('${d.id}')">Slett</button>
            </div>
        </div>`).join('');
}
