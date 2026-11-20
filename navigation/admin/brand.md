---
layout: opencs
title: Branding
description: Set your site's name, logo and welcome text (Admins only).
permalink: /admin/brand/
search_exclude: true
---

<div class="ocs__admin" id="admin-brand">
  <header class="ocs__admin-head">
    <div>
      <nav class="ocs__admin-crumbs" aria-label="Breadcrumb"><a href="{{ site.baseurl }}/admin/">Admin Dashboard</a> / Branding</nav>
      <h1>Branding</h1>
      <p>Your site starts unbranded. Add your name, logo and welcome text here and the home page uses them straight away. Leave a field empty to show its placeholder.</p>
    </div>
    <span class="ocs__badge">Admin</span>
  </header>

  {% include admin/gate.html %}

  <section id="admin-gate-staff" class="ocs__card" hidden>
    <h2 class="ocs__section-title">Branding</h2>
    <p>Only Admins can change the site's branding. Ask an Admin if you need it changed.</p>
  </section>

  <div id="admin-gate-content" hidden>
    <form class="ocs__card" id="brand-form" novalidate>
      <h2 class="ocs__section-title">Name and welcome</h2>
      <p><label for="brand-name"><strong>Site name</strong> <small>(up to 80 characters)</small></label><br>
        <input class="ocs__input" id="brand-name" name="name" type="text" maxlength="80" placeholder="Your Company" autocomplete="off"></p>
      <p><label for="brand-tagline"><strong>Tagline</strong> <small>(up to 200 characters)</small></label><br>
        <input class="ocs__input" id="brand-tagline" name="tagline" type="text" maxlength="200" placeholder="Your tagline goes here" autocomplete="off"></p>
      <p><label for="brand-hero-text"><strong>Welcome message</strong> <small>(up to 500 characters)</small></label><br>
        <textarea class="ocs__input" id="brand-hero-text" name="hero_text" rows="3" maxlength="500" placeholder="Add a short welcome message for your visitors."></textarea></p>

      <h2 class="ocs__section-title">Images</h2>
      <p>Paste the web address of each image (starting with <code>https://</code>), or a path on this site such as <code>/images/logo.png</code>.</p>
      <p><label for="brand-logo-url"><strong>Logo address</strong></label><br>
        <input class="ocs__input" id="brand-logo-url" name="logo_url" type="url" maxlength="500" placeholder="https://example.com/logo.png" autocomplete="off"></p>
      <p><label for="brand-hero-image-url"><strong>Hero image address</strong></label><br>
        <input class="ocs__input" id="brand-hero-image-url" name="hero_image_url" type="url" maxlength="500" placeholder="https://example.com/hero.jpg" autocomplete="off"></p>

      <div class="ocs__links">
        <button type="submit" class="ocs__btn accent fill" id="brand-save">Save branding</button>
        <button type="button" class="ocs__btn" id="brand-reset">Reset to unbranded</button>
        <a class="ocs__btn" href="{{ site.baseurl }}/" id="brand-view">View the home page</a>
      </div>
    </form>
  </div>
</div>

<script type="module" src="{{ site.baseurl }}/assets/js/admin/brand.js"></script>
