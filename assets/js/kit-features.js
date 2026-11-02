---
---
// OCS-in-a-Kit runtime feature switch (loaded blocking in <head> by _includes/kit/runtime.html).
//
// Build time: scripts/apply_kit.py writes _data/kit.json, embedded below. With kit.build: all
// every feature's pages ship and this script alone decides what shows; with kit.build: kit the
// pages of unselected features are not in the build at all.
//
// Run time: asks BOTH {javaURI}/api/kit and {pythonURI}/api/kit. If only one answers it is used;
// if both answer a feature is on only when both say on, and the disagreement is kept in
// state.mismatch for the admin pages. Answers are cached briefly in sessionStorage. This is what
// people see, not a security boundary: pages are public static files and the backends enforce
// access themselves.
//
// Visible content fails OPEN: if no backend answers, menus follow the build's kit.name /
// kit.features selection and no page is replaced by the "turned off" message.
//
// Markup hooks:
//   data-feature="<id>"      hidden when feature <id> is off. Site links whose URL
//                            belongs to a feature (kits/catalog.json) are marked
//                            automatically, including ones added later by scripts.
//   data-feature-off="<id>"  the reverse: shown only while feature <id> is off.
//   data-kit-group           hidden when it has feature links and all its links are off.
//                            ="heading" also hides the heading and note just before it.
//   data-role-label="staff"  text replaced by this kit's label for the role
//                            (admin | staff | member), e.g. Teacher or Manager.
//   data-feature-admin       only shown to signed-in Admins (feature management).
//
// API: window.OCS_KIT.isEnabled(id), .isUrlEnabled(href), .featureForUrl(href), .setUser(user),
//      .refresh(force), .apply(root), .effective(answers); fires "ocs:kit" on document.
// Mock mode (admin page tests): ?mock=1 reads the sample state kit-api.js keeps in sessionStorage;
// &mockdown=1|flask|spring makes backends unreachable; &mockdelay=<ms> slows the answer down.
(function () {
  'use strict';

  var BUILD = {{ site.data.kit | jsonify }};
  var BASEURL = "{{ site.baseurl }}";
  var CACHE_KEY = 'ocs-kit-runtime';
  var MOCK_PUBLIC_KEY = 'ocs-kit-mock-public';
  var TTL_MS = 60 * 1000;            // fresh: no need to ask the backends again
  var STALE_MS = 60 * 60 * 1000;     // old enough to ignore even for the first paint
  var DOWN_TTL_MS = 30 * 1000;       // remember "no backend answered" so pages do not keep waiting
  var TIMEOUT_MS = 4000;
  var PENDING_MS = 1500;             // longest a feature page stays blank waiting for the answer

  var params = new URLSearchParams(location.search);
  var MOCK = params.get('mock');
  var MOCK_DOWN = params.get('mockdown');
  var MOCK_DELAY = Number(params.get('mockdelay')) || 0;

  var urls = BUILD.urls || {};
  var built = BUILD.built || BUILD.enabled;
  var state = {
    source: 'build',             // build (selection) | stale | cache | backend
    known: false,                // true when enabled comes from a backend answer
    settled: false,              // false until this page load has its answer
    enabled: BUILD.enabled.slice(),
    roles: BUILD.roles || {},
    kit: BUILD.kit,
    kit_name: BUILD.name,
    kit_source: null,
    customized: false,
    mismatch: null,              // { kit: {...}|null, flaskOnly: [ids], springOnly: [ids] }
    isAdmin: false,
    build: BUILD.build || 'kit'
  };
  var pageFeature = '';
  var refreshSeq = 0;

  // Hidden-state styling lives here so it works on every layout, before first paint.
  var pageParts = 'body>:not(.site-header):not(.site-footer):not(#ocs-kit-gate):not(script):not(style)';
  addStyle('[data-kit-off]{display:none!important}' +
    '[data-feature-off][hidden]{display:none!important}' +
    '[data-feature-admin]:not([data-kit-admin]){display:none!important}' +
    'html[data-kit-gate] ' + pageParts + '{display:none!important}' +
    'html[data-kit-pending] ' + pageParts + '{visibility:hidden!important}' +
    '#ocs-kit-gate{max-width:40rem;margin:3rem auto;padding:1.5rem 16px;text-align:center}' +
    '#ocs-kit-gate h1{font-size:1.6rem;margin:0 0 .75rem}' +
    '#ocs-kit-gate p{margin:0 0 1rem}' +
    '#ocs-kit-gate .ocs-kit-gate-links{display:flex;flex-wrap:wrap;gap:.75rem;justify-content:center}');
  var offStyle = addStyle('');

  function addStyle(css) {
    var el = document.createElement('style');
    el.textContent = css;
    (document.head || document.documentElement).appendChild(el);
    return el;
  }

  function isEnabled(id) {
    if (!id || id === 'core') return true;
    return state.enabled.indexOf(id) !== -1;
  }

  function normalizePath(path) {
    if (BASEURL && path.indexOf(BASEURL + '/') === 0) path = path.slice(BASEURL.length);
    else if (BASEURL && path === BASEURL) path = '/';
    path = path.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
    if (path.length > 1) path = path.replace(/\/+$/, '');
    return path || '/';
  }

  function featureForUrl(href) {
    if (!href) return '';
    var u;
    try { u = new URL(href, location.href); } catch (e) { return ''; }
    if (u.origin !== location.origin) return '';
    var path = normalizePath(u.pathname);
    return urls[path] || urls[path + '.html'] || '';
  }

  function isUrlEnabled(href) { return isEnabled(featureForUrl(href)); }

  // ---------------------------------------------------------------- what the page shows

  function hideOff(el) {
    if (isEnabled(el.getAttribute('data-feature'))) el.removeAttribute('data-kit-off');
    else el.setAttribute('data-kit-off', '');
  }

  // A list row or card that is nothing but a link to a feature page goes with that link
  // (search results, post lists), so no empty row is left behind.
  function markContainer(link, feature) {
    var box = link.closest('li, .post-meta');
    if (!box || box.hasAttribute('data-feature') || box.hasAttribute('data-kit-group')) return;
    var links = box.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) {
      if (featureForUrl(links[i].getAttribute('href')) !== feature) return;
    }
    box.setAttribute('data-feature', feature);
  }

  function applyGroups(root) {
    var groups = root.querySelectorAll('[data-kit-group]');
    for (var i = 0; i < groups.length; i++) {
      var links = groups[i].querySelectorAll('a[href]:not([href^="#"])');
      var marked = false, allOff = links.length > 0;
      for (var j = 0; j < links.length; j++) {
        if (links[j].hasAttribute('data-feature')) marked = true;
        if (!links[j].hasAttribute('data-kit-off') && !links[j].closest('[data-kit-off]')) allOff = false;
      }
      var off = marked && allOff;
      setGroupOff(groups[i], off);
      if (groups[i].getAttribute('data-kit-group') === 'heading') {
        var prev = groups[i].previousElementSibling;
        while (prev && !/^(H[1-6]|HR)$/.test(prev.tagName) && prev.hasAttribute('data-kit-group') === false) {
          setGroupOff(prev, off);
          prev = prev.previousElementSibling;
        }
        if (prev && /^H[1-6]$/.test(prev.tagName)) setGroupOff(prev, off);
      }
    }
  }

  function setGroupOff(el, off) {
    if (off) el.setAttribute('data-kit-off', '');
    else if (!el.hasAttribute('data-feature')) el.removeAttribute('data-kit-off');
  }

  function apply(root) {
    root = root && root.querySelectorAll ? root : document;
    var links = root.querySelectorAll('a[href]:not([data-feature])');
    for (var i = 0; i < links.length; i++) {
      var f = featureForUrl(links[i].getAttribute('href'));
      if (f) {
        links[i].setAttribute('data-feature', f);
        markContainer(links[i], f);
      }
    }
    var marked = root.querySelectorAll('[data-feature]');
    for (var j = 0; j < marked.length; j++) hideOff(marked[j]);
    var reverse = root.querySelectorAll('[data-feature-off]');
    for (var r = 0; r < reverse.length; r++) reverse[r].hidden = isEnabled(reverse[r].getAttribute('data-feature-off'));
    applyGroups(root);
    var labels = root.querySelectorAll('[data-role-label]');
    for (var k = 0; k < labels.length; k++) {
      var label = state.roles[labels[k].getAttribute('data-role-label')];
      if (label && labels[k].textContent !== label) labels[k].textContent = label;
    }
    var admin = root.querySelectorAll('[data-feature-admin]');
    for (var m = 0; m < admin.length; m++) {
      if (state.isAdmin) admin[m].setAttribute('data-kit-admin', '');
      else admin[m].removeAttribute('data-kit-admin');
    }
  }

  // Hides links of off features as soon as they are parsed, before apply() can run.
  function writeOffStyle() {
    var off = Object.keys(BUILD.features || {}).filter(function (id) { return !isEnabled(id); });
    offStyle.textContent = off.length
      ? off.map(function (id) { return '[data-feature="' + id + '"]'; }).join(',') + '{display:none!important}'
      : '';
  }

  // ---------------------------------------------------------------- page gate

  var originalTitle = null;

  function gateLinks() {
    var box = document.getElementById('ocs-kit-gate-links');
    if (!box) return;
    var mock = MOCK ? '?mock=' + encodeURIComponent(MOCK) : '';
    box.innerHTML = '<a class="ocs__btn accent fill" href="' + BASEURL + '/">Go to the home page</a>' +
      (state.isAdmin ? '<a class="ocs__btn" href="' + BASEURL + '/admin/features/' + mock + '">Manage features</a>' : '');
  }

  function showGate() {
    document.documentElement.setAttribute('data-kit-gate', '');
    if (!document.body) return;
    var gate = document.getElementById('ocs-kit-gate');
    if (!gate) {
      var info = (BUILD.features || {})[pageFeature] || {};
      gate = document.createElement('main');
      gate.id = 'ocs-kit-gate';
      gate.tabIndex = -1;
      gate.innerHTML = '<h1>This feature is turned off</h1><p></p>' +
        '<div class="ocs-kit-gate-links" id="ocs-kit-gate-links"></div>';
      gate.querySelector('p').textContent = (info.name || 'This feature') +
        ' is turned off on this site, so this page is not available. Ask your site\'s Admin if you need it.';
      var header = document.querySelector('body > .site-header');
      document.body.insertBefore(gate, header ? header.nextSibling : document.body.firstChild);
      if (originalTitle === null) originalTitle = document.title;
      document.title = 'This feature is turned off';
      gateLinks();
      gate.focus({ preventScroll: true });
      checkAdminForGate();
    }
  }

  function hideGate() {
    if (!document.documentElement.hasAttribute('data-kit-gate')) return;
    document.documentElement.removeAttribute('data-kit-gate');
    var gate = document.getElementById('ocs-kit-gate');
    if (gate) gate.remove();
    if (originalTitle !== null) document.title = originalTitle;
    originalTitle = null;
    try { window.dispatchEvent(new Event('resize')); } catch (e) { /* old browsers */ }  // canvases measured at 0
  }

  // Only a real backend answer (or a recent one) can take a page away: fail open.
  function updateGate() {
    if (!pageFeature) return;
    if (state.settled || state.known) document.documentElement.removeAttribute('data-kit-pending');
    if (state.known && !isEnabled(pageFeature)) showGate();
    else hideGate();
  }

  // The gate's "Manage features" link needs the role even on layouts without login.js.
  function checkAdminForGate() {
    if (state.isAdmin) return;
    if (MOCK) { if (MOCK === 'admin' || MOCK === '1' || MOCK === 'true') setUser({ role: 'Admin' }); return; }
    if (window.javaURI) {
      fetchJson(window.javaURI.replace(/\/$/, '') + '/api/person/get').then(setUser)
        .catch(function () {
          if (window.pythonURI) fetchJson(window.pythonURI.replace(/\/$/, '') + '/api/id').then(setUser).catch(function () { /* not signed in */ });
        });
    }
  }

  // ---------------------------------------------------------------- effective state

  function roleLabels(roles) {
    var out = {};
    Object.keys(roles || {}).forEach(function (r) {
      var v = roles[r];
      out[r] = typeof v === 'string' ? v : (v && v.label) || r;
    });
    return out;
  }

  function listOf(answer) {
    if (!answer || !Array.isArray(answer.features)) return null;
    return answer.features.indexOf('*') !== -1 ? Object.keys(BUILD.features || {}) : answer.features;
  }

  /**
   * Effective state from { spring: answer|null, flask: answer|null }. Spring's answer is used,
   * Flask's when Spring has none; with both, a feature is on only if both say on. Pure: tested
   * by scripts/test_kit_runtime.js. Returns null when no backend answered.
   */
  function effective(answers) {
    var spring = listOf(answers.spring), flask = listOf(answers.flask);
    if (!spring && !flask) return null;
    var main = spring ? answers.spring : answers.flask;
    var list = spring && flask ? spring.filter(function (id) { return flask.indexOf(id) !== -1; }) : (spring || flask);
    var mismatch = null;
    if (spring && flask) {
      var springOnly = spring.filter(function (id) { return flask.indexOf(id) === -1; });
      var flaskOnly = flask.filter(function (id) { return spring.indexOf(id) === -1; });
      var kitDiffers = answers.spring.kit !== answers.flask.kit;
      if (springOnly.length || flaskOnly.length || kitDiffers) {
        mismatch = {
          kit: kitDiffers ? { spring: answers.spring.kit, flask: answers.flask.kit } : null,
          springOnly: springOnly, flaskOnly: flaskOnly
        };
      }
    }
    return {
      enabled: built.filter(function (id) { return id === 'core' || list.indexOf(id) !== -1; }),  // needs its pages too
      roles: roleLabels(main.roles), kit: main.kit, kit_name: main.kit_name || main.name,
      kit_source: main.kit_source || null, customized: !!main.customized, mismatch: mismatch
    };
  }

  function useAnswers(answers, source) {
    var e = answers && effective(answers);
    if (!e) {
      state.known = false;
      state.source = 'build';
      state.enabled = BUILD.enabled.slice();
      state.roles = BUILD.roles || {};
      state.kit = BUILD.kit;
      state.kit_name = BUILD.name;
      state.kit_source = null;
      state.customized = false;
      state.mismatch = null;
      return;
    }
    state.known = true;
    state.source = source;
    state.enabled = e.enabled;
    state.roles = Object.assign({}, BUILD.roles || {}, e.roles);
    state.kit = e.kit;
    state.kit_name = e.kit_name;
    state.kit_source = e.kit_source;
    state.customized = e.customized;
    state.mismatch = e.mismatch;
  }

  // ---------------------------------------------------------------- answers: cache, backends, mock

  function cacheKey() { return MOCK ? CACHE_KEY + '-mock' : CACHE_KEY; }

  function readCache() {
    try {
      var c = JSON.parse(sessionStorage.getItem(cacheKey()) || 'null');
      if (!c || !c.answers) return null;
      var age = Date.now() - c.at;
      var down = !c.answers.spring && !c.answers.flask;
      if (down) return age < DOWN_TTL_MS ? { answers: c.answers, fresh: true } : null;
      return age < STALE_MS ? { answers: c.answers, fresh: age < TTL_MS } : null;
    } catch (e) { return null; }  // storage blocked
  }

  function writeCache(answers) {
    try { sessionStorage.setItem(cacheKey(), JSON.stringify({ at: Date.now(), answers: answers })); } catch (e) { /* ignore */ }
  }

  function fetchJson(url) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS) : null;
    return fetch(url, {
      credentials: 'include',
      cache: 'no-store',
      headers: { 'X-Origin': 'client' },
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      if (timer) clearTimeout(timer);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function ask(base) {
    if (!base) return Promise.resolve(null);
    return fetchJson(base.replace(/\/$/, '') + '/api/kit').then(function (d) {
      return d && Array.isArray(d.features) ? d : null;
    }).catch(function () { return null; });
  }

  // Same shape as the backends: kit-api.js keeps it up to date; before that, the sample file.
  function askMock() {
    var down = function (b) { return MOCK_DOWN === '1' || MOCK_DOWN === 'true' || MOCK_DOWN === b; };
    var read = function () {
      try { return JSON.parse(sessionStorage.getItem(MOCK_PUBLIC_KEY) || 'null'); } catch (e) { return null; }
    };
    var wait = new Promise(function (resolve) { setTimeout(resolve, MOCK_DELAY); });
    return wait.then(function () {
      var stored = read();
      if (stored) return stored;
      return fetch(BASEURL + '/assets/js/admin/mock/kit-admin.json').then(function (r) { return r.json(); });
    }).then(function (d) {
      return { spring: down('spring') ? null : d.spring, flask: down('flask') ? null : d.flask };
    }).catch(function () { return { spring: null, flask: null }; });
  }

  function askBackends() {
    if (MOCK) return askMock();
    return Promise.all([ask(window.javaURI), ask(window.pythonURI)]).then(function (r) {
      return { spring: r[0], flask: r[1] };
    });
  }

  function announce() {
    writeOffStyle();
    apply(document);
    updateGate();
    try {
      document.dispatchEvent(new CustomEvent('ocs:kit', {
        detail: { enabled: state.enabled, source: state.source, known: state.known, settled: state.settled, mismatch: state.mismatch }
      }));
    } catch (e) { /* old browsers */ }
  }

  /** Re-read the state. force skips the cache (Admin just changed something). */
  function refresh(force) {
    var seq = ++refreshSeq;
    var cached = force ? null : readCache();
    if (cached && cached.fresh) {
      useAnswers(cached.answers, 'cache');
      state.settled = true;
      announce();
      return Promise.resolve(state);
    }
    return askBackends().then(function (answers) {
      if (seq !== refreshSeq) return state;   // a newer refresh is on its way
      writeCache(answers);
      useAnswers(answers, 'backend');         // no answer: the build's selection (fail open)
      state.settled = true;
      announce();
      return state;
    });
  }

  function setUser(user) {
    var roles = [];
    if (user) {
      if (user.role) roles.push(String(user.role));
      (user.roles || []).forEach(function (r) { roles.push(String(r && r.name !== undefined ? r.name : r)); });
    }
    state.isAdmin = roles.some(function (r) { return /^(role_)?admin$/i.test(r); });
    if (document.body) apply(document);
    gateLinks();
  }

  window.OCS_KIT = {
    build: BUILD, state: state, isEnabled: isEnabled, isUrlEnabled: isUrlEnabled,
    featureForUrl: featureForUrl, apply: apply, refresh: refresh, setUser: setUser, effective: effective
  };

  document.addEventListener('ocs:user', function (e) { setUser(e.detail); });

  // ---------------------------------------------------------------- first paint

  pageFeature = featureForUrl(location.href);
  var first = readCache();
  if (first) {
    useAnswers(first.answers, first.fresh ? 'cache' : 'stale');
    if (first.fresh) state.settled = true;
  }
  writeOffStyle();
  if (pageFeature && state.known && !isEnabled(pageFeature)) {
    document.documentElement.setAttribute('data-kit-gate', '');
  } else if (pageFeature && !first) {
    // First page of the session: keep a feature page blank briefly rather than flash it.
    document.documentElement.setAttribute('data-kit-pending', '');
    setTimeout(function () { document.documentElement.removeAttribute('data-kit-pending'); }, PENDING_MS);
  }

  function start() {
    apply(document);
    updateGate();
    if (typeof MutationObserver !== 'undefined') {
      var pending = false;
      new MutationObserver(function () {
        if (pending) return;
        pending = true;
        (window.requestAnimationFrame || setTimeout)(function () { pending = false; apply(document); });
      }).observe(document.body, { childList: true, subtree: true });
    }
    refresh(false);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
