# Business home hero (WebGL)

`pearl-hero.src.js` is the source of the 3D hero: a clear glass hand (a fist with the index finger pointing) pressing into still water, with ripples
flowing outward from the touch point. The water is a GPU height-field simulation (a wave equation
run on a float texture at a fixed 120 Hz); the cursor writes a continuous wake into it and the fingertip follows
the cursor through a frame-rate independent spring. `../vendor/pearl-hero.js` is the same code bundled with three.js
into one script, so the site needs no CDN and no import map. The page loads it on demand from
`../business-home.js`, only when the hero is on screen.

`hand.js` builds the hand: a signed distance field (rounded cones, ellipsoids and rounded boxes joined with a
smooth minimum) that is baked once, with marching cubes, into a smooth mesh when the scene starts. Edit the shapes in
`handDistance()`; `bakeHand()` sets the grid resolution. Nothing in it runs per frame.

## Rebuild after editing the source

Run these in a scratch folder (not inside the site) so `node_modules` never lands in the repo:

```bash
npm install three@0.170.0 esbuild
NODE_PATH=$PWD/node_modules ./node_modules/.bin/esbuild /path/to/assets/js/business-hero/pearl-hero.src.js \
  --bundle --format=esm --minify --target=es2020 --legal-comments=none \
  --outfile=/path/to/assets/js/vendor/pearl-hero.js
```

## What to tune

- Glass: `glassMaterial()` (ior, iridescence, clearcoat, refraction strength, tint, rim). It refracts a half-size texture
  of the water instead of using three's transmission pass, which re-renders the whole scene every frame.
- Light: `studioEnvironment()` (white key, cool blue rim, warm peach rim).
- Water simulation: `SIM_SPEED`, `SIM_DAMPING`, `SIM_STEP`, the tip's ring source in `update()`.
- Water shading: `WATER_FRAG` (ripple strength, palette, caustics, meniscus).
- Hand shape: `handDistance()` in `hand.js`. Hand size, pose and reach: `HAND_SCALE`, `handPose.rotation`, `REST_NDC` and `REACH`.
- Quality: phones get fewer segments, no transmission and no bloom; reduced motion and low-power
  devices get one still frame; the resolution drops automatically if frames run slow.
