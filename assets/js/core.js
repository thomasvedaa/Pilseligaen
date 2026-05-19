/* ════════════════════════════════════════════
   CONSTANTS & HELPERS
════════════════════════════════════════════ */
const SUPABASE_URL  = 'https://hmgvocclrpfypmflbyop.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtZ3ZvY2NscnBmeXBtZmxieW9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxOTM4NzcsImV4cCI6MjA5NDc2OTg3N30.U2LlSW3L_c7pW8ELQ9pRaegzg6mkwtoZE9DzFM_iPWc';
const USER_COLORS  = ['#f0a500','#3fb950','#58a6ff','#ff7b72','#d2a8ff','#ffa657','#79c0ff','#f78166'];
const ALCOHOL_UNIT_GRAMS = 12;
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
function dayKey(iso) {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function dayLabel(key) {
    const [,m,d]=key.split('-');
    return `${d}.${m}`;
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
    scales:{ x:{ticks:{color:'#8b949e'},grid:{color:'#30363d'}}, y:{ticks:{color:'#8b949e'},grid:{color:'#30363d'},beginAtZero:true} }
};
