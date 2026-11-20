---
---
// Business home page: shows it instead of the standard home page when the site runs the Business
// kit, and fills the name, logo, hero image and text from the saved brand (set in Admin > Branding).
// Anything not set yet keeps its placeholder text.
import { pythonURI } from '{{ site.baseurl }}/assets/js/api/config.js';

const KIT = 'business';
const $ = (selector) => document.querySelector(selector);

function currentKit() {
    return (window.OCS_KIT && window.OCS_KIT.state && window.OCS_KIT.state.kit) || null;
}

/** Show the Business home for the Business kit, the standard home for any other. */
function chooseHome() {
    const kit = currentKit();
    if (!kit) return;
    const business = kit === KIT;
    const home = $('#home-business');
    const standard = $('#home-default');
    if (home) home.style.display = business ? '' : 'none';
    if (standard) standard.style.display = business ? 'none' : '';
    document.documentElement.toggleAttribute('data-brand-home', business);
}

function safeUrl(value) {
    return /^https?:\/\//i.test(value) || (value.startsWith('/') && !value.startsWith('//')) ? value : '';
}

function setText(key, value) {
    const el = $(`[data-brand="${key}"]`);
    if (el && value) el.textContent = value;
}

function setImage(key, placeholderKey, value) {
    const img = $(`[data-brand="${key}"]`);
    const holder = $(`[data-brand-placeholder="${placeholderKey}"]`);
    const url = safeUrl(value || '');
    if (!img) return;
    img.style.display = url ? '' : 'none';
    if (holder) holder.style.display = url ? 'none' : '';
    if (url) img.src = url;
}

async function loadBrand() {
    try {
        const res = await fetch(`${pythonURI}/api/kit/brand`, { cache: 'no-store' });
        if (!res.ok) return;
        const brand = await res.json();
        setText('name', brand.name);
        setText('tagline', brand.tagline);
        setText('hero_text', brand.hero_text);
        setImage('logo', 'logo', brand.logo_url);
        setImage('hero_image', 'hero_image', brand.hero_image_url);
        if (brand.name) {
            const logo = $('[data-brand="logo"]');
            if (logo) logo.alt = `${brand.name} logo`;
        }
    } catch (_) { /* backend down: the placeholders stay */ }
}

chooseHome();
document.addEventListener('ocs:kit', chooseHome);
loadBrand();
