---
---
// Admin dashboard data layer: who is signed in, and the kit/feature state of BOTH backends.
//
// Backend contract (Flask at pythonURI and Spring at javaURI implement the same thing):
//   GET    /api/kit                       public: kit, kit_name, features, feature_details, roles, signup_role
//   GET    /api/kit/admin                 Admin only (401 signed out, 403 not an Admin): adds source,
//                                          setup (this backend's settings with configured: bool) and ready
//   PUT    /api/kit/admin/features        {"features": {"<id>": true|false}} -> admin payload
//   DELETE /api/kit/admin/features/<id>   clear the admin override (back to kit/.env default)
//   PUT    /api/kit/admin/kit             {"kit": "vanilla|education|business"}: apply a preset and clear
//                                          per-feature overrides -> admin payload
//   DELETE /api/kit/admin/kit             back to the server's env configuration -> admin payload
// GET /api/kit and /api/kit/admin also carry kit_source (admin | env | default) and customized (bool);
// /api/kit/admin adds presets: {id: {name, description, features: [ids], roles: {admin|staff|member: {label}}}}.
//
// Mock mode (no backends needed): add ?mock=1 to the page URL (admin), or ?mock=staff,
// ?mock=member, ?mock=anon. &mockfail=flask|spring makes writes fail on that backend,
// &mockfail=403 makes every write return 403, &mockfailonce=1 fails only the first write (to try a
// retry), &mockdown=1|flask|spring makes reads and writes fail. Mock state lives in sessionStorage only.

import { pythonURI, javaURI, fetchOptions } from '{{ site.baseurl }}/assets/js/api/config.js';
import FALLBACK_CATALOG from '{{ site.baseurl }}/assets/js/admin/catalog-fallback.js';

const BASEURL = '{{ site.baseurl }}';
export const BACKENDS = {
    flask: { id: 'flask', name: 'Flask', uri: pythonURI, folder: 'flask' },
    spring: { id: 'spring', name: 'Spring', uri: javaURI, folder: 'spring' },
};
export const BACKEND_IDS = ['flask', 'spring'];

const params = new URLSearchParams(location.search);
const mockParam = params.get('mock');
export const MOCK = mockParam ? (mockParam === '1' || mockParam === 'true' ? 'admin' : mockParam) : null;
const MOCK_FAIL = params.get('mockfail');
const MOCK_DOWN = params.get('mockdown');

// ------------------------------------------------------------------ catalog

/**
 * The kit catalog (names, descriptions, labels, setup guides). kits/ is excluded from the
 * site build, so the public parts are bundled in catalog-fallback.js (regenerate it when
 * kits/catalog.json changes; see ADMIN-DASHBOARD-MERGE.md).
 */
export function loadCatalog() {
    return Promise.resolve(FALLBACK_CATALOG);
}

// ------------------------------------------------------------------ http helpers

async function call(backend, method, path, body) {
    const opts = { ...fetchOptions, method, cache: 'no-store' };
    if (body !== undefined) opts.body = JSON.stringify(body);
    try {
        const res = await fetch(`${BACKENDS[backend].uri}${path}`, opts);
        let data = null;
        const type = res.headers.get('content-type') || '';
        if (type.includes('application/json')) {
            try { data = await res.json(); } catch (_) { data = null; }
        }
        return { backend, ok: res.ok, status: res.status, data };
    } catch (err) {
        return { backend, ok: false, status: 0, data: null, error: String(err && err.message || err) };
    }
}

/** Human explanation of a failed call. */
export function describeFailure(result) {
    if (!result || result.ok) return '';
    const name = BACKENDS[result.backend] ? BACKENDS[result.backend].name : result.backend;
    switch (result.status) {
        case 0: return `${name} backend did not answer (is it running? Check ${BACKENDS[result.backend].uri}).`;
        case 401: return `You are signed out of the ${name} backend. Sign in again.`;
        case 403: return `${name} says your account is not an Admin.`;
        case 404: return `${name} backend does not have this kit or feature API yet (update the ${name} backend).`;
        default: {
            const msg = result.data && (result.data.message || result.data.error);
            return `${name} answered ${result.status}${msg ? ': ' + msg : ''}.`;
        }
    }
}

// ------------------------------------------------------------------ identity

const SPRING_ROLE = { ROLE_ADMIN: 'admin', ROLE_TEACHER: 'staff' };
const FLASK_ROLE = { Admin: 'admin', Teacher: 'staff' };
const RANK = { anon: 0, member: 1, staff: 2, admin: 3 };

function springRole(person) {
    const names = (person.roles || []).map(r => (typeof r === 'string' ? r : r.name));
    if (names.includes('ROLE_ADMIN')) return 'admin';
    if (names.some(n => SPRING_ROLE[n] === 'staff')) return 'staff';
    return 'member';
}

function flaskRole(user) {
    if (user.is_admin || user.role === 'Admin') return 'admin';
    if (user.is_teacher || FLASK_ROLE[user.role] === 'staff') return 'staff';
    return 'member';
}

/**
 * Who is signed in, from both backends. role is the canonical id (admin | staff | member)
 * or 'anon'. The highest role either backend reports is used for what the page SHOWS; every
 * admin request is still checked by the backend itself.
 */
export async function getIdentity() {
    if (MOCK) {
        const fx = await mockFixture();
        const who = fx.identities[MOCK];
        return who ? { ...who, perBackend: { flask: who.role, spring: who.role } } : { role: 'anon', perBackend: {} };
    }
    const [s, f] = await Promise.all([call('spring', 'GET', '/api/person/get'), call('flask', 'GET', '/api/id')]);
    const perBackend = {};
    let uid = null, name = null;
    if (s.ok && s.data) { perBackend.spring = springRole(s.data); uid = s.data.uid; name = s.data.name; }
    if (f.ok && f.data) { perBackend.flask = flaskRole(f.data); uid = uid || f.data.uid; name = name || f.data.name; }
    let role = 'anon';
    for (const r of Object.values(perBackend)) if (RANK[r] > RANK[role]) role = r;
    return { uid, name, role, perBackend };
}

// ------------------------------------------------------------------ kit state

/** Public kit info from whichever backend answers first (Spring preferred). */
export async function getKitPublic() {
    if (MOCK) {
        const st = await mockState();
        const p = st.spring;
        return {
            kit: p.kit, kit_name: p.kit_name, features: p.features, roles: p.roles, signup_role: p.signup_role,
            kit_source: p.kit_source, customized: p.customized,
            feature_details: p.feature_details.map(({ id, name, category, labels, enabled }) => ({ id, name, category, labels, enabled })),
        };
    }
    const results = await Promise.all(BACKEND_IDS.map(b => call(b, 'GET', '/api/kit')));
    const ok = results.find(r => r.backend === 'spring' && r.ok && r.data) || results.find(r => r.ok && r.data);
    if (!ok) return null;
    const d = ok.data;
    return { ...d, kit_name: d.kit_name || d.name };
}

/** Admin payload from both backends: { flask: result, spring: result }. */
export async function getKitAdmin() {
    if (MOCK) return mockCall('GET');
    const results = await Promise.all(BACKEND_IDS.map(b => call(b, 'GET', '/api/kit/admin')));
    return Object.fromEntries(results.map(r => [r.backend, normalize(r)]));
}

/** Turn a feature on/off on both backends. Returns { flask: result, spring: result }. */
export async function setFeature(id, enabled) {
    if (MOCK) {
        return mockCall('PUT', (st, fx) => {
            const f = fx.feature_details.find(d => d.id === id);
            if (f && f.always_on && !enabled) return `'${id}' is always on`;
            st.overrides[id] = !!enabled;
            return null;
        });
    }
    const body = { features: { [id]: !!enabled } };
    const results = await Promise.all(BACKEND_IDS.map(b => call(b, 'PUT', '/api/kit/admin/features', body)));
    return Object.fromEntries(results.map(r => [r.backend, normalize(r)]));
}

/** Clear the admin override on both backends (back to the kit / server .env default). */
export async function resetFeature(id) {
    if (MOCK) return mockCall('DELETE', (st) => { delete st.overrides[id]; return null; });
    const results = await Promise.all(BACKEND_IDS.map(b => call(b, 'DELETE', `/api/kit/admin/features/${encodeURIComponent(id)}`)));
    return Object.fromEntries(results.map(r => [r.backend, normalize(r)]));
}

/**
 * Apply a kit preset on the given backends (a retry passes only the ones that failed).
 * A 200 that does not report the requested kit counts as a failure: never claim what did not happen.
 */
export async function applyKit(kit, backends = BACKEND_IDS) {
    const results = MOCK
        ? await mockCall('PUT', (st) => { st.kit = kit; st.kit_source = 'admin'; st.overrides = {}; return null; }, backends)
        : Object.fromEntries((await Promise.all(backends.map(b => call(b, 'PUT', '/api/kit/admin/kit', { kit })))).map(r => [r.backend, normalize(r)]));
    for (const b of backends) {
        const r = results[b];
        if (r.ok && r.data.kit !== kit) {
            results[b] = { ...r, ok: false, data: { message: `it still reports the ${r.data.kit_name || r.data.kit} kit` } };
        }
    }
    return results;
}

/** Back to each server's env configuration on the given backends. */
export async function resetKit(backends = BACKEND_IDS) {
    if (MOCK) {
        return mockCall('DELETE', (st, fx) => { st.kit = fx.kit; st.kit_source = 'env'; st.overrides = {}; return null; }, backends);
    }
    const results = await Promise.all(backends.map(b => call(b, 'DELETE', '/api/kit/admin/kit')));
    return Object.fromEntries(results.map(r => [r.backend, normalize(r)]));
}

function normalize(r) {
    if (r.ok && r.data && !r.data.kit_name && r.data.name) r.data.kit_name = r.data.name;
    if (r.ok && (!r.data || !Array.isArray(r.data.feature_details))) {
        return { ...r, ok: false, status: r.status || 500, data: { message: 'unexpected response' } };
    }
    return r;
}

/** Users by canonical role (admin | staff | member), from Spring's person list. null if unavailable. */
export async function getUserCounts() {
    let people;
    if (MOCK) {
        people = (await mockFixture()).people;
    } else {
        const r = await call('spring', 'GET', '/api/people');
        if (!r.ok || !Array.isArray(r.data)) return null;
        people = r.data;
    }
    const counts = { admin: 0, staff: 0, member: 0 };
    for (const p of people) counts[springRole(p)] += 1;
    return { total: people.length, counts };
}

// ------------------------------------------------------------------ mock backend

let fixturePromise = null;
function mockFixture() {
    if (!fixturePromise) {
        fixturePromise = fetch(`${BASEURL}/assets/js/admin/mock/kit-admin.json`).then(r => r.json());
    }
    return fixturePromise;
}

const MOCK_STATE_KEY = 'ocs-admin-mock-state';
const MOCK_PUBLIC_KEY = 'ocs-kit-mock-public';   // read by assets/js/kit-features.js
const MOCK_FAILED_KEY = 'ocs-admin-mock-failed';

function readMock() {
    try { return JSON.parse(sessionStorage.getItem(MOCK_STATE_KEY) || '{}'); } catch (_) { return {}; }
}
function writeMock(o) {
    try { sessionStorage.setItem(MOCK_STATE_KEY, JSON.stringify(o)); } catch (_) { /* private mode */ }
}

/** The backends' `presets`: in mock mode, from the catalog so the samples cannot drift from it. */
function mockPresets() {
    const out = {};
    for (const [id, k] of Object.entries(FALLBACK_CATALOG.kits)) {
        const roles = {};
        for (const [r, v] of Object.entries(k.roles || {})) roles[r] = { label: v.label };
        out[id] = { name: k.name, description: k.description, features: k.features, roles };
    }
    return out;
}

/** Fixture + what mock Admins did: fixture = the server's env configuration. */
async function mockState() {
    const fx = await mockFixture();
    const saved = readMock();
    const presets = mockPresets();
    const out = {};
    const pub = {};
    for (const b of BACKEND_IDS) {
        const p = JSON.parse(JSON.stringify(fx[b]));
        const st = saved[b] || { kit: p.kit, kit_source: 'env', overrides: {} };
        if (st.kit_source === 'admin') {
            const preset = presets[st.kit];
            p.kit = st.kit;
            p.kit_name = preset.name;
            p.roles = preset.roles;
            for (const d of p.feature_details) {
                d.enabled = !!d.always_on || preset.features.includes(d.id);
                d.source = 'kit';
            }
        }
        for (const d of p.feature_details) {
            if (d.id in st.overrides) {
                d.enabled = st.overrides[d.id];
                d.source = 'admin';
                d.updated_by = 'admin';
                d.updated_at = new Date().toISOString();
            }
        }
        p.features = p.feature_details.filter(d => d.enabled).map(d => d.id);
        p.kit_source = st.kit_source;
        p.customized = Object.keys(st.overrides).length > 0;
        p.presets = presets;
        out[b] = p;
        pub[b] = { kit: p.kit, kit_name: p.kit_name, features: p.features, roles: p.roles, kit_source: p.kit_source, customized: p.customized };
    }
    try { sessionStorage.setItem(MOCK_PUBLIC_KEY, JSON.stringify(pub)); } catch (_) { /* private mode */ }
    return out;
}

function mockWriteFails(b) {
    if (MOCK_DOWN === '1' || MOCK_DOWN === b) return true;
    if (MOCK_FAIL !== b) return false;
    if (!params.has('mockfailonce')) return true;
    if (sessionStorage.getItem(MOCK_FAILED_KEY)) return false;
    sessionStorage.setItem(MOCK_FAILED_KEY, '1');
    return true;
}

async function mockCall(method, change, targets = BACKEND_IDS) {
    await new Promise(r => setTimeout(r, 250));
    const results = {};
    const saved = readMock();
    const fx = await mockFixture();
    for (const b of targets) {
        if (MOCK !== 'admin') {
            results[b] = { backend: b, ok: false, status: MOCK === 'anon' ? 401 : 403, data: { message: 'Admin only' } };
            continue;
        }
        if (method === 'GET') {
            results[b] = MOCK_DOWN === '1' || MOCK_DOWN === b
                ? { backend: b, ok: false, status: 0, data: null, error: 'mock failure' }
                : { backend: b, ok: true, status: 200 };
            continue;
        }
        if (MOCK_FAIL === '403') {
            results[b] = { backend: b, ok: false, status: 403, data: { message: 'Admin only' } };
            continue;
        }
        if (mockWriteFails(b)) {
            results[b] = { backend: b, ok: false, status: 0, data: null, error: 'mock failure' };
            continue;
        }
        const st = saved[b] || { kit: fx[b].kit, kit_source: 'env', overrides: {} };
        const refusal = change && change(st, fx[b]);
        if (refusal) { results[b] = { backend: b, ok: false, status: 400, data: { message: refusal } }; continue; }
        saved[b] = st;
        results[b] = { backend: b, ok: true, status: 200 };
    }
    writeMock(saved);
    const state = await mockState();
    for (const b of targets) if (results[b].ok) results[b].data = state[b];
    return results;
}
