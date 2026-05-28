/* ADMIN / MODERATION */
async function renderAdminModeration() {
    const el = document.getElementById('admin-panel');
    if (!el) return;

    if (!isAdmin(CU)) {
        el.innerHTML = `
            <div class="card">
                <div class="st">Ingen tilgang</div>
                <p class="admin-muted">Adminpanelet er bare synlig for brukere med adminrolle.</p>
            </div>
        `;
        return;
    }

    el.innerHTML = '<div class="vload"><div class="spinner"></div>Laster moderering...</div>';
    const data = await loadAdminModerationData();
    if (data.error) {
        el.innerHTML = `
            <div class="card">
                <div class="st">Adminschema mangler</div>
                <p class="admin-muted">Kjør oppdatert <strong>schema.sql</strong> i Supabase for å aktivere moderering.</p>
                <p class="admin-muted">${esc(data.error.message || 'Ukjent feil')}</p>
            </div>
        `;
        return;
    }

    el.innerHTML = `
        ${renderAdminSummary(data)}
        ${renderAdminSeasons(data)}
        ${renderAdminDrinks(data)}
        ${renderAdminComments(data)}
        ${renderAdminEvents(data)}
    `;
}

async function loadAdminModerationData() {
    const [
        usersRes,
        drinksRes,
        drinkCommentsRes,
        achievementCommentsRes,
        eventsRes,
        seasonsRes
    ] = await Promise.all([
        sb.from('pl_users').select(PROFILE_SELECT),
        sb.from('pl_drinks').select('*').order('created_at',{ascending:false}).limit(30),
        sb.from('pl_drink_comments').select('id,drink_id,user_id,body,created_at').order('created_at',{ascending:false}).limit(30),
        sb.from('pl_achievement_comments').select('id,achievement_id,user_id,body,created_at').order('created_at',{ascending:false}).limit(30),
        sb.from('pl_events').select('*').order('created_at',{ascending:false}).limit(30),
        sb.from('pl_seasons').select('*').order('starts_at',{ascending:false}).limit(30)
    ]);

    const error = usersRes.error || drinksRes.error || drinkCommentsRes.error || achievementCommentsRes.error || eventsRes.error;
    if (error) return {error};

    const usersById = Object.fromEntries((usersRes.data || []).map(u => [u.id,u]));
    return {
        users: usersRes.data || [],
        usersById,
        drinks: drinksRes.data || [],
        drinkComments: drinkCommentsRes.data || [],
        achievementComments: achievementCommentsRes.data || [],
        events: eventsRes.data || [],
        seasons: seasonsRes.error ? [] : (seasonsRes.data || []),
        seasonsError: seasonsRes.error
    };
}

function renderAdminSummary(data) {
    return `<div class="stat-grid admin-grid">
        <div class="card"><div class="ct">Brukere</div><div class="cv">${data.users.length}</div><div class="cs">profiler</div></div>
        <div class="card"><div class="ct">Siste drikker</div><div class="cv">${data.drinks.length}</div><div class="cs">viser maks 30</div></div>
        <div class="card"><div class="ct">Kommentarer</div><div class="cv">${data.drinkComments.length + data.achievementComments.length}</div><div class="cs">viser maks 60</div></div>
        <div class="card"><div class="ct">Turer</div><div class="cv">${data.events.length}</div><div class="cs">viser maks 30</div></div>
    </div>`;
}

function renderAdminSeasons(data) {
    if (data.seasonsError) {
        return `<div class="card admin-section">
            <div class="sh"><div class="st">Sesonger</div></div>
            <p class="admin-muted">KjÃ¸r oppdatert <strong>schema.sql</strong> for Ã¥ lagre sesonger i Supabase.</p>
            <button class="btn btn-p btn-sm" type="button" onclick="adminCreateSummerSeason()">PrÃ¸v Ã¥ opprette Sommer 2026</button>
        </div>`;
    }

    const hasSummer=(data.seasons||[]).some(s=>s.slug===SUMMER_2026_SEASON.slug);
    const rows=(data.seasons||[]).map(s=>`
        <div class="admin-row">
            <div class="admin-main">
                <strong>${esc(s.name)}</strong>
                <span>${esc(seasonDateRange(s))}</span>
                <small>${s.is_active?'Aktiv':'Skjult'} Â· ${esc(s.slug)}</small>
            </div>
            <div class="admin-actions">
                <button class="btn btn-s btn-sm" type="button" onclick="adminToggleSeason('${s.id}',${s.is_active?'false':'true'})">${s.is_active?'Skjul':'Aktiver'}</button>
                <button class="btn btn-d btn-sm" type="button" onclick="adminDeleteSeason('${s.id}')">Slett</button>
            </div>
        </div>
    `).join('');

    return `<div class="card admin-section">
        <div class="sh">
            <div class="st">Sesonger</div>
            ${hasSummer?'':'<button class="btn btn-p btn-sm" type="button" onclick="adminCreateSummerSeason()">Opprett Sommer 2026</button>'}
        </div>
        <div class="admin-list">${rows || '<div class="empty">Ingen sesonger ennÃ¥.</div>'}</div>
    </div>`;
}

function adminUserName(data, userId) {
    return displayName(data.usersById[userId] || {username:'Ukjent'});
}

function renderAdminDrinks(data) {
    const rows = data.drinks.length ? data.drinks.map(d => `
        <div class="admin-row">
            <div class="admin-main">
                <strong>${esc(adminUserName(data,d.user_id))}</strong>
                <span>${esc(d.type_name)}${d.qty !== 1 ? ` x${esc(d.qty)}` : ''}</span>
                <small>${fmtDate(d.ts)}${eventMeta(d)}${d.note ? ' · ' + esc(d.note) : ''} · ${formatAlcohol(d.grams)}</small>
            </div>
            <button class="btn btn-d btn-sm" type="button" onclick="adminDeleteDrink('${d.id}')">Slett</button>
        </div>
    `).join('') : '<div class="empty">Ingen drikker å moderere.</div>';

    return `<div class="card admin-section">
        <div class="sh"><div class="st">Siste drikker</div></div>
        <div class="admin-list">${rows}</div>
    </div>`;
}

function renderAdminComments(data) {
    const drinkRows = data.drinkComments.map(c => `
        <div class="admin-row">
            <div class="admin-main">
                <strong>${esc(adminUserName(data,c.user_id))}</strong>
                <span>${esc(c.body)}</span>
                <small>Feedkommentar · ${fmtDate(c.created_at)}</small>
            </div>
            <button class="btn btn-d btn-sm" type="button" onclick="adminDeleteComment('pl_drink_comments','${c.id}')">Slett</button>
        </div>
    `);
    const achievementRows = data.achievementComments.map(c => `
        <div class="admin-row">
            <div class="admin-main">
                <strong>${esc(adminUserName(data,c.user_id))}</strong>
                <span>${esc(c.body)}</span>
                <small>Merkekommentar · ${fmtDate(c.created_at)}</small>
            </div>
            <button class="btn btn-d btn-sm" type="button" onclick="adminDeleteComment('pl_achievement_comments','${c.id}')">Slett</button>
        </div>
    `);
    const rows = [...drinkRows,...achievementRows].join('') || '<div class="empty">Ingen kommentarer å moderere.</div>';

    return `<div class="card admin-section">
        <div class="sh"><div class="st">Kommentarer</div></div>
        <div class="admin-list">${rows}</div>
    </div>`;
}

function renderAdminEvents(data) {
    const rows = data.events.length ? data.events.map(e => `
        <div class="admin-row">
            <div class="admin-main">
                <strong>${esc(e.name)}</strong>
                <span>Kode ${esc(e.code)}</span>
                <small>${e.ended_at ? 'Avsluttet ' + fmtDate(e.ended_at) : 'Aktiv'} · laget ${fmtDate(e.created_at)}</small>
            </div>
            <div class="admin-actions">
                ${e.ended_at ? '' : `<button class="btn btn-s btn-sm" type="button" onclick="adminEndEvent('${e.id}')">Avslutt</button>`}
                <button class="btn btn-d btn-sm" type="button" onclick="adminDeleteEvent('${e.id}')">Slett</button>
            </div>
        </div>
    `).join('') : '<div class="empty">Ingen turer å moderere.</div>';

    return `<div class="card admin-section">
        <div class="sh"><div class="st">Turer og eventer</div></div>
        <div class="admin-list">${rows}</div>
    </div>`;
}

function requireAdminAction() {
    if (isAdmin(CU)) return true;
    showToast('Ingen admintilgang.', false);
    return false;
}

async function adminDeleteDrink(id) {
    if (!requireAdminAction()) return;
    if (!confirm('Slette denne registreringen?')) return;
    setLoading(true,'Sletter registrering...');
    const {data,error} = await sb.from('pl_drinks').delete().eq('id',id).select('id');
    setLoading(false);
    if (error || !data?.length) { showToast('Kunne ikke slette. Kjør oppdatert schema.sql først.', false); return; }
    showToast('Registrering slettet.');
    await renderAdminModeration();
}

async function adminDeleteComment(table, id) {
    if (!requireAdminAction()) return;
    if (!['pl_drink_comments','pl_achievement_comments'].includes(table)) return;
    if (!confirm('Slette denne kommentaren?')) return;
    setLoading(true,'Sletter kommentar...');
    const {data,error} = await sb.from(table).delete().eq('id',id).select('id');
    setLoading(false);
    if (error || !data?.length) { showToast('Kunne ikke slette kommentar.', false); return; }
    showToast('Kommentar slettet.');
    await renderAdminModeration();
}

async function adminEndEvent(id) {
    if (!requireAdminAction()) return;
    if (!confirm('Avslutte denne turen?')) return;
    setLoading(true,'Avslutter tur...');
    const {error} = await sb.from('pl_events').update({ended_at:new Date().toISOString()}).eq('id',id);
    setLoading(false);
    if (error) { showToast('Kunne ikke avslutte. Kjør oppdatert schema.sql først.', false); return; }
    await loadEvents();
    showToast('Tur avsluttet.');
    await renderAdminModeration();
}

async function adminDeleteEvent(id) {
    if (!requireAdminAction()) return;
    if (!confirm('Slette denne turen? Drikker beholdes, men kobles fra turen.')) return;
    const typed = prompt('Skriv SLETT for å bekrefte.');
    if (String(typed || '').trim().toUpperCase() !== 'SLETT') return;
    setLoading(true,'Sletter tur...');
    const {data,error} = await sb.from('pl_events').delete().eq('id',id).select('id');
    setLoading(false);
    if (error || !data?.length) { showToast('Kunne ikke slette. Kjør oppdatert schema.sql først.', false); return; }
    await loadEvents();
    showToast('Tur slettet.');
    await renderAdminModeration();
}

async function adminCreateSummerSeason() {
    if (!requireAdminAction()) return;
    setLoading(true,'Oppretter Sommer 2026...');
    const {error}=await sb.from('pl_seasons')
        .upsert(summerSeasonPayload(),{onConflict:'slug'})
        .select('id')
        .single();
    setLoading(false);
    if (error) { showToast('Kunne ikke opprette sesong. KjÃ¸r oppdatert schema.sql fÃ¸rst.', false); return; }
    await loadSeasons();
    updateEventControls();
    showToast('Sommer 2026 er klar.');
    await renderAdminModeration();
}

async function adminToggleSeason(id, active) {
    if (!requireAdminAction()) return;
    setLoading(true,'Oppdaterer sesong...');
    const {error}=await sb.from('pl_seasons').update({is_active:active}).eq('id',id);
    setLoading(false);
    if (error) { showToast('Kunne ikke oppdatere sesong.', false); return; }
    await loadSeasons();
    updateEventControls();
    await renderAdminModeration();
}

async function adminDeleteSeason(id) {
    if (!requireAdminAction()) return;
    if (!confirm('Slette denne sesongen? Drikker beholdes.')) return;
    setLoading(true,'Sletter sesong...');
    const {data,error}=await sb.from('pl_seasons').delete().eq('id',id).select('id');
    setLoading(false);
    if (error || !data?.length) { showToast('Kunne ikke slette sesong.', false); return; }
    await loadSeasons();
    if (currentSeasonId && !seasonById(currentSeasonId)) {
        currentSeasonId='';
        localStorage.removeItem('pl_season_filter');
    }
    updateEventControls();
    await renderAdminModeration();
}
