/* SEASONS */
const SUMMER_2026_SEASON = {
    id: 'sommer-2026',
    name: 'Sommer 2026',
    slug: 'sommer-2026',
    starts_at: '2026-06-01T00:00:00+02:00',
    ends_at: '2026-08-17T00:00:00+02:00',
    is_active: true,
    isDefault: true
};

function seasonKey(season) {
    return season?.slug || season?.id || '';
}

function defaultSeasons() {
    return [{...SUMMER_2026_SEASON}];
}

function mergeDefaultSeasons(seasons) {
    const byKey={};
    defaultSeasons().forEach(s=>{byKey[seasonKey(s)]=s;});
    (seasons||[]).forEach(s=>{byKey[seasonKey(s)]={...s,isDefault:false};});
    return Object.values(byKey)
        .filter(s=>s.is_active!==false)
        .sort((a,b)=>new Date(b.starts_at)-new Date(a.starts_at));
}

function seasonById(id=currentSeasonId) {
    if (!id) return null;
    return (seasonCache||[]).find(s=>s.id===id || s.slug===id) || null;
}

function seasonLabel(id=currentSeasonId) {
    const season=seasonById(id);
    return season ? season.name : 'Sesong';
}

function seasonContainsDate(season, value) {
    if (!season || !value) return false;
    const ts=new Date(value);
    return ts >= new Date(season.starts_at) && ts < new Date(season.ends_at);
}

function currentSeasonContains(value) {
    return seasonContainsDate(seasonById(), value);
}

function seasonDateRange(season) {
    if (!season) return '';
    const start=new Date(season.starts_at);
    const end=new Date(season.ends_at);
    end.setDate(end.getDate()-1);
    const fmt=d=>d.toLocaleDateString('no-NO',{day:'numeric',month:'long',year:'numeric'});
    return `${fmt(start)} - ${fmt(end)}`;
}

function seasonOptionsHtml() {
    const seasons=(seasonCache||[]).filter(s=>s.is_active!==false);
    if (!seasons.length) return '';
    return `<optgroup label="Sesonger">${seasons
        .map(s=>`<option value="season:${esc(seasonKey(s))}">${esc(s.name)}</option>`)
        .join('')}</optgroup>`;
}

async function loadSeasons() {
    const {data,error}=await sb.from('pl_seasons')
        .select('id,name,slug,starts_at,ends_at,is_active,created_by,created_at')
        .order('starts_at',{ascending:false});

    if (error) {
        seasonSchemaReady=false;
        seasonCache=defaultSeasons();
    } else {
        seasonSchemaReady=true;
        seasonCache=mergeDefaultSeasons(data||[]);
    }

    const validKeys=new Set((seasonCache||[]).map(seasonKey));
    if (currentSeasonId && !validKeys.has(currentSeasonId)) {
        currentSeasonId='';
        localStorage.removeItem('pl_season_filter');
    }
}

function ensureSeasonRealtime() {
    if (seasonChannel || !seasonSchemaReady) return;
    seasonChannel=sb.channel('seasons-realtime')
        .on('postgres_changes',{event:'*',schema:'public',table:'pl_seasons'},async()=>{
            await loadSeasons();
            await refreshActiveScope();
        })
        .subscribe();
}

function summerSeasonPayload() {
    const {id,isDefault,...payload}=SUMMER_2026_SEASON;
    return payload;
}
