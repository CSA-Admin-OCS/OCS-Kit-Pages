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
// Side effects fail CLOSED (trackers, third-party widgets, camera, outside APIs): hiding is not
// enough, so they do not start until this page load has its answer and canRun(id) is true. With no
// backend answer, canRun follows the build's selection: a deselected feature does nothing. If a
// feature goes off while a page is open, its widgets are removed and its requests stopped (the
// state is re-checked every minute while any side effect is active).
//
// Markup hooks:
//   <template data-kit-load="<id>">  markup and scripts that stay inert until canRun(<id>).
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
//      .canRun(id), .whenFeature(id, fn), .refresh(force), .apply(root), .effective(answers);
//      fires "ocs:kit" on document.
// Mock mode (local testing only, ignored unless the site runs on localhost or 127.0.0.1, and it
// never lets a side effect run): ?mock=1 reads the sample state kit-api.js keeps in sessionStorage;
// &mockdown=1|flask|spring makes backends unreachable; &mockdelay=<ms> slows the answer down;
// &mockoff=a,b turns those features off in the answers.
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

  // Anyone can craft a URL: mock parameters only count on a developer's own machine.
  var LOCAL = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  var params = new URLSearchParams(LOCAL ? location.search : '');
  var MOCK = params.get('mock');
  var MOCK_DOWN = params.get('mockdown');
  var MOCK_DELAY = Number(params.get('mockdelay')) || 0;
  var MOCK_OFF = (params.get('mockoff') || '').split(',').filter(Boolean);

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
  var realFetch = window.fetch ? window.fetch.bind(window) : null;   // the runtime's own calls skip the guard

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

  function cacheKey() {
    if (!MOCK) return CACHE_KEY;
    return CACHE_KEY + '-mock' + (MOCK_DOWN || MOCK_OFF.length ? '-' + MOCK_DOWN + '-' + MOCK_OFF.join() : '');
  }

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
    return realFetch(url, {
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
      return realFetch(BASEURL + '/assets/js/admin/mock/kit-admin.json').then(function (r) { return r.json(); });
    }).then(function (d) {
      var pick = function (a) {
        return MOCK_OFF.length ? Object.assign({}, a, { features: a.features.filter(function (f) { return MOCK_OFF.indexOf(f) === -1; }) }) : a;
      };
      return { spring: down('spring') ? null : pick(d.spring), flask: down('flask') ? null : pick(d.flask) };
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
    syncSideEffects();
    if (state.settled) settledWaiters.splice(0).forEach(function (fn) { fn(); });
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

  // ---------------------------------------------------------------- side effects (fail closed)

  /** May this feature's side effects run now? Never before this page load has its answer. */
  function canRun(id) {
    if (!id || id === 'core') return true;
    if (MOCK || !state.settled) return false;   // a mock answer is never a yes
    if (state.known) return isEnabled(id);
    return (BUILD.deselected || []).indexOf(id) === -1 && built.indexOf(id) !== -1;
  }

  /** Run fn once, as soon as canRun(id) is true. */
  function whenFeature(id, fn) {
    if (canRun(id)) { fn(); return; }
    var listener = function () {
      if (!canRun(id)) return;
      document.removeEventListener('ocs:kit', listener);
      fn();
    };
    document.addEventListener('ocs:kit', listener);
  }

  var settledWaiters = [];
  function whenSettled(fn) {
    if (state.settled) fn(); else settledWaiters.push(fn);
  }

  var sideEffectsActive = false;
  var recheckTimer = null;

  function sideEffectStarted() {
    sideEffectsActive = true;
    if (!recheckTimer) recheckTimer = setInterval(function () { refresh(false); }, TTL_MS + 1000);
  }

  // Scripts cloned from a <template> would not keep their order: rebuild them so they run in place.
  function liveCopy(fragment) {
    fragment.querySelectorAll('script').forEach(function (old) {
      var script = document.createElement('script');
      Array.prototype.forEach.call(old.attributes, function (a) { if (a.name !== 'async' || old.src === '') script.setAttribute(a.name, a.value); });
      if (old.src) script.async = old.hasAttribute('async');
      script.textContent = old.textContent;
      old.replaceWith(script);
    });
    return fragment;
  }

  function loadTemplate(t) {
    t.setAttribute('data-kit-loaded', '');
    var content = liveCopy(t.content.cloneNode(true));
    if (t.parentNode === document.head) {       // scripts only: stopped by the request guard, never reloaded
      t.parentNode.insertBefore(content, t.nextSibling);
    } else {
      var box = document.createElement('div');
      box.style.display = 'contents';
      box.appendChild(content);
      t.parentNode.insertBefore(box, t.nextSibling);
      t.kitBox = box;
    }
    sideEffectStarted();
  }

  function unloadTemplate(t) {
    if (!t.kitBox) return;                      // head scripts keep running but cannot send
    t.kitBox.remove();                          // widgets, their iframes and panels go
    t.kitBox = null;
    t.removeAttribute('data-kit-loaded');
  }

  function syncSideEffects() {
    if (!state.settled) return;
    var list = document.querySelectorAll('template[data-kit-load]');
    for (var i = 0; i < list.length; i++) {
      var allowed = canRun(list[i].getAttribute('data-kit-load'));
      if (allowed && !list[i].hasAttribute('data-kit-loaded')) loadTemplate(list[i]);
      else if (!allowed && list[i].hasAttribute('data-kit-loaded')) unloadTemplate(list[i]);
    }
  }

  // Requests that belong to a feature wherever they come from; on a feature's own page, every
  // cross-origin request except the sign-in check belongs to that page's feature.
  var RULES = [
    { any: ['analytics'], re: /\/api\/ocs-analytics|googletagmanager\.com|google-analytics\.com/ },
    { any: ['social'], re: /utteranc\.es|disqus\.com|\/api\/(microblog|feedback)(\/|\?|$)/ },
    { any: ['ai-chatbot', 'ai-grading'], re: /\/api\/gemini/ },
    { any: ['game-engine'], re: /alphavantage\.co/ },
    { any: ['lessons'], re: /api\.voicerss\.org/ },
    { any: ['assignments'], re: /\/api\/challenge-submission/ }
  ];
  var IDENTITY = /\/api\/(person\/get|id|kit)(\/|\?|$)|\/authenticate(\?|$)/;

  function ownersOf(url) {
    var u;
    try { u = new URL(String(url), location.href); } catch (e) { return null; }
    for (var i = 0; i < RULES.length; i++) if (RULES[i].re.test(u.href)) return RULES[i].any;
    if (pageFeature && u.host !== location.host && !IDENTITY.test(u.pathname)) return [pageFeature];
    return null;
  }

  function mayRun(owners) { return owners.some(canRun); }

  function blocked(url) { return 'Blocked by OCS-in-a-Kit: the feature for ' + url + ' is off'; }

  function installGuards() {
    if (realFetch) {
      window.fetch = function (input, init) {
        var url = input && input.url ? input.url : input;
        var owners = ownersOf(url);
        if (!owners) return realFetch(input, init);
        return new Promise(function (resolve, reject) {
          whenSettled(function () {
            if (mayRun(owners)) resolve(realFetch(input, init));
            else reject(new TypeError(blocked(url)));
          });
        });
      };
    }
    if (window.XMLHttpRequest) {
      var xhr = XMLHttpRequest.prototype, open = xhr.open, send = xhr.send;
      xhr.open = function (method, url, async) {
        this.kitOwners = ownersOf(url);
        this.kitSync = async === false;
        return open.apply(this, arguments);
      };
      xhr.send = function () {
        var self = this, args = arguments, owners = this.kitOwners;
        if (!owners) return send.apply(this, args);
        var go = function () {
          if (mayRun(owners)) send.apply(self, args);
          else self.dispatchEvent(new Event('error'));
        };
        if (this.kitSync) { if (mayRun(owners)) return send.apply(this, args); throw new DOMException('blocked', 'NetworkError'); }
        whenSettled(go);
      };
    }
    if (navigator.sendBeacon) {
      var beacon = navigator.sendBeacon.bind(navigator);
      navigator.sendBeacon = function (url, data) {
        var owners = ownersOf(url);
        if (!owners) return beacon(url, data);
        if (!state.settled) { whenSettled(function () { if (mayRun(owners)) beacon(url, data); }); return true; }
        return mayRun(owners) ? beacon(url, data) : false;
      };
    }
    if (window.WebSocket) {
      var RealSocket = window.WebSocket;
      var Guarded = function (url, protocols) {
        var owners = ownersOf(url);
        if (owners && !mayRun(owners)) throw new DOMException(blocked(url), 'SecurityError');
        return protocols === undefined ? new RealSocket(url) : new RealSocket(url, protocols);
      };
      Guarded.prototype = RealSocket.prototype;
      ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'].forEach(function (k) { Guarded[k] = RealSocket[k]; });
      window.WebSocket = Guarded;
    }
    // The camera on a feature's own page (face recognition) waits for the answer too.
    var media = navigator.mediaDevices;
    if (media && media.getUserMedia) {
      var getUserMedia = media.getUserMedia.bind(media);
      media.getUserMedia = function (constraints) {
        if (!pageFeature) return getUserMedia(constraints);
        return new Promise(function (resolve, reject) {
          whenSettled(function () {
            if (canRun(pageFeature)) resolve(getUserMedia(constraints));
            else reject(new DOMException('This feature is turned off', 'NotAllowedError'));
          });
        });
      };
    }
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
    featureForUrl: featureForUrl, apply: apply, refresh: refresh, setUser: setUser, effective: effective,
    canRun: canRun, whenFeature: whenFeature
  };

  document.addEventListener('ocs:user', function (e) { setUser(e.detail); });

  // ---------------------------------------------------------------- first paint

  pageFeature = featureForUrl(location.href);
  installGuards();                 // before any page script can send anything
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
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && sideEffectsActive) refresh(false);
    });
    refresh(false);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
