/* GROUPS / PERMANENT LEAGUES */

let groupChannel = null;
let groupCache = [];
let allGroupsById = {};
let groupSchemaReady = true;
let currentGroupId = localStorage.getItem('pl_group_filter') || '';

function cleanGroupCode(value) {
    return String(value||'')
        .trim()
        .toUpperCase()
        .replace(/\s+/g,'-')
        .replace(/[^A-Z0-9-]/g,'')
        .slice(0,24);
}

function randomGroupCode() {
    const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes=new Uint8Array(7);
    crypto.getRandomValues(bytes);
    return Array.from(bytes,b=>alphabet[b%alphabet.length]).join('');
}

function groupById(id=currentGroupId) {
    if (!id) return null;
    return (groupCache||[]).find(g=>g.id===id) || allGroupsById[id] || null;
}

function updateGroupControls() {
    const validIds=new Set((groupCache||[]).map(g=>g.id));
    if (currentGroupId && !validIds.has(currentGroupId)) {
        currentGroupId='';
        localStorage.removeItem('pl_group_filter');
    }
    if (!currentGroupId && groupCache.length) {
        currentGroupId=groupCache[0].id;
        localStorage.setItem('pl_group_filter',currentGroupId);
    }

    const label=document.getElementById('group-active-label');
    if (label) label.textContent=currentGroupId ? groupById(currentGroupId)?.name || 'Gruppe' : 'Ingen gruppe';
    renderGroupFilter();
    renderGroupMenuList();
}

function renderGroupFilter() {
    const select=document.getElementById('group-filter');
    if (!select) return;

    if (!groupSchemaReady) {
        select.innerHTML='<option value="">Schema mangler</option>';
        select.disabled=true;
        return;
    }
    if (!groupCache.length) {
        select.innerHTML='<option value="">Ingen grupper</option>';
        select.disabled=true;
        return;
    }

    select.disabled=false;
    select.innerHTML=(groupCache||[])
        .map(g=>`<option value="${g.id}">${esc(g.name)}</option>`)
        .join('');
    select.value=currentGroupId || groupCache[0].id;
}

function toggleGroupTools(force) {
    const panel=document.getElementById('group-tools-panel');
    const btn=document.getElementById('group-tools-toggle');
    if (!panel || !btn) return;
    const open=typeof force==='boolean' ? force : !panel.classList.contains('open');
    panel.classList.toggle('open',open);
    btn.setAttribute('aria-expanded',open?'true':'false');
}

function renderGroupMenuList() {
    const el=document.getElementById('group-tools-list');
    if (!el) return;

    if (!groupSchemaReady) {
        el.innerHTML='<div class="menu-empty">Kjør schema.sql først.</div>';
        return;
    }
    if (!groupCache.length) {
        el.innerHTML='<div class="menu-empty">Ingen grupper ennå.</div>';
        return;
    }

    el.innerHTML=(groupCache||[]).map(g=>{
        const active=g.id===currentGroupId;
        const canDelete=g.created_by===CU.id || isAdmin(CU);
        return `<div class="menu-group-row${active?' active':''}">
            <div class="menu-group-main">
                <strong>${esc(g.name)}</strong>
                <small>Kode ${esc(g.code)} · ${g.member_count||1} ${g.member_count===1?'person':'personer'}</small>
            </div>
            <div class="menu-group-actions">
                <button class="mini-btn" type="button" onclick="copyGroupCode('${esc(g.code)}')">Kopier</button>
                <button class="mini-btn" type="button" onclick="activateGroup('${g.id}')">${active?'Valgt':'Velg'}</button>
                <button class="mini-btn" type="button" onclick="leaveGroup('${g.id}')">Forlat</button>
                ${canDelete?`<button class="mini-btn danger" type="button" onclick="deleteGroup('${g.id}')">Slett</button>`:''}
            </div>
        </div>`;
    }).join('');
}

async function loadGroups() {
    if (!CU) return;
    const {data:members,error}=await sb.from('pl_group_members')
        .select('group_id,joined_at')
        .eq('user_id',CU.id)
        .order('joined_at',{ascending:false});

    if (error) {
        groupSchemaReady=false;
        groupCache=[];
        allGroupsById={};
        currentGroupId='';
        localStorage.removeItem('pl_group_filter');
        updateGroupControls();
        return;
    }

    groupSchemaReady=true;
    const ids=[...new Set((members||[]).map(m=>m.group_id))];
    if (!ids.length) {
        groupCache=[];
        allGroupsById={};
        currentGroupId='';
        localStorage.removeItem('pl_group_filter');
        updateGroupControls();
        return;
    }

    const [{data:groups,error:groupError},{data:allMembers}] = await Promise.all([
        sb.from('pl_groups').select('*').in('id',ids).order('created_at',{ascending:false}),
        sb.from('pl_group_members').select('group_id,user_id').in('group_id',ids)
    ]);

    if (groupError) {
        groupSchemaReady=false;
        groupCache=[];
        currentGroupId='';
        localStorage.removeItem('pl_group_filter');
        updateGroupControls();
        return;
    }

    const counts={};
    (allMembers||[]).forEach(m=>{counts[m.group_id]=(counts[m.group_id]||0)+1;});
    groupCache=(groups||[]).map(g=>({...g,member_count:counts[g.id]||1}));
    allGroupsById=Object.fromEntries(groupCache.map(g=>[g.id,g]));
    updateGroupControls();
}

function ensureGroupRealtime() {
    if (groupChannel || !groupSchemaReady) return;
    const refresh=async()=>{await loadGroups(); await refreshActiveGroups();};
    groupChannel=sb.channel('groups-realtime')
        .on('postgres_changes',{event:'*',schema:'public',table:'pl_groups'},refresh)
        .on('postgres_changes',{event:'*',schema:'public',table:'pl_group_members'},refresh)
        .on('postgres_changes',{event:'*',schema:'public',table:'pl_drinks'},refresh)
        .on('postgres_changes',{event:'*',schema:'public',table:'pl_users'},refresh)
        .subscribe();
}

async function ensureGroupsReady() {
    if (groupSchemaReady) return true;
    await loadGroups();
    if (groupSchemaReady) {
        ensureGroupRealtime();
        await renderGroups();
        return true;
    }
    showToast('Kjør oppdatert schema.sql for grupper først.',false);
    return false;
}

async function refreshActiveGroups() {
    updateGroupControls();
    if (activeViewName()==='groups') await renderGroups();
}

async function afterGroupJoined(group) {
    await loadGroups();
    currentGroupId=group.id;
    localStorage.setItem('pl_group_filter',currentGroupId);
    updateGroupControls();
    await renderGroups();
}

async function createGroup() {
    if (!(await ensureGroupsReady())) return;
    const name=document.getElementById('group-name').value.trim();
    if (!name) {showToast('Skriv navn på gruppen.',false);return;}
    if (name.length>48) {showToast('Maks 48 tegn på navn.',false);return;}
    const code=cleanGroupCode(document.getElementById('group-code').value)||randomGroupCode();
    if (code.length<3) {showToast('Kode må ha minst 3 tegn.',false);return;}

    setLoading(true,'Oppretter gruppe...');
    const {data:group,error}=await sb.rpc('create_group_with_code',{
        group_name:name,
        input_code:code
    });

    setLoading(false);
    if (error) {
        showToast(error.message||'Kunne ikke opprette. Koden er kanskje brukt.',false);
        return;
    }

    document.getElementById('group-name').value='';
    document.getElementById('group-code').value='';
    await afterGroupJoined({...group,member_count:1});
    showToast(`Gruppe opprettet. Kode: ${code}`);
}

async function joinGroupByCode(inputId='group-join-code') {
    if (!(await ensureGroupsReady())) return;
    const input=document.getElementById(inputId);
    const code=cleanGroupCode(input?.value);
    if (code.length<3) {showToast('Skriv inn en gyldig kode.',false);return;}

    setLoading(true,'Sjekker kode...');
    const {data:group,error}=await sb.rpc('join_group_by_code',{input_code:code});
    setLoading(false);
    if (error || !group) {
        showToast(error?.message||'Fant ingen gruppe med den koden.',false);
        return;
    }

    if (input) input.value='';
    await afterGroupJoined(group);
    showToast(`Du er med i ${group.name}.`);
}

async function copyGroupCode(code) {
    try {
        await navigator.clipboard.writeText(code);
        showToast('Kode kopiert');
    } catch {
        prompt('Kopier koden:',code);
    }
}

async function activateGroup(groupId) {
    currentGroupId=groupId;
    if (currentGroupId) localStorage.setItem('pl_group_filter',currentGroupId);
    else localStorage.removeItem('pl_group_filter');
    updateGroupControls();
    await renderGroups();
}

async function leaveGroup(groupId) {
    const group=groupById(groupId);
    if (!group) return;
    if (!confirm(`Forlate "${group.name}"?`)) return;

    setLoading(true,'Forlater gruppe...');
    const {data,error}=await sb.from('pl_group_members')
        .delete()
        .eq('group_id',groupId)
        .eq('user_id',CU.id)
        .select('group_id');
    setLoading(false);
    if (error || !data?.length) {
        showToast('Kunne ikke forlate gruppen.',false);
        return;
    }

    await loadGroups();
    await renderGroups();
    showToast('Du forlot gruppen.');
}

async function deleteGroup(groupId) {
    const group=groupById(groupId);
    if (!group) return;
    if (group.created_by!==CU.id && !isAdmin(CU)) {showToast('Bare eieren kan slette gruppen.',false);return;}
    const typed=prompt(`Skriv SLETT for å slette "${group.name}".`);
    if (String(typed||'').trim().toUpperCase()!=='SLETT') {
        showToast('Sletting avbrutt.',false);
        return;
    }

    setLoading(true,'Sletter gruppe...');
    const {data,error}=await sb.from('pl_groups')
        .delete()
        .eq('id',groupId)
        .select('id');
    setLoading(false);
    if (error || !data?.length) {
        showToast('Kunne ikke slette gruppen.',false);
        return;
    }

    await loadGroups();
    await renderGroups();
    showToast('Gruppe slettet.');
}

function renderGroupCards() {
    if (!groupCache.length) return '<div class="empty">Ingen grupper ennå. Lag en gruppe eller bli med med kode.</div>';

    return groupCache.map(g=>{
        const active=g.id===currentGroupId;
        const canDelete=g.created_by===CU.id || isAdmin(CU);
        return `
        <div class="group-card${active?' active':''}">
            <div class="group-main">
                <div class="group-name">${esc(g.name)}</div>
                <div class="group-meta">Kode <strong>${esc(g.code)}</strong> · ${g.member_count||1} ${g.member_count===1?'person':'personer'}</div>
            </div>
            <div class="group-actions">
                <button class="icon-btn" onclick="copyGroupCode('${esc(g.code)}')">Kopier kode</button>
                <button class="btn btn-s btn-sm" onclick="activateGroup('${g.id}')">${active?'Valgt':'Vis topp'}</button>
                <button class="btn btn-s btn-sm" onclick="leaveGroup('${g.id}')">Forlat</button>
                ${canDelete?`<button class="btn btn-d btn-sm" onclick="deleteGroup('${g.id}')">Slett</button>`:''}
            </div>
        </div>`;
    }).join('');
}

async function loadGroupLeaderboard(groupId) {
    const group=groupById(groupId);
    if (!group) return {group:null,members:[],users:[],drinks:[],ranked:[],error:null};

    const {data:members,error:memberError}=await sb.from('pl_group_members')
        .select('user_id,joined_at')
        .eq('group_id',groupId);
    if (memberError) return {group,members:[],users:[],drinks:[],ranked:[],error:memberError};

    const userIds=[...new Set((members||[]).map(m=>m.user_id).filter(Boolean))];
    if (!userIds.length) return {group,members:members||[],users:[],drinks:[],ranked:[],error:null};

    const [{data:users,error:userError},{data:drinks,error:drinkError}] = await Promise.all([
        sb.from('pl_users').select(PROFILE_SELECT).in('id',userIds),
        sb.from('pl_drinks').select('user_id,type_name,vol_ml,abv,qty,grams,ts').in('user_id',userIds)
    ]);
    const error=userError||drinkError;
    if (error) return {group,members:members||[],users:users||[],drinks:drinks||[],ranked:[],error};

    const ranked=aggregateLeaderboard(users||[],drinks||[]);
    return {group,members:members||[],users:users||[],drinks:drinks||[],ranked,error:null};
}

function renderGroupSummary(data) {
    const totalGrams=(data.drinks||[]).reduce((sum,d)=>sum+(Number(d.grams)||0),0);
    const drinkCount=(data.drinks||[]).length;
    const activeDrinkers=(data.ranked||[]).filter(u=>u.rawGrams>0).length;
    const leader=(data.ranked||[]).find(u=>u.rawGrams>0);

    return `<div class="group-summary">
        <div class="group-stat"><div class="ct">Medlemmer</div><div class="cv">${data.users.length}</div><div class="cs">i gruppen</div></div>
        <div class="group-stat"><div class="ct">Totalt</div><div class="cv">${formatAlcoholValue(totalGrams)}</div><div class="cs">${alcoholSuffix()}</div></div>
        <div class="group-stat"><div class="ct">Registreringer</div><div class="cv">${drinkCount}</div><div class="cs">noensinne</div></div>
        <div class="group-stat"><div class="ct">Leder</div><div class="cv group-leader-value">${leader?esc(displayName(leader)):'-'}</div><div class="cs">${leader?formatAlcohol(leader.rawGrams):'ingen ennå'}</div></div>
    </div>
    <div class="group-muted">${activeDrinkers} av ${data.users.length} medlemmer har registrert drikke.</div>`;
}

function renderGroupRankedList(ranked) {
    if (!ranked.length) return '<div class="empty">Ingen medlemmer i denne gruppen.</div>';

    const maxG=Math.max(ranked[0]?.rawGrams||0,1);
    const medals=['🥇','🥈','🥉'];
    return ranked.map((u,i)=>{
        const color=u.color||USER_COLORS[0];
        const isMe=u.id===CU.id;
        const name=displayName(u);
        return `<div class="lbr${isMe?' me':''}">
            <div class="lbrank ${i<3?'r'+(i+1):''}">${i<3?medals[i]:i+1}</div>
            ${avatarHtml(u,28,'.78em')}
            <div class="lbmain">
                <div class="lbtop">
                    <div class="lbn">${esc(name)}${isMe?'<span class="metag">(deg)</span>':''}</div>
                    <div class="lbg" style="color:${color}">${formatAlcohol(u.rawGrams)}</div>
                </div>
                <div class="lbmeta">
                    <span class="lbchip">Øl <strong>${fmtLiters(u.liters.beer)}</strong></span>
                    <span class="lbchip">Vin <strong>${fmtLiters(u.liters.wine)}</strong></span>
                    <span class="lbchip">Sprit <strong>${fmtLiters(u.liters.spirits)}</strong></span>
                </div>
                <div class="bar-wrap"><div class="bar" style="width:${Math.round(u.rawGrams/maxG*100)}%;background:${color}"></div></div>
            </div>
        </div>`;
    }).join('');
}

async function renderGroupLeaderboard() {
    const card=document.getElementById('group-board-card');
    const title=document.getElementById('group-board-title');
    const meta=document.getElementById('group-board-meta');
    const el=document.getElementById('group-board');
    if (!card || !title || !meta || !el) return;

    if (!currentGroupId || !groupCache.length) {
        card.style.display='none';
        return;
    }

    card.style.display='block';
    title.textContent='Gruppetopp';
    meta.textContent='Laster...';
    el.innerHTML='<div class="vload"><div class="spinner"></div>Laster...</div>';

    const data=await loadGroupLeaderboard(currentGroupId);
    if (data.error) {
        meta.textContent='';
        el.innerHTML=`<div class="empty">Kunne ikke laste gruppetoppen: ${esc(data.error.message||'Ukjent feil')}</div>`;
        return;
    }

    title.textContent=data.group?.name || 'Gruppetopp';
    meta.innerHTML=data.group ? `Kode <strong>${esc(data.group.code)}</strong> · all-time total` : '';
    el.innerHTML=`
        ${renderGroupSummary(data)}
        <div class="group-ranked">${renderGroupRankedList(data.ranked)}</div>
    `;
}

async function renderGroups() {
    const select=document.getElementById('group-filter');
    if (!select) return;
    if (!groupSchemaReady) {
        renderGroupFilter();
        const card=document.getElementById('group-board-card');
        if (card) card.style.display='none';
        updateGroupControls();
        return;
    }

    updateGroupControls();
    await renderGroupLeaderboard();
}
