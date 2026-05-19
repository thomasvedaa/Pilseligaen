/* ════════════════════════════════════════════
   LEADERBOARD  — sanntid via Supabase Realtime
════════════════════════════════════════════ */
let lbFilter='all';
let lbLimit=10;
let lbTimelineMode='daily';
let chLB=null, chLBTime=null;

function setLbF(btn,filter) {
    btn.closest('.tf').querySelectorAll('.fb').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active'); lbFilter=filter; renderLeaderboard(filter);
}

function normalizeLbLimit(value) {
    const n=parseInt(value,10);
    if (!Number.isFinite(n) || n<1) return 10;
    return Math.min(n,250);
}

function setLbLimit(value) {
    const customWrap=document.getElementById('lb-custom-wrap');
    const customInput=document.getElementById('lb-custom');
    if (value==='custom') {
        customWrap.style.display='block';
        lbLimit=normalizeLbLimit(customInput.value);
        customInput.focus();
    } else {
        customWrap.style.display='none';
        lbLimit=normalizeLbLimit(value);
    }
    fetchAndRenderLb(lbFilter);
}

function setLbCustomLimit(value) {
    const n=parseInt(value,10);
    if (!Number.isFinite(n) || n<1) return;
    lbLimit=normalizeLbLimit(value);
    fetchAndRenderLb(lbFilter);
}

function setLbTimelineMode(btn,mode) {
    btn.closest('.tf').querySelectorAll('.fb').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    lbTimelineMode=mode;
    fetchAndRenderLb(lbFilter);
}

function renderLeaderboard(filter) {
    // Unsubscribe previous channel
    if (lbChannel){sb.removeChannel(lbChannel);lbChannel=null;}

    document.getElementById('lb-list').innerHTML='<div class="vload"><div class="spinner"></div>Laster…</div>';
    document.getElementById('lb-count-note').textContent='';

    // Initial render
    fetchAndRenderLb(filter);

    // Subscribe for real-time updates
    lbChannel = sb.channel('lb-realtime')
        .on('postgres_changes',{event:'*',schema:'public',table:'pl_drinks'},()=>fetchAndRenderLb(lbFilter))
        .on('postgres_changes',{event:'*',schema:'public',table:'pl_users'},()=>fetchAndRenderLb(lbFilter))
        .subscribe();
}

function getLbRange(filter) {
    const now=new Date();
    if (filter==='week') {
        const start=new Date(now);
        start.setDate(now.getDate()-(now.getDay()===0?6:now.getDay()-1));
        start.setHours(0,0,0,0);
        return {start,end:null};
    }
    if (filter==='month') {
        return {start:new Date(now.getFullYear(),now.getMonth(),1),end:null};
    }
    if (filter==='lastmonth') {
        return {
            start:new Date(now.getFullYear(),now.getMonth()-1,1),
            end:new Date(now.getFullYear(),now.getMonth(),1)
        };
    }
    return {start:null,end:null};
}

function aggregateLeaderboard(users,drinks) {
    const byUser={};
    users.forEach(u=>{
        byUser[u.id]={grams:0,liters:{beer:0,wine:0,spirits:0},days:{}};
    });

    drinks.forEach(d=>{
        const row=byUser[d.user_id];
        if (!row) return;
        const g=Number(d.grams)||0;
        const liters=((Number(d.vol_ml)||0)*(Number(d.qty)||1))/1000;
        const category=drinkCategory(d);

        row.grams+=g;
        if (row.liters[category]!==undefined) row.liters[category]+=liters;

        const k=dayKey(d.ts);
        row.days[k]=(row.days[k]||0)+g;
    });

    return users.map(u=>{
        const stats=byUser[u.id]||{grams:0,liters:{beer:0,wine:0,spirits:0},days:{}};
        return {...u,rawGrams:stats.grams,grams:Math.round(stats.grams),liters:stats.liters,days:stats.days};
    }).sort((a,b)=>b.rawGrams-a.rawGrams);
}

function hideLbCharts() {
    document.getElementById('lb-chart-card').style.display='none';
    document.getElementById('lb-time-card').style.display='none';
    if (chLB){chLB.destroy();chLB=null;}
    if (chLBTime){chLBTime.destroy();chLBTime=null;}
}

async function fetchAndRenderLb(filter) {
    const {start,end}=getLbRange(filter);
    let drinkQuery=sb.from('pl_drinks').select('user_id,event_id,type_name,vol_ml,abv,qty,grams,ts');
    if (start) drinkQuery=drinkQuery.gte('ts',start.toISOString());
    if (end) drinkQuery=drinkQuery.lt('ts',end.toISOString());

    const {data:allDrinksRaw} = await drinkQuery;
    const {data:usersRaw}     = await sb.from('pl_users').select('*');
    if (!allDrinksRaw||!usersRaw) return;

    const users=await fetchUsersForCurrentScope(usersRaw||[]);
    const drinks=visibleDrinksForScope(allDrinksRaw||[]);
    const ranked=aggregateLeaderboard(users,drinks);
    const el=document.getElementById('lb-list');

    if (ranked.every(u=>u.rawGrams===0)){
        el.innerHTML='<div class="empty">Ingen drikke i denne perioden.</div>';
        document.getElementById('lb-count-note').textContent='';
        hideLbCharts();
        return;
    }

    const visible=ranked.slice(0,lbLimit);
    renderLbList(ranked,visible);
    renderLbBarChart(visible);
    renderLbTimeline(visible,drinks,filter);
}

function renderLbList(ranked,visible) {
    const maxG=ranked[0]?.rawGrams||1;
    const medals=['🥇','🥈','🥉'];
    const el=document.getElementById('lb-list');
    document.getElementById('lb-count-note').textContent=`Viser ${visible.length} av ${ranked.length} brukere`;

    el.innerHTML=visible.map((u,i)=>{
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
                <div class="bar-wrap"><div class="bar" style="width:${maxG>0?Math.round(u.rawGrams/maxG*100):0}%;background:${color}"></div></div>
            </div>
        </div>`;
    }).join('');
}

function renderLbBarChart(visible) {
    const card=document.getElementById('lb-chart-card');
    if (visible.some(u=>u.rawGrams>0)){
        card.style.display='block';
        if (chLB) chLB.destroy();
        chLB=new Chart(document.getElementById('ch-lb').getContext('2d'),{
            type:'bar',
            data:{labels:visible.map(displayName),datasets:[{data:visible.map(u=>chartValue(u.rawGrams)),backgroundColor:visible.map(u=>(u.color||USER_COLORS[0])+'cc'),borderColor:visible.map(u=>u.color||USER_COLORS[0]),borderWidth:1,borderRadius:4}]},
            options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>formatChartValue(c.parsed.y)}}},scales:{x:{ticks:{color:'#8b949e'},grid:{color:'#30363d'}},y:{ticks:{color:'#8b949e'},grid:{color:'#30363d'},beginAtZero:true}}}
        });
    } else {
        card.style.display='none';
        if (chLB){chLB.destroy();chLB=null;}
    }
}

function timelineKeys(drinks,filter) {
    const used=[...new Set(drinks.map(d=>dayKey(d.ts)))].sort();
    if (!used.length) return [];

    const {start,end}=getLbRange(filter);
    if (!start) return used;

    const cursor=new Date(start);
    cursor.setHours(0,0,0,0);
    const stop=end?new Date(end):new Date();
    stop.setHours(0,0,0,0);
    if (end) stop.setDate(stop.getDate()-1);

    const keys=[];
    for (const d=new Date(cursor); d<=stop; d.setDate(d.getDate()+1)) keys.push(dayKey(d));
    return keys;
}

function renderLbTimeline(visible,drinks,filter) {
    const card=document.getElementById('lb-time-card');
    const users=visible.filter(u=>u.rawGrams>0);
    const keys=timelineKeys(drinks,filter);
    if (!users.length || !keys.length) {
        card.style.display='none';
        if (chLBTime){chLBTime.destroy();chLBTime=null;}
        return;
    }

    card.style.display='block';
    if (chLBTime) chLBTime.destroy();
    chLBTime=new Chart(document.getElementById('ch-lb-time').getContext('2d'),{
        type:'line',
        data:{
            labels:keys.map(dayLabel),
            datasets:users.map(u=>{
                let running=0;
                const color=u.color||USER_COLORS[0];
                return {
                    label:displayName(u),
                    data:keys.map(k=>{
                        running+=u.days[k]||0;
                        const v=lbTimelineMode==='cumulative'?running:(u.days[k]||0);
                        return chartValue(v);
                    }),
                    borderColor:color,
                    backgroundColor:color+'22',
                    borderWidth:2,
                    tension:.25,
                    pointRadius:keys.length>45?0:2,
                    pointHoverRadius:4,
                    fill:false
                };
            })
        },
        options:{
            responsive:true,
            maintainAspectRatio:false,
            interaction:{mode:'index',intersect:false},
            plugins:{
                legend:{display:users.length<=8,labels:{color:'#8b949e',boxWidth:10,boxHeight:10}},
                tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${formatChartValue(c.parsed.y)}`}}
            },
            scales:{
                x:{ticks:{color:'#8b949e',maxRotation:0,autoSkip:true},grid:{color:'#30363d'}},
                y:{ticks:{color:'#8b949e'},grid:{color:'#30363d'},beginAtZero:true}
            }
        }
    });
}
