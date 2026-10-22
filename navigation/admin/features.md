---
layout: opencs
title: Feature Manager
description: Turn site features on or off and follow each feature's setup guide (Admins only).
permalink: /admin/features/
search_exclude: true
---

<div class="ocs__admin" id="admin-features">
  <header class="ocs__admin-head">
    <div>
      <nav class="ocs__admin-crumbs" aria-label="Breadcrumb"><a href="{{ site.baseurl }}/admin/" id="crumb-admin">Admin Dashboard</a> / Features</nav>
      <h1>Feature Manager</h1>
      <p>Turn features on or off for everyone on this site. Many features need a key or a setting on the server before they fully work: each card shows whether it is ready, and <strong>Setup guide</strong> walks you through the rest.</p>
    </div>
    <span class="ocs__badge" id="admin-kit-badge">Admin</span>
  </header>

  {% include admin/gate.html %}

  <section id="admin-gate-staff" class="ocs__card" aria-labelledby="staff-title" hidden>
    <h2 class="ocs__section-title" id="staff-title">Features on this site</h2>
    <p>You can see which features are on. Only Admins can turn features on or off; ask an Admin if you need one.</p>
    <ul class="ocs__admin-readonly" id="staff-features"></ul>
  </section>

  <div id="admin-gate-content" hidden>
    <div class="ocs__admin-toolbar" role="search">
      <label class="ocs__admin-sr" for="feature-search">Search features</label>
      <input id="feature-search" class="ocs__input" type="search" placeholder="Search features" autocomplete="off">
      <label class="ocs__admin-sr" for="feature-filter">Show</label>
      <select id="feature-filter" class="ocs__input">
        <option value="all">All features</option>
        <option value="on">On</option>
        <option value="off">Off</option>
        <option value="setup">Needs setup</option>
      </select>
      <button type="button" class="ocs__btn small" id="feature-refresh">Refresh status</button>
    </div>
    <div id="feature-groups"></div>
  </div>

  <div class="ocs__modal ocs__admin-dialog" id="guide-dialog" role="dialog" aria-modal="true" aria-labelledby="guide-title" hidden>
    <div class="ocs__modal-card">
      <div class="ocs__modal-header">
        <h2 class="ocs__modal-title" id="guide-title">Setup guide</h2>
        <button type="button" class="ocs__btn small" id="guide-close">Close<span class="ocs__admin-sr"> setup guide</span></button>
      </div>
      <div id="guide-body"></div>
    </div>
  </div>

  <div class="ocs__modal ocs__admin-dialog ocs__admin-confirm" id="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-body" hidden>
    <div class="ocs__modal-card">
      <div class="ocs__modal-header">
        <h2 class="ocs__modal-title" id="confirm-title">Turn on this feature?</h2>
      </div>
      <div id="confirm-body"></div>
      <div class="ocs__modal-actions">
        <button type="button" class="ocs__btn" id="confirm-cancel">Cancel</button>
        <button type="button" class="ocs__btn accent fill" id="confirm-ok">Turn on</button>
      </div>
    </div>
  </div>
</div>

<script type="module" src="{{ site.baseurl }}/assets/js/admin/features.js"></script>
