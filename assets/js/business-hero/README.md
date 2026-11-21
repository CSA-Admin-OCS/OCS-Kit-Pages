# Business home hero (WebGL)

`pearl-hero.src.js` is the source of the hero: a pool of still pearl water that ripples under the cursor, with a
steady train of rings spreading from a trembling point when the cursor is away. The water is a GPU height-field
simulation (a wave equation run on a float texture at a fixed 120 Hz); the cursor writes a continuous wake into it
through a frame-rate independent smoothing. `../vendor/pearl-hero.js` is the same code bundled with three.js into one
script, so the site needs no CDN and no import map. The page loads it on demand from `../business-home.js`, only when
the hero is on screen.

## Rebuild after editing the source

Run these in a scratch folder (not inside the site) so `node_modules` never lands in the repo:

```bash
npm install three@0.170.0 esbuild
NODE_PATH=$PWD/node_modules ./node_modules/.bin/esbuild /path/to/assets/js/business-hero/pearl-hero.src.js \
  --bundle --format=esm --minify --target=es2020 --legal-comments=none \
  --outfile=/path/to/assets/js/vendor/pearl-hero.js
```

## What to tune

- Water simulation: `SIM_SPEED`, `SIM_DAMPING`, `SIM_STEP`, and the trembling source in `update()`.
- Cursor wake: the `splat()` call in `update()` (radius and strength grow with speed; slow drift adds nothing).
- Where the water rests when the cursor is away: `REST_NDC`. How far the cursor reaches: `REACH` (the whole hero).
- Water shading: `WATER_FRAG` (ripple strength, palette, caustics,).
- Quality: phones get a smaller simulation and no bloom; reduced motion and low-power devices get one still frame;
  the resolution drops automatically if frames run slow.
