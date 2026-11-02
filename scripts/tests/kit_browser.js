#!/usr/bin/env node
// Browser checks of the kit runtime and Feature Manager in mock mode (no backends needed).
//   SITE=_site PLAYWRIGHT_CORE=<path to playwright-core> CHROME=<chrome binary> [PORT=4600] node scripts/tests/kit_browser.js
// SITE must be a kit.build: all build. Requests are captured; nothing leaves the machine.
'use strict';
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');

const SITE = path.resolve(process.env.SITE || '_site');
const PORT = Number(process.env.PORT) || 4600;
const ORIGIN = `http://localhost:${PORT}`;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

const server = http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, ORIGIN).pathname);
    for (const f of [p, `${p}.html`, path.join(p, 'index.html')].map(x => path.join(SITE, x))) {
        if (f.startsWith(SITE) && fs.existsSync(f) && fs.statSync(f).isFile()) {
            res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
            fs.createReadStream(f).pipe(res);
            return;
        }
    }
    res.writeHead(404, { 'content-type': 'text/html' });
    res.end('not found');
});

const COMMENTS_PAGE = process.env.COMMENTS_PAGE || '/javascript/json/lesson';
const FEATURE_PAGE = '/lessons/';
const tests = [];
const test = (name, fn) => tests.push([name, fn]);
let browser;

/** A fresh context whose outside requests are recorded and answered empty. */
async function open(url, { width = 1280, hold = 1500 } = {}) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } });
    const seen = [];
    await ctx.route('**/*', route => {
        const u = route.request().url();
        seen.push(u);
        if (u.startsWith(ORIGIN)) return route.continue();
        if (/\/api\//.test(u) || /:858[57]\//.test(u)) return route.abort();
        return route.fulfill({ status: 200, contentType: 'text/javascript', body: '' });
    });
    const page = await ctx.newPage();
    await page.goto(ORIGIN + url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.OCS_KIT && window.OCS_KIT.state.settled);
    await page.waitForTimeout(hold);
    return { ctx, page, seen, has: re => seen.some(u => re.test(u)) };
}

// ------------------------------------------------------------------ side effects fail closed

const TRACKER = /ocs-analytics-tracker\.js/;
const ANALYTICS_API = /\/api\/ocs-analytics/;
const WIDGETS = /utteranc\.es|disqus\.com|\/api\/microblog|\/api\/feedback/;

test('analytics off: tracker not loaded and no analytics requests', async () => {
    const { ctx, page, has } = await open('/?mock=1&mockoff=analytics');
    assert(!has(TRACKER), 'tracker was requested');
    assert(!has(ANALYTICS_API), 'analytics API was called');
    assert.strictEqual(await page.evaluate(() => typeof window.OCSAnalytics), 'undefined');
    await ctx.close();
});

test('analytics on: tracker loads', async () => {
    const { ctx, page, has } = await open('/?mock=1');
    assert(has(TRACKER), 'tracker was not requested');
    await page.waitForFunction(() => window.OCSAnalytics);
    await ctx.close();
});

test('tracker waits for the answer: nothing before the backends reply', async () => {
    const slow = await browser.newContext();
    const seen = [];
    await slow.route('**/*', r => { seen.push(r.request().url()); return r.continue().catch(() => {}); });
    const p = await slow.newPage();
    await p.goto(`${ORIGIN}/?mock=1&mockdelay=1200`, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(400);
    assert(!seen.some(u => TRACKER.test(u)), 'tracker loaded before the answer');
    await slow.close();
});

test('social off: no third-party widget requests and no widget in the page', async () => {
    const { ctx, page, has } = await open(`${COMMENTS_PAGE}?mock=1&mockoff=social`);
    assert(!has(WIDGETS), 'a social widget made a request');
    assert.strictEqual(await page.locator('#microblog-panel, .micro-actions-wrapper, .utterances').count(), 0);
    await ctx.close();
});

test('social on: comment widget loads', async () => {
    const { ctx, has } = await open(`${COMMENTS_PAGE}?mock=1`);
    assert(has(/utteranc\.es/), 'utterances was not requested');
    await ctx.close();
});

test('no backend answers: selected feature runs, deselected feature does nothing', async () => {
    const { ctx, page, has } = await open('/?mock=1&mockdown=1');
    assert(has(TRACKER), 'analytics is in the education selection, so it should load');
    const r = await page.evaluate(() => ({
        selected: OCS_KIT.canRun('analytics'), deselected: OCS_KIT.canRun('face-recognition'), known: OCS_KIT.state.known,
    }));
    assert.deepStrictEqual(r, { selected: true, deselected: false, known: false });
    await ctx.close();
});

test('feature page with no backend: visible but camera and its requests stay blocked if deselected', async () => {
    const { ctx, page, has } = await open('/facial-login?mock=1&mockdown=1');
    assert.strictEqual(await page.locator('#ocs-kit-gate').count(), 0, 'visible content must fail open');
    const camera = await page.evaluate(() => navigator.mediaDevices
        ? navigator.mediaDevices.getUserMedia({ video: true }).then(() => 'granted', e => e.name) : 'NotAllowedError');
    assert.strictEqual(camera, 'NotAllowedError');
    const sent = await page.evaluate(() => fetch('https://outside.example/track').then(() => 'sent', () => 'blocked'));
    assert.strictEqual(sent, 'blocked');
    assert(!has(/outside\.example/));
    await ctx.close();
});

test('turned off during the page: widgets go and sending stops', async () => {
    const { ctx, page, seen } = await open(`${COMMENTS_PAGE}?mock=1`);
    assert(await page.evaluate(() => document.querySelectorAll('[data-kit-load="social"][data-kit-loaded]').length > 0));
    await page.evaluate(async () => {
        const fx = await (await fetch(`${window.baseurl}/assets/js/admin/mock/kit-admin.json`)).json();
        for (const b of ['flask', 'spring']) fx[b].features = fx[b].features.filter(f => f !== 'analytics' && f !== 'social');
        sessionStorage.setItem('ocs-kit-mock-public', JSON.stringify({ flask: fx.flask, spring: fx.spring }));
        await OCS_KIT.refresh(true);
    });
    const before = seen.length;
    const r = await page.evaluate(() => fetch(`${window.javaURI}/api/ocs-analytics/save`, { method: 'POST' }).then(() => 'sent', e => e.message));
    assert(/Blocked by OCS-in-a-Kit/.test(r), r);
    assert.strictEqual(await page.evaluate(() => document.querySelectorAll('[data-kit-load="social"][data-kit-loaded]').length), 0);
    assert(!seen.slice(before).some(u => ANALYTICS_API.test(u)));
    await ctx.close();
});

// ------------------------------------------------------------------ visible state fails open

test('page of a disabled feature shows the message; content is hidden', async () => {
    const { ctx, page } = await open(`${FEATURE_PAGE}?mock=member&mockoff=lessons`);
    assert.strictEqual(await page.locator('#ocs-kit-gate h1').innerText(), 'This feature is turned off');
    assert(await page.locator('#ocs-kit-gate a', { hasText: 'home' }).isVisible());
    assert.strictEqual(await page.locator('#ocs-kit-gate a', { hasText: 'Manage features' }).count(), 0);
    assert(!(await page.locator('main.page-content').isVisible()));
    await ctx.close();
});

test('Admins also get Manage features on the message', async () => {
    const { ctx, page } = await open(`${FEATURE_PAGE}?mock=1&mockoff=lessons`);
    await page.locator('#ocs-kit-gate a', { hasText: 'Manage features' }).waitFor();
    await ctx.close();
});

test('backends unreachable: the page stays (fail open) and menus follow the selection', async () => {
    const { ctx, page } = await open(`${FEATURE_PAGE}?mock=1&mockdown=1`);
    assert.strictEqual(await page.locator('#ocs-kit-gate').count(), 0);
    assert(await page.locator('main.page-content').isVisible());
    assert(await page.locator('a.page-link[data-feature="lessons"]').first().isVisible());
    await ctx.close();
});

test('only Flask answers: its state is used', async () => {
    const { ctx, page } = await open(`${FEATURE_PAGE}?mock=1&mockdown=spring&mockoff=lessons`);
    await page.locator('#ocs-kit-gate h1').waitFor();
    await ctx.close();
});

test('header link follows the runtime state', async () => {
    const off = await open('/?mock=1&mockoff=lessons');
    assert(!(await off.page.locator('a.page-link[data-feature="lessons"]').first().isVisible()));
    assert(!(await off.page.locator('h2', { hasText: 'Lessons and Guides' }).isVisible()), 'empty home section left behind');
    await off.ctx.close();
    const on = await open('/?mock=1');
    assert(await on.page.locator('a.page-link[data-feature="lessons"]').first().isVisible());
    assert(await on.page.locator('h2', { hasText: 'Lessons and Guides' }).isVisible());
    await on.ctx.close();
});

test('runner degrades to read-only code when its feature is off', async () => {
    const on = await open('/js/classes/2027?mock=1');
    assert(await on.page.locator('.code-runner-container').first().isVisible());
    assert(!(await on.page.locator('[data-feature-off="code-runner"]').first().isVisible()));
    await on.ctx.close();
    const off = await open('/js/classes/2027?mock=1&mockoff=code-runner');
    assert.strictEqual(await off.page.locator('#ocs-kit-gate').count(), 0);
    assert(!(await off.page.locator('.code-runner-container').first().isVisible()));
    assert(await off.page.locator('[data-feature-off="code-runner"]').first().isVisible());
    await off.ctx.close();
});

(async () => {
    await new Promise(r => server.listen(PORT, r));
    browser = await chromium.launch({ executablePath: process.env.CHROME, args: ['--use-fake-ui-for-media-stream'] });
    let failed = 0;
    const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
    for (const [name, fn] of tests) {
        if (only && !only.test(name)) continue;
        try {
            await fn();
            console.log(`ok   ${name}`);
        } catch (e) {
            failed += 1;
            console.log(`FAIL ${name}\n     ${String(e.message).split('\n').slice(0, 6).join('\n     ')}`);
        }
    }
    await browser.close();
    server.close();
    console.log(`${tests.length - failed} passed, ${failed} failed`);
    process.exit(failed ? 1 : 0);
})();
