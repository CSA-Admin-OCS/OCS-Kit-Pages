---
---
// The photo gallery (/events/gallery/): pictures from recent events, newest first, with a lightbox.
import { getJson, formatDay, photoUrl, h } from '{{ site.baseurl }}/assets/js/events/events-common.js';

const grid = document.getElementById('gallery-grid');
const status = document.getElementById('gallery-status');
const box = document.getElementById('gallery-lightbox');
const bigImage = box.querySelector('img');
const caption = box.querySelector('figcaption');
let photos = [];
let current = 0;
let opener = null;

function say(text) {
    status.textContent = text;
    status.hidden = !text;
}

function describe(p) {
    return [p.event_title, formatDay(p.event_start), p.caption].filter(Boolean).join(' · ');
}

function open(index, trigger) {
    current = (index + photos.length) % photos.length;
    const p = photos[current];
    bigImage.src = photoUrl(p);
    bigImage.alt = p.caption || `Photo from ${p.event_title}`;
    caption.textContent = describe(p);
    if (trigger) opener = trigger;
    if (!box.open) box.showModal();
}

function close() {
    if (box.open) box.close();
    if (opener) opener.focus();
}

box.querySelector('.ocs-gallery__close').addEventListener('click', close);
box.querySelector('.ocs-gallery__prev').addEventListener('click', () => open(current - 1));
box.querySelector('.ocs-gallery__next').addEventListener('click', () => open(current + 1));
box.addEventListener('click', (e) => { if (e.target === box) close(); });
box.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') open(current - 1);
    if (e.key === 'ArrowRight') open(current + 1);
});

async function init() {
    say('Loading photos…');
    try {
        photos = (await getJson('/gallery?limit=60')).photos || [];
    } catch (err) {
        say('The gallery could not be loaded right now.');
        return;
    }
    say(photos.length ? '' : 'No photos from recent events yet.');
    photos.forEach((p, i) => {
        const button = h('button', { type: 'button', class: 'ocs-gallery__thumb', 'aria-label': `Open photo: ${describe(p)}` }, [
            h('img', { src: photoUrl(p), alt: '', loading: 'lazy' }),
            h('span', { text: p.event_title }),
        ]);
        button.addEventListener('click', () => open(i, button));
        grid.append(h('li', {}, button));
    });
    box.querySelectorAll('.ocs-gallery__prev, .ocs-gallery__next').forEach((b) => { b.hidden = photos.length < 2; });
}

init();
