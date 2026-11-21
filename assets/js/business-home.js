---
---
// Business home page: shown at /business/ on any build, and instead of the standard home page when
// the site runs the Business kit. It fills the name, tagline, welcome text, logo and hero image from the saved brand (Admin >
// Branding), and drives the side indicators and the gentle mouse parallax.
// Anything not set yet keeps its placeholder. Styling is all in _sass/open-coding/business-home.scss.
import { pythonURI } from '{{ site.baseurl }}/assets/js/api/config.js';

const KIT = 'business';
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function currentKit() {
    return (window.OCS_KIT && window.OCS_KIT.state && window.OCS_KIT.state.kit) || null;
}

/** Show the Business home for the Business kit, the standard home for any other. */
function chooseHome() {
    const home = $('#home-business');
    if (home && home.hasAttribute('data-forced')) {         // the page at /business/ always shows the Business site
        home.hidden = false;
        document.documentElement.setAttribute('data-brand-home', '');
        return;
    }
    const kit = currentKit();
    if (!kit) return;
    const business = kit === KIT;
    const standard = $('#home-default');
    const chooser = $('#home-kits');
    if (home) home.hidden = !business;
    if (standard) standard.hidden = business;
    if (chooser) chooser.hidden = business;
    document.documentElement.toggleAttribute('data-brand-home', business);
}

// ---------------------------------------------------------------- brand

function safeUrl(value) {
    return /^https?:\/\//i.test(value) || (value.startsWith('/') && !value.startsWith('//')) ? value : '';
}

function setText(key, value) {
    const el = $(`[data-brand="${key}"]`);
    if (el && value) el.textContent = value;
}

function setImage(key, value) {
    const img = $(`[data-brand="${key}"]`);
    const holder = $(`[data-brand-placeholder="${key}"]`);
    const url = safeUrl(value || '');
    if (!img) return;
    img.hidden = !url;
    if (holder) holder.hidden = !!url;
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
        setImage('logo', brand.logo_url);
        setImage('hero_image', brand.hero_image_url);
        const logo = $('[data-brand="logo"]');
        if (logo && brand.name) logo.alt = `${brand.name} logo`;
    } catch (_) { /* backend down: the placeholders stay */ }
}

// ---------------------------------------------------------------- side indicators and motion

function setupIndicators() {
    const sections = $$('[data-pearl-section]');
    const dots = $$('[data-pearl-dot]');
    const number = $('[data-pearl-number]');
    const ticksBox = $('[data-pearl-ticks]');
    if (!sections.length) return;

    const TICKS = 14;
    if (ticksBox && !ticksBox.children.length) {
        for (let i = 0; i < TICKS; i++) ticksBox.appendChild(document.createElement('span'));
    }
    let active = 0;
    const show = (index) => {
        active = index;
        dots.forEach((dot, i) => dot.setAttribute('aria-current', i === index ? 'true' : 'false'));
        if (number) number.textContent = String(index + 1).padStart(2, '0');
    };
    const paintTicks = () => {
        if (!ticksBox) return;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const at = max > 0 ? Math.round((window.scrollY / max) * (TICKS - 1)) : 0;
        Array.from(ticksBox.children).forEach((tick, i) => tick.classList.toggle('is-active', i === at));
    };
    if ('IntersectionObserver' in window) {
        const seen = new Map();
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(e => seen.set(e.target, e.isIntersecting ? e.intersectionRatio : 0));
            let best = 0;
            sections.forEach((s, i) => { if ((seen.get(s) || 0) > (seen.get(sections[best]) || 0)) best = i; });
            show(best);
        }, { threshold: [0.1, 0.3, 0.5, 0.7] });
        sections.forEach(s => observer.observe(s));
    }
    window.addEventListener('scroll', paintTicks, { passive: true });
    paintTicks();

    const go = (step) => {
        const target = sections[Math.max(0, Math.min(sections.length - 1, active + step))];
        target.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
    };
    const prev = $('[data-pearl-prev]');
    const next = $('[data-pearl-next]');
    if (prev) prev.addEventListener('click', () => go(-1));
    if (next) next.addEventListener('click', () => go(1));
}

// ---------------------------------------------------------------- the 3D hero (loaded on demand)

/** Starts the WebGL scene when the hero is on screen, pauses it when it is not, and falls back to a
 *  flat pastel wash when WebGL is missing. Reduced motion and low-power devices get a single still frame. */
function setupHero() {
    const host = $('[data-pearl-art]');
    if (!host) return;
    const conn = navigator.connection || {};
    const lowPower = !!conn.saveData || (navigator.hardwareConcurrency || 8) <= 2 || (navigator.deviceMemory || 8) <= 2;
    const small = window.matchMedia('(max-width: 760px)').matches;
    let hero = null;
    let loading = false;
    let visible = false;

    const sync = () => {
        if (!hero) return;
        if (visible && !document.hidden) hero.play(); else hero.pause();
    };
    const start = async () => {
        if (hero || loading) return;
        loading = true;
        try {
            const module = await import('{{ site.baseurl }}/assets/js/vendor/pearl-hero.js');
            hero = module.startPearlHero(host, { small, still: calm || lowPower, pointerTarget: $('#top') || window });
            host.classList.add('is-3d');
            sync();
        } catch (error) {
            host.classList.add('is-flat');          // no WebGL: the pastel wash stays
        }
        loading = false;
    };
    if ('IntersectionObserver' in window) {
        new IntersectionObserver((entries) => {
            visible = entries.some(e => e.isIntersecting);
            if (visible) start();
            sync();
        }, { rootMargin: '120px', threshold: 0 }).observe(host);
    } else {
        visible = true;
        start();
    }
    document.addEventListener('visibilitychange', sync);
}

// ---------------------------------------------------------------- one navigation: reflect who is signed in

function setupSession() {
    document.addEventListener('ocs:user', (event) => {
        const user = event.detail;
        const signin = $$('[data-pearl-signin]');
        const signup = $('[data-pearl-signup]');
        const base = (window.baseurl || '').replace(/\/$/, '');
        if (user) {
            signin.forEach(a => { a.textContent = a.classList.contains('ocs__pearl-cta') ? 'Open your profile' : 'Profile'; a.href = `${base}/profile`; });
            if (signup) { signup.textContent = 'Sign out'; signup.href = `${base}/logout`; }
        } else {
            signin.forEach(a => { a.textContent = 'Sign in'; a.href = `${base}/login`; });
            if (signup) { signup.textContent = 'Get started'; signup.href = `${base}/signup`; }
        }
    });
}

chooseHome();
document.addEventListener('ocs:kit', chooseHome);
loadBrand();
setupIndicators();
setupHero();
setupSession();
