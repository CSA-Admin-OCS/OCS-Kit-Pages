---
---
// The upcoming-events ticker: a strip on every page that scrolls the next events in time order.
// It lives in <template data-kit-load="events"> (see _includes/events/ticker.html), so none of this
// runs, and no request is made, unless the events feature is on.
import { loadEvents, formatWhen, eventLink, h } from '{{ site.baseurl }}/assets/js/events/events-common.js';

const REFRESH_MS = 5 * 60 * 1000;
const PIXELS_PER_SECOND = 70;
const MAX_ITEMS = 12;

const bar = document.getElementById('ocs-events-ticker');

function item(ev, hidden) {
    const when = formatWhen(ev.occurrence_start, ev.occurrence_end);
    const link = h('a', { href: eventLink(ev.id), tabindex: hidden ? '-1' : false }, [
        h('strong', { text: ev.title }),
        h('span', { class: 'ocs-ticker__when', text: when }),
        ev.location ? h('span', { class: 'ocs-ticker__where', text: ev.location }) : null,
    ]);
    return h('li', { class: 'ocs-ticker__item' }, link);
}

function render(events) {
    const track = bar.querySelector('.ocs-ticker__track');
    track.replaceChildren();
    if (!events.length) {
        bar.hidden = true;
        return;
    }
    // A repeating event appears once, at its next date, so one weekly meeting cannot fill the strip.
    const seen = new Set();
    const shown = events.filter((ev) => !seen.has(ev.id) && seen.add(ev.id)).slice(0, MAX_ITEMS);
    for (const ev of shown) track.append(item(ev, false));
    // A second copy makes the loop seamless. Screen readers and the tab key only meet the first.
    const copy = h('ul', { class: 'ocs-ticker__track ocs-ticker__track--copy', 'aria-hidden': 'true' });
    for (const ev of shown) copy.append(item(ev, true));
    track.after(copy);
    bar.hidden = false;
    // Speed follows the width, so a long list does not race past.
    requestAnimationFrame(() => {
        const width = track.scrollWidth || 600;
        bar.style.setProperty('--ticker-seconds', `${Math.max(12, Math.round(width / PIXELS_PER_SECOND))}s`);
    });
}

function clearCopy() {
    bar.querySelectorAll('.ocs-ticker__track--copy').forEach((n) => n.remove());
}

async function refresh() {
    try {
        const events = await loadEvents('upcoming', 100);
        clearCopy();
        render(events);
    } catch (err) {
        bar.hidden = true;  // a missing or sleeping backend must never break the page
    }
}

if (bar) {
    const button = bar.querySelector('.ocs-ticker__pause');
    button.addEventListener('click', () => {
        const paused = bar.classList.toggle('is-paused');
        button.setAttribute('aria-pressed', String(paused));
        button.textContent = paused ? 'Play' : 'Pause';
    });
    refresh();
    setInterval(refresh, REFRESH_MS);
}
