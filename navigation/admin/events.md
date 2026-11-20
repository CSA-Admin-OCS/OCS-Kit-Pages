---
layout: opencs
title: Manage Events
description: Add, edit and delete events, schedule posts about them and upload photos (Admins only).
permalink: /admin/events/
search_exclude: true
events_ticker: false
---

<div class="ocs__admin" id="admin-events">
  <header class="ocs__admin-head">
    <div>
      <nav class="ocs__admin-crumbs" aria-label="Breadcrumb"><a href="{{ site.baseurl }}/admin/">Admin Dashboard</a> / Events</nav>
      <h1>Manage Events</h1>
      <p>Upcoming events scroll across the top of every page in time order. Add an event, let it repeat, schedule posts that go live before or after it, and add photos for the gallery.</p>
    </div>
    <span class="ocs__badge">Admin</span>
  </header>

  {% include admin/gate.html %}

  <div id="admin-gate-content" hidden>
    <section class="ocs__card" aria-labelledby="form-title">
      <h2 class="ocs__section-title" id="form-title">Add an event</h2>
      <form id="event-form" class="ocs-admin-form" novalidate>
        <input type="hidden" id="ev-id">
        <label>Title <input class="ocs__input" id="ev-title" maxlength="200" required></label>
        <label>Starts <input class="ocs__input" id="ev-start" type="datetime-local" min="2000-01-01T00:00" max="2100-12-31T23:59" required></label>
        <label>Ends (optional) <input class="ocs__input" id="ev-end" type="datetime-local" min="2000-01-01T00:00" max="2100-12-31T23:59"></label>
        <label>Location <input class="ocs__input" id="ev-location" maxlength="200"></label>
        <label class="ocs-admin-form__wide">Description <textarea class="ocs__input" id="ev-description" rows="4"></textarea></label>
        <label>Status
          <select class="ocs__input" id="ev-status">
            <option value="published">Published (visible to everyone)</option>
            <option value="draft">Draft (only admins see it, never on the ticker)</option>
            <option value="cancelled">Cancelled (hidden from visitors)</option>
          </select>
        </label>
        <label>Repeats
          <select class="ocs__input" id="ev-repeat">
            <option value="none">Does not repeat</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>
        <label>Repeat until (optional) <input class="ocs__input" id="ev-until" type="date" min="2000-01-01" max="2100-12-31"></label>
        <div class="ocs-admin-form__actions">
          <button type="submit" class="ocs__btn accent fill" id="ev-save">Add event</button>
          <button type="button" class="ocs__btn" id="ev-cancel" hidden>Cancel editing</button>
        </div>
      </form>
    </section>

    <section class="ocs__card" aria-labelledby="list-title">
      <h2 class="ocs__section-title" id="list-title">All events</h2>
      <p id="ev-empty" class="ocs__admin-crumbs" hidden>No events yet. Add the first one above.</p>
      <ul class="ocs-admin-events" id="ev-list"></ul>
    </section>
  </div>
</div>

<script type="module" src="{{ site.baseurl }}/assets/js/admin/events.js"></script>
