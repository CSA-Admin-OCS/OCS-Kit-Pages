---
---
// OCS-in-a-Kit runtime feature switch (loaded on every page by _includes/kit/runtime.html).
//
// Build time: scripts/apply_kit.py excludes pages of disabled features and writes
// _data/kit.json, embedded below. Run time: admins can turn features off in the
// backends; this script asks {javaURI}/api/kit (falls back to {pythonURI}/api/kit),
// caches the answer for 5 minutes in sessionStorage and hides what is off.
// If no backend answers, the build-time selection is used (fail open).
//
// Markup hooks:
//   data-feature="<id>"      hidden when feature <id> is off. Site links whose URL
//                            belongs to a feature (kits/catalog.json) are marked
//                            automatically, including ones added later by scripts.
//   data-role-label="staff"  text replaced by this kit's label for the role
//                            (admin | staff | member), e.g. Teacher or Manager.
//   data-feature-admin       only shown to signed-in Admins (feature management).
//
// API: window.OCS_KIT.isEnabled(id), .isUrlEnabled(href), .featureForUrl(href),
//      .setUser(user), .refresh(), .apply(root); fires "ocs:kit" on document.
(function () {
  'use strict';

  var BUILD = {{ site.data.kit | jsonify }};
  var BASEURL = "{{ site.baseurl }}";
  var CACHE_KEY = 'ocs-kit-runtime';
  var TTL_MS = 5 * 60 * 1000;
  var TIMEOUT_MS = 4000;

  var urls = (BUILD && BUILD.urls) || {};
  var state = {
    source: BUILD ? 'build' : 'none',
    enabled: BUILD ? BUILD.enabled.slice() : null,   // null = unknown, everything on
    roles: (BUILD && BUILD.roles) || {},
    isAdmin: false
  };

  // Hidden-state styling lives here so it works on every layout.
  var style = document.createElement('style');
  style.textContent = '[data-kit-off]{display:none!important}' +
    '[data-feature-admin]:not([data-kit-admin]){display:none!important}';
  (document.head || document.documentElement).appendChild(style);

  function isEnabled(id) {
    if (!id || id === 'core' || !state.enabled) return true;
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

  function apply(root) {
    root = root && root.querySelectorAll ? root : document;
    var links = root.querySelectorAll('a[href]:not([data-feature])');
    for (var i = 0; i < links.length; i++) {
      var f = featureForUrl(links[i].getAttribute('href'));
      if (f) links[i].setAttribute('data-feature', f);
    }
    var marked = root.querySelectorAll('[data-feature]');
    for (var j = 0; j < marked.length; j++) {
      if (isEnabled(marked[j].getAttribute('data-feature'))) marked[j].removeAttribute('data-kit-off');
      else marked[j].setAttribute('data-kit-off', '');
    }
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

  function roleLabels(roles) {
    var out = {};
    Object.keys(roles || {}).forEach(function (r) {
      var v = roles[r];
      out[r] = typeof v === 'string' ? v : (v && v.label) || r;
    });
    return out;
  }

  function useRuntime(data, source) {
    if (!data || !Array.isArray(data.features)) return false;
    var runtime = data.features;
    if (runtime.indexOf('*') !== -1 && BUILD) runtime = Object.keys(BUILD.features);
    // A feature needs its pages (build time) and must be on in the backend (run time)
    var built = BUILD ? BUILD.enabled : runtime;
    state.enabled = built.filter(function (id) { return id === 'core' || runtime.indexOf(id) !== -1; });
    if (data.roles) state.roles = Object.assign({}, state.roles, roleLabels(data.roles));
    state.source = source;
    return true;
  }

  function readCache() {
    try {
      var c = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
      if (c && Date.now() - c.at < TTL_MS) return c.data;
    } catch (e) { /* storage blocked */ }
    return null;
  }

  function writeCache(data) {
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data: data })); } catch (e) { /* ignore */ }
  }

  function fetchJson(url) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS) : null;
    return fetch(url, {
      credentials: 'include',
      headers: { 'X-Origin': 'client' },
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      if (timer) clearTimeout(timer);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function announce() {
    apply(document);
    try {
      document.dispatchEvent(new CustomEvent('ocs:kit', { detail: { enabled: state.enabled, source: state.source } }));
    } catch (e) { /* old browsers */ }
  }

  function refresh(force) {
    var cached = !force && readCache();
    if (cached && useRuntime(cached, 'cache')) { announce(); return Promise.resolve(state); }
    var bases = [window.javaURI, window.pythonURI].filter(Boolean);
    var attempt = function (i) {
      if (i >= bases.length) return Promise.resolve(null);
      return fetchJson(bases[i].replace(/\/$/, '') + '/api/kit')
        .catch(function () { return attempt(i + 1); });
    };
    return attempt(0).then(function (data) {
      if (data && useRuntime(data, 'backend')) writeCache(data);
      announce();   // no answer: keep the build-time selection (fail open)
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
    apply(document);
  }

  window.OCS_KIT = {
    build: BUILD, state: state, isEnabled: isEnabled, isUrlEnabled: isUrlEnabled,
    featureForUrl: featureForUrl, apply: apply, refresh: refresh, setUser: setUser
  };

  document.addEventListener('ocs:user', function (e) { setUser(e.detail); });

  function start() {
    apply(document);
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
