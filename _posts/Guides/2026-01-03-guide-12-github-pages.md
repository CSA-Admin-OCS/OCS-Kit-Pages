---
layout: post
title: GitHub Pages Basics
description: How a GitHub Pages site is built from a repository, and how to publish your own.
categories:
- Guides
author: OCS Kit
codemirror: false
toc: true
permalink: /guides/github-pages/
lesson_course: guides
lesson_unit: GitHub Pages
lesson_order: 12
lesson_kind: guide
---

## GitHub Pages Task

Welcome to your GitHub Pages mini-project journey! This article will guide you through essential skills for starting with web programming with GitHub Pages and updating your home page (index.md).

The articles listed are relevant and will be part of future learnings.  But for now, just focus on adding links to these in your preferred style on your home page.

The joy is in the task and seeing information come alive.

<div class="mermaid">
graph TD
    A[Notebooks & Jokes] --> B[Anatomy]
    B --> C[Theme]
    C --> D[Markdown]
    D --> E[Jekyll]
    E --> F[Hacks]
    linkStyle default stroke:#1e90ff,stroke-width:3px;
</div>

---

## Home Page Edits

Review the following menus, observe all the menu styles.  They all do navigation to other pages in a different way.  Pick one or more styles and update your home page with some updates.

### HTML Orientation 1

<table>
  <tr>
    <th>Notebooks & Jokes</th>
    <th>Anatomy</th>
    <th><a href="{{site.baseurl}}/guides/pages-theme/">Theme</a></th>
    <th><a href="{{site.baseurl}}/guides/markdown-page/">Markdown</a></th>
    <th>Jekyll</th>
    <th>Hacks</th>
  </tr>
  <tr>
    <td>Fun with JavaScript and Jupyter Notebooks</td>
    <td>Explore the structure of a GitHub Pages site</td>
    <td>Learn about theme templates and layout of SASS files for advanced styling</td>
    <td>Master Markdown for content creation</td>
    <td>Understand Jekyll static site generation</td>
    <td>Apply your knowledge with hands-on challenges</td>
  </tr>
</table>

---

### HTML Orientation 2

<table>
  <tr>
    <th>Topic</th>
    <th>Description</th>
  </tr>
  <tr>
    <td>Notebooks & Jokes</td>
    <td>Fun with JavaScript and Jupyter Notebooks</td>
  </tr>
  <tr>
    <td>Anatomy</td>
    <td>Explore the structure of a GitHub Pages site</td>
  </tr>
  <tr>
    <td><a href="{{site.baseurl}}/guides/pages-theme/">Theme</a></td>
    <td>Learn about theme templates and layout of SASS files for advanced styling</td>
  </tr>
  <tr>
    <td><a href="{{site.baseurl}}/guides/markdown-page/">Markdown</a></td>
    <td>Master Markdown for content creation</td>
  </tr>
  <tr>
    <td>Jekyll</td>
    <td>Understand Jekyll static site generation</td>
  </tr>
  <tr>
    <td>Hacks</td>
    <td>Apply your knowledge with hands-on challenges</td>
  </tr>
</table>

---

### Markdown Orientation 1

- **Start at the top** and follow the arrows to progress through each topic.

- Jupyter Notebooks & Jokes
  - Learn JavaScript in Jupyter Notebooks with a fun twist—random programming and accounting jokes!
- GH Pages Anatomy
  - Explore the structure of a GitHub Pages site
- [Theme]({{site.baseurl}}/guides/pages-theme/)
  - Learn about theme templates and layout of SASS files for advanced styling
- [Markdown]({{site.baseurl}}/guides/markdown-page/)
  - Master Markdown for content creation
- Jekyll
  - Understand Jekyll static site generation

---

### Markdown Orientation 2

- Jupyter Notebooks & Jokes: Fun with JavaScript and Jupyter Notebooks
- Anatomy: Explore the structure of a GitHub Pages site
- [Theme]({{site.baseurl}}/guides/pages-theme/): Learn about theme templates and layout of SASS files for advanced styling
- [Markdown]({{site.baseurl}}/guides/markdown-page/): Master Markdown for content creation
- Jekyll: Understand Jekyll static site generation
- Hacks: Apply your knowledge with hands-on challenges

---

### [Tailwind](https://tailwindcss.com/plus/ui-blocks/application-ui/page-examples/home-screens)

<div class="flex flex-wrap gap-6 justify-center my-8">
  <!-- Notebooks & Jokes Card -->
  <div class="bg-gray-800 shadow-md rounded-lg p-6 w-72 flex flex-col items-center hover:shadow-xl transition">
    Notebooks & Jokes
    <p class="text-gray-700 text-center">Fun with JavaScript and Jupyter Notebooks</p>
  </div>
  <!-- Anatomy Card -->
  <div class="bg-gray-400 shadow-md rounded-lg p-6 w-72 flex flex-col items-center hover:shadow-xl transition">
    Anatomy
    <p class="text-gray-700 text-center">Explore the structure of a GitHub Pages site</p>
  </div>
  <!-- Theme Card -->
  <div class="bg-red-600 shadow-md rounded-lg p-6 w-72 flex flex-col items-center hover:shadow-xl transition">
    <a href="{{site.baseurl}}/guides/pages-theme/" class="text-xl font-bold text-blue-600 hover:underline mb-2">Theme</a>
    <p class="text-gray-700 text-center">Learn about theme templates and layout of SASS files for advanced styling</p>
  </div>
  <!-- Markdown Card -->
  <div class="bg-green-600 shadow-md rounded-lg p-6 w-72 flex flex-col items-center hover:shadow-xl transition">
    <a href="{{site.baseurl}}/guides/markdown-page/" class="text-xl font-bold text-blue-600 hover:underline mb-2">Markdown</a>
    <p class="text-gray-700 text-center">Master Markdown for content creation</p>
  </div>
  <!-- Jekyll Card -->
  <div class="bg-purple-600 shadow-md rounded-lg p-6 w-72 flex flex-col items-center hover:shadow-xl transition">
    Jekyll
    <p class="text-gray-700 text-center">Understand Jekyll static site generation</p>
  </div>
  <!-- Hacks Card -->
  <div class="bg-pink-600 shadow-md rounded-lg p-6 w-72 flex flex-col items-center hover:shadow-xl transition">
    Hacks
    <p class="text-gray-700 text-center">Apply your knowledge with hands-on challenges</p>
  </div>
</div>

---

## Hack

> Ready to begin? Start building a layout and articles on your personal Home Page (index.md).

1. Pick a style to navigate to these items on your Home Page
2. Move all of these documents into your personal repository and get all the links working.
3. Read the articles and make a summary paragraph on the index.md page, so you can recognize why you made links to these topics in the future.

<nav class="ocs__pager" aria-label="Lesson navigation">
  <a class="ocs__pager-link" href="{{site.baseurl}}/guides/javascript-html-css-kernels/">&larr; HTML, CSS, and JavaScript in Notebooks</a>
  <a class="ocs__pager-link next" href="{{site.baseurl}}/guides/markdown-page/">Build a Markdown Page &rarr;</a>
</nav>

[All Guides]({{site.baseurl}}/guides/)
