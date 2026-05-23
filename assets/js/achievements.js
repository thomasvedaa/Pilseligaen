/* ════════════════════════════════════════════
   ACHIEVEMENTS
════════════════════════════════════════════ */
let achChannel=null;
let achProfileUserId=null;

const ACHIEVEMENTS = [
    {id:'first', icon:'🥂', name:'Første skål', desc:'Registrerte sin første drink.', check:s=>s.totalDrinks>=1, progress:s=>`${Math.min(s.totalDrinks,1)}/1`},
    {id:'first_comment', icon:'💬', name:'Si hei!', desc:'Legg igjen en kommentar.', check:s=>s.hasCommented, progress:s=>s.hasCommented?'Klar':'0/1'},
    {id:'units10', icon:'🥉', name:'Fersk', desc:'10 alkoholenheter totalt.', check:s=>s.totalUnits>=10, progress:s=>`${fmtAchievementUnits(Math.min(s.totalUnits,10))}/10 enheter`},
    {id:'units100', icon:'🥈', name:'Godt i gang', desc:'100 alkoholenheter totalt.', check:s=>s.totalUnits>=100, progress:s=>`${fmtAchievementUnits(Math.min(s.totalUnits,100))}/100 enheter`},
    {id:'units1000', icon:'🥇', name:'Veteran', desc:'1000 alkoholenheter totalt.', check:s=>s.totalUnits>=1000, progress:s=>`${fmtAchievementUnits(Math.min(s.totalUnits,1000))}/1000 enheter`},
    {id:'units5000', icon:'💀', name:'Legenden', desc:'5000 alkoholenheter totalt.', check:s=>s.totalUnits>=5000, progress:s=>`${fmtAchievementUnits(Math.min(s.totalUnits,5000))}/5000 enheter`},
    {id:'streak10', icon:'🔥', name:'3 dager streak', desc:'Drakk 3 dager på rad.', check:s=>s.bestStreak>=10, progress:s=>`${Math.min(s.bestStreak,10)}/3 dager`},
    {id:'streak100', icon:'🔥', name:'10 dager streak', desc:'Drakk 10 dager på rad.', check:s=>s.bestStreak>=100, progress:s=>`${Math.min(s.bestStreak,100)}/10 dager`},
    {id:'twelve_half', icon:'🍺', name:'Yummers', desc:'Minst 12 halvlitere øl i samme kveld.', check:s=>s.maxEveningHalfLiters>=12, progress:s=>`${fmtNo(Math.min(s.maxEveningHalfLiters,12),1)}/12`},
    {id:'chilli_klaus', icon:'🌶️', name:'Chili Klaus', desc:'Tatt deg en shot med guds gave', check:s=>s.hasChilli, progress:s=>s.hasChilli?'Klar':'0/1'},
    {id:'morningbird', icon:'🌅', name:'Six seven', desc:'Registrerte en drink mellom 06 og 07.', check:s=>s.hasMorning, progress:s=>s.hasMorning?'Klar':'0/1'},
    {id:'weekend', icon:'🌙', name:'Helgekriger', desc:'Drakk torsdag, fredag og lørdag i samme helg.', check:s=>s.hasWeekendRun, progress:s=>s.hasWeekendRun?'Klar':'0/1'},
    {id:'variety', icon:'🎨', name:'Variert meny', desc:'Øl, vin og sprit på samme dag.', check:s=>s.hasAllCategoriesDay, progress:s=>s.hasAllCategoriesDay?'Klar':'0/1'},
    {id:'nightowl', icon:'🦉', name:'Nattugle', desc:'Registrerte en drink mellom 02 og 06.', check:s=>s.hasLateNight, progress:s=>s.hasLateNight?'Klar':'0/1'},
    {id:'regular', icon:'📅', name:'Fast inventar', desc:'30 forskjellige drikkedager.', check:s=>s.drinkDays>=30, progress:s=>`${Math.min(s.drinkDays,30)}/30 dager`},
    {id:'month10', icon:'🗓️', name:'Månedens stamkunde', desc:'10 drikkedager i samme måned.', check:s=>s.maxMonthDays>=10, progress:s=>`${Math.min(s.maxMonthDays,10)}/10 dager`},
    {id:'beer50', icon:'🍻', name:'50 liter øl', desc:'Totalt 50 liter øl registrert.', check:s=>s.liters.beer>=50, progress:s=>`${fmtLiters(Math.min(s.liters.beer,50))}/50 L`},
    {id:'month_beer50', icon:'🍺', name:'Alkoholiker', desc:'50 liter øl i samme måned.', check:s=>s.maxMonthBeerLiters>=50, progress:s=>`${fmtLiters(Math.min(s.maxMonthBeerLiters,50))}/50 L`},
    {id:'month_beer100', icon:'🚨', name:'Du har et problem', desc:'100 liter øl i samme måned.', check:s=>s.maxMonthBeerLiters>=100, progress:s=>`${fmtLiters(Math.min(s.maxMonthBeerLiters,100))}/100 L`},
    {id:'wine10', icon:'🍷', name:'Somalier', desc:'Totalt 10 liter vin registrert.', check:s=>s.liters.wine>=10, progress:s=>`${fmtLiters(Math.min(s.liters.wine,10))}/10 L`},
    {id:'wine50', icon:'🍷', name:'Sommelier', desc:'Totalt 50 liter vin registrert.', check:s=>s.liters.wine>=50, progress:s=>`${fmtLiters(Math.min(s.liters.wine,50))}/50 L`},
    {id:'spirits1', icon:'🥃', name:'Vodka-visum', desc:'Totalt 1 liter sprit registrert.', check:s=>s.liters.spirits>=1, progress:s=>`${fmtLiters(Math.min(s.liters.spirits,1))}/1 L`},
    {id:'spirits10', icon:'🥃', name:'Indre fred', desc:'Totalt 10 liter sprit registrert.', check:s=>s.liters.spirits>=10, progress:s=>`${fmtLiters(Math.min(s.liters.spirits,10))}/10 L`},
    {id:'split_the_g', icon:'🍀', name:'Split the G', desc:'Drakk din første Guinness.', check:s=>s.guinnessCount>=1, progress:s=>`${Math.min(s.guinnessCount,1)}/1`},
    {id:'g_spot', icon:'🎯', name:'Finding the G spot?', desc:'100 Guinness drukket.', check:s=>s.guinnessCount>=100, progress:s=>`${Math.min(s.guinnessCount,100)}/100`},
    {id:'tur_konge', icon:'👑', name:'Tur konge', desc:'Drakk mest på en gruppetur da turen ble avsluttet.', check:s=>s.turKongeWins>=1, progress:s=>s.turKongeWins>=1?`${s.turKongeWins} turer`:'0/1'},
    {id:'edru_sjafor', icon:'🚗', name:'Edru sjåfør', desc:'Drakk minst på en avsluttet tur med 3+ deltakere.', check:s=>s.edruSjaforWins>=1, progress:s=>s.edruSjaforWins>=1?`${s.edruSjaforWins} turer`:'0/1'},
    {id:'legendary_pull', icon:'⚡', name:'Legendary pull', desc:'Drakk en energiøl. Reinheitsgebot RIP.', check:s=>s.hasEnergyBeer, progress:s=>s.hasEnergyBeer?'Klar':'0/1'},

];

function achievementById(id) {
    return ACHIEVEMENTS.find(a=>a.id===id);
}

function fmtAchievementUnits(value) {
    return fmtNo(value, value>=100?0:1);
}

function keyToDate(key) {
    const [y,m,d]=key.split('-').map(Number);
    return new Date(y,m-1,d);
}

function addDaysToKey(key,days) {
    const d=keyToDate(key);
    d.setDate(d.getDate()+days);
    return dayKey(d);
}

function dayDiff(fromKey,toKey) {
    return Math.round((keyToDate(toKey)-keyToDate(fromKey))/86400000);
}

function eveningKey(iso) {
    const d=new Date(iso);
    if (d.getHours()<6) d.setDate(d.getDate()-1);
    return dayKey(d);
}

function monthKey(key) {
    return key.slice(0,7);
}

function weekendKeyForDrink(iso) {
    const d=new Date(iso);
    const day=d.getDay();
    if (![4,5,6].includes(day)) return null;
    if (day===5) d.setDate(d.getDate()-1);
    if (day===6) d.setDate(d.getDate()-2);
    return dayKey(d);
}

function streakStats(days) {
    const sorted=[...new Set(days)].sort();
    if (!sorted.length) return {current:0,best:0,active:false,last:null};

    let best=1;
    let run=1;
    for (let i=1;i<sorted.length;i++) {
        run=dayDiff(sorted[i-1],sorted[i])===1 ? run+1 : 1;
        best=Math.max(best,run);
    }

    const today=dayKey(new Date());
    const last=sorted[sorted.length-1];
    const active=dayDiff(last,today)<=1;
    let current=active?1:0;
    if (active) {
        for (let i=sorted.length-2;i>=0;i--) {
            if (dayDiff(sorted[i],sorted[i+1])!==1) break;
            current++;
        }
    }
    return {current,best,active,last};
}

function summarizeAchievements(user,drinks,extra={}) {
    const hasCommented=!!extra.hasCommented;
    const sorted=[...drinks].sort((a,b)=>new Date(a.ts)-new Date(b.ts));
    const totalGrams=sorted.reduce((sum,d)=>sum+(Number(d.grams)||0),0);
    const totalUnits=totalGrams/ALCOHOL_UNIT_GRAMS;
    const days=[...new Set(sorted.map(d=>dayKey(d.ts)))].sort();
    const streak=streakStats(days);
    const weekendStreak=weekendStreakStats(sorted);
    const liters={beer:0,wine:0,spirits:0};
    const dayCategories={};
    const eveningHalfLiters={};
    const weekendMap={};
    const monthDays={};
    const monthBeerLiters={};
    let hasChilli=false;
    let hasMorning=false;
    let hasLateNight=false;
    let hasComeback=false;
    let guinnessCount=0;
    let hasEnergyBeer=false;

    sorted.forEach((d,i)=>{
        const k=dayKey(d.ts);
        const category=drinkCategory(d);
        const vol=((Number(d.vol_ml)||0)*(Number(d.qty)||1))/1000;
        if (liters[category]!==undefined) liters[category]+=vol;
        (dayCategories[k] ||= new Set()).add(category);
        monthDays[monthKey(k)]=(monthDays[monthKey(k)]||new Set()).add(k);

        if (category==='beer') {
            eveningHalfLiters[eveningKey(d.ts)]=(eveningHalfLiters[eveningKey(d.ts)]||0)+(vol*1000/500);
            monthBeerLiters[monthKey(k)]=(monthBeerLiters[monthKey(k)]||0)+vol;
        }

        const txt=`${d.type_name||''} ${d.note||''}`.toLowerCase();
        if (/(chilli|chili|klaus)/.test(txt)) hasChilli=true;
        if (/guinness/.test(txt)) guinnessCount+=Number(d.qty)||1;
        if (/energi[øo]l/.test(txt)) hasEnergyBeer=true;

        const hour=new Date(d.ts).getHours();
        if (hour>=6 && hour<7) hasMorning=true;
        if (hour>=2 && hour<6) hasLateNight=true;

        const wk=weekendKeyForDrink(d.ts);
        if (wk) {
            const day=new Date(d.ts).getDay();
            (weekendMap[wk] ||= new Set()).add(day);
        }

        if (i>0) {
            const prev=dayKey(sorted[i-1].ts);
            if (dayDiff(prev,k)>=14) hasComeback=true;
        }
    });

    const maxEveningHalfLiters=Math.max(0,...Object.values(eveningHalfLiters));
    const hasAllCategoriesDay=Object.values(dayCategories).some(set=>set.has('beer') && set.has('wine') && set.has('spirits'));
    const hasWeekendRun=Object.values(weekendMap).some(set=>set.has(4) && set.has(5) && set.has(6));
    const maxMonthDays=Math.max(0,...Object.values(monthDays).map(set=>set.size));
    const maxMonthBeerLiters=Math.max(0,...Object.values(monthBeerLiters));
    const unlocked=ACHIEVEMENTS.filter(a=>a.check({
        user,
        totalDrinks:sorted.length,
        totalGrams,
        totalUnits,
        drinkDays:days.length,
        currentStreak:streak.current,
        bestStreak:streak.best,
        currentWeekendStreak:weekendStreak.current,
        bestWeekendStreak:weekendStreak.best,
        liters,
        maxEveningHalfLiters,
        hasChilli,
        hasMorning,
        hasLateNight,
        hasComeback,
        hasWeekendRun,
        hasAllCategoriesDay,
        maxMonthDays,
        maxMonthBeerLiters,
        guinnessCount,
        hasEnergyBeer,
        hasCommented,
        turKongeWins:extra.turKongeWins||0,
        edruSjaforWins:extra.edruSjaforWins||0
    }));

    return {
        user,
        drinks:sorted,
        totalDrinks:sorted.length,
        totalGrams,
        totalUnits,
        drinkDays:days.length,
        currentStreak:streak.current,
        bestStreak:streak.best,
        streakActive:streak.active && streak.current>0,
        currentWeekendStreak:weekendStreak.current,
        bestWeekendStreak:weekendStreak.best,
        weekendStreakActive:weekendStreak.active && weekendStreak.current>0,
        lastDay:streak.last,
        lastWeekend:weekendStreak.last,
        liters,
        maxEveningHalfLiters,
        hasChilli,
        hasMorning,
        hasLateNight,
        hasComeback,
        hasWeekendRun,
        hasAllCategoriesDay,
        maxMonthDays,
        maxMonthBeerLiters,
        guinnessCount,
        hasEnergyBeer,
        hasCommented,
        turKongeWins:extra.turKongeWins||0,
        edruSjaforWins:extra.edruSjaforWins||0,
        unlockedCount:unlocked.length
    };
}

function achievementUnlockEvents(user,drinks,comments=[]) {
    const sorted=[...drinks].sort((a,b)=>new Date(a.ts)-new Date(b.ts));
    const userComments=(comments||[])
        .filter(c=>c.user_id===user.id)
        .sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));

    const events=[];
    const unlocked=new Set();
    const days=new Set();
    const monthDays={};
    const dayCategories={};
    const eveningHalfLiters={};
    const weekendMap={};
    const monthBeerLiters={};
    const liters={beer:0,wine:0,spirits:0};
    let totalGrams=0;
    let lastDay=null;
    let dayRun=0;
    let guinnessCount=0;

    const unlock=(id,item)=>{
        if (unlocked.has(id)) return;
        const achievement=achievementById(id);
        if (!achievement) return;
        unlocked.add(id);
        events.push({
            id:`ach:${user.id}:${id}`,
            kind:'achievement',
            user_id:user.id,
            user,
            achievement,
            event_id:item.event_id||'',
            ts:item.created_at||item.ts,
            drink_ts:item.ts||item.created_at
        });
    };

    if (userComments.length) {
        unlock('first_comment',userComments[0]);
    }

    sorted.forEach((d,i)=>{
        const k=dayKey(d.ts);
        const m=monthKey(k);
        const category=drinkCategory(d);
        const vol=((Number(d.vol_ml)||0)*(Number(d.qty)||1))/1000;
        totalGrams+=Number(d.grams)||0;
        const totalUnits=totalGrams/ALCOHOL_UNIT_GRAMS;

        if (i===0) unlock('first',d);
        if (totalUnits>=10) unlock('units10',d);
        if (totalUnits>=100) unlock('units100',d);
        if (totalUnits>=1000) unlock('units1000',d);
        if (totalUnits>=5000) unlock('units5000',d);

        if (!days.has(k)) {
            days.add(k);
            dayRun=lastDay && dayDiff(lastDay,k)===1 ? dayRun+1 : 1;
            lastDay=k;
            (monthDays[m] ||= new Set()).add(k);

            if (dayRun>=10) unlock('streak10',d);
            if (dayRun>=100) unlock('streak100',d);
            if (days.size>=30) unlock('regular',d);
            if (monthDays[m].size>=10) unlock('month10',d);
        }

        if (liters[category]!==undefined) liters[category]+=vol;
        if (category==='beer') {
            eveningHalfLiters[eveningKey(d.ts)]=(eveningHalfLiters[eveningKey(d.ts)]||0)+(vol*1000/500);
            monthBeerLiters[m]=(monthBeerLiters[m]||0)+vol;
            if (eveningHalfLiters[eveningKey(d.ts)]>=12) unlock('twelve_half',d);
            if (liters.beer>=50) unlock('beer50',d);
            if (monthBeerLiters[m]>=50) unlock('month_beer50',d);
            if (monthBeerLiters[m]>=100) unlock('month_beer100',d);
        }
        if (category==='wine' && liters.wine>=10) unlock('wine10',d);
        if (category==='spirits' && liters.spirits>=1) unlock('spirits1',d);

        (dayCategories[k] ||= new Set()).add(category);
        if (dayCategories[k].has('beer') && dayCategories[k].has('wine') && dayCategories[k].has('spirits')) unlock('variety',d);

        const txt=`${d.type_name||''} ${d.note||''}`.toLowerCase();
        if (/(chilli|chili|klaus)/.test(txt)) unlock('chilli_klaus',d);
        if (/guinness/.test(txt)) {
            guinnessCount+=Number(d.qty)||1;
            if (guinnessCount>=1) unlock('split_the_g',d);
            if (guinnessCount>=100) unlock('g_spot',d);
        }
        if (/energi[øo]l/.test(txt)) unlock('legendary_pull',d);

        const hour=new Date(d.ts).getHours();
        if (hour>=6 && hour<7) unlock('morningbird',d);
        if (hour>=2 && hour<6) unlock('nightowl',d);

        const wk=weekendKeyForDrink(d.ts);
        if (wk) {
            const day=new Date(d.ts).getDay();
            (weekendMap[wk] ||= new Set()).add(day);
            if (weekendMap[wk].has(4) && weekendMap[wk].has(5) && weekendMap[wk].has(6)) unlock('weekend',d);
        }

        if (i>0) {
            const prev=dayKey(sorted[i-1].ts);
            if (dayDiff(prev,k)>=14) unlock('comeback',d);
        }
    });

    return events;
}

function computeTripWinnersPerEvent(endedEvents,members,drinks) {
    const result=[];
    if (!endedEvents.length) return result;
    const membersByEvent={};
    members.forEach(m=>{(membersByEvent[m.event_id] ||= new Set()).add(m.user_id);});
    endedEvents.forEach(ev=>{
        const memberSet=membersByEvent[ev.id]||new Set();
        if (memberSet.size<2) return;
        const endedAt=new Date(ev.ended_at);
        const gramsBy={};
        drinks.forEach(d=>{
            if (d.event_id!==ev.id) return;
            if (new Date(d.ts)>endedAt) return;
            if (!memberSet.has(d.user_id)) return;
            gramsBy[d.user_id]=(gramsBy[d.user_id]||0)+(Number(d.grams)||0);
        });
        const entries=Object.entries(gramsBy).filter(([,g])=>g>0);
        if (!entries.length) return;
        const max=Math.max(...entries.map(([,g])=>g));
        const turKonge=entries.filter(([,g])=>g===max).map(([uid])=>uid);
        let edruSjafor=[];
        if (memberSet.size>=3 && entries.length>=2) {
            const min=Math.min(...entries.map(([,g])=>g));
            if (min<max) edruSjafor=entries.filter(([,g])=>g===min).map(([uid])=>uid);
        }
        result.push({event:ev,turKonge,edruSjafor});
    });
    return result;
}

function achievementFeedEvents(users,drinks,endedEvents=[],members=[],comments=[]) {
    const drinksByUser={};
    (drinks||[]).forEach(d=>{(drinksByUser[d.user_id] ||= []).push(d);});
    const userById={};
    (users||[]).forEach(u=>{userById[u.id]=u;});

    const drinkBased=(users||[]).flatMap(u=>achievementUnlockEvents(u,drinksByUser[u.id]||[],comments||[]));

    const tripBased=[];
    computeTripWinnersPerEvent(endedEvents,members,drinks||[]).forEach(({event,turKonge,edruSjafor})=>{
        turKonge.forEach(uid=>{
            const user=userById[uid];
            if (!user) return;
            tripBased.push({id:`ach:${uid}:tur_konge:${event.id}`,kind:'achievement',user_id:uid,user,achievement:achievementById('tur_konge'),event_id:event.id,ts:event.ended_at,drink_ts:event.ended_at});
        });
        edruSjafor.forEach(uid=>{
            const user=userById[uid];
            if (!user) return;
            tripBased.push({id:`ach:${uid}:edru_sjafor:${event.id}`,kind:'achievement',user_id:uid,user,achievement:achievementById('edru_sjafor'),event_id:event.id,ts:event.ended_at,drink_ts:event.ended_at});
        });
    });

    return [...drinkBased,...tripBased];
}

function achievementUnlockStats(summaries) {
    const total=summaries.length;
    const stats={};
    ACHIEVEMENTS.forEach(a=>{
        const count=summaries.filter(s=>a.check(s)).length;
        stats[a.id]={count,total,percent:total?Math.round(count/total*100):0};
    });
    return stats;
}

async function loadAchievementData() {
    const [
        {data:users,error:userError},
        {data:drinks,error:drinkError},
        commentsRes,
        endedEventsRes,
        membersRes
    ]=await Promise.all([
        sb.from('pl_users').select(PROFILE_SELECT),
        sb.from('pl_drinks').select('*'),
        sb.from('pl_drink_comments').select('user_id'),
        sb.from('pl_events').select('*').not('ended_at','is',null),
        sb.from('pl_event_members').select('event_id,user_id')
    ]);
    if (userError || drinkError) return {error:userError||drinkError};

    const commenters=new Set((commentsRes?.data||[]).map(c=>c.user_id));
    const tripStandings=computeTripStandings(endedEventsRes?.data||[],membersRes?.data||[],drinks||[]);

    const scopeUsers=users||[];
    const scopeDrinks=drinks||[];
    const drinksByUser={};
    scopeDrinks.forEach(d=>{(drinksByUser[d.user_id] ||= []).push(d);});
    const summaries=scopeUsers
        .map(u=>summarizeAchievements(u,drinksByUser[u.id]||[],{
            hasCommented:commenters.has(u.id),
            turKongeWins:tripStandings.turKonge[u.id]||0,
            edruSjaforWins:tripStandings.edruSjafor[u.id]||0
        }))
        .sort((a,b)=>b.unlockedCount-a.unlockedCount || b.bestStreak-a.bestStreak || displayName(a.user).localeCompare(displayName(b.user),'no'));

    return {users:scopeUsers,drinks:scopeDrinks,summaries,unlockStats:achievementUnlockStats(summaries)};
}

function computeTripStandings(endedEvents,members,drinks) {
    const turKonge={};
    const edruSjafor={};
    if (!endedEvents.length) return {turKonge,edruSjafor};
    const membersByEvent={};
    members.forEach(m=>{(membersByEvent[m.event_id] ||= new Set()).add(m.user_id);});
    endedEvents.forEach(ev=>{
        const memberSet=membersByEvent[ev.id]||new Set();
        if (memberSet.size<2) return;
        const endedAt=new Date(ev.ended_at);
        const gramsBy={};
        drinks.forEach(d=>{
            if (d.event_id!==ev.id) return;
            if (new Date(d.ts)>endedAt) return;
            if (!memberSet.has(d.user_id)) return;
            gramsBy[d.user_id]=(gramsBy[d.user_id]||0)+(Number(d.grams)||0);
        });
        const entries=Object.entries(gramsBy).filter(([,g])=>g>0);
        if (!entries.length) return;
        const max=Math.max(...entries.map(([,g])=>g));
        entries.filter(([,g])=>g===max).forEach(([uid])=>{
            turKonge[uid]=(turKonge[uid]||0)+1;
        });
        if (memberSet.size>=3 && entries.length>=2) {
            const min=Math.min(...entries.map(([,g])=>g));
            if (min<max) {
                entries.filter(([,g])=>g===min).forEach(([uid])=>{
                    edruSjafor[uid]=(edruSjafor[uid]||0)+1;
                });
            }
        }
    });
    return {turKonge,edruSjafor};
}

function renderStreakBadge(summary) {
    if (summary.streakActive) {
        return `<div class="streak-badge live"><span>🔥</span><strong>${summary.currentStreak}</strong> ${summary.currentStreak===1?'dag':'dager'}</div>`;
    }
    return `<div class="streak-badge dead"><strong>0</strong> aktiv streak</div>`;
}

function renderAchievementBadge(achievement,summary,unlockStats={}) {
    const unlocked=achievement.check(summary);
    const stat=unlockStats[achievement.id]||{count:0,total:0,percent:0};
    return `<div class="ach-badge${unlocked?' unlocked':' locked'}">
        <div class="ach-icon">${achievement.icon}</div>
        <div class="ach-copy">
            <div class="ach-name">${esc(achievement.name)}</div>
            <div class="ach-desc">${esc(achievement.desc)}</div>
            <div class="ach-progress">${unlocked?'Opplåst':esc(achievement.progress(summary))}</div>
            <div class="ach-share">
                <div class="ach-share-bar"><span style="width:${stat.percent}%"></span></div>
                <span>${stat.percent}% (${stat.count}/${stat.total})</span>
            </div>
        </div>
    </div>`;
}

function renderAchievementUser(summary,unlockStats={},options={}) {
    const user=summary.user;
    const name=displayName(user);
    const isMe=user.id===CU.id;
    const title=options.title||'';
    const bestWeekend=summary.bestWeekendStreak||0;
    const currentWeekend=summary.weekendStreakActive?summary.currentWeekendStreak:0;
    return `<div class="ach-user-card${isMe?' me':''}">
        ${title?`<div class="st" style="margin-bottom:14px">${esc(title)}</div>`:''}
        <div class="ach-user-head">
            ${avatarHtml(user,42,'.9em')}
            <div class="ach-user-main">
                <div class="ach-user-name">${esc(name)}${isMe?'<span class="metag">(deg)</span>':''}</div>
                <div class="ach-user-meta">Helgestreak ${currentWeekend} aktiv · beste ${bestWeekend} ${bestWeekend===1?'helg':'helger'}</div>
                <div class="ach-user-meta">${summary.unlockedCount}/${ACHIEVEMENTS.length} merker · beste streak ${summary.bestStreak} ${summary.bestStreak===1?'dag':'dager'} · ${summary.drinkDays} drikkedager</div>
            </div>
            ${renderStreakBadge(summary)}
        </div>
        <div class="ach-stat-row">
            <span>Øl <strong>${fmtLiters(summary.liters.beer)}</strong></span>
            <span>Vin <strong>${fmtLiters(summary.liters.wine)}</strong></span>
            <span>Sprit <strong>${fmtLiters(summary.liters.spirits)}</strong></span>
            <span>Helgestreak <strong>${currentWeekend}</strong> / ${bestWeekend}</span>
        </div>
        <div class="ach-grid">
            ${ACHIEVEMENTS.map(a=>renderAchievementBadge(a,summary,unlockStats)).join('')}
        </div>
    </div>`;
}

function renderProfileList(summaries) {
    return `<div class="card">
        <div class="st" style="margin-bottom:12px">Profiler</div>
        <div class="profile-list">
            ${summaries.map(s=>`<button class="profile-row" onclick="openAchievementProfile('${s.user.id}')">
                ${avatarHtml(s.user,34,'.82em')}
                <span class="profile-main">
                    <strong>${esc(displayName(s.user))}${s.user.id===CU.id?' <span class="metag">(deg)</span>':''}</strong>
                    <small>${s.unlockedCount}/${ACHIEVEMENTS.length} merker · beste streak ${s.bestStreak} ${s.bestStreak===1?'dag':'dager'}</small>
                </span>
                <span class="profile-arrow">›</span>
            </button>`).join('')}
        </div>
    </div>`;
}

function achievementsNavButton() {
    return Array.from(document.querySelectorAll('.nav-item')).find(b=>(b.getAttribute('onclick')||'').includes("'achievements'"))||null;
}

function backToAchievements() {
    showView('achievements',achievementsNavButton());
}

function refreshActiveAchievementView() {
    const view=activeViewName();
    if (view==='achievements') renderAchievements();
    if (view==='profile') renderAchievementProfile(achProfileUserId);
}

async function renderAchievements() {
    const el=document.getElementById('ach-list');
    if (!el) return;
    el.innerHTML='<div class="vload"><div class="spinner"></div>Laster…</div>';

    if (!achChannel) {
        achChannel=sb.channel('achievements-realtime')
            .on('postgres_changes',{event:'*',schema:'public',table:'pl_drinks'},()=>refreshActiveAchievementView())
            .on('postgres_changes',{event:'*',schema:'public',table:'pl_drink_comments'},()=>refreshActiveAchievementView())
            .on('postgres_changes',{event:'*',schema:'public',table:'pl_users'},()=>refreshActiveAchievementView())
            .on('postgres_changes',{event:'*',schema:'public',table:'pl_events'},()=>refreshActiveAchievementView())
            .subscribe();
    }

    const data=await loadAchievementData();
    if (data.error) {
        el.innerHTML=`<div class="empty">Kunne ikke laste merker.</div>`;
        return;
    }

    const summaries=data.summaries;
    const mine=summaries.find(s=>s.user.id===CU.id);

    if (!mine) {
        el.innerHTML='<div class="empty">Ingen brukere ennå.</div>';
        return;
    }

    el.innerHTML=`
        ${renderAchievementUser(mine,data.unlockStats,{title:'Mine merker'})}
        ${renderProfileList(summaries)}
    `;
}

async function openAchievementProfile(userId) {
    achProfileUserId=userId;
    showView('profile');
    await renderAchievementProfile(userId);
}

async function renderAchievementProfile(userId=achProfileUserId) {
    const el=document.getElementById('profile-detail');
    if (!el || !userId) return;
    el.innerHTML='<div class="vload"><div class="spinner"></div>Laster…</div>';

    const data=await loadAchievementData();
    if (data.error) {
        el.innerHTML='<div class="empty">Kunne ikke laste profil.</div>';
        return;
    }

    const summary=data.summaries.find(s=>s.user.id===userId);
    if (!summary) {
        el.innerHTML='<div class="empty">Fant ikke profilen.</div>';
        return;
    }

    el.innerHTML=`
        <div class="sh" style="margin-bottom:16px">
            <button class="icon-btn" onclick="backToAchievements()">Tilbake</button>
            <span class="live-badge"><span class="live-dot"></span>Live</span>
        </div>
        <div class="stat-grid">
            <div class="card"><div class="ct">Totalt</div><div class="cv">${formatAlcoholValue(summary.drinks.reduce((s,d)=>s+(Number(d.grams)||0),0))}</div><div class="cs">${alcoholSubLabel()}</div></div>
            <div class="card"><div class="ct">Drikkedager</div><div class="cv">${summary.drinkDays}</div><div class="cs">registrerte dager</div></div>
            <div class="card"><div class="ct">Beste streak</div><div class="cv">${summary.bestStreak}</div><div class="cs">${summary.bestStreak===1?'dag':'dager'}</div></div>
            <div class="card"><div class="ct">Helgestreak</div><div class="cv">${summary.weekendStreakActive?summary.currentWeekendStreak:0}</div><div class="cs">beste ${summary.bestWeekendStreak||0} ${(summary.bestWeekendStreak||0)===1?'helg':'helger'}</div></div>
            <div class="card"><div class="ct">Merker</div><div class="cv">${summary.unlockedCount}</div><div class="cs">av ${ACHIEVEMENTS.length}</div></div>
        </div>
        ${renderAchievementUser(summary,data.unlockStats,{title:`${displayName(summary.user)} sine merker`})}
    `;
}
