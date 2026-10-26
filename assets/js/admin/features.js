// Feature Manager (/admin/features/): toggle features on both backends, setup guides.
import { BACKENDS, BACKEND_IDS, MOCK, loadCatalog, getIdentity, getKitPublic, getKitAdmin, setFeature, resetFeature, describeFailure } from './kit-api.js';
import { SITE, WHERE, esc, md, announce, mockBanner, showGate, buildFeatures, sourceText, backendName, copyText, trapFocus, renderStaff, refreshKitRuntime } from './common.js';

const state = { catalog: null, admin: null, kit: null, features: [], busy: new Set(), results: {}, guideId: null };
const CONFIRM_LABELS = ['privacy-sensitive', 'needs-api-key', 'third-party-data', 'needs-external-service'];
const ALERT_LABELS = new Set(['privacy-sensitive', 'needs-api-key', 'third-party-data', 'needs-external-service', 'runs-code', 'user-content']);

const $ = (id) => document.getElementById(id);
const feature = (id) => state.features.find(f => f.id === id);

// ------------------------------------------------------------------ rendering: cards

function labelChip(label) {
    const tip = (state.catalog.labels || {})[label] || '';
    const alert = ALERT_LABELS.has(label) ? ' ocs__admin-label--alert' : '';
    return `<span class="ocs__admin-label${alert}" tabindex="0" data-tip="${esc(tip)}">${esc(label)}<span class="ocs__admin-sr">: ${esc(tip)}</span></span>`;
}

function enabledText(f) {
    if (f.always_on) return 'Always on';
    if (f.enabled === 'mixed') return 'On in one backend only';
    if (f.enabled === null) return 'Unknown';
    return f.enabled ? 'On' : 'Off';
}

function readinessPill(f) {
    if (f.settings.length === 0) return '<span class="ocs__admin-pill ocs__admin-pill--ok"><span aria-hidden="true">&#10003;</span> No setup needed</span>';
    if (f.needsSetup) return '<span class="ocs__admin-pill ocs__admin-pill--warn"><span aria-hidden="true">!</span> Needs setup</span>';
    if (f.unknownRequired.length) return '<span class="ocs__admin-pill ocs__admin-pill--muted"><span aria-hidden="true">?</span> Setup unknown</span>';
    return '<span class="ocs__admin-pill ocs__admin-pill--ok"><span aria-hidden="true">&#10003;</span> Ready</span>';
}

function backendLine(f, b) {
    const s = f.backends[b];
    const name = esc(backendName(b));
    if (!s.reachable) return `<li><span>${name}</span><span class="ocs__admin-pill ocs__admin-pill--muted">not reachable</span></li>`;
    if (!s.known) return `<li><span>${name}</span><span class="ocs__admin-pill ocs__admin-pill--muted">not in this backend</span></li>`;
    const settingsHere = f.settings.filter(x => x.service === b);
    const missing = settingsHere.filter(x => x.required && x.configured === false);
    const ready = settingsHere.length === 0
        ? '<span class="ocs__admin-pill ocs__admin-pill--muted">no settings</span>'
        : missing.length
            ? `<span class="ocs__admin-pill ocs__admin-pill--warn"><span aria-hidden="true">!</span> Needs ${esc(missing.map(m => m.key).join(', '))}</span>`
            : '<span class="ocs__admin-pill ocs__admin-pill--ok"><span aria-hidden="true">&#10003;</span> Ready</span>';
    const by = s.source === 'admin' && s.updated_by ? ` by ${esc(s.updated_by)}` : '';
    return `<li><span>${name}: <strong>${s.enabled ? 'On' : 'Off'}</strong> <small>(${esc(sourceText(s.source))}${by})</small></span>${ready}</li>`;
}

function cardHtml(f) {
    const on = f.enabled === true || f.enabled === 'mixed';
    const busy = state.busy.has(f.id);
    const anyAdmin = BACKEND_IDS.some(b => f.backends[b].known && f.backends[b].source === 'admin');
    const pills = [
        `<span class="ocs__admin-pill ${on ? 'ocs__admin-pill--on' : 'ocs__admin-pill--off'}">${esc(enabledText(f))}</span>`,
        on || f.settings.length ? readinessPill(f) : '',
        on && !f.inBuild ? '<span class="ocs__admin-pill ocs__admin-pill--warn"><span aria-hidden="true">!</span> Website rebuild needed</span>' : '',
    ].join('');
    const toggle = `<label class="ocs__toggle">
        <input type="checkbox" class="ocs__toggle-input" role="switch" data-toggle="${esc(f.id)}"
          aria-labelledby="fname-${esc(f.id)}" aria-describedby="fstatus-${esc(f.id)}"
          ${on ? 'checked' : ''} ${f.always_on || busy ? 'disabled' : ''}>
        <span class="ocs__toggle-track" aria-hidden="true"></span>
        <span class="ocs__toggle-label" aria-hidden="true">${busy ? 'Saving' : f.always_on ? 'Locked' : on ? 'On' : 'Off'}</span>
      </label>`;
    const result = state.results[f.id];
    return `<li class="ocs__admin-feature${on ? ' ocs__admin-feature--on' : ''}" id="feature-${esc(f.id)}">
      <div class="ocs__admin-feature-top">
        <h3 id="fname-${esc(f.id)}">${esc(f.name)}</h3>
        ${toggle}
      </div>
      <p>${md(f.description)}</p>
      <div class="ocs__admin-row" aria-label="Labels">${f.labels.map(labelChip).join('')}</div>
      <div class="ocs__admin-row" id="fstatus-${esc(f.id)}">${pills}</div>
      <ul class="ocs__admin-backends" aria-label="Status per backend">${BACKEND_IDS.map(b => backendLine(f, b)).join('')}</ul>
      <div aria-live="polite" id="fresult-${esc(f.id)}">${result ? `<div class="ocs__admin-result ocs__admin-result--${result.kind}">${result.html}</div>` : ''}</div>
      <div class="ocs__admin-feature-actions">
        <button type="button" class="ocs__btn small ${f.needsSetup && on ? 'accent fill' : ''}" data-guide="${esc(f.id)}">Setup guide<span class="ocs__admin-sr"> for ${esc(f.name)}</span></button>
        ${anyAdmin && !f.always_on ? `<button type="button" class="ocs__btn small" data-reset="${esc(f.id)}" ${busy ? 'disabled' : ''}>Reset to kit default<span class="ocs__admin-sr"> for ${esc(f.name)}</span></button>` : ''}
      </div>
    </li>`;
}

function matches(f) {
    const q = ($('feature-search').value || '').trim().toLowerCase();
    const filter = $('feature-filter').value;
    const on = f.enabled === true || f.enabled === 'mixed';
    if (filter === 'on' && !on) return false;
    if (filter === 'off' && on) return false;
    if (filter === 'setup' && !(on && f.needsSetup)) return false;
    if (!q) return true;
    return [f.id, f.name, f.description, ...f.labels].join(' ').toLowerCase().includes(q);
}

function renderGroups() {
    const cats = state.catalog.categories || {};
    const order = ['core', 'general', 'education', ...Object.keys(cats).filter(c => !['core', 'general', 'education'].includes(c))];
    const isEducation = state.kit && state.kit.kit === 'education';
    const html = order.map(cat => {
        const items = state.features.filter(f => f.category === cat && matches(f));
        if (!items.length) return '';
        const info = cats[cat] || { name: cat, description: '' };
        const note = cat === 'education' && !isEducation
            ? ' This site does not run the Education kit, so these are usually not needed.' : '';
        return `<section class="ocs__admin-category" aria-labelledby="cat-${esc(cat)}">
          <h2 id="cat-${esc(cat)}">${esc(info.name)}</h2>
          <p>${esc(info.description)}${esc(note)}</p>
          <ul class="ocs__admin-features">${items.map(cardHtml).join('')}</ul>
        </section>`;
    }).join('');
    $('feature-groups').innerHTML = html || '<p class="ocs__card">No features match your search.</p>';
}

function rerenderCard(id, focusToggle) {
    const el = $(`feature-${id}`);
    const f = feature(id);
    if (!el || !f) { renderGroups(); return; }
    el.outerHTML = cardHtml(f);
    if (focusToggle) {
        const t = document.querySelector(`[data-toggle="${CSS.escape(id)}"]`);
        if (t && !t.disabled) t.focus();
    }
    const card = $(`feature-${id}`);
    const input = card && card.querySelector('[data-toggle]');
    if (input && f.enabled === 'mixed') input.indeterminate = true;
}

function refreshModel() {
    state.features = buildFeatures(state.catalog, state.admin);
}

// ------------------------------------------------------------------ actions

function confirmReasons(f) {
    const reasons = [];
    for (const l of CONFIRM_LABELS) {
        if (f.labels.includes(l)) reasons.push(`<li><strong>${esc(l)}</strong>: ${esc((state.catalog.labels || {})[l] || '')}</li>`);
    }
    if (f.category === 'education' && state.kit && state.kit.kit !== 'education') {
        reasons.push(`<li><strong>Educational feature</strong>: built for classrooms (Teachers and Students). Your site runs ${esc(state.kit.kit_name || state.kit.kit)}; it will work, but its pages talk about classes and students.</li>`);
    }
    return reasons;
}

function askConfirm(f) {
    const reasons = confirmReasons(f);
    if (!reasons.length) return Promise.resolve(true);
    const dlg = $('confirm-dialog');
    $('confirm-title').textContent = `Turn on ${f.name}?`;
    $('confirm-body').innerHTML = `<p>Please check before turning this on for everyone:</p><ul>${reasons.join('')}</ul>`
        + (f.settings.some(s => s.required) ? '<p>It needs setup before it fully works. The setup guide opens after you turn it on.</p>' : '');
    dlg.hidden = false;
    document.body.style.overflow = 'hidden';
    return new Promise(resolve => {
        let release = null;
        const done = (ok) => {
            dlg.hidden = true;
            document.body.style.overflow = '';
            $('confirm-ok').onclick = null;
            $('confirm-cancel').onclick = null;
            dlg.onclick = null;
            if (release) release();
            resolve(ok);
        };
        release = trapFocus(dlg, () => done(false));
        $('confirm-ok').onclick = () => done(true);
        $('confirm-cancel').onclick = () => done(false);
        dlg.onclick = (e) => { if (e.target === dlg) done(false); };
        $('confirm-cancel').focus();
    });
}

/** Apply per-backend results to state; returns a {kind, html, okAll} summary. */
function applyResults(results, verbDone) {
    const ok = BACKEND_IDS.filter(b => results[b].ok);
    const failed = BACKEND_IDS.filter(b => !results[b].ok);
    for (const b of ok) state.admin[b] = results[b];
    if (!failed.length) {
        return { kind: 'ok', okAll: true, html: `${esc(verbDone)} on both backends.` };
    }
    const reasons = failed.map(b => `<li>${esc(describeFailure(results[b]))}</li>`).join('');
    if (!ok.length) {
        const forbidden = failed.every(b => results[b].status === 403 || results[b].status === 401);
        return {
            kind: 'error', okAll: false,
            html: forbidden
                ? `Not saved: only Admins can change features.<ul>${reasons}</ul>`
                : `Not saved on either backend.<ul>${reasons}</ul>`,
        };
    }
    return {
        kind: 'warn', okAll: false,
        html: `${esc(verbDone)} on ${esc(ok.map(backendName).join(' and '))} only. The backends now disagree; fix the problem below, then press the switch again.<ul>${reasons}</ul>`,
    };
}

async function toggle(id, wantOn, input) {
    const f = feature(id);
    if (!f || f.always_on || state.busy.has(id)) return;
    if (wantOn) {
        const ok = await askConfirm(f);
        if (!ok) { if (input) input.checked = !wantOn; rerenderCard(id, true); return; }
    }
    state.busy.add(id);
    state.results[id] = { kind: 'ok', html: wantOn ? 'Turning on&hellip;' : 'Turning off&hellip;' };
    rerenderCard(id);
    const results = await setFeature(id, wantOn);
    state.busy.delete(id);
    const summary = applyResults(results, wantOn ? `Turned on ${f.name}` : `Turned off ${f.name}`);
    if (BACKEND_IDS.some(b => results[b].ok)) refreshKitRuntime();
    refreshModel();
    const after = feature(id);
    if (summary.okAll && wantOn && after.needsSetup) {
        summary.kind = 'warn';
        summary.html += ` It still needs setup: <button type="button" class="ocs__btn small accent fill" data-guide="${esc(id)}">Open the setup guide</button>`;
    }
    if (summary.okAll && wantOn && !after.inBuild) {
        summary.kind = 'warn';
        summary.html += ' Its pages are not in this website build yet; the setup guide explains how to add them.';
    }
    state.results[id] = summary;
    rerenderCard(id, true);
    announce(stripTags(summary.html), summary.kind === 'ok' ? 'ok' : summary.kind);
    if (summary.okAll && wantOn && (after.needsSetup || !after.inBuild)) openGuide(id);
    else if (state.guideId === id) renderGuide(id);
}

async function reset(id) {
    const f = feature(id);
    if (!f || state.busy.has(id)) return;
    state.busy.add(id);
    rerenderCard(id);
    const results = await resetFeature(id);
    state.busy.delete(id);
    const summary = applyResults(results, `Reset ${f.name} to the kit default`);
    if (BACKEND_IDS.some(b => results[b].ok)) refreshKitRuntime();
    refreshModel();
    const after = feature(id);
    if (summary.okAll) summary.html += ` It is now ${esc(enabledText(after).toLowerCase())}.`;
    state.results[id] = summary;
    rerenderCard(id);
    announce(stripTags(summary.html), summary.kind === 'ok' ? 'ok' : summary.kind);
}

function stripTags(html) {
    const d = document.createElement('div');
    d.innerHTML = html;
    d.querySelectorAll('button').forEach(b => b.remove());
    return d.textContent.trim();
}

async function reload(message) {
    state.admin = await getKitAdmin();
    refreshModel();
    renderGroups();
    if (state.guideId) renderGuide(state.guideId);
    const problems = BACKEND_IDS.filter(b => !state.admin[b].ok).map(b => describeFailure(state.admin[b]));
    if (problems.length) announce(problems.join(' '), 'warn');
    else if (message) announce(message, 'ok');
}

// ------------------------------------------------------------------ setup guide

const STEP_KEY = (id) => `ocs-admin-steps-${id}`;
function readSteps(id) {
    try { return JSON.parse(localStorage.getItem(STEP_KEY(id)) || '[]'); } catch (_) { return []; }
}
function writeSteps(id, done) {
    try { localStorage.setItem(STEP_KEY(id), JSON.stringify(done)); } catch (_) { /* storage off */ }
}

function placeholder(s) {
    if (s.example && !s.secret) return s.example;
    return s.secret ? 'your-key-here' : 'your-value-here';
}

function configuredPill(s) {
    if (s.configured === true) return '<span class="ocs__admin-pill ocs__admin-pill--ok"><span aria-hidden="true">&#10003;</span> Set</span>';
    if (s.configured === false) {
        return s.required
            ? '<span class="ocs__admin-pill ocs__admin-pill--bad"><span aria-hidden="true">&#10007;</span> Not set (required)</span>'
            : '<span class="ocs__admin-pill ocs__admin-pill--muted"><span aria-hidden="true">&#10007;</span> Not set (optional)</span>';
    }
    return '<span class="ocs__admin-pill ocs__admin-pill--muted"><span aria-hidden="true">?</span> Unknown (backend not reachable)</span>';
}

function snippet(text, label) {
    return `<div class="ocs__admin-snippet"><pre><code>${esc(text)}</code></pre>`
        + `<button type="button" class="ocs__btn small" data-copy="${esc(text)}">Copy<span class="ocs__admin-sr"> ${esc(label)}</span></button></div>`;
}

function settingsSection(f) {
    if (!f.settings.length) return '<p>No keys or settings are needed for this feature.</p>';
    const services = ['flask', 'spring', 'pages'].filter(svc => f.settings.some(s => s.service === svc));
    return services.map(svc => {
        const items = f.settings.filter(s => s.service === svc);
        const todo = items.filter(s => s.configured !== true);
        const list = items.map(s => `<li>
            <div class="ocs__admin-setting-head"><code>${esc(s.key.replace(/^kit\./, ''))}</code>${configuredPill(s)}</div>
            <p>${md(s.help)}${s.secret ? ' <em>Secret: keep it out of Git and never share it.</em>' : ''}</p>
            ${s.example ? `<p>Example: <code>${esc(s.example)}</code></p>` : ''}
            ${s.get_it ? `<p><a href="${esc(s.get_it)}" target="_blank" rel="noopener noreferrer">Get it here<span class="ocs__admin-sr"> (${esc(s.key)}, opens in a new tab)</span></a></p>` : ''}
          </li>`).join('');
        let how = '';
        if (svc === 'pages') {
            const yaml = 'kit:\n' + (todo.length ? todo : items).map(s => `  ${s.key.replace(/^kit\./, '')}: "${placeholder(s)}"`).join('\n');
            how = `<p>${todo.length ? 'Add' : 'These live'} in the <code>kit:</code> block of <code>_config.yml</code> in your website repository (values there are public, which is fine for these keys):</p>`
                + snippet(yaml, `_config.yml settings for ${f.name}`)
                + '<p>Then commit and push; GitHub rebuilds the site in a few minutes. (Running the site on your computer? Stop it and run <code>make</code> again.)</p>';
        } else {
            const env = (todo.length ? todo : items)
                .map(s => `${s.required ? '' : '# optional: '}${s.key}=${placeholder(s)}`).join('\n');
            const folder = BACKENDS[svc].folder;
            how = todo.length
                ? `<p>Open <code>${folder}/.env</code> in your install folder, add these lines with your real values${todo.some(x => !x.required) ? ' (to use an optional one, delete the <code># optional: </code> in front of it)' : ''}:</p>`
                  + snippet(env, `${backendName(svc)} .env lines for ${f.name}`)
                  + `<p>Then restart the ${esc(backendName(svc))} backend so it reads the file:</p>`
                  + snippet(`cd ${folder}\ndocker compose up -d`, `${backendName(svc)} restart command`)
                : `<p><span aria-hidden="true">&#10003;</span> Everything here is set in <code>${folder}/.env</code>.</p>`;
        }
        return `<h4 class="ocs__admin-where">${esc(WHERE[svc] ? WHERE[svc].short : svc)} <small>(${esc(WHERE[svc] ? WHERE[svc].long : svc)})</small></h4>
          <ul class="ocs__admin-settings">${list}</ul>${how}`;
    }).join('');
}

function stepsSection(f) {
    if (!f.steps.length) return '<p>No manual steps.</p>';
    const done = readSteps(f.id);
    return `<ul class="ocs__admin-steps">${f.steps.map((s, i) => `<li><label>
        <input type="checkbox" data-step="${esc(f.id)}" data-index="${i}" ${done.includes(i) ? 'checked' : ''}>
        <span>${md(s)}</span></label></li>`).join('')}</ul>
      <p class="ocs__admin-crumbs">Ticks are saved in this browser only, to help you keep track.</p>`;
}

/** The kit: features: line with this feature added, in the same style the site already uses. */
function featuresLineWith(id) {
    const current = SITE.config_features.map(String);
    const explicit = current.some(x => !/^[+-]/.test(x) && x !== '*');
    const next = explicit ? [...current.filter(x => x !== id), id] : [...current.filter(x => x !== `-${id}`), `+${id}`];
    return `  features: [${next.map(x => JSON.stringify(x)).join(', ')}]`;
}

function buildSection(f) {
    if (f.inBuild) return '';
    const kitLine = SITE.kit ? `  name: ${SITE.kit}\n` : '';
    const yaml = `kit:\n${kitLine}${featuresLineWith(f.id)}`;
    return `<h3>Add its pages to the website</h3>
      <div class="ocs__admin-result ocs__admin-result--warn">
        <p>This website was built without ${esc(f.name)}'s pages, so turning it on in the backends is not enough. Do one of these:</p>
        <ol>
          <li>In your website repository, change <code>features:</code> in the <code>kit:</code> block of <code>_config.yml</code> as shown below, then commit and push. GitHub rebuilds the site in a few minutes. (Running the site on your computer? Run <code>make</code> again.)</li>
          <li>Or re-run the OCS-in-a-Kit installer with <code>--change-features</code> and choose this feature (it updates the website and both backends).</li>
        </ol>
      </div>` + snippet(yaml, `_config.yml feature list with ${f.name}`);
}

function renderGuide(id) {
    const f = feature(id);
    if (!f) return;
    const on = f.enabled === true || f.enabled === 'mixed';
    $('guide-title').textContent = `Set up ${f.name}`;
    const statusLine = `<div class="ocs__admin-row">
        <span class="ocs__admin-pill ${on ? 'ocs__admin-pill--on' : 'ocs__admin-pill--off'}">${esc(enabledText(f))}</span>
        ${readinessPill(f)}
        ${f.labels.map(labelChip).join('')}
      </div>`;
    const offNote = !on && !f.always_on
        ? `<div class="ocs__admin-result ocs__admin-result--warn"><p>This feature is off. You can prepare the settings first, then turn it on.</p>
           <button type="button" class="ocs__btn small accent fill" data-guide-enable="${esc(f.id)}">Turn on ${esc(f.name)}</button></div>` : '';
    const n = { i: 0 };
    const h = (t) => `<h3>${++n.i}. ${esc(t)}</h3>`;
    $('guide-body').innerHTML = `${statusLine}
      <p>${md(f.summary || f.description)}</p>
      ${offNote}
      ${buildSection(f)}
      ${h('Settings')}
      <p class="ocs__admin-crumbs">The dashboard only checks whether each setting is set. It never shows or stores the values.</p>
      ${settingsSection(f)}
      ${h('Steps')}
      ${stepsSection(f)}
      ${h('Check that it works')}
      <p>${md(f.verify || 'Open the feature on the website.')}</p>
      <div class="ocs__modal-actions">
        <button type="button" class="ocs__btn small" data-guide-check="${esc(f.id)}">Check again</button>
        <button type="button" class="ocs__btn small accent fill" data-guide-done>Done</button>
      </div>`;
}

let releaseGuide = null;
function openGuide(id, fromHistory) {
    if (!feature(id)) return;
    state.guideId = id;
    renderGuide(id);
    const dlg = $('guide-dialog');
    dlg.hidden = false;
    document.body.style.overflow = 'hidden';
    if (releaseGuide) releaseGuide();
    releaseGuide = trapFocus(dlg, closeGuide);
    $('guide-close').focus();
    if (!fromHistory) {
        const url = new URL(location.href);
        url.searchParams.set('f', id);
        history.pushState({ f: id }, '', url);
    }
}

function closeGuide(fromHistory) {
    const dlg = $('guide-dialog');
    if (dlg.hidden) return;
    const id = state.guideId;
    dlg.hidden = true;
    document.body.style.overflow = '';
    state.guideId = null;
    if (releaseGuide) { releaseGuide(); releaseGuide = null; }
    if (fromHistory !== true) {
        const url = new URL(location.href);
        url.searchParams.delete('f');
        history.pushState({}, '', url);
    }
    const btn = document.querySelector(`[data-guide="${CSS.escape(id || '')}"]`);
    if (btn) btn.focus();
}

// ------------------------------------------------------------------ events

function wire() {
    document.addEventListener('change', (e) => {
        const t = e.target;
        if (t.matches('[data-toggle]')) toggle(t.dataset.toggle, t.checked, t);
        if (t.matches('[data-step]')) {
            const id = t.dataset.step;
            const done = new Set(readSteps(id));
            const i = Number(t.dataset.index);
            if (t.checked) done.add(i); else done.delete(i);
            writeSteps(id, [...done]);
        }
    });
    document.addEventListener('click', async (e) => {
        const t = e.target.closest('button');
        if (!t) return;
        if (t.dataset.guide) openGuide(t.dataset.guide);
        else if (t.dataset.reset) reset(t.dataset.reset);
        else if (t.dataset.copy != null) {
            const ok = await copyText(t.dataset.copy);
            const label = t.firstChild;
            label.textContent = ok ? 'Copied' : 'Copy failed';
            setTimeout(() => { label.textContent = 'Copy'; }, 1800);
        } else if (t.dataset.guideCheck) {
            t.disabled = true;
            await reload('Status refreshed.');
        } else if (t.hasAttribute('data-guide-done')) closeGuide();
        else if (t.dataset.guideEnable) {
            const id = t.dataset.guideEnable;
            closeGuide();
            toggle(id, true);
        }
    });
    $('guide-close').addEventListener('click', () => closeGuide());
    $('guide-dialog').addEventListener('click', (e) => { if (e.target === $('guide-dialog')) closeGuide(); });
    $('feature-search').addEventListener('input', renderGroups);
    $('feature-filter').addEventListener('change', renderGroups);
    $('feature-refresh').addEventListener('click', () => reload('Status refreshed.'));
    window.addEventListener('popstate', () => {
        const f = new URLSearchParams(location.search).get('f');
        if (f) openGuide(f, true); else closeGuide(true);
    });
}

async function main() {
    mockBanner();
    if (MOCK) $('crumb-admin').href += `?mock=${encodeURIComponent(MOCK)}`;
    const [who, catalog] = await Promise.all([getIdentity(), loadCatalog()]);
    state.catalog = catalog;
    if (who.role === 'anon') { showGate('signin'); return; }
    if (who.role !== 'admin') {
        const kit = await getKitPublic();
        const label = kit && kit.roles && kit.roles[who.role] ? kit.roles[who.role].label : who.role;
        if (who.role === 'staff') { showGate('staff'); renderStaff(kit, catalog); }
        else showGate('denied', label);
        return;
    }
    state.admin = await getKitAdmin();
    const denied = BACKEND_IDS.every(b => !state.admin[b].ok && (state.admin[b].status === 401 || state.admin[b].status === 403));
    if (denied) { showGate('denied', 'not an Admin on the backends'); return; }
    const okResult = BACKEND_IDS.map(b => state.admin[b]).find(r => r.ok);
    state.kit = okResult ? okResult.data : await getKitPublic();
    if (state.kit) $('admin-kit-badge').textContent = state.kit.kit_name || state.kit.kit;
    refreshModel();
    showGate('content');
    wire();
    renderGroups();
    document.querySelectorAll('[data-toggle]').forEach(i => { const f = feature(i.dataset.toggle); if (f && f.enabled === 'mixed') i.indeterminate = true; });
    const problems = BACKEND_IDS.filter(b => !state.admin[b].ok).map(b => describeFailure(state.admin[b]));
    if (!okResult) announce(`The feature API did not answer, so features cannot be changed right now. ${problems.join(' ')}`, 'error');
    else if (problems.length) announce(`${problems.join(' ')} Changes will only reach the backend that answers.`, 'warn');
    const deep = new URLSearchParams(location.search).get('f');
    if (deep) openGuide(deep, true);
}

main().catch(err => {
    showGate('none');
    announce(`Something went wrong loading features: ${err.message}`, 'error');
});
