/* ════════════════════════════════════════════
   STATS
════════════════════════════════════════════ */
let tlPeriod=30;
let tlMode='daily';
let chTL=null, chWD=null, chMO=null;

function setTlF(btn,period) {
    btn.closest('.tf').querySelectorAll('.fb').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active'); tlPeriod=period; renderStats();
}

function setTlMode(btn,mode) {
    btn.closest('.tf').querySelectorAll('.fb').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active'); tlMode=mode; renderStats();
}

async function renderStats() {
    document.getElementById('stats-sum').innerHTML='<div style="grid-column:1/-1" class="vload"><div class="spinner"></div>Laster…</div>';
    const {data:all}=await sb.from('pl_drinks').select('*').eq('user_id',CU.id);
    const drinks=all||[];
    const total=drinks.reduce((s,d)=>s+d.grams,0);
    const days=new Set(drinks.map(d=>new Date(d.ts).toDateString())).size;
    const avg=days>0?total/days:0;
    const byDay={}; drinks.forEach(d=>{const k=new Date(d.ts).toDateString();byDay[k]=(byDay[k]||0)+d.grams;});
    const maxDay=Object.values(byDay).length?Math.max(...Object.values(byDay)):0;
    document.getElementById('stats-sum').innerHTML=`
        <div class="card"><div class="ct">Totalt</div><div class="cv">${formatAlcoholValue(total)}</div><div class="cs">${alcoholSubLabel()}</div></div>
        <div class="card"><div class="ct">Drikkedager</div><div class="cv">${days}</div><div class="cs">dager totalt</div></div>
        <div class="card"><div class="ct">Snitt per dag</div><div class="cv">${formatAlcoholValue(avg)}</div><div class="cs">per drikkedag</div></div>
        <div class="card"><div class="ct">Tyngste dag</div><div class="cv">${formatAlcoholValue(maxDay)}</div><div class="cs">${alcoholSubLabel()}</div></div>`;
    // Timeline
    let filtered=drinks;
    if (tlPeriod>0){const cut=new Date();cut.setDate(cut.getDate()-tlPeriod);filtered=drinks.filter(d=>new Date(d.ts)>=cut);}
    const tld={}; filtered.forEach(d=>{const k=dayKey(d.ts);tld[k]=(tld[k]||0)+d.grams;});
    const tlK=Object.keys(tld).sort();
    let running=0;
    const tlData=tlK.map(k=>{
        running+=tld[k];
        const v=tlMode==='cumulative'?running:tld[k];
        return chartValue(v);
    });
    if (chTL) chTL.destroy();
    chTL=new Chart(document.getElementById('ch-tl').getContext('2d'),{type:tlMode==='cumulative'?'line':'bar',data:{labels:tlK.map(dayLabel),datasets:[{data:tlData,backgroundColor:'rgba(240,165,0,.75)',borderColor:'#f0a500',borderWidth:tlMode==='cumulative'?2:1,borderRadius:3,tension:.25,pointRadius:tlK.length>45?0:2,pointHoverRadius:4,fill:false}]},options:CHART_OPTS});
    // Weekday
    const wdg=[0,0,0,0,0,0,0];
    drinks.forEach(d=>{let w=new Date(d.ts).getDay();w=w===0?6:w-1;wdg[w]+=d.grams;});
    const wdMax=Math.max(...wdg)||1;
    if (chWD) chWD.destroy();
    chWD=new Chart(document.getElementById('ch-wd').getContext('2d'),{type:'bar',data:{labels:['Man','Tir','Ons','Tor','Fre','Lør','Søn'],datasets:[{data:wdg.map(chartValue),backgroundColor:wdg.map(g=>`rgba(240,165,0,${.2+(g/wdMax)*.8})`),borderColor:'#f0a500',borderWidth:1,borderRadius:3}]},options:CHART_OPTS});
    // Monthly
    const now=new Date();
    const moK=[],moL=[]; const MN=['Jan','Feb','Mar','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Des'];
    for (let i=11;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);moK.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);moL.push(MN[d.getMonth()]);}
    const mo={}; moK.forEach(k=>{mo[k]=0;});
    drinks.forEach(d=>{const dt=new Date(d.ts);const k=`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;if(mo[k]!==undefined)mo[k]+=d.grams;});
    if (chMO) chMO.destroy();
    chMO=new Chart(document.getElementById('ch-mo').getContext('2d'),{type:'bar',data:{labels:moL,datasets:[{data:moK.map(k=>chartValue(mo[k])),backgroundColor:'rgba(88,166,255,.75)',borderColor:'#58a6ff',borderWidth:1,borderRadius:3}]},options:CHART_OPTS});
}
