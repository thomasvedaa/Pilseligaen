/* ════════════════════════════════════════════
   START APP
════════════════════════════════════════════ */
let routerBound = false;
let appBasePath = detectAppBasePath();
let activeRouteState = {view:'dashboard',route:'/',params:{}};

function pageByView(name) {
    return PAGE_MODULES[name] || Object.values(PAGE_MODULES).find(page => page.view === name) || PAGE_MODULES.dashboard;
}

function staticRouteMap() {
    return Object.fromEntries(Object.values(PAGE_MODULES)
        .filter(page => page.path && !page.match && page.view !== 'not-found')
        .map(page => [page.path, page]));
}

function appBasePathFromScript() {
    const script = document.currentScript || document.querySelector('script[src*="assets/js/app.js"]');
    if (!script?.src) return '';

    try {
        const scriptUrl = new URL(script.src, window.location.href);
        const base = scriptUrl.pathname.replace(/\/assets\/js\/app\.js$/, '');
        if (base !== scriptUrl.pathname) return base.replace(/\/$/, '');
    } catch (_) {}

    return '';
}

function detectAppBasePath() {
    const assetBase = appBasePathFromScript();
    if (assetBase) return assetBase;

    const path = window.location.pathname || '/';
    if (path.endsWith('/index.html')) {
        return path.slice(0, -'/index.html'.length) || '';
    }

    const trimmed = path.replace(/\/+$/, '');
    if (!trimmed) return '';

    const parts = trimmed.split('/').filter(Boolean);
    const routeIndex = parts.findIndex(part => PAGE_ROUTE_SEGMENTS.includes(part));
    if (routeIndex >= 0) {
        const base = '/' + parts.slice(0, routeIndex).join('/');
        return base === '/' ? '' : base;
    }

    if (parts.length > 1) return '/' + parts.slice(0,-1).join('/');
    return '';
}

function normalizeRoutePath(value) {
    let path = String(value || '/').split('?')[0].split('#')[0] || '/';
    if (!path.startsWith('/')) path = '/' + path;
    path = path.replace(/\/+/g, '/');
    if (path.endsWith('/index.html')) path = path.slice(0, -'/index.html'.length) || '/';
    if (path.length > 1) path = path.replace(/\/$/, '');
    return path || '/';
}

function routePathFromLocation() {
    const hash = window.location.hash || '';
    if (hash.startsWith('#/')) return normalizeRoutePath(hash.slice(1));

    let path = window.location.pathname || '/';
    if (path.endsWith('/index.html')) path = path.slice(0, -'/index.html'.length) || '/';
    if (appBasePath && path.startsWith(appBasePath)) path = path.slice(appBasePath.length) || '/';
    return normalizeRoutePath(path);
}

function routePathForView(name) {
    const page = pageByView(name);
    if (page.pathForState) return page.pathForState(activeRouteState);
    return page.path || PAGE_MODULES.dashboard.path;
}

function routeStateForPath(routePath) {
    const rawRoute = normalizeRoutePath(routePath);
    const route = ROUTE_ALIASES[rawRoute] || rawRoute;

    for (const page of Object.values(PAGE_MODULES)) {
        if (!page.match) continue;
        const match = route.match(page.match);
        if (match) {
            const params = page.paramsFromMatch ? page.paramsFromMatch(match) : {};
            return {view:page.view, route, params};
        }
    }

    const page = staticRouteMap()[route];
    if (page) return {view:page.view, route:page.path, params:{}};
    return {view:'not-found', route:rawRoute, params:{missingRoute:rawRoute}};
}

function routeUrl(routePath) {
    const route = normalizeRoutePath(routePath);
    if (window.location.protocol === 'file:') {
        return route === '/' ? window.location.pathname : `${window.location.pathname}#${route}`;
    }
    return `${appBasePath}${route === '/' ? '/' : route}`;
}

function setBrowserRoute(routePath, replace=false) {
    const route = normalizeRoutePath(routePath);
    if (!replace && routePathFromLocation() === route) return;
    const method = replace ? 'replaceState' : 'pushState';
    window.history[method]({route}, '', routeUrl(route));
}

function setActiveRouteControls(name) {
    const navView = pageByView(name).nav;
    document.querySelectorAll('[data-view]').forEach(el => {
        el.classList.toggle('active', !!navView && el.dataset.view === navView);
    });
}

function setPageTitle(name) {
    document.title = pageByView(name).title || PAGE_MODULES.dashboard.title;
}

async function renderView(name) {
    const page = pageByView(name);
    if (page.prepare) page.prepare(activeRouteState);
    await page.render(activeRouteState);
}

async function activateView(name, options={}) {
    const viewName = document.getElementById('view-'+name) ? name : 'dashboard';
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    document.getElementById('view-'+viewName).classList.add('active');
    setActiveRouteControls(viewName);
    setPageTitle(viewName);
    if (options.scroll !== false) window.scrollTo(0,0);
    await renderView(viewName);
}

async function navigateToRoute(routePath, options={}) {
    const state = routeStateForPath(routePath);
    activeRouteState = state;
    setBrowserRoute(state.route, !!options.replace);
    await activateView(state.view, options);
}

async function loadRouteFromLocation(options={}) {
    const state = routeStateForPath(routePathFromLocation());
    activeRouteState = state;
    if (options.replace) setBrowserRoute(state.route, true);
    await activateView(state.view, options);
}

function bindAppRouter() {
    if (routerBound) return;
    document.addEventListener('click', event => {
        const trigger = event.target.closest('[data-route]');
        if (!trigger || trigger.disabled) return;
        if (trigger.tagName === 'A' && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) return;
        event.preventDefault();
        navigateToRoute(trigger.dataset.route);
    });
    window.addEventListener('popstate', () => loadRouteFromLocation({scroll:false}));
    window.addEventListener('hashchange', () => {
        if ((window.location.hash || '').startsWith('#/')) loadRouteFromLocation({scroll:false});
    });
    routerBound = true;
}

function replaceAppRoute(routePath) {
    setBrowserRoute(routePath, true);
}

async function startApp(user) {
    CU=user;
    updateUserHeader();
    document.getElementById('app').style.display='block';
    bindAppRouter();
    updateAlcoholModeButton();
    await loadSeasons();
    await loadEvents();
    ensureSeasonRealtime();
    ensureEventRealtime();
    updateEventControls();
    resetDt();
    await loadRouteFromLocation({replace:true});
}

function updateUserHeader() {
    if (!CU) return;
    const av=document.getElementById('usr-av');
    setAvatarElement(av,CU);
    document.getElementById('usr-nm').textContent=displayName(CU);
    document.querySelectorAll('[data-admin-only]').forEach(el=>{
        el.style.display=isAdmin(CU)?'inline-flex':'none';
    });
}

async function editNickname() {
    if (!CU) return;
    const current=displayName(CU);
    const next=prompt('Velg kallenavn som vises i ligaen:', current);
    if (next===null) return;
    const nickname=next.trim();
    if (!nickname){showToast('Kallenavn kan ikke være tomt.',false);return;}
    if (nickname.length>32){showToast('Maks 32 tegn.',false);return;}

    setLoading(true,'Lagrer kallenavn…');
    const {data,error}=await sb.from('pl_users').update({nickname}).eq('id',CU.id).select(PROFILE_SELECT).single();
    setLoading(false);
    if (error){
        showToast('Kunne ikke lagre. Kjør oppdatert schema.sql i Supabase først.',false);
        return;
    }
    CU={...data,is_admin:isAdmin(CU)};
    updateUserHeader();
    await refreshActiveViewForAlcoholMode();
    showToast('Kallenavn oppdatert!');
}

async function editAvatar() {
    if (!CU) return;
    const current=cleanAvatarUrl(CU.avatar_url);
    const next=prompt('Lim inn URL til profilbilde. La feltet være tomt for å fjerne bildet:', current);
    if (next===null) return;
    const avatar_url=cleanAvatarUrl(next);
    if (next.trim() && !avatar_url) {
        showToast('Bruk en gyldig http/https-lenke til et bilde.',false);
        return;
    }

    setLoading(true,'Lagrer profilbilde…');
    const {data,error}=await sb.from('pl_users').update({avatar_url:avatar_url||null}).eq('id',CU.id).select(PROFILE_SELECT).single();
    setLoading(false);
    if (error){
        showToast('Kunne ikke lagre. Kjør oppdatert schema.sql i Supabase først.',false);
        return;
    }
    CU={...data,is_admin:isAdmin(CU)};
    updateUserHeader();
    await refreshActiveViewForAlcoholMode();
    showToast(avatar_url?'Profilbilde oppdatert!':'Profilbilde fjernet.');
}

/* ════════════════════════════════════════════
   NAVIGATION
════════════════════════════════════════════ */
async function showView(name, btnOrOptions) {
    const opts = btnOrOptions && btnOrOptions.nodeType !== 1 && typeof btnOrOptions === 'object'
        ? btnOrOptions
        : {};
    const route = routePathForView(name);
    const state = routeStateForPath(route);
    activeRouteState = state;
    if (opts.pushRoute !== false) setBrowserRoute(route, !!opts.replace);
    await activateView(state.view, opts);
}

function activeViewName() {
    const active=document.querySelector('.view.active');
    return active ? active.id.replace('view-','') : 'dashboard';
}

function updateAlcoholModeButton() {
    const btn=document.getElementById('unit-toggle');
    if (!btn) return;
    const gramsActive=alcoholMode==='grams';
    btn.innerHTML=`<span class="unit-choice${gramsActive?' active':''}">Gram</span><span class="unit-swap">↔</span><span class="unit-choice${gramsActive?'':' active'}">Enheter</span>`;
    btn.title=gramsActive?'Klikk for å vise alkoholenheter':'Klikk for å vise gram alkohol';
    btn.setAttribute('aria-label',gramsActive?'Viser gram alkohol. Bytt til alkoholenheter.':'Viser alkoholenheter. Bytt til gram alkohol.');
    btn.setAttribute('aria-pressed',gramsActive?'false':'true');
}

async function refreshActiveViewForAlcoholMode() {
    updateAlcoholModeButton();
    const view=activeViewName();
    if (view==='dashboard') await renderDashboard();
    if (view==='stats') await renderStats();
    if (view==='lb') await fetchAndRenderLb(lbFilter);
    if (view==='achievements') await renderAchievements();
    if (view==='profile') await renderAchievementProfile(achProfileUserId);
    if (view==='drinks') await renderDtList();
    if (view==='events') await renderEvents();
    if (view==='log') {
        await populateLogSelect();
        await updateLogPreview();
        await renderMyDrinksList();
    }
}

function toggleAlcoholMode() {
    alcoholMode=alcoholMode==='grams'?'units':'grams';
    localStorage.setItem('pl_alcohol_mode',alcoholMode);
    refreshActiveViewForAlcoholMode();
}
