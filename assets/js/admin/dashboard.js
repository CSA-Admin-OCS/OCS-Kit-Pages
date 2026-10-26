// Admin Dashboard (/admin/): kit, roles + user counts, feature summary, admin links.
import { BACKENDS, BACKEND_IDS, MOCK, loadCatalog, getIdentity, getKitPublic, getKitAdmin, getUserCounts, describeFailure } from './kit-api.js';
import { SITE, esc, announce, mockBanner, showGate, buildFeatures, backendName, renderStaff } from './common.js';

const base = SITE.baseurl || '';
const withMock = (url) => (MOCK ? `${url}${url.includes('?') ? '&' : '?'}mock=${encodeURIComponent(MOCK)}` : url);

function roleLabel(kit, role) {
    return (kit && kit.roles && kit.roles[role] && kit.roles[role].label) || role;
}

function renderKit(kit, catalog, admin) {
    const kitInfo = (catalog.kits || {})[kit.kit] || {};
    document.getElementById('kit-name').textContent = kit.kit_name || kitInfo.name || kit.kit;
    document.getElementById('admin-kit-badge').textContent = kit.kit_name || kitInfo.name || 'Admin';
    document.getElementById('kit-desc').textContent = kitInfo.description || '';
    document.getElementById('kit-backends').innerHTML = BACKEND_IDS.map(b => {
        const r = admin[b];
        const text = r && r.ok ? `${esc(r.data.kit_name || r.data.kit)}` : 'not reachable';
        const cls = r && r.ok ? 'ocs__admin-pill--ok' : 'ocs__admin-pill--warn';
        const glyph = r && r.ok ? '&#10003;' : '!';
        return `<dt>${esc(backendName(b))} backend</dt><dd><span class="ocs__admin-pill ${cls}"><span aria-hidden="true">${glyph}</span> ${text}</span></dd>`;
    }).join('');
}

function renderRoles(kit, counts) {
    const roles = ['admin', 'staff', 'member'];
    document.getElementById('role-counts').innerHTML = roles.map(r => {
        const n = counts ? counts.counts[r] : '–';
        const signup = kit.signup_role === r ? ' <span class="ocs__admin-pill ocs__admin-pill--muted">new sign-ups</span>' : '';
        return `<dt>${esc(roleLabel(kit, r))}${signup}</dt><dd>${n}</dd>`;
    }).join('') + (counts ? `<dt>Total</dt><dd>${counts.total}</dd>` : '');
    document.getElementById('role-note').textContent = counts
        ? `Only ${roleLabel(kit, 'admin')}s can change features. ${roleLabel(kit, 'staff')}s run day-to-day work; ${roleLabel(kit, 'member')}s use the site.`
        : 'User counts are not available (the Spring user list did not answer).';
    document.getElementById('user-links').innerHTML =
        `<a class="ocs__btn small" href="${esc(BACKENDS.spring.uri)}/mvc/person/read">Manage users and roles</a>`;
}

function renderFeatures(features) {
    const on = features.filter(f => f.enabled === true || f.enabled === 'mixed');
    const needs = on.filter(f => f.needsSetup);
    const mixed = features.filter(f => f.enabled === 'mixed');
    document.getElementById('feat-on').textContent = `${on.length} of ${features.length} on`;
    const pills = [];
    pills.push(needs.length
        ? `<span class="ocs__admin-pill ocs__admin-pill--warn"><span aria-hidden="true">!</span> ${needs.length} need setup</span>`
        : `<span class="ocs__admin-pill ocs__admin-pill--ok"><span aria-hidden="true">&#10003;</span> All set up</span>`);
    if (mixed.length) pills.push(`<span class="ocs__admin-pill ocs__admin-pill--warn">${mixed.length} differ between backends</span>`);
    const notBuilt = on.filter(f => !f.inBuild);
    if (notBuilt.length) pills.push(`<span class="ocs__admin-pill ocs__admin-pill--warn">${notBuilt.length} need a website rebuild</span>`);
    document.getElementById('feat-pills').innerHTML = pills.join('');

    const card = document.getElementById('setup-card');
    card.hidden = needs.length === 0;
    document.getElementById('setup-list').innerHTML = needs.map(f => {
        const missing = f.missingRequired.map(s => s.key).join(', ');
        return `<li><span><strong>${esc(f.name)}</strong><br><small>Missing: ${esc(missing)}</small></span>`
            + `<a class="ocs__btn small accent" href="${esc(withMock(`${base}/admin/features/?f=${encodeURIComponent(f.id)}`))}">Setup guide<span class="ocs__admin-sr"> for ${esc(f.name)}</span></a></li>`;
    }).join('');
}

function renderLinks(features) {
    const isOn = id => features.some(f => f.id === id && (f.enabled === true || f.enabled === 'mixed'));
    const links = [
        { href: withMock(`${base}/admin/features/`), title: 'Feature Manager', text: 'Turn features on or off and follow each setup guide.' },
        { href: `${BACKENDS.spring.uri}/mvc/person/read`, title: 'Users and roles', text: 'Create accounts, reset passwords and change roles (Spring admin).' },
        { href: `${BACKENDS.spring.uri}/mvc/groups/read`, title: 'Groups', text: 'Create groups and add people to them (Spring admin).' },
        { href: `${BACKENDS.flask.uri}/users/table2`, title: 'Flask users', text: 'User table on the Flask backend.' },
        { href: `${BACKENDS.flask.uri}/sections/`, title: 'Sections', text: 'Sections/classes on the Flask backend.' },
    ];
    if (isOn('analytics')) links.push({ href: `${base}/analytics-dashboard`, title: 'Analytics', text: 'Usage and activity across the site.' });
    document.getElementById('admin-links').innerHTML = links.map(l =>
        `<li><a href="${esc(l.href)}"><strong>${esc(l.title)}</strong><span>${esc(l.text)}</span></a></li>`).join('');
}

async function main() {
    mockBanner();
    const [who, catalog] = await Promise.all([getIdentity(), loadCatalog()]);
    if (who.role === 'anon') { showGate('signin'); return; }
    if (who.role !== 'admin') {
        const kit = await getKitPublic();
        if (who.role === 'staff') {
            showGate('staff');
            renderStaff(kit, catalog);
        } else {
            showGate('denied', roleLabel(kit, who.role));
        }
        return;
    }

    const [admin, counts] = await Promise.all([getKitAdmin(), getUserCounts()]);
    const okAny = BACKEND_IDS.some(b => admin[b].ok);
    const denied = BACKEND_IDS.every(b => !admin[b].ok && (admin[b].status === 401 || admin[b].status === 403));
    if (denied) { showGate('denied', 'not an Admin on the backends'); return; }

    let kit;
    if (okAny) {
        const r = admin.spring.ok ? admin.spring : admin.flask;
        kit = r.data;
    } else {
        kit = await getKitPublic();
        if (!kit) {
            showGate('content');
            announce(BACKEND_IDS.map(b => describeFailure(admin[b])).join(' '), 'error');
            return;
        }
    }
    showGate('content');
    const features = buildFeatures(catalog, admin);
    renderKit(kit, catalog, admin);
    renderRoles(kit, counts);
    renderFeatures(features);
    renderLinks(features);
    const problems = BACKEND_IDS.filter(b => !admin[b].ok).map(b => describeFailure(admin[b]));
    if (problems.length) announce(problems.join(' '), 'warn');
}

main().catch(err => {
    showGate('none');
    announce(`Something went wrong loading the dashboard: ${err.message}`, 'error');
});
