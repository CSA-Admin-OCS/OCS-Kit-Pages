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
//
// Mock mode (no backends needed): add ?mock=1 to the page URL (admin), or ?mock=staff,
// ?mock=member, ?mock=anon. &mockfail=flask|spring makes writes fail on that backend,
// &mockfail=403 makes every write return 403. Mock state lives in sessionStorage only.

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

// ------------------------------------------------------------------ catalog

let catalogPromise = null;
/** The kit catalog: /kits/catalog.json when this site serves it, else the bundled copy. */
export function loadCatalog() {
    if (!catalogPromise) {
        catalogPromise = fetch(`${BASEURL}/kits/catalog.json`, { cache: 'no-cache' })
            .then(r => (r.ok ? r.json() : null))
            .then(c => (c && c.features && c.labels ? c : FALLBACK_CATALOG))
            .catch(() => FALLBACK_CATALOG);
    }
    return catalogPromise;
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
        case 404: return `${name} backend has no feature API yet (update the ${name} backend).`;
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
    if (MOCK) return mockCall('PUT', id, enabled);
    const body = { features: { [id]: !!enabled } };
    const results = await Promise.all(BACKEND_IDS.map(b => call(b, 'PUT', '/api/kit/admin/features', body)));
    return Object.fromEntries(results.map(r => [r.backend, normalize(r)]));
}

/** Clear the admin override on both backends (back to the kit / server .env default). */
export async function resetFeature(id) {
    if (MOCK) return mockCall('DELETE', id);
    const results = await Promise.all(BACKEND_IDS.map(b => call(b, 'DELETE', `/api/kit/admin/features/${encodeURIComponent(id)}`)));
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

const MOCK_KEY = 'ocs-admin-mock-overrides';
function readOverrides() {
    try { return JSON.parse(sessionStorage.getItem(MOCK_KEY) || '{}'); } catch (_) { return {}; }
}
function writeOverrides(o) {
    try { sessionStorage.setItem(MOCK_KEY, JSON.stringify(o)); } catch (_) { /* private mode */ }
}

async function mockState() {
    const fx = await mockFixture();
    const over = readOverrides();
    const out = {};
    for (const b of BACKEND_IDS) {
        const p = JSON.parse(JSON.stringify(fx[b]));
        const mine = over[b] || {};
        for (const d of p.feature_details) {
            if (d.id in mine) {
                d.enabled = mine[d.id];
                d.source = 'admin';
                d.updated_by = 'admin';
                d.updated_at = new Date().toISOString();
            }
        }
        p.features = p.feature_details.filter(d => d.enabled).map(d => d.id);
        out[b] = p;
    }
    return out;
}

async function mockCall(method, id, enabled) {
    await new Promise(r => setTimeout(r, 250));
    const results = {};
    const over = readOverrides();
    for (const b of BACKEND_IDS) {
        if (MOCK !== 'admin') {
            results[b] = { backend: b, ok: false, status: MOCK === 'anon' ? 401 : 403, data: { message: 'Admin only' } };
            continue;
        }
        if (method !== 'GET' && (MOCK_FAIL === '403')) {
            results[b] = { backend: b, ok: false, status: 403, data: { message: 'Admin only' } };
            continue;
        }
        if (method !== 'GET' && MOCK_FAIL === b) {
            results[b] = { backend: b, ok: false, status: 0, data: null, error: 'mock failure' };
            continue;
        }
        over[b] = over[b] || {};
        if (method === 'PUT') {
            const fx = await mockFixture();
            const f = fx[b].feature_details.find(d => d.id === id);
            if (f && f.always_on && !enabled) {
                results[b] = { backend: b, ok: false, status: 400, data: { message: `'${id}' is always on` } };
                continue;
            }
            over[b][id] = !!enabled;
        }
        if (method === 'DELETE') delete over[b][id];
        results[b] = { backend: b, ok: true, status: 200 };
    }
    writeOverrides(over);
    const state = await mockState();
    for (const b of BACKEND_IDS) if (results[b].ok) results[b].data = state[b];
    return results;
}
