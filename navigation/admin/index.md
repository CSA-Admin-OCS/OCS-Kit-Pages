---
layout: opencs
title: Admin Dashboard
description: Kit, roles, users and feature status for the site's Admins.
permalink: /admin/
search_exclude: true
---

<div class="ocs__admin" id="admin-dashboard">
  <header class="ocs__admin-head">
    <div>
      <span class="ocs__badge" id="admin-kit-badge">Admin</span>
      <h1>Admin Dashboard</h1>
      <p>Your site at a glance: which kit it runs, who uses it, and which features are on or still need setup.</p>
    </div>
  </header>

  {% include admin/gate.html %}

  <section id="admin-gate-staff" class="ocs__card" aria-labelledby="staff-title" hidden>
    <h2 class="ocs__section-title" id="staff-title">Features on this site</h2>
    <p>You can see which features are on. Only Admins can turn features on or off; ask an Admin if you need one.</p>
    <ul class="ocs__admin-readonly" id="staff-features"></ul>
  </section>

  <div id="admin-gate-content" hidden>
    <div class="ocs__admin-cards">
      <section class="ocs__card" aria-labelledby="kit-title">
        <h2 class="ocs__section-title" id="kit-title">Kit</h2>
        <div class="ocs__admin-big" id="kit-name">&nbsp;</div>
        <p id="kit-desc" class="ocs__admin-crumbs"></p>
        <dl class="ocs__admin-kv" id="kit-backends"></dl>
      </section>

      <section class="ocs__card" aria-labelledby="roles-title">
        <h2 class="ocs__section-title" id="roles-title">Roles and users</h2>
        <dl class="ocs__admin-kv" id="role-counts"></dl>
        <p class="ocs__admin-crumbs" id="role-note"></p>
        <div class="ocs__admin-card-foot" id="user-links"></div>
      </section>

      <section class="ocs__card" aria-labelledby="feat-title">
        <h2 class="ocs__section-title" id="feat-title">Features</h2>
        <div class="ocs__admin-big" id="feat-on">&nbsp;</div>
        <div class="ocs__admin-row" id="feat-pills"></div>
        <div class="ocs__admin-card-foot">
          <a class="ocs__btn accent fill" href="{{ site.baseurl }}/admin/features/" id="feat-manage">Manage features</a>
        </div>
      </section>
    </div>

    <section class="ocs__card" aria-labelledby="setup-title" id="setup-card" hidden>
      <h2 class="ocs__section-title" id="setup-title">Needs setup</h2>
      <p class="ocs__admin-crumbs">These features are on but are missing a required setting, so they will not fully work yet. Open the guide for step-by-step instructions.</p>
      <ul class="ocs__admin-readonly" id="setup-list"></ul>
    </section>

    <section class="ocs__card" aria-labelledby="links-title">
      <h2 class="ocs__section-title" id="links-title">Admin tools</h2>
      <ul class="ocs__admin-links" id="admin-links"></ul>
    </section>
  </div>
</div>

<script type="module" src="{{ site.baseurl }}/assets/js/admin/dashboard.js"></script>
