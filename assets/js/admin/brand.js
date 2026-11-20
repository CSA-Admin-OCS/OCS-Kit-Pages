---
---
// Branding (/admin/brand/): the site's name, tagline, logo, hero image and welcome text.
import { getIdentity, getBrand, saveBrand, clearBrand, describeFailure } from './kit-api.js';
import { announce, showGate } from './common.js';

const FIELDS = ['name', 'tagline', 'hero_text', 'logo_url', 'hero_image_url'];
const input = (key) => document.querySelector(`[name="${key}"]`);

function fill(brand) {
    for (const key of FIELDS) input(key).value = (brand && brand[key]) || '';
}

function urlProblem(key) {
    const v = input(key).value.trim();
    if (!v) return '';
    const ok = /^https?:\/\//i.test(v) || (v.startsWith('/') && !v.startsWith('//'));
    return ok && !/[\s<>"']/.test(v) ? '' : 'must start with https:// (or be a path starting with /) and have no spaces';
}

async function onSave(event) {
    event.preventDefault();
    for (const key of ['logo_url', 'hero_image_url']) {
        const problem = urlProblem(key);
        if (problem) {
            announce(`${key === 'logo_url' ? 'The logo address' : 'The hero image address'} ${problem}.`, 'error');
            input(key).focus();
            return;
        }
    }
    const body = Object.fromEntries(FIELDS.map(key => [key, input(key).value.trim()]));
    const result = await saveBrand(body);
    if (result.ok) {
        fill(result.data);
        announce('Branding saved. The home page uses it now.', 'info');
    } else {
        announce(describeFailure(result), 'error');
    }
}

async function onReset() {
    if (!window.confirm('Remove all branding and go back to the placeholders?')) return;
    const result = await clearBrand();
    if (result.ok) {
        fill(result.data);
        announce('Branding removed. The home page shows its placeholders again.', 'info');
    } else {
        announce(describeFailure(result), 'error');
    }
}

async function main() {
    const who = await getIdentity();
    if (who.role === 'anon') { showGate('signin'); return; }
    if (who.role !== 'admin') { showGate(who.role === 'staff' ? 'staff' : 'denied', who.role); return; }
    const current = await getBrand();
    if (!current.ok) announce(describeFailure(current), 'error');
    fill(current.ok ? current.data : null);
    showGate('content');
    document.getElementById('brand-form').addEventListener('submit', onSave);
    document.getElementById('brand-reset').addEventListener('click', onReset);
}

main();
