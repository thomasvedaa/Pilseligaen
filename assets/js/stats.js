/* STATS */
let tlPeriod=30;
let tlMode='daily';
let h2hA='';
let h2hB='';
let h2hData={users:[],drinks:[]};
let chTL=null, chWD=null, chMO=null;

function setTlF(btn,period) {
    btn.closest('.tf').querySelectorAll('.fb').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active'); tlPeriod=period; renderStats();
}

function setTlMode(btn,mode) {
    btn.closest('.tf').querySelectorAll('.fb').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active'); tlMode=mode; renderStats();
}

function setH2hUser(slot,value) {
    if (slot==='a') h2hA=value;
    else h2hB=value;
    renderHeadToHead();
}

function drinkDayStreakStats(drinks) {
    const days=[...new Set((drinks||[]).map(d=>dayKey(d.ts)))].sort();
    if (!days.length) return {current:0,best:0,active:false,last:null};

    let best=1;
    let run=1;
    for (let i=1;i<days.length;i++) {
        run=dayDiff(days[i-1],days[i])===1 ? run+1 : 1;
        best=Math.max(best,run);
    }

    const today=dayKey(new Date());
    const last=days[days.length-1];
    const active=dayDiff(last,today)<=1;
    let current=active?1:0;
    if (active) {
        for (let i=days.length-2;i>=0;i--) {
            if (dayDiff(days[i],days[i+1])!==1) break;
            current++;
        }
    }

    return {current,best,active,last};
}

function summarizeUserStats(user,allDrinks) {
    const drinks=(allDrinks||[]).filter(d=>d.user_id===user.id);
    const total=drinks.reduce((s,d)=>s+(Number(d.grams)||0),0);
    const drinkCount=drinks.length;
    const days=[...new Set(drinks.map(d=>dayKey(d.ts)))];
    const byDay={};
    const liters={beer:0,wine:0,spirits:0};

    drinks.forEach(d=>{
        const g=Number(d.grams)||0;
        const k=dayKey(d.ts);
        const category=drinkCategory(d);
        const vol=((Number(d.vol_ml)||0)*(Number(d.qty)||1))/1000;
        byDay[k]=(byDay[k]||0)+g;
        if (liters[category]!==undefined) liters[category]+=vol;
    });

    const maxDay=Object.values(byDay).length?Math.max(...Object.values(byDay)):0;
    const dailyStreak=drinkDayStreakStats(drinks);
    const weekendStreak=weekendStreakStats(drinks);

    return {
        user,
        drinks,
        drinkCount,
        total,
        days:days.length,
        avg:days.length?total/days.length:0,
        maxDay,
        liters,
        dailyStreak,
        weekendStreak
    };
}

function h2hWinClass(left,right) {
    if (Math.abs((left||0)-(right||0))<0.001) return '';
    return left>right?' win':'';
}

function renderH2hMetric(label,left,right,formatter) {
    return `<div class="h2h-row">
        <div class="h2h-val${h2hWinClass(left,right)}">${formatter(left)}</div>
        <div class="h2h-label">${esc(label)}</div>
        <div class="h2h-val${h2hWinClass(right,left)}">${formatter(right)}</div>
    </div>`;
}

function populateH2hSelects(summaries) {
    const aSel=document.getElementById('h2h-a');
    const bSel=document.getElementById('h2h-b');
    if (!aSel || !bSel) return;

    const users=summaries.map(s=>s.user);
    const has=id=>users.some(u=>u.id===id);
    if (!h2hA || !has(h2hA)) h2hA=has(CU.id)?CU.id:(users[0]?.id||'');
    if (!h2hB || !has(h2hB) || (h2hB===h2hA && users.length>1)) {
        h2hB=(summaries.find(s=>s.user.id!==h2hA && s.total>0)||summaries.find(s=>s.user.id!==h2hA)||summaries[0])?.user.id||'';
    }

    const options=users.map(u=>`<option value="${u.id}">${esc(displayName(u))}${u.id===CU.id?' (deg)':''}</option>`).join('');
    aSel.innerHTML=options;
    bSel.innerHTML=options;
    aSel.value=h2hA;
    bSel.value=h2hB;
}

function renderHeadToHead() {
    const el=document.getElementById('h2h-result');
    if (!el) return;

    const summaries=(h2hData.users||[])
        .map(u=>summarizeUserStats(u,h2hData.drinks||[]))
        .sort((a,b)=>b.total-a.total || displayName(a.user).localeCompare(displayName(b.user),'no'));

    if (!summaries.length) {
        el.innerHTML='<div class="empty">Ingen brukere i dette området.</div>';
        return;
    }

    populateH2hSelects(summaries);
    const left=summaries.find(s=>s.user.id===h2hA)||summaries[0];
    const right=summaries.find(s=>s.user.id===h2hB)||summaries.find(s=>s.user.id!==left.user.id)||left;

    const metrics=[
        renderH2hMetric('Totalt',left.total,right.total,formatAlcohol),
        renderH2hMetric('Registreringer',left.drinkCount,right.drinkCount,v=>fmtNo(v,0)),
        renderH2hMetric('Drikkedager',left.days,right.days,v=>fmtNo(v,0)),
        renderH2hMetric('Snitt per dag',left.avg,right.avg,formatAlcohol),
        renderH2hMetric('Tyngste dag',left.maxDay,right.maxDay,formatAlcohol),
        renderH2hMetric('Beste streak',left.dailyStreak.best,right.dailyStreak.best,v=>`${fmtNo(v,0)} ${v===1?'dag':'dager'}`),
        renderH2hMetric('Helgestreak',left.weekendStreak.best,right.weekendStreak.best,v=>`${fmtNo(v,0)} ${v===1?'helg':'helger'}`),
        renderH2hMetric('Øl',left.liters.beer,right.liters.beer,fmtLiters),
        renderH2hMetric('Vin',left.liters.wine,right.liters.wine,fmtLiters),
        renderH2hMetric('Sprit',left.liters.spirits,right.liters.spirits,fmtLiters)
    ].join('');

    el.innerHTML=`<div class="h2h-board">
        <div class="h2h-person">
            ${avatarHtml(left.user,38,'.86em')}
            <div><strong>${esc(displayName(left.user))}</strong><small>${formatAlcohol(left.total)}</small></div>
        </div>
        <div class="h2h-vs">mot</div>
        <div class="h2h-person right">
            ${avatarHtml(right.user,38,'.86em')}
            <div><strong>${esc(displayName(right.user))}</strong><small>${formatAlcohol(right.total)}</small></div>
        </div>
        <div class="h2h-metrics">${metrics}</div>
    </div>`;
}

async function renderStats() {
    document.getElementById('stats-sum').innerHTML='<div style="grid-column:1/-1" class="vload"><div class="spinner"></div>Laster...</div>';
    const [{data:mine},{data:all},{data:usersRaw}]=await Promise.all([
        sb.from('pl_drinks').select('*').eq('user_id',CU.id),
        sb.from('pl_drinks').select('*'),
        sb.from('pl_users').select(PROFILE_SELECT)
    ]);
    const drinks=visibleDrinksForScope(mine||[]);
    const allScopedDrinks=visibleDrinksForScope(all||[]);
    const users=await fetchUsersForCurrentScope(usersRaw||[]);
    h2hData={users,drinks:allScopedDrinks};

    const total=drinks.reduce((s,d)=>s+(Number(d.grams)||0),0);
    const days=new Set(drinks.map(d=>new Date(d.ts).toDateString())).size;
    const avg=days>0?total/days:0;
    const byDay={}; drinks.forEach(d=>{const k=new Date(d.ts).toDateString();byDay[k]=(byDay[k]||0)+(Number(d.grams)||0);});
    const maxDay=Object.values(byDay).length?Math.max(...Object.values(byDay)):0;
    const weekend=weekendStreakStats(drinks);
    document.getElementById('stats-sum').innerHTML=`
        <div class="card"><div class="ct">Totalt</div><div class="cv">${formatAlcoholValue(total)}</div><div class="cs">${alcoholSubLabel()}</div></div>
        <div class="card"><div class="ct">Drikkedager</div><div class="cv">${days}</div><div class="cs">dager totalt</div></div>
        <div class="card"><div class="ct">Snitt per dag</div><div class="cv">${formatAlcoholValue(avg)}</div><div class="cs">per drikkedag</div></div>
        <div class="card"><div class="ct">Tyngste dag</div><div class="cv">${formatAlcoholValue(maxDay)}</div><div class="cs">${alcoholSubLabel()}</div></div>
        <div class="card"><div class="ct">Helgestreak</div><div class="cv">${weekend.active?weekend.current:0}</div><div class="cs">beste ${weekend.best} ${weekend.best===1?'helg':'helger'}</div></div>`;
    renderHeadToHead();

    let filtered=drinks;
    if (tlPeriod>0){const cut=new Date();cut.setDate(cut.getDate()-tlPeriod);filtered=drinks.filter(d=>new Date(d.ts)>=cut);}
    const tld={}; filtered.forEach(d=>{const k=dayKey(d.ts);tld[k]=(tld[k]||0)+(Number(d.grams)||0);});
    const tlK=Object.keys(tld).sort();
    let running=0;
    const tlData=tlK.map(k=>{
        running+=tld[k];
        const v=tlMode==='cumulative'?running:tld[k];
        return chartValue(v);
    });
    if (chTL) chTL.destroy();
    chTL=new Chart(document.getElementById('ch-tl').getContext('2d'),{type:tlMode==='cumulative'?'line':'bar',data:{labels:tlK.map(dayLabel),datasets:[{data:tlData,backgroundColor:'rgba(240,165,0,.75)',borderColor:'#f0a500',borderWidth:tlMode==='cumulative'?2:1,borderRadius:3,tension:.25,pointRadius:tlK.length>45?0:2,pointHoverRadius:4,fill:false}]},options:CHART_OPTS});

    const wdg=[0,0,0,0,0,0,0];
    drinks.forEach(d=>{let w=new Date(d.ts).getDay();w=w===0?6:w-1;wdg[w]+=Number(d.grams)||0;});
    const wdMax=Math.max(...wdg)||1;
    if (chWD) chWD.destroy();
    chWD=new Chart(document.getElementById('ch-wd').getContext('2d'),{type:'bar',data:{labels:['Man','Tir','Ons','Tor','Fre','Lør','Søn'],datasets:[{data:wdg.map(chartValue),backgroundColor:wdg.map(g=>`rgba(240,165,0,${.2+(g/wdMax)*.8})`),borderColor:'#f0a500',borderWidth:1,borderRadius:3}]},options:CHART_OPTS});

    const now=new Date();
    const moK=[],moL=[]; const MN=['Jan','Feb','Mar','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Des'];
    for (let i=11;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);moK.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);moL.push(MN[d.getMonth()]);}
    const mo={}; moK.forEach(k=>{mo[k]=0;});
    drinks.forEach(d=>{const dt=new Date(d.ts);const k=`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;if(mo[k]!==undefined)mo[k]+=Number(d.grams)||0;});
    if (chMO) chMO.destroy();
    chMO=new Chart(document.getElementById('ch-mo').getContext('2d'),{type:'bar',data:{labels:moL,datasets:[{data:moK.map(k=>chartValue(mo[k])),backgroundColor:'rgba(88,166,255,.75)',borderColor:'#58a6ff',borderWidth:1,borderRadius:3}]},options:CHART_OPTS});
}
