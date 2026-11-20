---
layout: opencs
title: Events
description: Upcoming events, in time order.
permalink: /events/
events_ticker: false
---

<div class="ocs-events">
  <header class="ocs-events__head">
    <h1 id="events-heading">Upcoming events</h1>
    <p>
      <button type="button" class="ocs__btn small" id="events-past-toggle">Show past events</button>
      <a class="ocs__btn small" href="{{ site.baseurl }}/events/gallery/">Photo gallery</a>
    </p>
  </header>
  <p id="events-status" class="ocs-events__status" role="status" aria-live="polite" hidden></p>
  <ul class="ocs-events__list" id="events-list"></ul>
</div>

<script type="module" src="{{ site.baseurl }}/assets/js/events/events-page.js"></script>
