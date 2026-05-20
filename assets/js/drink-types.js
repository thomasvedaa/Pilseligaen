/* ════════════════════════════════════════════
   DRINK TYPES
════════════════════════════════════════════ */
async function getCustomDtypes(fresh=false) {
    if (dtCache && !fresh) return dtCache;
    if (!CU) return [];
    const {data}=await sb.from('pl_drink_types')
        .select('id,name,vol_ml,abv,created_by,created_at')
        .eq('created_by',CU.id)
        .order('created_at');
    dtCache=(data||[]).map(t=>({...t,isDefault:false}));
    return dtCache;
}
async function getAllDtypes() {
    const custom=await getCustomDtypes();
    return [...DEFAULT_DTYPES,...custom];
}

async function populateLogSelect() {
    const sel=document.getElementById('log-type'); const prev=sel.value;
    sel.innerHTML='<option value="">Velg type…</option>';
    const types=await getAllDtypes();
    types.forEach(t=>{
        const g=grams(t.vol_ml,t.abv);
        const o=document.createElement('option'); o.value=t.id;
        o.textContent=`${t.name}  (${fmtVolume(t.vol_ml)} · ${formatAlcohol(g)})`;
        sel.appendChild(o);
    });
    if (prev) sel.value=prev;
    updateLogPreview();
}

async function updateLogPreview() {
    const tid=document.getElementById('log-type').value;
    const qty=parseFloat(document.getElementById('log-qty').value)||1;
    const el=document.getElementById('log-prev');
    if (!tid){el.style.display='none';return;}
    const types=await getAllDtypes();
    const t=types.find(x=>x.id===tid); if (!t) return;
    const g=grams(t.vol_ml,t.abv,qty);
    document.getElementById('log-prev-label').textContent=alcoholMode==='units'?'Alkoholenheter totalt:':'Gram alkohol totalt:';
    document.getElementById('log-prev-g').textContent=formatAlcohol(g);
    document.getElementById('log-prev-d').textContent=`${qty} × ${fmtVolume(t.vol_ml)} @ ${t.abv}%`;
    el.style.display='block';
}

function toggleDtForm(show) {
    document.getElementById('dt-form').style.display=show?'block':'none';
    if (!show){
        ['dt-nm','dt-vol','dt-abv'].forEach(i=>document.getElementById(i).value='');
        document.getElementById('dt-kind').value='single';
        document.getElementById('dt-pack').value='6';
        toggleDtKind();
        document.getElementById('dt-prev').style.display='none';
    }
}

function isBulkDt() {
    return document.getElementById('dt-kind').value==='bulk';
}

function toggleDtKind() {
    const bulk=isBulkDt();
    document.getElementById('dt-pack-wrap').style.display=bulk?'block':'none';
    document.getElementById('dt-bulk-presets').style.display=bulk?'flex':'none';
    document.getElementById('dt-vol-label').textContent=bulk?'Volum per enhet (ml)':'Volum (ml)';
    document.getElementById('dt-vol').placeholder=bulk?'500':'500';
    updDtPrev();
}

function setBulkPreset(count,vol) {
    document.getElementById('dt-kind').value='bulk';
    toggleDtKind();
    document.getElementById('dt-pack').value=count;
    document.getElementById('dt-vol').value=vol;
    updDtPrev();
}

function dtPackQty() {
    return isBulkDt() ? parseInt(document.getElementById('dt-pack').value,10) : 1;
}

function dtTotalVolume(vol,packQty) {
    return vol * packQty;
}

function updDtPrev() {
    const vol=parseFloat(document.getElementById('dt-vol').value);
    const abv=parseFloat(document.getElementById('dt-abv').value);
    const packQty=dtPackQty();
    const el=document.getElementById('dt-prev');
    if (vol>0&&packQty>0&&abv>=0&&abv<=100){
        const totalVol=dtTotalVolume(vol,packQty);
        const prefix=packQty>1?`${packQty} × ${fmtVolume(vol)} = ${fmtVolume(totalVol)} · `:'';
        document.getElementById('dt-prev-g').textContent=formatAlcoholValue(grams(totalVol,abv));
        document.getElementById('dt-prev-label').textContent=prefix?`Pakning: ${prefix}`:'Per enhet: ';
        document.getElementById('dt-prev-unit').textContent=alcoholSubLabel();
        el.style.display='block';
    }
    else el.style.display='none';
}

async function handleAddDt() {
    const name=document.getElementById('dt-nm').value.trim();
    const vol=parseFloat(document.getElementById('dt-vol').value);
    const abv=parseFloat(document.getElementById('dt-abv').value);
    const packQty=dtPackQty();
    const totalVol=dtTotalVolume(vol,packQty);
    if (!name)              {showToast('Skriv inn navn!',false);return;}
    if (!vol||vol<=0)       {showToast('Ugyldig volum!',false);return;}
    if (!Number.isInteger(packQty)||packQty<1){showToast('Ugyldig antall i pakke!',false);return;}
    if (isNaN(abv)||abv<0||abv>100){showToast('Ugyldig prosent!',false);return;}
    const saveName=packQty>1?`${name} (${packQty} × ${fmtVolume(vol)})`:name;
    setLoading(true,'Lagrer…');
    const {error}=await sb.from('pl_drink_types').insert({name:saveName,vol_ml:totalVol,abv,created_by:CU.id});
    setLoading(false);
    if (error){showToast('Feil: '+error.message,false);return;}
    dtCache=null; toggleDtForm(false); await renderDtList(); await populateLogSelect();
    showToast('Drikketype lagt til! ✓');
}

async function deleteDt(id) {
    if (!confirm('Slett denne drikketypen?')) return;
    setLoading(true,'Sletter…');
    const {data,error}=await sb.from('pl_drink_types').delete().eq('id',id).eq('created_by',CU.id).select('id');
    setLoading(false);
    if (error){showToast('Kunne ikke slette drikketypen.',false);return;}
    if (!data?.length){showToast('Du kan bare slette egne drikketyper.',false);return;}
    dtCache=null; await renderDtList(); await populateLogSelect();
    showToast('Slettet');
}

async function renderDtList() {
    const el=document.getElementById('dt-list');
    el.innerHTML='<div class="vload"><div class="spinner"></div>Laster…</div>';
    const types=await getAllDtypes();
    if (!types.length){el.innerHTML='<div class="empty">Ingen drikketyper.</div>';return;}
    el.innerHTML=types.map(t=>{
        const g=grams(t.vol_ml,t.abv);
        const meta=t.pack_count&&t.unit_vol_ml
            ? `${t.pack_count} × ${fmtVolume(t.unit_vol_ml)} = ${fmtVolume(t.vol_ml)}`
            : fmtVolume(t.vol_ml);
        return `<div class="dti">
            <span style="font-size:1.3em;flex-shrink:0">${drinkIcon(t.abv)}</span>
            <div class="dtinf">
                <div class="dtn">${t.name}</div>
                <div class="dtm">${meta} · ${t.abv}% · <strong style="color:var(--accent)">${formatAlcohol(g)}</strong> per enhet</div>
            </div>
            ${t.isDefault?'<span class="badge">Standard</span>':`<button class="btn btn-d btn-sm" onclick="deleteDt('${t.id}')">Slett</button>`}
        </div>`;
    }).join('');
}
