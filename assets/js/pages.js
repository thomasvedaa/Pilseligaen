/* PAGE MODULES */
const PAGE_ROUTE_SEGMENTS = ['log','stats','leaderboard','lb','drinks','drink-types','achievements','events','groups','admin','404'];

const ROUTE_ALIASES = {
    '/lb': '/leaderboard',
    '/drink-types': '/drinks'
};

const PAGE_MODULES = {
    dashboard: {
        view: 'dashboard',
        path: '/',
        nav: 'dashboard',
        title: 'Pilseligaen',
        render: async () => renderDashboard()
    },
    log: {
        view: 'log',
        path: '/log',
        nav: 'log',
        title: 'Registrer - Pilseligaen',
        render: async () => {
            await populateLogSelect();
            resetDt();
            await renderMyDrinksList();
        }
    },
    stats: {
        view: 'stats',
        path: '/stats',
        nav: 'stats',
        title: 'Statistikk - Pilseligaen',
        render: async () => {
            tlPeriod = 30;
            await renderStats();
        }
    },
    lb: {
        view: 'lb',
        path: '/leaderboard',
        nav: 'lb',
        title: 'Toppliste - Pilseligaen',
        render: async () => renderLeaderboard(lbFilter)
    },
    drinks: {
        view: 'drinks',
        path: '/drinks',
        nav: 'drinks',
        title: 'Drikkekort - Pilseligaen',
        render: async () => renderDtList()
    },
    achievements: {
        view: 'achievements',
        path: '/achievements',
        nav: 'achievements',
        title: 'Merker - Pilseligaen',
        render: async () => renderAchievements()
    },
    profile: {
        view: 'profile',
        path: '/achievements',
        nav: 'achievements',
        title: 'Profil - Pilseligaen',
        match: /^\/achievements\/([^/]+)$/,
        pathForState: () => {
            const id = typeof achProfileUserId !== 'undefined' ? achProfileUserId : '';
            return id ? `/achievements/${encodeURIComponent(id)}` : PAGE_MODULES.achievements.path;
        },
        prepare: state => {
            if (typeof achProfileUserId !== 'undefined') achProfileUserId = state.params.userId;
        },
        paramsFromMatch: match => ({userId: decodeURIComponent(match[1])}),
        render: async state => renderAchievementProfile(state.params.userId)
    },
    events: {
        view: 'events',
        path: '/events',
        nav: 'events',
        title: 'Turer - Pilseligaen',
        render: async () => renderEvents()
    },
    groups: {
        view: 'groups',
        path: '/groups',
        nav: 'groups',
        title: 'Grupper - Pilseligaen',
        render: async () => renderGroups()
    },
    admin: {
        view: 'admin',
        path: '/admin',
        nav: 'admin',
        title: 'Admin - Pilseligaen',
        render: async () => renderAdminModeration()
    },
    notFound: {
        view: 'not-found',
        path: '/404',
        nav: null,
        title: '404 - Pilseligaen',
        render: async state => renderNotFoundPage(state.route)
    }
};

function renderNotFoundPage(route) {
    const el = document.getElementById('not-found-detail');
    if (!el) return;
    el.innerHTML = `
        <div class="card not-found-card">
            <div class="not-found-code">404</div>
            <h2>Fant ikke siden</h2>
            <p>Ruten <strong>${esc(route || '/')}</strong> finnes ikke i Pilseligaen.</p>
            <button class="btn btn-p btn-sm" type="button" data-route="/" data-view="dashboard">Til hjem</button>
        </div>
    `;
}
