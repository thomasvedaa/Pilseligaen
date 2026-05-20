/* ════════════════════════════════════════════
   CONSTANTS & HELPERS
════════════════════════════════════════════ */
const SUPABASE_URL  = 'https://hmgvocclrpfypmflbyop.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtZ3ZvY2NscnBmeXBtZmxieW9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxOTM4NzcsImV4cCI6MjA5NDc2OTg3N30.U2LlSW3L_c7pW8ELQ9pRaegzg6mkwtoZE9DzFM_iPWc';
const USER_COLORS  = ['#f0a500','#3fb950','#58a6ff','#ff7b72','#d2a8ff','#ffa657','#79c0ff','#f78166'];

// Theme Chart.js to match the pub-night palette.
if (window.Chart) {
    Chart.defaults.color = '#a89878';           // var(--dim)
    Chart.defaults.borderColor = '#483b2f';      // var(--border)
    Chart.defaults.font.family = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, system-ui, sans-serif";
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(28, 22, 16, 0.95)';
    Chart.defaults.plugins.tooltip.titleColor = '#f5ecd9';
    Chart.defaults.plugins.tooltip.bodyColor = '#a89878';
    Chart.defaults.plugins.tooltip.borderColor = '#5a4a3a';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.displayColors = true;
    Chart.defaults.plugins.tooltip.boxPadding = 5;
}

const ALCOHOL_UNIT_GRAMS = 12;
const AUTH_EMAIL_DOMAIN = 'pilseligaen.local';
const PROFILE_SELECT = 'id,username,nickname,avatar_url,color,created_at';
let alcoholMode = localStorage.getItem('pl_alcohol_mode') || 'grams';

const DEFAULT_DTYPES = [
    { id:'d1', name:'Pils 0,33L (4,7%)',    vol_ml:330, abv:4.7,  isDefault:true },
    { id:'d2', name:'Pils 0,5L (4,7%)',     vol_ml:500, abv:4.7,  isDefault:true },
    { id:'d3', name:'Fatøl 0,5L (5,0%)',    vol_ml:500, abv:5.0,  isDefault:true },
    { id:'d4', name:'Cider 0,33L (4,5%)',   vol_ml:330, abv:4.5,  isDefault:true },
    { id:'d5', name:'Vin, glass (12%)',      vol_ml:150, abv:12.0, isDefault:true },
    { id:'d6', name:'Vin, flaske (12%)',     vol_ml:750, abv:12.0, isDefault:true },
    { id:'d7', name:'Shot / brennevin (40%)',vol_ml:40,  abv:40.0, isDefault:true },
    { id:'d8', name:'Sekser Pils 0,5L (4,7%)',vol_ml:3000, abv:4.7, isDefault:true, pack_count:6, unit_vol_ml:500 },
    { id:'d9', name:'10-pakning Pils 0,33L (4,7%)',vol_ml:3300, abv:4.7, isDefault:true, pack_count:10, unit_vol_ml:330 },
    { id:'d10', name:'Guinness 0,5L (4,2%)',  vol_ml:500, abv:4.2, isDefault:true },
    { id:'d11', name:'Aass Energiøl 0,5L (4,7%)', vol_ml:500, abv:4.7, isDefault:true },
];

function grams(vol, abv, qty = 1) { return Math.round(vol * (abv / 100) * 0.789 * qty * 10) / 10; }
function drinkIcon(abv) { return abv >= 25 ? '🥃' : abv >= 9 ? '🍷' : '🍺'; }
function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g,ch=>({
        '&':'&amp;',
        '<':'&lt;',
        '>':'&gt;',
        '"':'&quot;',
        "'":'&#39;'
    }[ch]));
}
function displayName(user) {
    return (user?.nickname || user?.username || '?').trim() || '?';
}
function userInitial(user) {
    return displayName(user)[0].toUpperCase();
}
function cleanAvatarUrl(value) {
    const raw=String(value||'').trim();
    if (!raw) return '';
    try {
        const url=new URL(raw);
        if (!['http:','https:'].includes(url.protocol)) return '';
        return url.href.slice(0,500);
    } catch {
        return '';
    }
}
function avatarImgTag(user) {
    const url=cleanAvatarUrl(user?.avatar_url);
    if (!url) return '';
    return `<img src="${esc(url)}" alt="${esc(displayName(user))}" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove();this.parentElement.classList.remove('has-img');this.parentElement.textContent=this.parentElement.dataset.initial">`;
}
function avatarHtml(user, size=30, fontSize='.82em') {
    const color=user?.color||USER_COLORS[0];
    const image=avatarImgTag(user);
    const cls=image?'avatar has-img':'avatar';
    const content=image || esc(userInitial(user));
    return `<div class="${cls}" data-initial="${esc(userInitial(user))}" style="background:${color};width:${size}px;height:${size}px;font-size:${fontSize};flex-shrink:0">${content}</div>`;
}
function setAvatarElement(el,user) {
    if (!el) return;
    const image=avatarImgTag(user);
    el.className=image?'avatar has-img':'avatar';
    el.dataset.initial=userInitial(user);
    el.style.background=user?.color||USER_COLORS[0];
    el.innerHTML=image || esc(userInitial(user));
}
function alcoholDisplayValue(gramsValue) {
    const raw=Number(gramsValue)||0;
    if (alcoholMode==='units') {
        return Math.round((raw / ALCOHOL_UNIT_GRAMS) * 10) / 10;
    }
    return Math.round(raw);
}
function fmtNo(value, decimals=1) {
    return Number(value).toLocaleString('no-NO',{minimumFractionDigits:0,maximumFractionDigits:decimals});
}
function alcoholSuffix() {
    return alcoholMode==='units' ? 'enheter' : 'g';
}
function alcoholSubLabel() {
    return alcoholMode==='units' ? 'alkoholenheter' : 'gram alkohol';
}
function formatAlcohol(gramsValue) {
    const val=alcoholDisplayValue(gramsValue);
    return `${fmtNo(val,alcoholMode==='units'?1:0)} ${alcoholSuffix()}`;
}
function formatAlcoholValue(gramsValue) {
    return fmtNo(alcoholDisplayValue(gramsValue),alcoholMode==='units'?1:0);
}
function formatChartValue(value) {
    return `${fmtNo(value,alcoholMode==='units'?1:0)} ${alcoholSuffix()}`;
}
function chartValue(gramsValue) {
    return alcoholDisplayValue(gramsValue);
}
function fmtVolume(ml) {
    const n=Number(ml)||0;
    if (n>=1000) return (n/1000).toLocaleString('no-NO',{minimumFractionDigits:n%1000===0?0:1,maximumFractionDigits:2}) + ' L';
    return n.toLocaleString('no-NO',{maximumFractionDigits:0}) + ' ml';
}
function fmtDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('no-NO',{weekday:'short',day:'numeric',month:'short'}) + ' kl. ' + d.toLocaleTimeString('no-NO',{hour:'2-digit',minute:'2-digit'});
}
function safeAuthName(value) {
    return String(value||'')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g,'-')
        .replace(/^-+|-+$/g,'') || 'bruker';
}
function authEmailFromUsername(value) {
    const raw=String(value||'').trim().toLowerCase();
    if (raw.endsWith(`@${AUTH_EMAIL_DOMAIN}`)) return raw;
    return `${safeAuthName(raw)}@${AUTH_EMAIL_DOMAIN}`;
}
function eventById(id=currentEventId) {
    return (eventCache||[]).find(e=>e.id===id)||null;
}
function eventLabel(id=currentEventId) {
    const event=eventById(id);
    return event ? event.name : 'Totalt';
}
function eventIdsForCurrentUser() {
    return new Set((eventCache||[]).map(e=>e.id));
}
function visibleDrinksForScope(drinks) {
    const rows=drinks||[];
    if (!eventSchemaReady) return rows;
    if (currentEventId) return rows.filter(d=>d.event_id===currentEventId);
    const allowed=eventIdsForCurrentUser();
    return rows.filter(d=>!d.event_id || allowed.has(d.event_id));
}
function eventMeta(d) {
    if (!eventSchemaReady || !d?.event_id) return '';
    const event=eventById(d.event_id);
    return event ? ` · ${esc(event.name)}` : '';
}
function dayKey(iso) {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function dayLabel(key) {
    const [,m,d]=key.split('-');
    return `${d}.${m}`;
}
function keyToDate(key) {
    const [y,m,d]=key.split('-').map(Number);
    return new Date(y,m-1,d);
}
function dayDiff(fromKey,toKey) {
    return Math.round((keyToDate(toKey)-keyToDate(fromKey))/86400000);
}
function weekendAlcoholKey(iso) {
    const d=new Date(iso);
    const day=d.getDay();
    if (![0,4,5,6].includes(day)) return null;
    if (day===0) d.setDate(d.getDate()-3);
    if (day===5) d.setDate(d.getDate()-1);
    if (day===6) d.setDate(d.getDate()-2);
    return dayKey(d);
}
function currentWeekendKey(now=new Date()) {
    const d=new Date(now);
    const day=d.getDay();
    if (day===0) d.setDate(d.getDate()-3);
    if (day===1) d.setDate(d.getDate()-4);
    if (day===2) d.setDate(d.getDate()-5);
    if (day===3) d.setDate(d.getDate()-6);
    if (day===5) d.setDate(d.getDate()-1);
    if (day===6) d.setDate(d.getDate()-2);
    return dayKey(d);
}
function weekendDiff(fromKey,toKey) {
    return Math.round(dayDiff(fromKey,toKey)/7);
}
function weekendLabel(key) {
    const start=keyToDate(key);
    const end=new Date(start);
    end.setDate(end.getDate()+3);
    const f=d=>`${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}`;
    return `${f(start)}-${f(end)}`;
}
function weekendStreakStats(drinksOrKeys) {
    const keys=[...new Set((drinksOrKeys||[])
        .map(row=>typeof row==='string'?row:weekendAlcoholKey(row?.ts))
        .filter(Boolean))]
        .sort();
    if (!keys.length) return {current:0,best:0,active:false,last:null};

    let best=1;
    let run=1;
    for (let i=1;i<keys.length;i++) {
        run=weekendDiff(keys[i-1],keys[i])===1 ? run+1 : 1;
        best=Math.max(best,run);
    }

    const last=keys[keys.length-1];
    const active=last===currentWeekendKey();
    let current=active?1:0;
    if (active) {
        for (let i=keys.length-2;i>=0;i--) {
            if (weekendDiff(keys[i],keys[i+1])!==1) break;
            current++;
        }
    }

    return {current,best,active,last};
}
function fmtLiters(liters) {
    if (!liters) return '0 L';
    const digits = liters < 1 ? 2 : 1;
    return liters.toLocaleString('no-NO',{minimumFractionDigits:digits,maximumFractionDigits:digits}) + ' L';
}
function drinkCategory(d) {
    const name=(d.type_name||'').toLowerCase();
    const abv=Number(d.abv)||0;
    if (/(sprit|brennevin|shot|vodka|gin|rom|rum|whisk|tequila|akevitt|cognac|likør|jager|jäger)/.test(name) || abv>=22) return 'spirits';
    if (/(vin|wine|prosecco|champagne|cava)/.test(name)) return 'wine';
    if (/(øl|ol|pils|lager|ipa|ale|stout|porter|bayer|fatøl|beer)/.test(name)) return 'beer';
    if (abv>=8 && abv<22) return 'wine';
    if (abv>0 && abv<8) return 'beer';
    return 'other';
}
function resetDt() {
    const now = new Date(); now.setSeconds(0,0);
    document.getElementById('log-dt').value = new Date(now - now.getTimezoneOffset()*60000).toISOString().slice(0,16);
}

let _overlayTimer;
function setLoading(show, msg='Laster…') {
    clearTimeout(_overlayTimer);
    const el = document.getElementById('overlay');
    document.getElementById('overlay-msg').textContent = msg;
    if (show) { el.style.display='flex'; } else { _overlayTimer=setTimeout(()=>el.style.display='none', 80); }
}

function showToast(msg, ok=true) {
    document.querySelectorAll('.toast').forEach(t=>t.remove());
    const t=document.createElement('div'); t.className='toast '+(ok?'ok':'err'); t.textContent=msg;
    document.body.appendChild(t); setTimeout(()=>t.remove(),2700);
}

const CHART_OPTS = {
    responsive:true, maintainAspectRatio:false,
    plugins:{ legend:{display:false}, tooltip:{callbacks:{label:c=>formatChartValue(c.parsed.y)}} },
    scales:{ x:{ticks:{color:'#a89878'},grid:{color:'#483b2f'}}, y:{ticks:{color:'#a89878'},grid:{color:'#483b2f'},beginAtZero:true} }
};
