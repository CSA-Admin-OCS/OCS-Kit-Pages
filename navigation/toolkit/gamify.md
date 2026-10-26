---
layout: opencs 
title: Gamify Home Base
description: 
permalink: /gamify
menu: nav/home.html
---

<script type="module">
    import { login, pythonURI, javaURI, fetchOptions } from '{{site.baseurl}}/assets/js/api/config.js';
  
    async function verifyAuthentication() {
      const URL = `${javaURI}/api/person/get`;
      try {
        const response = await fetch(URL, fetchOptions);
        if (!response.ok) {
          throw new Error(`Spring server response: ${response.status}`);
        }
        return true; // Successful authentication
      } catch (error) {
        return false; // Authentication failed
      }
    }
  
    window.onload = async function() {
      const isAuthenticated = await verifyAuthentication();
      const loadingElement = document.getElementById('loadingElement');
      
      if (isAuthenticated) {
        loadingElement.style.display = "none";  // Hide the loading screen
      } else {
        // Create a blurred background overlay
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)'; // Semi-transparent black
        overlay.style.backdropFilter = 'blur(10px)'; // Blur effect
        overlay.style.zIndex = '999'; // Ensure it appears above other elements
        document.body.appendChild(overlay);

        // Create the "Please login" message box
        const message = document.createElement('div');
        message.style.position = 'absolute';
        message.style.top = '50%';
        message.style.left = '50%';
        message.style.transform = 'translate(-50%, -50%)';
        message.style.backgroundColor = 'black'; // Solid black background
        message.style.padding = '20px';
        message.style.fontSize = '20px';
        message.style.color = '#fff'; // White text color
        message.style.borderRadius = '10px';
        message.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)'; // Optional shadow for better visibility
        message.style.zIndex = '1000'; // Ensure it appears above the overlay
        message.innerHTML = 'Please login';
        
        // Add the message on top of the overlay
        document.body.appendChild(message);
  
        // Wait for 2 seconds before redirecting
        setTimeout(() => {
          window.location.href = "{{site.baseurl}}/login";  // Redirect to login page
        }, 2000);  // 2000ms = 2 seconds
      }
    }
</script>

{%- comment -%}
  Buttons point at game pages this website has (stock and casino simulations have no pages here).
  The Media Bias Game belongs to the examples feature and hides when that is off.
{%- endcomment -%}
<div class="toolkit-buttons">
  <div id="loadingElement" class="loading-container">
      <div class="spinner"></div>
  </div>  
  <a href="{{site.baseurl}}/gamify/fortuneFindersv1-1" class="toolkit-button" data-description="An adventure game where you explore levels, talk to NPCs and answer CS questions to earn balance." data-authors="Author: NITD+People">
    <img src="{{site.baseurl}}/images/gamify/lessons/fortune.png" alt="Fortune Finders" />
    <span class="button-name">Fortune Finders</span>
    <div class="description">
      <p>Start at the airport, interact with NPCs and answer CS related questions to earn balance, then head to Wall Street.</p>
    </div>
  </a>
  <a href="{{site.baseurl}}/gamify/water" class="toolkit-button" data-description="Learn the basics of JS and object oriented programming through hands on learning. Dive deep into the world of game coding in this underwater game where you can interact with different oceanic animals such as turtles, fishes, and more." data-authors="Author: Jane Smith">
    <img src="{{site.baseurl}}/images/gamify/lessons/shark.png" alt="RPG Game" />
    <span class="button-name">RPG Game</span>
    <div class="description">
      <p>Learn the basics of JS and object oriented programming through hands on learning. Dive deep into the world of game coding in this underwater game where you can interact with different oceanic animals such as turtles, fishes, and more.</p>
    </div>
  </a>
  <a href="{{site.baseurl}}/assets/js/GameEnginev1/platformer/endplatformer.html" class="toolkit-button" data-description="Jump, shoot and dodge enemies on the End ship in this side-scrolling platformer." data-authors="Author: Alex Johnson">
    <img src="{{site.baseurl}}/images/gamify/lessons/platformer.png" alt="Platformer Game" />
    <span class="button-name">Platformer Game</span>
    <div class="description">
      <p>Jump, shoot and dodge enemies on the End ship in this side-scrolling platformer.</p>
    </div>
  </a>
</div>

{%- include kit/url-feature.html url="/media" %}
{%- unless kit_off %}
<!-- Second Row of Buttons -->
<div class="toolkit-buttons">
  <a href="{{site.baseurl}}/media" class="toolkit-button" data-feature="{{ kit_feature }}" data-description="Engage in simulations that teach real-world applications of coding and software engineering concepts." data-authors="Author: CodeSim Team">
    <img src="{{site.baseurl}}/images/gamify/lessons/media.png" alt="Media Game" />
    <span class="button-name">Media Bias Game</span>
    <div class="description">
      <p>Drag the images into the correct bins (Left, Center, or Right). You have 3 lives!</p>
    </div>
  </a>
</div>
{%- endunless %}

<style>
  /* Additional styling for the login prompt */
  .login-message {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background-color: #ffcc00;
      padding: 20px;
      font-size: 20px;
      color: #000;
      border-radius: 10px;
      z-index: 10000; /* Ensures it appears on top of other elements */
  }
  /* Full-screen black overlay */
  .loading-container {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.9); /* Black background with opacity */
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 9999; /* Ensure it stays on top of all content */
  }

  /* Spinning circle */
  .spinner {
      border: 8px solid #f3f3f3; /* Light gray border */
      border-top: 8px solid #3498db; /* Blue border-top */
      border-radius: 50%;
      width: 50px;
      height: 50px;
      animation: spin 2s linear infinite; /* Spinning animation */
  }

  /* Spin animation */
  @keyframes spin {
      0% {
          transform: rotate(0deg);
      }
      100% {
          transform: rotate(360deg);
      }
  }
  .toolkit-buttons {
    display: flex;
    justify-content: space-around;
    align-items: flex-start;
    margin: 20px 0;
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
