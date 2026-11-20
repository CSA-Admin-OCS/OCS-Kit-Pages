---
---
// Admin > Events (/admin/events/): create, edit and delete events, skip one date of a repeating event,
// schedule posts, and add or remove photos. Only an Admin session gets past the gate, and the Flask
// backend checks the admin role again on every write.
import { getIdentity } from '{{ site.baseurl }}/assets/js/admin/kit-api.js';
import { announce, showGate } from '{{ site.baseurl }}/assets/js/admin/common.js';
import { API, h, formatWhen, photoUrl, REPEAT_TEXT } from '{{ site.baseurl }}/assets/js/events/events-common.js';
import { fetchOptions } from '{{ site.baseurl }}/assets/js/api/config.js';

const $ = (id) => document.getElementById(id);
const form = $('event-form');
const listEl = $('ev-list');
const STATUS_TEXT = { published: 'Published', draft: 'Draft', cancelled: 'Cancelled' };
let events = [];
const openPanels = new Set();   // event ids whose posts/photos panel is open, kept across refreshes

/** Call the admin API. Resolves to {ok, data}; the message of a failure is always readable. */
async function call(method, path, body, formData) {
    const options = { ...fetchOptions, method, cache: 'no-store' };
    if (formData) {
        options.headers = { 'X-Origin': 'client' };   // the browser sets the multipart boundary itself
        options.body = formData;
    } else if (body !== undefined) {
        options.body = JSON.stringify(body);
    }
    try {
        const res = await fetch(`${API}${path}`, options);
        let data = null;
        try { data = await res.json(); } catch (_) { /* no body */ }
        return { ok: res.ok, status: res.status, data };
    } catch (err) {
        return { ok: false, status: 0, data: { message: 'The Flask backend did not answer.' } };
    }
}

function fail(result, what) {
    const msg = result.data && result.data.message;
    announce(`${what} failed${msg ? ': ' + msg : ` (${result.status})`}`, 'error');
}

const toInput = (text) => (text ? text.slice(0, 16) : '');   // 2030-06-20T18:00:00 -> datetime-local

/** A date-time that opens on the next full hour, so the Starts box is never half empty. */
function nextHour() {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() + 1);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
}

/** Plain-words problem with a date or date-time box, or '' when it is fine (or optional and empty). */
function dateProblem(input, label, required) {
    if (input.validity && input.validity.badInput) {
        return `The ${label} is only partly filled in. Pick the date, the hour, the minutes and AM or PM.`;
    }
    if (!input.value) return required ? `Please choose the ${label}.` : '';
    const year = Number(input.value.slice(0, 4));
    if (year < 2000 || year > 2100) return `The ${label} has a year that looks wrong (${input.value.slice(0, 4)}). Use a year between 2000 and 2100.`;
    return '';
}

/** Show the first problem on the page and put the cursor in that box. Returns true if there was one. */
function complain(problems) {
    const first = problems.find(([text]) => text);
    if (!first) return false;
    announce(first[0], 'error');
    first[1].focus();
    return true;
}

// ------------------------------------------------------------------ the event form

function resetForm() {
    form.reset();
    $('ev-start').value = nextHour();
    $('ev-id').value = '';
    $('form-title').textContent = 'Add an event';
    $('ev-save').textContent = 'Add event';
    $('ev-cancel').hidden = true;
}

function editEvent(ev) {
    $('ev-id').value = ev.id;
    $('ev-title').value = ev.title;
    $('ev-start').value = toInput(ev.start);
    $('ev-end').value = toInput(ev.end);
    $('ev-location').value = ev.location || '';
    $('ev-description').value = ev.description || '';
    $('ev-status').value = ev.status;
    $('ev-repeat').value = ev.repeat;
    $('ev-until').value = ev.repeat_until || '';
    $('form-title').textContent = 'Edit event';
    $('ev-save').textContent = 'Save changes';
    $('ev-cancel').hidden = false;
    form.scrollIntoView({ block: 'center' });
    $('ev-title').focus();
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const startDay = $('ev-start').value.slice(0, 10);
    if (complain([
        [$('ev-title').value.trim() ? '' : 'Please give the event a title.', $('ev-title')],
        [dateProblem($('ev-start'), 'start time', true), $('ev-start')],
        [dateProblem($('ev-end'), 'end time', false), $('ev-end')],
        [$('ev-end').value && $('ev-start').value && $('ev-end').value < $('ev-start').value ? 'The event ends before it starts.' : '', $('ev-end')],
        [dateProblem($('ev-until'), '"repeat until" date', false), $('ev-until')],
        [$('ev-until').value && startDay && $('ev-until').value < startDay ? 'The "repeat until" date is before the event starts.' : '', $('ev-until')],
        [$('ev-repeat').value !== 'none' && $('ev-end').value && $('ev-end').value.slice(0, 10) !== startDay ? 'A repeating event has to start and end on the same day.' : '', $('ev-end')],
    ])) return;
    const body = {
        title: $('ev-title').value, start: $('ev-start').value, end: $('ev-end').value || null,
        location: $('ev-location').value, description: $('ev-description').value,
        status: $('ev-status').value, repeat: $('ev-repeat').value, repeat_until: $('ev-until').value || null,
    };
    const id = $('ev-id').value;
    const result = await call(id ? 'PUT' : 'POST', id ? `/${id}` : '', body);
    if (!result.ok) { fail(result, id ? 'Saving the event' : 'Adding the event'); return; }
    announce(id ? 'Event saved.' : 'Event added.', 'ok');
    resetForm();
    await refresh();
});

$('ev-cancel').addEventListener('click', resetForm);

// ------------------------------------------------------------------ the list

async function removeEvent(ev) {
    if (!window.confirm(`Delete "${ev.title}"? Its posts and photos are deleted too.`)) return;
    const result = await call('DELETE', `/${ev.id}`);
    if (!result.ok) { fail(result, 'Deleting the event'); return; }
    announce('Event deleted.', 'ok');
    openPanels.delete(ev.id);
    if ($('ev-id').value === String(ev.id)) resetForm();
    await refresh();
}

async function skipDate(ev, input) {
    if (!input.value) { announce('Pick the date and time of the occurrence to skip.', 'error'); return; }
    const result = await call('POST', `/${ev.id}/skip`, { start: input.value });
    if (!result.ok) { fail(result, 'Skipping that date'); return; }
    announce('That date is now skipped.', 'ok');
}

function postsSection(ev) {
    const items = ev.posts.map((p) => {
        const del = h('button', { type: 'button', class: 'ocs__btn small', text: 'Delete' });
        del.append(h('span', { class: 'ocs__admin-sr', text: ` post ${p.title}` }));
        del.addEventListener('click', async () => {
            const r = await call('DELETE', `/posts/${p.id}`);
            if (!r.ok) { fail(r, 'Deleting the post'); return; }
            await refresh();
        });
        const live = p.publish_at.replace('T', ' ').slice(0, 16);
        return h('li', {}, [h('strong', { text: p.title }), ` (${p.kind}, goes live ${live}) `, del]);
    });
    const f = h('form', { class: 'ocs-admin-form', novalidate: true }, [
        h('label', {}, ['Post title ', h('input', { class: 'ocs__input', name: 'title', maxlength: '200' })]),
        h('label', {}, ['Goes live ', h('input', { class: 'ocs__input', name: 'publish_at', type: 'datetime-local' })]),
        h('label', {}, ['Hide again (optional) ', h('input', { class: 'ocs__input', name: 'unpublish_at', type: 'datetime-local' })]),
        h('label', {}, ['When it is for ', h('select', { class: 'ocs__input', name: 'kind' }, [
            h('option', { value: 'before', text: 'Before the event' }), h('option', { value: 'after', text: 'After the event' })])]),
        h('label', { class: 'ocs-admin-form__wide' }, ['Text ', h('textarea', { class: 'ocs__input', name: 'body', rows: '3' })]),
        h('div', { class: 'ocs-admin-form__actions' }, h('button', { type: 'submit', class: 'ocs__btn small accent', text: 'Schedule post' })),
    ]);
    f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const v = (n) => f.elements[n].value;
        if (complain([
            [v('title').trim() ? '' : 'The post needs a title.', f.elements.title],
            [v('body').trim() ? '' : 'The post needs some text.', f.elements.body],
            [dateProblem(f.elements.publish_at, 'time the post goes live', true), f.elements.publish_at],
            [dateProblem(f.elements.unpublish_at, 'time the post is hidden again', false), f.elements.unpublish_at],
        ])) return;
        const r = await call('POST', `/${ev.id}/posts`, {
            title: v('title'), body: v('body'), kind: v('kind'), publish_at: v('publish_at'), unpublish_at: v('unpublish_at') || null });
        if (!r.ok) { fail(r, 'Scheduling the post'); return; }
        announce('Post scheduled.', 'ok');
        await refresh();
    });
    return h('div', {}, [h('h4', { text: 'Scheduled posts' }), items.length ? h('ul', {}, items) : h('p', { text: 'None yet.' }), f]);
}

function photosSection(ev) {
    const items = ev.photos.map((p) => {
        const del = h('button', { type: 'button', class: 'ocs__btn small', text: 'Delete' });
        del.append(h('span', { class: 'ocs__admin-sr', text: ' photo' }));
        del.addEventListener('click', async () => {
            const r = await call('DELETE', `/photos/${p.id}`);
            if (!r.ok) { fail(r, 'Deleting the photo'); return; }
            await refresh();
        });
        return h('li', {}, [h('img', { src: photoUrl(p), alt: p.caption || 'Event photo', width: '96', height: '72' }), h('span', { text: p.caption || '' }), del]);
    });
    const file = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/gif,image/webp', name: 'file' });
    const caption = h('input', { class: 'ocs__input', name: 'caption', maxlength: '300' });
    const f = h('form', { class: 'ocs-admin-form', novalidate: true }, [
        h('label', {}, ['Photo (PNG, JPEG, GIF or WebP, up to 5 MB) ', file]),
        h('label', {}, ['Caption (optional) ', caption]),
        h('div', { class: 'ocs-admin-form__actions' }, h('button', { type: 'submit', class: 'ocs__btn small accent', text: 'Upload photo' })),
    ]);
    f.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!file.files.length) { announce('Choose a photo first.', 'error'); return; }
        const data = new FormData();
        data.append('file', file.files[0]);
        data.append('caption', caption.value);
        const r = await call('POST', `/${ev.id}/photos`, undefined, data);
        if (!r.ok) { fail(r, 'Uploading the photo'); return; }
        announce('Photo added.', 'ok');
        await refresh();
    });
    return h('div', {}, [h('h4', { text: 'Photos' }), items.length ? h('ul', { class: 'ocs-admin-photos' }, items) : h('p', { text: 'None yet.' }), f]);
}

function row(ev) {
    const panel = h('div', { class: 'ocs-admin-events__panel', hidden: !openPanels.has(ev.id) });
    const manage = h('button', { type: 'button', class: 'ocs__btn small', 'aria-expanded': String(openPanels.has(ev.id)), text: 'Posts and photos' });
    manage.addEventListener('click', () => {
        const open = panel.hidden;
        panel.hidden = !open;
        manage.setAttribute('aria-expanded', String(open));
        open ? openPanels.add(ev.id) : openPanels.delete(ev.id);
    });
    const edit = h('button', { type: 'button', class: 'ocs__btn small', text: 'Edit' });
    edit.append(h('span', { class: 'ocs__admin-sr', text: ` ${ev.title}` }));
    edit.addEventListener('click', () => editEvent(ev));
    const del = h('button', { type: 'button', class: 'ocs__btn small', text: 'Delete' });
    del.append(h('span', { class: 'ocs__admin-sr', text: ` ${ev.title}` }));
    del.addEventListener('click', () => removeEvent(ev));

    panel.append(postsSection(ev), photosSection(ev));
    if (ev.repeat !== 'none') {
        const date = h('input', { class: 'ocs__input', type: 'datetime-local', value: toInput(ev.start) });
        const skip = h('button', { type: 'button', class: 'ocs__btn small', text: 'Skip this date' });
        skip.addEventListener('click', () => skipDate(ev, date));
        panel.append(h('div', {}, [h('h4', { text: 'Skip one occurrence' }), h('p', { text: 'Enter the start of the date to leave out. The rest of the series stays.' }), date, ' ', skip]));
    }
    const meta = [formatWhen(ev.start, ev.end)];
    if (ev.location) meta.push(ev.location);
    if (REPEAT_TEXT[ev.repeat]) meta.push(REPEAT_TEXT[ev.repeat] + (ev.repeat_until ? ` until ${ev.repeat_until}` : ''));
    return h('li', { class: `ocs-admin-events__item is-${ev.status}` }, [
        h('div', { class: 'ocs-admin-events__head' }, [
            h('strong', { text: ev.title }),
            h('span', { class: 'ocs__admin-pill', text: STATUS_TEXT[ev.status] || ev.status }),
            h('span', { class: 'ocs-admin-events__meta', text: meta.join(' · ') }),
        ]),
        h('div', { class: 'ocs-admin-events__buttons' }, [edit, manage, del]),
        panel,
    ]);
}

async function refresh() {
    const result = await call('GET', '/admin');
    if (!result.ok) { fail(result, 'Loading events'); return; }
    events = result.data.events || [];
    listEl.replaceChildren(...events.map(row));
    $('ev-empty').hidden = events.length > 0;
}

// ------------------------------------------------------------------ start

(async function init() {
    const who = await getIdentity();
    if (who.role === 'anon') { showGate('signin'); return; }
    if (who.role !== 'admin') { showGate('denied', who.role === 'staff' ? 'a staff account' : 'a regular user'); return; }
    showGate('content');
    $('ev-start').value = nextHour();
    await refresh();
})();
