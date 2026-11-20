---
---
// The public events page (/events/): upcoming events in time order, a button for past ones, and a
// "Details" panel per event with its photos and the posts that are live right now.
import { getJson, loadEvents, formatDay, formatTime, formatWhen, REPEAT_TEXT, photoUrl, h } from '{{ site.baseurl }}/assets/js/events/events-common.js';

const list = document.getElementById('events-list');
const status = document.getElementById('events-status');
const pastButton = document.getElementById('events-past-toggle');
let showingPast = false;

function say(text) {
    status.textContent = text;
    status.hidden = !text;
}

async function loadDetails(ev, panel) {
    panel.replaceChildren(h('p', { text: 'Loading…' }));
    try {
        const detail = await getJson(`/${ev.id}`);
        const parts = [];
        if (detail.description) parts.push(h('p', { class: 'ocs-events__description', text: detail.description }));
        for (const post of detail.posts || []) {
            parts.push(h('article', { class: 'ocs-events__post' }, [
                h('h4', {}, [post.title, h('span', { class: `ocs-events__tag ocs-events__tag--${post.kind}`, text: post.kind === 'after' ? 'After the event' : 'Before the event' })]),
                h('p', { text: post.body }),
            ]));
        }
        if ((detail.photos || []).length) {
            parts.push(h('ul', { class: 'ocs-events__photos' }, detail.photos.map((p) => h('li', {}, h('img', { src: photoUrl(p), alt: p.caption || `Photo from ${ev.title}`, loading: 'lazy' })))));
        }
        panel.replaceChildren(...(parts.length ? parts : [h('p', { text: 'No more details yet.' })]));
    } catch (err) {
        panel.replaceChildren(h('p', { class: 'ocs-events__error', text: 'Could not load the details. Try again later.' }));
    }
}

function card(ev, past) {
    const start = ev.occurrence_start;
    const panel = h('div', { class: 'ocs-events__panel', id: `event-panel-${ev.id}-${start}`, hidden: true });
    const button = h('button', { type: 'button', class: 'ocs__btn small', 'aria-expanded': 'false', 'aria-controls': panel.id, text: 'Details' });
    let loaded = false;
    button.addEventListener('click', () => {
        const open = panel.hidden;
        panel.hidden = !open;
        button.setAttribute('aria-expanded', String(open));
        if (open && !loaded) { loaded = true; loadDetails(ev, panel); }
    });
    const meta = [formatWhen(start, ev.occurrence_end)];
    if (ev.location) meta.push(ev.location);
    if (REPEAT_TEXT[ev.repeat]) meta.push(REPEAT_TEXT[ev.repeat]);
    return h('li', { class: `ocs-events__card${past ? ' is-past' : ''}`, id: `event-${ev.id}` }, [
        h('div', { class: 'ocs-events__date', 'aria-hidden': 'true' }, [h('span', { text: formatDay(start) }), h('span', { text: formatTime(start) })]),
        h('div', { class: 'ocs-events__body' }, [
            h('h3', { text: ev.title }),
            h('p', { class: 'ocs-events__meta', text: meta.join(' · ') }),
            button,
            panel,
        ]),
    ]);
}

async function show(when) {
    say('Loading events…');
    try {
        const events = await loadEvents(when, 100);
        list.replaceChildren(...events.map((ev) => card(ev, when === 'past')));
        say(events.length ? '' : (when === 'past' ? 'No past events yet.' : 'No upcoming events right now. Check back soon.'));
        const wanted = location.hash.startsWith('#event-') ? document.getElementById(location.hash.slice(1)) : null;
        if (wanted) wanted.scrollIntoView();
    } catch (err) {
        list.replaceChildren();
        say('Events could not be loaded right now.');
    }
}

pastButton.addEventListener('click', () => {
    showingPast = !showingPast;
    pastButton.textContent = showingPast ? 'Show upcoming events' : 'Show past events';
    document.getElementById('events-heading').textContent = showingPast ? 'Past events' : 'Upcoming events';
    show(showingPast ? 'past' : 'upcoming');
});

show('upcoming');
