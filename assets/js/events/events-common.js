---
---
// Shared helpers for the events feature: the ticker, the events page, the gallery.
// All data comes from the Flask backend (GET /api/site-events). Text is only ever put on the page
// with textContent, never as HTML, so an event title cannot inject markup.
import { pythonURI, fetchOptions } from '{{ site.baseurl }}/assets/js/api/config.js';

export const API = `${pythonURI}/api/site-events`;

/** GET a JSON path under /api/site-events; resolves to the parsed body, or throws on any failure. */
export async function getJson(path) {
    const res = await fetch(`${API}${path}`, { ...fetchOptions, cache: 'no-store' });
    if (!res.ok) throw new Error(`events request failed (${res.status})`);
    return res.json();
}

export async function loadEvents(when = 'upcoming', limit = 50) {
    const data = await getJson(`?when=${encodeURIComponent(when)}&limit=${limit}`);
    return data.events || [];
}

/** "YYYY-MM-DDTHH:MM:SS" as a wall-clock Date (no time zone shifts, matching the backend). */
export function parseWall(text) {
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(text || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)) : null;
}

const DAY = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const TIME = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

export function formatDay(text) {
    const d = parseWall(text);
    return d ? DAY.format(d) : '';
}

export function formatTime(text) {
    const d = parseWall(text);
    return d ? TIME.format(d) : '';
}

/** "Fri, Jun 20, 6:00 PM" or "Fri, Jun 20, 6:00 PM to 8:00 PM" (a different day adds the end day). */
export function formatWhen(startText, endText) {
    if (!startText) return '';
    let out = `${formatDay(startText)}, ${formatTime(startText)}`;
    if (endText) {
        const sameDay = startText.slice(0, 10) === endText.slice(0, 10);
        out += sameDay ? ` to ${formatTime(endText)}` : ` to ${formatDay(endText)}, ${formatTime(endText)}`;
    }
    return out;
}

export const REPEAT_TEXT = { daily: 'Repeats daily', weekly: 'Repeats weekly', monthly: 'Repeats monthly' };

/** Where a visitor lands to read about one event. */
export function eventLink(id) {
    return `{{ site.baseurl }}/events/#event-${id}`;
}

/** Tiny element builder: h('a', { href, class }, 'text' | node | [children]). */
export function h(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
        if (value === false || value == null) continue;
        if (key === 'text') node.textContent = value;
        else node.setAttribute(key, value === true ? '' : value);
    }
    for (const child of [].concat(children)) {
        if (child == null) continue;
        node.append(child.nodeType ? child : document.createTextNode(String(child)));
    }
    return node;
}

/** A photo's address on the backend (the API returns it relative to the backend). */
export function photoUrl(photo) {
    return /^https?:\/\//.test(photo.url) ? photo.url : `${pythonURI}${photo.url}`;
}
