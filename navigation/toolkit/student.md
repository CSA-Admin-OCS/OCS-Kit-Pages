---
layout: opencs 
title: Student Toolkit
description: 
permalink: /student
---

{%- comment -%}
  Only tools this website has pages for (hall pass, presentation queue and submission buttons
  were dropped: there are no such pages). Buttons hide when their kit feature is off.
{%- endcomment -%}
<div class="toolkit-buttons">
  {%- include kit/url-feature.html url="/student/calendar" %}
  {%- unless kit_off %}
  <a href="{{site.baseurl}}/student/calendar" class="toolkit-button" data-feature="{{ kit_feature }}" data-description="Never lose track of your assignments again with the Slack Integrated Calendar!">
    <img src="{{site.baseurl}}/images/toolkit-nav-buttons/calendar.png" alt="Calendar" />
    <span class="button-name">Calendar</span>
    <div class="description">
      <p>View all slack announcements in one place.</p>
    </div>
  </a>
  {%- endunless %}
</div>

<style>
  .toolkit-buttons {
    display: flex;
    justify-content: space-around;
    align-items: flex-start;
    height: 100vh;
    margin: 0;
    padding: 20px;
  }

  .toolkit-button {
    width: 30%;
    height: auto;
    background-color: transparent;
    color: white;
    font-size: 1.5rem;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    transition: all 0.3s ease;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: center;
    text-align: center;
    text-decoration: none;
    padding-bottom: 20px;
  }

  .toolkit-button img {
    width: 100%;
    height: auto;
    object-fit: cover;
    border-radius: 8px;
    filter: blur(5px);
    transition: filter 0.3s ease, transform 0.3s ease;
  }

  .toolkit-button .button-name {
    position: relative;
    z-index: 1;
    font-size: 1.2rem;
    margin: 10px 0;
  }

  .toolkit-button .description {
    opacity: 0;
    position: relative;
    background: none;
    color: white;
    padding: 10px;
    text-align: center;
    transition: opacity 0.3s ease, transform 0.3s ease;
    white-space: normal;
    width: 100%;
    z-index: 1;
    font-size: 0.8rem;
    margin-top: 10px;
  }

  .toolkit-button:hover {
    transform: scale(1.1);
  }

  .toolkit-button:hover img {
    filter: blur(0);
  }

  .toolkit-button:hover .description {
    opacity: 1;
    transform: translateY(10px);
  }
</style>