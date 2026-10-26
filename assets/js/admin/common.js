// Shared helpers for the admin dashboard pages (/admin/ and /admin/features/).
import { BACKENDS, BACKEND_IDS, MOCK } from './kit-api.js';

/** Build-time facts about this website, written by the page (never secret values). */
export const SITE = window.OCS_ADMIN_SITE || { built: null, config_features: [], kit_configured: {}, baseurl: '' };
if (!Array.isArray(SITE.built)) SITE.built = null;
if (!Array.isArray(SITE.config_features)) SITE.config_features = [];

/** Tell the site-wide kit runtime (assets/js/kit-features.js) to drop its cached /api/kit answer. */
export function refreshKitRuntime() {
    try { sessionStorage.removeItem('ocs-kit-runtime'); } catch (_) { /* storage off */ }
    if (window.OCS_KIT && typeof window.OCS_KIT.refresh === 'function') window.OCS_KIT.refresh(true);
}

export function esc(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Minimal inline markdown for catalog text: `code` only (everything else escaped). */
export function md(text) {
    return esc(text).replace(/`([^`]+)`/g, '<code>$1</code>');
}

export const WHERE = {
    flask: { short: 'Flask .env', long: 'flask/.env in your install folder' },
    spring: { short: 'Spring .env', long: 'spring/.env in your install folder' },
    pages: { short: 'Website _config.yml', long: 'kit: block, public, never put secrets here' },
};

/** Announce a status message to screen readers and show it in the page's status area. */
export function announce(message, kind = 'info') {
    const box = document.getElementById('admin-status');
    if (!box) return;
    box.className = `adm__status adm__status--${kind}`;
    box.textContent = message;
    box.hidden = !message;
}

/** Shows the mock-mode banner when ?mock= is on. */
export function mockBanner() {
    if (!MOCK) return;
    const el = document.getElementById('admin-mock');
    if (el) {
        el.hidden = false;
        el.textContent = `Mock mode (${MOCK}): sample data, nothing is saved to a backend. Remove ?mock from the URL for real data.`;
    }
}

/** Show exactly one of the gate panels: loading | signin | denied | content. */
export function showGate(which, extra) {
    for (const id of ['loading', 'signin', 'denied', 'staff', 'content']) {
        const el = document.getElementById(`admin-gate-${id}`);
        if (el) el.hidden = id !== which;
    }
    if (extra && which === 'denied') {
        const el = document.getElementById('admin-gate-denied-role');
        if (el) el.textContent = extra;
    }
}

function settingConfigured(setting, admin) {
    if (setting.service === 'pages') {
        const key = setting.key.replace(/^kit\./, '');
        return key in SITE.kit_configured ? !!SITE.kit_configured[key] : null;
    }
    const r = admin && admin[setting.service];
    if (!r || !r.ok) return null; // unknown: backend unreachable or not an admin there
    const d = r.data.feature_details.find(x => x.id === setting.feature);
    const s = d && d.setup && (d.setup.settings || []).find(x => x.key === setting.key);
    return s ? !!s.configured : null;
}

/**
 * One view model per feature, merging the catalog (names, descriptions, every setting incl.
 * website ones) with each backend's admin payload (enabled, source, configured flags).
 */
export function buildFeatures(catalog, admin) {
    const ids = new Set(Object.keys(catalog.features || {}));
    for (const b of BACKEND_IDS) {
        const r = admin && admin[b];
        if (r && r.ok) r.data.feature_details.forEach(d => ids.add(d.id));
    }
    const buildList = SITE.built; // null: build selection unknown, assume the pages are there
    const out = [];
    for (const id of ids) {
        const cat = (catalog.features || {})[id] || {};
        const backends = {};
        let any = null;
        for (const b of BACKEND_IDS) {
            const r = admin && admin[b];
            const d = r && r.ok ? r.data.feature_details.find(x => x.id === id) : null;
            backends[b] = r && r.ok
                ? (d ? { reachable: true, known: true, enabled: !!d.enabled, source: d.source || 'kit', ready: d.ready !== false,
                    updated_by: d.updated_by, updated_at: d.updated_at, settingsCount: ((d.setup || {}).settings || []).length }
                    : { reachable: true, known: false })
                : { reachable: false, failure: r };
            any = any || d;
        }
        const setup = cat.setup || (any && any.setup) || { summary: '', settings: [], steps: [], verify: '' };
        const settings = (setup.settings || []).map(s => ({ ...s, service: s.service || 'flask', feature: id }));
        settings.forEach(s => { s.configured = settingConfigured(s, admin); });
        const known = BACKEND_IDS.filter(b => backends[b].reachable && backends[b].known);
        const states = known.map(b => backends[b].enabled);
        const enabled = states.length === 0 ? null : states.every(Boolean) ? true : states.some(Boolean) ? 'mixed' : false;
        const missingRequired = settings.filter(s => s.required && s.configured === false);
        const unknownRequired = settings.filter(s => s.required && s.configured === null);
        out.push({
            id,
            name: cat.name || (any && any.name) || id,
            description: cat.description || (any && any.description) || '',
            category: cat.category || (any && any.category) || 'general',
            labels: cat.labels || (any && any.labels) || [],
            always_on: !!(cat.always_on || (any && any.always_on)),
            backends,
            enabled,
            settings,
            summary: setup.summary || '',
            steps: setup.steps || [],
            verify: setup.verify || '',
            missingRequired,
            unknownRequired,
            needsSetup: missingRequired.length > 0,
            inBuild: !buildList || buildList.includes(id) || id === 'core' || !!(cat.always_on),
        });
    }
    const order = ['core', 'general', 'education'];
    out.sort((a, b) => (order.indexOf(a.category) - order.indexOf(b.category)) || a.name.localeCompare(b.name));
    return out;
}

export function sourceText(source) {
    return { kit: 'kit default', env: 'server .env', admin: 'changed by an admin' }[source] || source || 'unknown';
}

export function backendName(b) {
    return BACKENDS[b] ? BACKENDS[b].name : b;
}

/** Copy text to the clipboard; resolves true on success. */
export async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (_) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'absolute';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
        ta.remove();
        return ok;
    }
}

/** Keeps focus inside an open dialog and closes it on Escape. Returns a release function. */
export function trapFocus(dialog, onClose) {
    const previous = document.activeElement;
    const selector = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';
    function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
        if (e.key !== 'Tab') return;
        const items = [...dialog.querySelectorAll(selector)].filter(el => el.offsetParent !== null);
        if (!items.length) return;
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    dialog.addEventListener('keydown', onKey);
    return () => {
        dialog.removeEventListener('keydown', onKey);
        if (previous && previous.focus) previous.focus();
    };
}

/** Read-only list of features for staff (Teacher/Manager/Editor): names and On/Off only. */
export function renderStaff(kit, catalog) {
    const list = document.getElementById('staff-features');
    const details = (kit && kit.feature_details) || [];
    const enabled = new Set((kit && kit.features) || []);
    const rows = details.length ? details : Object.entries(catalog.features).map(([id, f]) => ({ id, name: f.name }));
    list.innerHTML = rows.map(f => {
        const on = f.enabled != null ? f.enabled : enabled.has(f.id);
        return `<li><span>${esc(f.name)}</span><span class="ocs__admin-pill ${on ? 'ocs__admin-pill--on' : 'ocs__admin-pill--off'}">${on ? 'On' : 'Off'}</span></li>`;
    }).join('');
    if (!kit) announce('Could not reach the backends to list features.', 'warn');
}
