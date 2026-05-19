/* ════════════════════════════════════════════
   DASHBOARD
════════════════════════════════════════════ */
const FEED_REACTIONS = ['🔥','😂','👏','💀','🍺'];

async function renderDashboard() {
    document.getElementById('dash-stats').innerHTML='';
    document.getElementById('recent-drinks').innerHTML='<div class="vload"><div class="spinner"></div>Laster…</div>';
    document.getElementById('drink-feed').innerHTML='<div class="vload"><div class="spinner"></div>Laster…</div>';
    ensureFeedRealtime();
    renderDrinkFeed();
    const {data:drinks,error}=await sb.from('pl_drinks').select('*').eq('user_id',CU.id);
    if (error){document.getElementById('recent-drinks').innerHTML=`<div class="empty">Feil: ${error.message}</div>`;return;}
    const all=drinks||[];
    const now=new Date();
    const wkS=new Date(now); wkS.setDate(now.getDate()-(now.getDay()===0?6:now.getDay()-1)); wkS.setHours(0,0,0,0);
    const mS=new Date(now.getFullYear(),now.getMonth(),1);
    const wkG=all.filter(d=>new Date(d.ts)>=wkS).reduce((s,d)=>s+d.grams,0);
    const mG =all.filter(d=>new Date(d.ts)>=mS ).reduce((s,d)=>s+d.grams,0);
    const tot=all.reduce((s,d)=>s+d.grams,0);
    const days=new Set(all.map(d=>new Date(d.ts).toDateString())).size;
    document.getElementById('dash-stats').innerHTML=`
        <div class="card"><div class="ct">Denne uken</div><div class="cv">${formatAlcoholValue(wkG)}</div><div class="cs">${alcoholSubLabel()}</div></div>
        <div class="card"><div class="ct">Denne måneden</div><div class="cv">${formatAlcoholValue(mG)}</div><div class="cs">${alcoholSubLabel()}</div></div>
        <div class="card"><div class="ct">Totalt</div><div class="cv">${formatAlcoholValue(tot)}</div><div class="cs">${days} drikkedager · ${alcoholSubLabel()}</div></div>`;
    const recent=[...all].sort((a,b)=>new Date(b.ts)-new Date(a.ts)).slice(0,12);
    const el=document.getElementById('recent-drinks');
    if (!recent.length){el.innerHTML='<div class="empty">Ingen drikke registrert ennå.<br>Trykk <strong>➕ Registrer</strong> for å starte!</div>';return;}
    el.innerHTML=recent.map(d=>`
        <div class="di">
            <span class="dico">${drinkIcon(d.abv)}</span>
            <div class="dinf">
                <div class="dn">${esc(d.type_name)}${d.qty!==1?` ×${d.qty}`:''}</div>
                <div class="dm">${fmtDate(d.ts)}${d.note?' · '+esc(d.note):''}</div>
            </div>
            <div class="dr">
                <span class="dg">${formatAlcohol(d.grams)}</span>
                <button class="del" onclick="deleteDrink('${d.id}')">✕</button>
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
        .subscribe();
}

async function fetchFeedInteractions(drinkIds) {
    const blank={ready:true,commentsByDrink:{},reactionsByDrink:{},myReactions:{}};
    if (!drinkIds.length) return blank;

    const [commentsRes,reactionsRes] = await Promise.all([
        sb.from('pl_drink_comments').select('id,drink_id,user_id,body,created_at').in('drink_id',drinkIds).order('created_at',{ascending:true}),
        sb.from('pl_drink_reactions').select('id,drink_id,user_id,emoji').in('drink_id',drinkIds)
    ]);

    if (commentsRes.error || reactionsRes.error) {
        return {...blank,ready:false};
    }

    (commentsRes.data||[]).forEach(c=>{
        (blank.commentsByDrink[c.drink_id] ||= []).push(c);
    });

    (reactionsRes.data||[]).forEach(r=>{
        const drinkReactions=(blank.reactionsByDrink[r.drink_id] ||= {});
        const emojiStats=(drinkReactions[r.emoji] ||= {count:0,active:false});
        emojiStats.count++;
        if (r.user_id===CU.id) {
            emojiStats.active=true;
            blank.myReactions[`${r.drink_id}:${r.emoji}`]=r.id;
        }
    });

    return blank;
}

async function renderDrinkFeed() {
    const el=document.getElementById('drink-feed');
    const [{data:drinks,error},{data:users}] = await Promise.all([
        sb.from('pl_drinks').select('*').order('ts',{ascending:false}).limit(30),
        sb.from('pl_users').select('*')
    ]);
    if (error){el.innerHTML=`<div class="empty">Feil: ${esc(error.message)}</div>`;return;}

    const byUser={};
    (users||[]).forEach(u=>{byUser[u.id]=u;});
    const feed=drinks||[];
    if (!feed.length){el.innerHTML='<div class="empty">Ingen aktivitet ennå.</div>';return;}
    const interactions=await fetchFeedInteractions(feed.map(d=>d.id));

    const schemaNotice=interactions.ready?'':'<div class="feed-disabled global">Kjør oppdatert schema.sql for å aktivere kommentarer og reaksjoner.</div>';
    el.innerHTML=schemaNotice+feed.map(d=>{
        const user=byUser[d.user_id]||{username:'Ukjent',color:USER_COLORS[0]};
        const isMe=d.user_id===CU.id;
        const comments=interactions.commentsByDrink[d.id]||[];
        const reactions=interactions.reactionsByDrink[d.id]||{};
        return `<div class="feed-item">
            <div class="feed-head">
                <div class="avatar" style="background:${user.color||USER_COLORS[0]};width:30px;height:30px;font-size:.78em">${esc(userInitial(user))}</div>
                <div class="dinf">
                    <div class="dn">${esc(displayName(user))}${isMe?'<span class="metag">(deg)</span>':''} drakk ${esc(d.type_name)}${d.qty!==1?` ×${d.qty}`:''}</div>
                    <div class="dm">${fmtDate(d.ts)}${d.note?' · '+esc(d.note):''}</div>
                </div>
                <div class="dr"><span class="dg">${formatAlcohol(d.grams)}</span></div>
            </div>
            ${interactions.ready?renderFeedReactions(d.id,reactions):''}
            ${interactions.ready?renderFeedComments(comments,byUser):''}
            ${interactions.ready?renderFeedCommentForm(d.id):''}
        </div>`;
    }).join('');
}

function renderFeedReactions(drinkId,reactions) {
    return `<div class="feed-actions">${FEED_REACTIONS.map(emoji=>{
        const stats=reactions[emoji]||{count:0,active:false};
        return `<button class="react-btn${stats.active?' active':''}" onclick="toggleFeedReaction('${drinkId}','${emoji}')">${emoji} ${stats.count||''}</button>`;
    }).join('')}</div>`;
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
    if (!confirm('Slett dette innlegget?')) return;
    await sb.from('pl_drinks').delete().eq('id',id);
    showToast('Slettet');
    await renderDashboard();
}
