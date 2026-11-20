---
layout: opencs
title: Event Gallery
description: Photos from recent events.
permalink: /events/gallery/
---

<div class="ocs-events">
  <header class="ocs-events__head">
    <h1>Event gallery</h1>
    <p>Photos from recent events. <a href="{{ site.baseurl }}/events/">See upcoming events</a></p>
  </header>
  <p id="gallery-status" class="ocs-events__status" role="status" aria-live="polite" hidden></p>
  <ul class="ocs-gallery__grid" id="gallery-grid"></ul>

  <dialog id="gallery-lightbox" class="ocs-gallery__box" aria-label="Photo viewer">
    <figure>
      <img alt="">
      <figcaption></figcaption>
    </figure>
    <div class="ocs-gallery__controls">
      <button type="button" class="ocs__btn small ocs-gallery__prev">Previous</button>
      <button type="button" class="ocs__btn small ocs-gallery__next">Next</button>
      <button type="button" class="ocs__btn small accent ocs-gallery__close">Close</button>
    </div>
  </dialog>
</div>

<script type="module" src="{{ site.baseurl }}/assets/js/events/gallery.js"></script>
