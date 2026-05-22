/* EVENTS / TRIPS */

function cleanEventCode(value) {
    return String(value||'')
        .trim()
        .toUpperCase()
        .replace(/\s+/g,'-')
        .replace(/[^A-Z0-9-]/g,'')
        .slice(0,24);
}

function randomEventCode() {
    const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes=new Uint8Array(7);
    crypto.getRandomValues(bytes);
    return Array.from(bytes,b=>alphabet[b%alphabet.length]).join('');
}

function eventOptionsHtml(emptyLabel='Totalt') {
    return `<option value="">${emptyLabel}</option>`+(eventCache||[])
        .map(e=>`<option value="${e.id}">${esc(e.name)}</option>`)
        .join('');
}

function updateEventControls() {
    const validIds=new Set((eventCache||[]).map(e=>e.id));
    if (currentEventId && !validIds.has(currentEventId)) {
        currentEventId='';
        localStorage.removeItem('pl_event_filter');
    }

    const filter=document.getElementById('event-filter');
    if (filter) {
        filter.innerHTML=eventSchemaReady?eventOptionsHtml('Totalt'):'<option value="">Eventer mangler</option>';
        filter.value=currentEventId;
        filter.disabled=!eventSchemaReady;
    }

    const logEvent=document.getElementById('log-event');
    if (logEvent) {
        logEvent.innerHTML=eventSchemaReady?eventOptionsHtml('Ingen tur'):'<option value="">Kjør schema.sql for eventer</option>';
        logEvent.value=currentEventId;
        logEvent.disabled=!eventSchemaReady || !eventCache.length;
    }

    const label=document.getElementById('event-active-label');
    if (label) label.textContent=eventLabel();
}

async function loadEvents() {
    if (!CU) return;
    const {data:members,error}=await sb.from('pl_event_members')
        .select('event_id,joined_at')
        .eq('user_id',CU.id)
        .order('joined_at',{ascending:false});

    if (error) {
        eventSchemaReady=false;
        eventCache=[];
        allEventsById={};
        currentEventId='';
        localStorage.removeItem('pl_event_filter');
        updateEventControls();
        return;
    }

    eventSchemaReady=true;

    const {data:everyEvent}=await sb.from('pl_events').select('*');
    allEventsById={};
    (everyEvent||[]).forEach(e=>{allEventsById[e.id]=e;});

    const ids=[...new Set((members||[]).map(m=>m.event_id))];
    if (!ids.length) {
        eventCache=[];
        currentEventId='';
        localStorage.removeItem('pl_event_filter');
        updateEventControls();
        return;
    }

    const [{data:events,error:eventError},{data:allMembers}] = await Promise.all([
        sb.from('pl_events').select('*').in('id',ids).order('created_at',{ascending:false}),
        sb.from('pl_event_members').select('event_id,user_id').in('event_id',ids)
    ]);

    if (eventError) {
        eventSchemaReady=false;
        eventCache=[];
        currentEventId='';
        localStorage.removeItem('pl_event_filter');
        updateEventControls();
        return;
    }

    const counts={};
    (allMembers||[]).forEach(m=>{counts[m.event_id]=(counts[m.event_id]||0)+1;});
    eventCache=(events||[]).map(e=>({...e,member_count:counts[e.id]||1}));
    updateEventControls();
}

function ensureEventRealtime() {
    if (eventChannel || !eventSchemaReady) return;
    eventChannel=sb.channel('events-realtime')
        .on('postgres_changes',{event:'*',schema:'public',table:'pl_events'},async()=>{await loadEvents(); refreshActiveScope();})
        .on('postgres_changes',{event:'*',schema:'public',table:'pl_event_members'},async()=>{await loadEvents(); refreshActiveScope();})
        .subscribe();
}

async function ensureEventsReady() {
    if (eventSchemaReady) return true;
    await loadEvents();
    if (eventSchemaReady) {
        ensureEventRealtime();
        await renderEvents();
        return true;
    }
    showToast('Kjør oppdatert schema.sql for eventer først.',false);
    return false;
}

async function refreshActiveScope() {
    updateEventControls();
    const view=activeViewName();
    if (view==='dashboard') { await renderDashboard(); return; }
    if (view==='log') { await renderMyDrinksList(); return; }
    if (view==='stats') { await renderStats(); return; }
    if (view==='lb') { await fetchAndRenderLb(lbFilter); return; }
    if (view==='achievements') { await renderAchievements(); return; }
    if (view==='profile') { await renderAchievementProfile(achProfileUserId); return; }
    if (view==='events') { await renderEvents(); return; }
}

async function setEventFilter(value) {
    currentEventId=value||'';
    if (currentEventId) localStorage.setItem('pl_event_filter',currentEventId);
    else localStorage.removeItem('pl_event_filter');
    await refreshActiveScope();
}

async function activateEvent(eventId) {
    await setEventFilter(eventId);
    showToast(eventId?`Viser ${eventLabel(eventId)}`:'Viser totalt');
}

async function afterEventJoined(event) {
    await loadEvents();
    currentEventId=event.id;
    localStorage.setItem('pl_event_filter',currentEventId);
    updateEventControls();
    await renderEvents();
    await refreshActiveScope();
}

async function createTripEvent() {
    if (!(await ensureEventsReady())) return;
    const name=document.getElementById('event-name').value.trim();
    if (!name) {showToast('Skriv navn på turen.',false);return;}
    if (name.length>48) {showToast('Maks 48 tegn på navn.',false);return;}
    const code=cleanEventCode(document.getElementById('event-code').value)||randomEventCode();
    if (code.length<3) {showToast('Kode må ha minst 3 tegn.',false);return;}

    setLoading(true,'Oppretter tur...');
    const {data:event,error}=await sb.rpc('create_event_with_code',{
        event_name:name,
        input_code:code
    });

    if (error) {
        setLoading(false);
        showToast(error.message||'Kunne ikke opprette. Koden er kanskje brukt.',false);
        return;
    }

    setLoading(false);

    document.getElementById('event-name').value='';
    document.getElementById('event-code').value='';
    await afterEventJoined({...event,member_count:1});
    showToast(`Tur opprettet. Kode: ${code}`);
}

async function joinEventByCode() {
    if (!(await ensureEventsReady())) return;
    const code=cleanEventCode(document.getElementById('event-join-code').value);
    if (code.length<3) {showToast('Skriv inn en gyldig kode.',false);return;}

    setLoading(true,'Sjekker kode...');
    const {data:event,error}=await sb.rpc('join_event_by_code',{input_code:code});
    if (error || !event) {
        setLoading(false);
        showToast(error?.message||'Fant ingen tur med den koden.',false);
        return;
    }
    if (event.ended_at) {
        setLoading(false);
        showToast('Turen er avsluttet.',false);
        return;
    }

    setLoading(false);

    document.getElementById('event-join-code').value='';
    await afterEventJoined(event);
    showToast(`Du er med i ${event.name}.`);
}

async function copyEventCode(code) {
    try {
        await navigator.clipboard.writeText(code);
        showToast('Kode kopiert');
    } catch {
        prompt('Kopier koden:',code);
    }
}

async function endTrip(eventId) {
    const event=eventById(eventId);
    if (!event) return;
    if (event.created_by!==CU.id) {showToast('Bare turlederen kan avslutte turen.',false);return;}
    if (event.ended_at) {showToast('Turen er allerede avsluttet.',false);return;}
    if (!confirm(`Avslutte "${event.name}"? Den med mest alkohol kåres til Tur konge.`)) return;
    setLoading(true,'Avslutter tur...');
    const {error}=await sb.from('pl_events').update({ended_at:new Date().toISOString()}).eq('id',eventId);
    setLoading(false);
    if (error) {showToast('Kunne ikke avslutte turen.',false);return;}
    await loadEvents();
    await refreshActiveScope();
    showToast('Tur avsluttet 👑');
}

async function deleteTrip(eventId) {
    const event=eventById(eventId);
    if (!event) return;
    if (event.created_by!==CU.id) {showToast('Bare turlederen kan slette turen.',false);return;}
    if (!confirm(`Slette "${event.name}"? Drikkene beholdes, men kobles fra turen.`)) return;
    const typed=prompt(`Skriv SLETT for å bekrefte sletting av "${event.name}".`);
    if (String(typed||'').trim().toUpperCase()!=='SLETT') {
        showToast('Sletting avbrutt.',false);
        return;
    }

    setLoading(true,'Sletter tur...');
    const {data,error}=await sb.from('pl_events').delete().eq('id',eventId).eq('created_by',CU.id).select('id');
    setLoading(false);
    if (error) {showToast('Kunne ikke slette turen. Kjør oppdatert schema.sql først.',false);return;}
    if (!data?.length) {showToast('Fant ikke en tur du kan slette.',false);return;}

    if (currentEventId===eventId) {
        currentEventId='';
        localStorage.removeItem('pl_event_filter');
    }
    await loadEvents();
    await refreshActiveScope();
    showToast('Tur slettet.');
}

async function fetchUsersForCurrentScope(users) {
    if (!eventSchemaReady || !currentEventId) return users||[];
    const {data,error}=await sb.from('pl_event_members').select('user_id').eq('event_id',currentEventId);
    if (error) return users||[];
    const ids=new Set((data||[]).map(m=>m.user_id));
    return (users||[]).filter(u=>ids.has(u.id));
}

async function loadEventLeaderStats() {
    const ids=(eventCache||[]).map(e=>e.id).filter(Boolean);
    if (!ids.length) return {};

    const {data:drinks,error}=await sb.from('pl_drinks')
        .select('event_id,user_id,grams,vol_ml,qty,type_name,abv')
        .in('event_id',ids);
    if (error || !drinks?.length) return {};

    const userIds=[...new Set(drinks.map(d=>d.user_id).filter(Boolean))];
    const {data:users}=userIds.length
        ? await sb.from('pl_users').select(PROFILE_SELECT).in('id',userIds)
        : {data:[]};
    const byUser=Object.fromEntries((users||[]).map(u=>[u.id,u]));
    const byEvent={};

    drinks.forEach(d=>{
        const event=(byEvent[d.event_id] ||= {totalGrams:0,drinkCount:0,users:{}});
        const row=(event.users[d.user_id] ||= {user:byUser[d.user_id]||{id:d.user_id,username:'Ukjent',color:USER_COLORS[0]},grams:0,drinkCount:0});
        const g=Number(d.grams)||0;
        event.totalGrams+=g;
        event.drinkCount++;
        row.grams+=g;
        row.drinkCount++;
    });

    Object.values(byEvent).forEach(event=>{
        event.leader=Object.values(event.users).sort((a,b)=>b.grams-a.grams || displayName(a.user).localeCompare(displayName(b.user),'no'))[0]||null;
    });

    return byEvent;
}

function renderEventLeaderLine(stats) {
    if (!stats?.leader) return '<div class="event-stats">Ingen registreringer ennå</div>';
    const leader=stats.leader;
    return `<div class="event-stats">
        <span class="event-leader">${avatarHtml(leader.user,22,'.7em')} Leder: <strong>${esc(displayName(leader.user))}</strong></span>
        <span>${formatAlcohol(leader.grams)}</span>
        <span>${leader.drinkCount} ${leader.drinkCount===1?'registrering':'registreringer'}</span>
        <span>Totalt ${formatAlcohol(stats.totalGrams)}</span>
    </div>`;
}

async function renderEvents() {
    const el=document.getElementById('event-list');
    if (!el) return;
    if (!eventSchemaReady) {
        el.innerHTML='<div class="empty">Kjør oppdatert schema.sql i Supabase for å aktivere turer og eventer.</div>';
        updateEventControls();
        return;
    }

    updateEventControls();
    if (!eventCache.length) {
        el.innerHTML='<div class="empty">Ingen turer ennå. Lag en tur eller bli med med kode.</div>';
        return;
    }

    const eventStats=await loadEventLeaderStats();
    el.innerHTML=eventCache.map(e=>{
        const ended=!!e.ended_at;
        const canEnd=!ended && e.created_by===CU.id;
        const canDelete=e.created_by===CU.id;
        const endedMeta=ended?` · <span class="badge">Avsluttet ${fmtDate(e.ended_at)}</span>`:'';
        return `
        <div class="event-card${e.id===currentEventId?' active':''}${ended?' ended':''}">
            <div class="event-main">
                <div class="event-name">${esc(e.name)}</div>
                <div class="event-meta">Kode <strong>${esc(e.code)}</strong> · ${e.member_count||1} ${e.member_count===1?'person':'personer'}${endedMeta}</div>
                ${renderEventLeaderLine(eventStats[e.id])}
            </div>
            <div class="event-actions">
                <button class="icon-btn" onclick="copyEventCode('${esc(e.code)}')">Kopier kode</button>
                ${canEnd?`<button class="btn btn-d btn-sm" onclick="endTrip('${e.id}')">Avslutt tur</button>`:''}
                ${canDelete?`<button class="btn btn-d btn-sm" onclick="deleteTrip('${e.id}')">Slett tur</button>`:''}
                <button class="btn btn-p btn-sm" onclick="activateEvent('${e.id}')">${e.id===currentEventId?'Aktiv':'Vis'}</button>
            </div>
        </div>
    `;}).join('');
}
