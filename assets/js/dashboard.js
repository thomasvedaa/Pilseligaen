/* ════════════════════════════════════════════
   DASHBOARD
════════════════════════════════════════════ */
const FEED_REACTIONS = ['🔥','😂','👏','💀','🍺'];
const FEED_PAGE_SIZE = 30;
let feedLimit = FEED_PAGE_SIZE;
let openInteractionDetailsId = null;

function renderBeerGlassHtml(totalGrams, maxGrams, name, sublabel, lastGrams) {
    const rawPct = maxGrams > 0 ? totalGrams / maxGrams : 0;
    const fillPct = Math.min(Math.round(rawPct * 100), 100);
    const overflowing = rawPct > 1;
    const hasBeer = rawPct > 0.02;

    const bubbleDefs = [
        [3, 22, 10, 0.0,  2.4],
        [2, 48, 25, 0.7,  3.0],
        [4, 65, 15, 1.3,  2.2],
        [2, 35, 40, 0.4,  3.4],
        [3, 78, 20, 1.9,  2.7],
        [2, 18, 55, 0.9,  3.1],
        [4, 54, 35, 2.2,  2.0],
        [3, 40,  8, 1.1,  2.8],
        [2, 70, 48, 1.6,  3.3],
        [3, 30, 62, 0.5,  2.5],
        [2, 58, 72, 2.4,  2.9],
        [4, 45, 55, 0.2,  3.6],
    ];
    const bubbles = hasBeer ? bubbleDefs.map(([sz,l,b,delay,dur]) =>
        `<span class="beer-bubble" style="width:${sz}px;height:${sz}px;left:${l}%;bottom:${b}%;animation-delay:${delay}s;animation-duration:${dur}s"></span>`
    ).join('') : '';

    const prevLabel = lastGrams > 0
        ? `<div class="beer-prev-label">Forrige: ${formatAlcohol(lastGrams)}</div>`
        : `<div class="beer-prev-label" style="visibility:hidden">–</div>`;

    return `<div class="beer-glass-item">
        ${prevLabel}
        <div class="beer-glass-outer">
            <div class="beer-glass-body">
                <div class="beer-fill-stack" data-fill="${fillPct}">
                    ${hasBeer ? '<div class="beer-foam-band"></div>' : ''}
                    ${bubbles}
                </div>
            </div>
            <svg class="beer-glass-svg" viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true">
                <path d="M13,1 L87,1 L73,139 L27,139 Z" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="1.5" stroke-linejoin="round"/>
            </svg>
            ${overflowing ? '<div class="beer-drip-left"></div><div class="beer-drip-right"></div>' : ''}
            ${overflowing ? '<div class="beer-puddle"></div>' : ''}
        </div>
        <div class="beer-glass-label">
            <div class="beer-label-total">${formatAlcohol(totalGrams)}</div>
            <div class="beer-label-name">${esc(name)}</div>
            <div class="beer-label-scope">${esc(sublabel)}</div>
        </div>
    </div>`;
}

function animateBeerGlass() {
    document.querySelectorAll('.beer-fill-stack').forEach(stack => {
        const target = Math.min(parseInt(stack.dataset.fill) || 0, 100) + '%';
        stack.style.height = '0%';
        requestAnimationFrame(() => requestAnimationFrame(() => { stack.style.height = target; }));
    });
}

async function renderDashboard() {
    document.getElementById('dash-stats').innerHTML='';
    document.getElementById('recent-drinks').innerHTML='<div class="vload"><div class="spinner"></div>Laster…</div>';
    document.getElementById('drink-feed').innerHTML='<div class="vload"><div class="spinner"></div>Laster…</div>';
    feedLimit=FEED_PAGE_SIZE;
    ensureFeedRealtime();
    renderDrinkFeed();

    const [{data:allDrinks,error},{data:allUsers}] = await Promise.all([
        sb.from('pl_drinks').select('*'),
        sb.from('pl_users').select(PROFILE_SELECT)
    ]);
    if (error){document.getElementById('recent-drinks').innerHTML=`<div class="empty">Feil: ${error.message}</div>`;return;}

    const scopeUsers = await fetchUsersForCurrentScope(allUsers||[]);
    const scopeUserIds = new Set(scopeUsers.map(u=>u.id));
    const myProfile = (allUsers||[]).find(u=>u.id===CU.id) || {username:'Meg'};

    let currentDrinks, lastDrinks, sublabel;
    if (currentEventId || currentSeasonId) {
        currentDrinks = visibleDrinksForScope(allDrinks||[]);
        lastDrinks = [];
        sublabel = scopeLabel();
    } else {
        const scoped = visibleDrinksForScope(allDrinks||[]);
        currentDrinks = scoped;
        lastDrinks = [];
        sublabel = 'Totalt';
    }

    const sumUser = (arr, uid) => arr
        .filter(d=>scopeUserIds.has(d.user_id)&&(uid?d.user_id===uid:true))
        .reduce((s,d)=>s+(Number(d.grams)||0),0);
    const myNow    = sumUser(currentDrinks, CU.id);
    const groupNow = sumUser(currentDrinks, null);
    const monthFloor = 12 * ALCOHOL_UNIT_GRAMS;
    const scopedPeriod = currentEventId || currentSeasonId;
    const myLast   = scopedPeriod ? 100 : Math.max(myNow, monthFloor);
    const groupLast= scopedPeriod ? Math.max(100, scopeUsers.length*100) : Math.max(groupNow, scopeUsers.length * monthFloor);

    const myLastDisplay    = scopedPeriod ? 0 : sumUser(lastDrinks, CU.id);
    const groupLastDisplay = scopedPeriod ? 0 : sumUser(lastDrinks, null);

    document.getElementById('dash-stats').innerHTML = `<div class="beer-glass-pair">
        ${renderBeerGlassHtml(myNow,    myLast,    displayName(myProfile), sublabel, myLastDisplay)}
        ${renderBeerGlassHtml(groupNow, groupLast, 'Gruppen',              sublabel, groupLastDisplay)}
    </div>`;
    animateBeerGlass();

    const myDrinks = visibleDrinksForScope((allDrinks||[]).filter(d=>d.user_id===CU.id));
    const recent = [...myDrinks].sort((a,b)=>new Date(b.ts)-new Date(a.ts)).slice(0,12);
    const el = document.getElementById('recent-drinks');
    if (!recent.length){el.innerHTML='<div class="empty">Ingen drikke registrert ennå.<br>Trykk <strong>➕ Registrer</strong> for å starte!</div>';return;}
    el.innerHTML=recent.map(d=>`
        <div class="di">
            <span class="dico">${drinkIcon(d.abv)}</span>
            <div class="dinf">
                <div class="dn">${esc(d.type_name)}${d.qty!==1?` ×${d.qty}`:''}</div>
                <div class="dm">${fmtDate(d.ts)}${eventMeta(d)}${drinkLocationMeta(d)}${d.note?' · '+esc(d.note):''}</div>
            </div>
            <div class="dr">
                <span class="dg">${formatAlcohol(d.grams)}</span>
                <button class="del del-txt" onclick="deleteDrink('${d.id}')">Slett</button>
            </div>
        </div>`).join('');
}

function ensureFeedRealtime() {
    if (feedChannel) return;
    feedChannel = sb.channel('feed-realtime')
        .on('postgres_changes',{event:'*',schema:'public',table:'pl_drinks'},()=>renderDashboard())
        .on('postgres_changes',{event:'*',schema:'public',table:'pl_users'},()=>renderDashboard())
        .on('postgres_changes',{event:'*',schema:'public',table:'pl_drink_comments'},()=>renderDrinkFeed())
        .on('postgres_changes',{event:'*',schema:'public',table:'pl_drink_reactions'},()=>renderDrinkFeed())
        .on('postgres_changes',{event:'*',schema:'public',table:'pl_achievement_reactions'},()=>renderDrinkFeed())
        .on('postgres_changes',{event:'*',schema:'public',table:'pl_achievement_comments'},()=>renderDrinkFeed())
        .subscribe();
}

async function fetchFeedInteractions(drinkIds,achievementIds=[]) {
    const blank={ready:true,commentsByDrink:{},commentUsersByDrink:{},reactionsByDrink:{},reactionUsersByDrink:{},commentsByAchievement:{},commentUsersByAchievement:{},reactionsByAchievement:{},reactionUsersByAchievement:{},myReactions:{}};
    if (!drinkIds.length && !achievementIds.length) return blank;

    const commentsP=drinkIds.length
        ? sb.from('pl_drink_comments').select('id,drink_id,user_id,body,created_at').in('drink_id',drinkIds).order('created_at',{ascending:true})
        : Promise.resolve({data:[],error:null});
    const drinkReactionsP=drinkIds.length
        ? sb.from('pl_drink_reactions').select('id,drink_id,user_id,emoji').in('drink_id',drinkIds)
        : Promise.resolve({data:[],error:null});
    const achReactionsP=achievementIds.length
        ? sb.from('pl_achievement_reactions').select('id,achievement_id,user_id,emoji').in('achievement_id',achievementIds)
        : Promise.resolve({data:[],error:null});
    const achCommentsP=achievementIds.length
        ? sb.from('pl_achievement_comments').select('id,achievement_id,user_id,body,created_at').in('achievement_id',achievementIds).order('created_at',{ascending:true})
        : Promise.resolve({data:[],error:null});

    const [commentsRes,reactionsRes,achReactionsRes,achCommentsRes]=await Promise.all([commentsP,drinkReactionsP,achReactionsP,achCommentsP]);

    if (commentsRes.error || reactionsRes.error) {
        return {...blank,ready:false};
    }

    (commentsRes.data||[]).forEach(c=>{
        (blank.commentsByDrink[c.drink_id] ||= []).push(c);
        const commenters=(blank.commentUsersByDrink[c.drink_id] ||= []);
        if (!commenters.includes(c.user_id)) commenters.push(c.user_id);
    });

    (reactionsRes.data||[]).forEach(r=>{
        const drinkReactions=(blank.reactionsByDrink[r.drink_id] ||= {});
        const emojiStats=(drinkReactions[r.emoji] ||= {count:0,active:false});
        emojiStats.count++;
        const drinkReactionUsers=(blank.reactionUsersByDrink[r.drink_id] ||= {});
        (drinkReactionUsers[r.emoji] ||= []).push(r.user_id);
        if (r.user_id===CU.id) {
            emojiStats.active=true;
            blank.myReactions[`${r.drink_id}:${r.emoji}`]=r.id;
        }
    });

    if (!achReactionsRes.error) {
        (achReactionsRes.data||[]).forEach(r=>{
            const reactions=(blank.reactionsByAchievement[r.achievement_id] ||= {});
            const stats=(reactions[r.emoji] ||= {count:0,active:false});
            stats.count++;
            const users=(blank.reactionUsersByAchievement[r.achievement_id] ||= {});
            (users[r.emoji] ||= []).push(r.user_id);
            if (r.user_id===CU.id) stats.active=true;
        });
    }

    if (!achCommentsRes.error) {
        (achCommentsRes.data||[]).forEach(c=>{
            (blank.commentsByAchievement[c.achievement_id] ||= []).push(c);
            const commenters=(blank.commentUsersByAchievement[c.achievement_id] ||= []);
            if (!commenters.includes(c.user_id)) commenters.push(c.user_id);
        });
    }

    return blank;
}

async function renderDrinkFeed() {
    const el=document.getElementById('drink-feed');
    const [{data:drinks,error},{data:users},{data:endedEvents},{data:members},{data:comments}] = await Promise.all([
        sb.from('pl_drinks').select('*').order('ts',{ascending:false}),
        sb.from('pl_users').select(PROFILE_SELECT),
        sb.from('pl_events').select('*').not('ended_at','is',null),
        sb.from('pl_event_members').select('event_id,user_id'),
        sb.from('pl_drink_comments').select('user_id,created_at')
    ]);
    if (error){el.innerHTML=`<div class="empty">Feil: ${esc(error.message)}</div>`;return;}

    const scopeUsers=await fetchUsersForCurrentScope(users||[]);
    const byUser={};
    (users||[]).forEach(u=>{byUser[u.id]=u;});
    const allVisibleDrinks=drinks||[];
    const allDrinks=visibleDrinksForScope(allVisibleDrinks);
    const drinkEvents=allDrinks.map(d=>({id:`drink:${d.id}`,kind:'drink',ts:d.ts,drink:d}));
    const allAchievementEvents=typeof achievementFeedEvents==='function'
        ? achievementFeedEvents(scopeUsers,allVisibleDrinks,endedEvents||[],members||[],comments||[])
        : [];
    const achEvents=currentEventId
        ? allAchievementEvents.filter(e=>e.event_id===currentEventId || e.achievement?.id==='first_comment')
        : currentSeasonId
            ? allAchievementEvents.filter(e=>currentSeasonContains(e.ts || e.drink_ts))
            : allAchievementEvents;
    const sortedFeed=[...drinkEvents,...achEvents].sort((a,b)=>new Date(b.ts)-new Date(a.ts));
    const feed=sortedFeed.slice(0,feedLimit);    const hasMore=sortedFeed.length>feed.length;
    if (!feed.length){el.innerHTML='<div class="empty">Ingen aktivitet ennå.</div>';return;}
    const drinkIds=feed.filter(e=>e.kind==='drink').map(e=>e.drink.id);
    const achievementIds=feed.filter(e=>e.kind==='achievement').map(e=>e.id);
    const interactions=await fetchFeedInteractions(drinkIds,achievementIds);

    const schemaNotice=interactions.ready?'':'<div class="feed-disabled global">Kjør oppdatert schema.sql for å aktivere kommentarer og reaksjoner.</div>';
    const loadMoreBtn=hasMore?'<div class="feed-load-more"><button class="btn btn-p" onclick="loadMoreFeed()">Last inn flere</button></div>':'';
    el.innerHTML=schemaNotice+feed.map(e=>e.kind==='achievement'
        ? renderAchievementFeedItem(e,byUser,interactions)
        : renderDrinkFeedItem(e.drink,interactions,byUser)
    ).join('')+loadMoreBtn;
}

async function loadMoreFeed() {
    feedLimit+=FEED_PAGE_SIZE;
    await renderDrinkFeed();
}

function renderDrinkFeedItem(d,interactions,byUser) {
    const user=byUser[d.user_id]||{username:'Ukjent',color:USER_COLORS[0]};
    const isMe=d.user_id===CU.id;
    const comments=interactions.commentsByDrink[d.id]||[];
    const commentUsers=interactions.commentUsersByDrink[d.id]||[];
    const reactions=interactions.reactionsByDrink[d.id]||{};
    const reactionUsers=interactions.reactionUsersByDrink[d.id]||{};
    return `<div class="feed-item">
        <div class="feed-head">
            ${avatarHtml(user,30,'.78em')}
            <div class="dinf">
                <div class="dn">${esc(displayName(user))}${isMe?'<span class="metag">(deg)</span>':''} drakk ${esc(d.type_name)}${d.qty!==1?` ×${d.qty}`:''}</div>
                <div class="dm">${fmtDate(d.ts)}${eventMeta(d)}${drinkLocationMeta(d)}${d.note?' · '+esc(d.note):''}</div>
            </div>
            <div class="dr">
                <span class="dg">${formatAlcohol(d.grams)}</span>
                ${isMe?`<button class="del del-txt" onclick="deleteDrink('${d.id}')">Slett</button>`:''}
            </div>
        </div>
        ${interactions.ready?renderFeedReactions(d.id,reactions,reactionUsers,commentUsers,byUser):''}
        ${interactions.ready?renderFeedComments(comments,byUser):''}
        ${interactions.ready?renderFeedCommentForm(d.id):''}
    </div>`;
}

function renderAchievementFeedItem(event,byUser,interactions) {
    const user=byUser[event.user_id]||event.user||{username:'Ukjent',color:USER_COLORS[0]};
    const isMe=event.user_id===CU.id;
    const reactions=interactions?.reactionsByAchievement?.[event.id]||{};
    const reactionUsers=interactions?.reactionUsersByAchievement?.[event.id]||{};
    const comments=interactions?.commentsByAchievement?.[event.id]||[];
    const commentUsers=interactions?.commentUsersByAchievement?.[event.id]||[];
    return `<div class="feed-item achievement">
        <div class="feed-head">
            ${avatarHtml(user,30,'.78em')}
            <div class="dinf">
                <div class="dn">${esc(displayName(user))}${isMe?'<span class="metag">(deg)</span>':''} låste opp ${event.achievement.icon} ${esc(event.achievement.name)}</div>
                <div class="dm">${fmtDate(event.ts)} · ${esc(event.achievement.desc)}</div>
            </div>
            <div class="dr"><span class="dg">🏅</span></div>
        </div>
        ${interactions?.ready?renderAchievementReactions(event.id,reactions,reactionUsers,commentUsers,byUser):''}
        ${interactions?.ready?renderAchievementComments(comments,byUser):''}
        ${interactions?.ready?renderAchievementCommentForm(event.id):''}
    </div>`;
}

function renderAchievementReactions(achId,reactions,reactionUsers,commentUsers,usersById) {
    const total=Object.values(reactions).reduce((sum,r)=>sum+(r.count||0),0);
    const hasInteractions=total>0 || commentUsers.length>0;
    const detailsId=`ach:${achId}`;
    const safeId=esc(achId);
    return `<div class="feed-actions">${FEED_REACTIONS.map(emoji=>{
        const stats=reactions[emoji]||{count:0,active:false};
        return `<button class="react-btn${stats.active?' active':''}" onclick="toggleAchievementReaction('${safeId}','${emoji}')">${emoji} ${stats.count||''}</button>`;
    }).join('')}${hasInteractions?`<button class="react-detail-btn" onclick="toggleInteractionDetails('${detailsId}')">${openInteractionDetailsId===detailsId?'Skjul reaksjoner':'Reaksjoner'}</button>`:''}</div>
    ${openInteractionDetailsId===detailsId?renderInteractionDetails(reactionUsers,commentUsers,usersById):''}`;
}

function renderAchievementComments(comments,usersById) {
    if (!comments.length) return '<div class="feed-comments"></div>';
    return `<div class="feed-comments">${comments.map(c=>{
        const user=usersById[c.user_id]||{username:'Ukjent'};
        const canDelete=c.user_id===CU.id;
        return `<div class="feed-comment">
            <div class="feed-comment-meta">
                <span>${esc(displayName(user))} · ${fmtDate(c.created_at)}</span>
                ${canDelete?`<button class="del" onclick="deleteAchievementComment('${c.id}')">✕</button>`:''}
            </div>
            <div>${esc(c.body)}</div>
        </div>`;
    }).join('')}</div>`;
}

function renderAchievementCommentForm(achId) {
    const safeId=esc(achId);
    const inputId=`feed-comment-ach-${achId.replace(/[^a-zA-Z0-9_-]/g,'_')}`;
    return `<div class="feed-comment-form">
        <input id="${inputId}" maxlength="240" placeholder="Skriv kommentar…" onkeydown="if(event.key==='Enter') addAchievementComment('${safeId}','${inputId}')">
        <button class="btn btn-s" onclick="addAchievementComment('${safeId}','${inputId}')">Send</button>
    </div>`;
}

async function addAchievementComment(achId,inputId) {
    const input=document.getElementById(inputId);
    const body=input?.value.trim();
    if (!body) return;
    const {error}=await sb.from('pl_achievement_comments').insert({achievement_id:achId,user_id:CU.id,body});
    if (error){showToast('Kjør oppdatert schema.sql for kommentarer.',false);return;}
    input.value='';
    await renderDrinkFeed();
}

async function deleteAchievementComment(id) {
    const {error}=await sb.from('pl_achievement_comments').delete().eq('id',id).eq('user_id',CU.id);
    if (error){showToast('Kunne ikke slette kommentar.',false);return;}
    await renderDrinkFeed();
}

async function toggleAchievementReaction(achId,emoji) {
    const {data:existing,error:findError}=await sb.from('pl_achievement_reactions')
        .select('id')
        .eq('achievement_id',achId)
        .eq('user_id',CU.id)
        .eq('emoji',emoji)
        .maybeSingle();
    if (findError){showToast('Kjør oppdatert schema.sql for reaksjoner.',false);return;}

    const result=existing
        ? await sb.from('pl_achievement_reactions').delete().eq('id',existing.id)
        : await sb.from('pl_achievement_reactions').insert({achievement_id:achId,user_id:CU.id,emoji});
    if (result.error){showToast('Kunne ikke lagre reaksjon.',false);return;}
    await renderDrinkFeed();
}

function renderFeedReactions(drinkId,reactions,reactionUsers,commentUsers,usersById) {
    const total=Object.values(reactions).reduce((sum,r)=>sum+(r.count||0),0);
    const hasInteractions=total>0 || commentUsers.length>0;
    return `<div class="feed-actions">${FEED_REACTIONS.map(emoji=>{
        const stats=reactions[emoji]||{count:0,active:false};
        return `<button class="react-btn${stats.active?' active':''}" onclick="toggleFeedReaction('${drinkId}','${emoji}')">${emoji} ${stats.count||''}</button>`;
    }).join('')}${hasInteractions?`<button class="react-detail-btn" onclick="toggleInteractionDetails('${drinkId}')">${openInteractionDetailsId===drinkId?'Skjul reaksjoner':'Reaksjoner'}</button>`:''}</div>
    ${openInteractionDetailsId===drinkId?renderInteractionDetails(reactionUsers,commentUsers,usersById):''}`;
}

function renderInteractionDetails(reactionUsers,commentUsers,usersById) {
    const namesFor=(ids)=>[...new Set(ids)]
        .map(id=>usersById[id]?displayName(usersById[id]):'Ukjent')
        .map(esc)
        .join(', ');
    const rows=[];
    if (commentUsers.length) {
        rows.push(`<div class="react-detail-row"><span>💬</span><span><strong>Kommenterte:</strong> ${namesFor(commentUsers)}</span></div>`);
    }
    rows.push(...FEED_REACTIONS
        .filter(emoji=>(reactionUsers[emoji]||[]).length)
        .map(emoji=>{
            const names=namesFor(reactionUsers[emoji]||[]);
            return `<div class="react-detail-row"><span>${emoji}</span><span>${names}</span></div>`;
        }));
    return rows.length?`<div class="react-details">${rows.join('')}</div>`:'';
}

function toggleInteractionDetails(drinkId) {
    openInteractionDetailsId=openInteractionDetailsId===drinkId?null:drinkId;
    renderDrinkFeed();
}

function renderFeedComments(comments,usersById) {
    if (!comments.length) return '<div class="feed-comments"></div>';
    return `<div class="feed-comments">${comments.map(c=>{
        const user=usersById[c.user_id]||{username:'Ukjent'};
        const canDelete=c.user_id===CU.id;
        return `<div class="feed-comment">
            <div class="feed-comment-meta">
                <span>${esc(displayName(user))} · ${fmtDate(c.created_at)}</span>
                ${canDelete?`<button class="del" onclick="deleteFeedComment('${c.id}')">✕</button>`:''}
            </div>
            <div>${esc(c.body)}</div>
        </div>`;
    }).join('')}</div>`;
}

function renderFeedCommentForm(drinkId) {
    return `<div class="feed-comment-form">
        <input id="feed-comment-${drinkId}" maxlength="240" placeholder="Skriv kommentar…" onkeydown="if(event.key==='Enter') addFeedComment('${drinkId}')">
        <button class="btn btn-s" onclick="addFeedComment('${drinkId}')">Send</button>
    </div>`;
}

async function addFeedComment(drinkId) {
    const input=document.getElementById(`feed-comment-${drinkId}`);
    const body=input?.value.trim();
    if (!body) return;
    const {error}=await sb.from('pl_drink_comments').insert({drink_id:drinkId,user_id:CU.id,body});
    if (error){showToast('Kjør oppdatert schema.sql for kommentarer.',false);return;}
    input.value='';
    await renderDrinkFeed();
}

async function deleteFeedComment(id) {
    const {error}=await sb.from('pl_drink_comments').delete().eq('id',id).eq('user_id',CU.id);
    if (error){showToast('Kunne ikke slette kommentar.',false);return;}
    await renderDrinkFeed();
}

async function toggleFeedReaction(drinkId,emoji) {
    const {data:existing,error:findError}=await sb.from('pl_drink_reactions')
        .select('id')
        .eq('drink_id',drinkId)
        .eq('user_id',CU.id)
        .eq('emoji',emoji)
        .maybeSingle();
    if (findError){showToast('Kjør oppdatert schema.sql for reaksjoner.',false);return;}

    const result=existing
        ? await sb.from('pl_drink_reactions').delete().eq('id',existing.id)
        : await sb.from('pl_drink_reactions').insert({drink_id:drinkId,user_id:CU.id,emoji});
    if (result.error){showToast('Kunne ikke lagre reaksjon.',false);return;}
    await renderDrinkFeed();
}

async function deleteDrink(id) {
    if (!confirm('Slett denne registreringen? Achievements, streaks, feed og statistikk oppdateres automatisk.')) return;
    setLoading(true,'Sletter registrering…');
    const {data,error}=await sb.from('pl_drinks').delete().eq('id',id).eq('user_id',CU.id).select('id');
    setLoading(false);
    if (error){showToast('Kunne ikke slette registreringen.',false);return;}
    if (!data?.length){showToast('Fant ikke en egen registrering å slette.',false);return;}
    showToast('Slettet');
    await refreshAfterDrinkChange();
}

async function refreshAfterDrinkChange() {
    const view=activeViewName();
    if (view==='dashboard') { await renderDashboard(); return; }
    if (view==='log') {
        await renderMyDrinksList();
        await renderDashboard();
        return;
    }
    if (view==='stats') { await renderStats(); return; }
    if (view==='lb') { await fetchAndRenderLb(lbFilter); return; }
    if (view==='achievements') { await renderAchievements(); return; }
    if (view==='profile') { await renderAchievementProfile(achProfileUserId); return; }
    if (view==='events') { await renderEvents(); return; }
    await renderDrinkFeed();
}
