#!/usr/bin/env node
// Checks kit.build in scripts/apply_kit.py and the effective-state rules in assets/js/kit-features.js
// with no browser or dependencies: node scripts/test_kit_runtime.js (make kit-test)
'use strict';
const assert = require('assert');
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const APPLY = path.join(ROOT, 'scripts', 'apply_kit.py');
const PY = process.env.PYTHON || 'python3';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ocs-kit-test-'));
fs.mkdirSync(path.join(tmp, 'kits'));
fs.copyFileSync(path.join(ROOT, 'kits/catalog.json'), path.join(tmp, 'kits/catalog.json'));

function site(build, ...args) {
    const line = build ? `  build: ${build}\n` : '';
    fs.writeFileSync(path.join(tmp, '_config.yml'), `kit:\n  name: education\n  features: []\n${line}exclude:\n  - kits/\n`);
    execFileSync(PY, [APPLY, '--root', tmp, '-q', ...args], { stdio: 'pipe' });
    return {
        data: JSON.parse(fs.readFileSync(path.join(tmp, '_data/kit.json'))),
        config: fs.readFileSync(path.join(tmp, '_config.kit.yml'), 'utf8'),
    };
}

const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'kits/catalog.json')));
const ALL = Object.keys(catalog.features);
const EDUCATION = catalog.kits.education.features;

const tests = {
    'build: all excludes nothing and keeps the kit as the fallback'() {
        const { data, config } = site('all');
        assert.strictEqual(data.build, 'all');
        assert.deepStrictEqual(data.built, ALL);
        assert.deepStrictEqual(data.disabled, []);
        assert.deepStrictEqual(data.enabled.slice().sort(), EDUCATION.slice().sort());
        assert.deepStrictEqual(data.deselected, ALL.filter(f => !EDUCATION.includes(f)));
        assert(!/_layouts\/finance/.test(config), 'a feature page was excluded');
    },
    'build defaults to all'() {
        assert.strictEqual(site(null).data.build, 'all');
    },
    'build: kit trims'() {
        const { data, config } = site('kit');
        assert.strictEqual(data.build, 'kit');
        assert.deepStrictEqual(data.disabled, data.deselected);
        assert(/_layouts\/finance/.test(config));
    },
    'an explicit --kit means a trimmed site unless --build all'() {
        assert.strictEqual(site('all', '--kit', 'vanilla').data.build, 'kit');
        assert.strictEqual(site('all', '--kit', 'vanilla', '--build', 'all').data.build, 'all');
    },
    '--no-mock-fixtures leaves the sample data out'() {
        assert(!/admin\/mock/.test(site('all').config));
        assert(/admin\/mock/.test(site('all', '--no-mock-fixtures').config));
    },
    'an unknown kit.build fails --check'() {
        site('all');
        fs.writeFileSync(path.join(tmp, '_config.yml'), 'kit:\n  name: education\n  build: sometimes\n');
        const r = spawnSync(PY, [APPLY, '--root', tmp, '--check', '--canonical', path.join(tmp, 'none')], { encoding: 'utf8' });
        assert(/unknown kit\.build/.test(r.stdout), r.stdout);
        assert.strictEqual(r.status, 1);
    },
};

// ------------------------------------------------------------------ effective state

function runtime(build) {
    const src = fs.readFileSync(path.join(ROOT, 'assets/js/kit-features.js'), 'utf8')
        .replace(/^---\n---\n/, '')
        .replace('{{ site.data.kit | jsonify }}', JSON.stringify(build))
        .replace('{{ site.baseurl }}', '');
    const el = () => ({ appendChild() {}, setAttribute() {}, removeAttribute() {}, hasAttribute: () => false, style: {} });
    const store = () => ({ getItem: () => null, setItem() {}, removeItem() {} });
    const win = {
        URL, URLSearchParams, JSON, Object, Array, Promise, setTimeout, setInterval, Date, String, Number,
        location: { href: 'http://example.test/', search: '', origin: 'http://example.test', hostname: 'example.test', host: 'example.test' },
        navigator: {}, sessionStorage: store(), localStorage: store(),
        document: { head: el(), documentElement: el(), createElement: el, addEventListener() {}, readyState: 'loading' },
    };
    win.window = win;
    vm.runInNewContext(src, win);
    return win.OCS_KIT;
}

const kit = runtime({
    kit: 'education', name: 'OCS Education', build: 'all', built: ['core', 'a', 'b', 'c'], enabled: ['core', 'a'], deselected: ['b', 'c'],
    disabled: [], urls: {}, features: { core: {}, a: {}, b: {}, c: {} }, roles: {},
});
const answer = (features, extra = {}) => ({ kit: 'education', features, ...extra });
const plain = v => JSON.parse(JSON.stringify(v));

Object.assign(tests, {
    'no answers: no effective state'() {
        assert.strictEqual(kit.effective({ spring: null, flask: null }), null);
    },
    'one backend answers: it is used'() {
        assert.deepStrictEqual(plain(kit.effective({ spring: null, flask: answer(['core', 'b']) }).enabled), ['core', 'b']);
        assert.deepStrictEqual(plain(kit.effective({ spring: answer(['a']), flask: null }).enabled), ['core', 'a']);
    },
    'both answer: on only if both say on, and the difference is reported'() {
        const e = kit.effective({ spring: answer(['core', 'a', 'b']), flask: answer(['core', 'b', 'c']) });
        assert.deepStrictEqual(plain(e.enabled), ['core', 'b']);
        assert.deepStrictEqual(plain(e.mismatch), { kit: null, springOnly: ['a'], flaskOnly: ['c'] });
    },
    'kits that differ are a mismatch; agreement is not'() {
        const e = kit.effective({ spring: answer(['core'], { kit: 'vanilla' }), flask: answer(['core']) });
        assert.deepStrictEqual(plain(e.mismatch.kit), { spring: 'vanilla', flask: 'education' });
        assert.strictEqual(kit.effective({ spring: answer(['core']), flask: answer(['core']) }).mismatch, null);
    },
    'star means every feature'() {
        assert.deepStrictEqual(plain(kit.effective({ spring: answer(['*']), flask: null }).enabled), ['core', 'a', 'b', 'c']);
    },
    'a feature whose pages are not built stays off'() {
        const trimmed = runtime({ kit: 'x', name: 'x', build: 'kit', built: ['core'], enabled: ['core'], deselected: ['a'], disabled: ['a'], urls: {}, features: { core: {}, a: {} }, roles: {} });
        assert.deepStrictEqual(plain(trimmed.effective({ spring: answer(['core', 'a']), flask: null }).enabled), ['core']);
    },
    'kit_source, customized and role labels pass through, Spring first'() {
        const e = kit.effective({
            spring: answer(['core'], { kit_source: 'admin', customized: true, roles: { staff: { label: 'Manager' } } }),
            flask: answer(['core'], { kit_source: 'env', roles: { staff: { label: 'Teacher' } } }),
        });
        assert.deepStrictEqual([e.kit_source, e.customized, e.roles.staff], ['admin', true, 'Manager']);
    },
});

let failed = 0;
for (const [name, fn] of Object.entries(tests)) {
    try { fn(); console.log(`ok   ${name}`); } catch (e) { failed += 1; console.log(`FAIL ${name}\n     ${e.message}`); }
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`${Object.keys(tests).length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
