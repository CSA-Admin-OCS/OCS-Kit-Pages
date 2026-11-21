// Business home hero: a pool of still pearl water that ripples under the cursor, rendered in real time with WebGL.
//
// Source for assets/js/vendor/pearl-hero.js (three.js and this file bundled into one script, so the
// page needs no CDN and no import map). To rebuild after editing, see README.md in this folder.
//
// How it works
//   - The water is a GPU height-field simulation: two ping-pong float textures hold the height and the
//     previous height, and a wave-equation shader steps them forward at a fixed 120 Hz, so the water
//     behaves the same on 60 Hz and 144 Hz screens. The cursor writes a smooth gaussian capsule (a line
//     of splats from the last position to the new one) into the height texture, so fast movement leaves
//     a continuous wake. The stirred point follows the cursor through a frame-rate independent smoothing.
//   - The water is shaded from the height texture (normals from central differences, fresnel, a soft
//     refraction of the pearl colour field, a little red/green/blue splitting, caustics).
//   - Nothing here touches React, the DOM or allocates objects per frame: the pointer handler only
//     writes numbers, and one requestAnimationFrame loop does everything.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

// ------------------------------------------------------------------------------------------ constants

const DOMAIN_CENTER = new THREE.Vector2(1.4, 0.0);   // the simulated square of water, in world x/z
const DOMAIN_HALF = 14;                                // 28 x 28 world units
const REST_NDC = new THREE.Vector2(0.30, -0.21);       // where the water is stirred when the cursor is away: about 65% across, 60% down
const REACH = { x0: -1, x1: 1, y0: -1, y1: 1 };               // the cursor reaches the whole hero
const SIM_STEP = 1 / 120;                              // fixed simulation step
const SIM_SPEED = 0.10;                                 // wave speed squared, in texels per step
const SIM_DAMPING = 0.96;

// ------------------------------------------------------------------------------------------ simulation shaders

const QUAD_VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const SIM_FRAG = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D tState;       // r = height, g = previous height
  uniform vec2 uTexel;
  uniform float uDamp;
  uniform float uSpeed;
  void main() {
    vec2 s = texture2D(tState, vUv).rg;
    float l = texture2D(tState, vUv - vec2(uTexel.x, 0.0)).r;
    float r = texture2D(tState, vUv + vec2(uTexel.x, 0.0)).r;
    float d = texture2D(tState, vUv - vec2(0.0, uTexel.y)).r;
    float u = texture2D(tState, vUv + vec2(0.0, uTexel.y)).r;
    float lap = l + r + d + u - 4.0 * s.r;
    // waves are absorbed at the edge of the simulated square, so nothing bounces back
    float edge = smoothstep(0.0, 0.07, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)));
    float damp = mix(0.90, uDamp, edge);
    float h = (2.0 * s.r - s.g + uSpeed * lap - 0.0005 * s.r) * damp;      // the small pull toward flat stops a broad mound building up
    gl_FragColor = vec4(clamp(h, -2.0, 2.0), s.r, 0.0, 1.0);
  }`;

const SPLAT_FRAG = /* glsl */`
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D tState;
  uniform vec2 uA;                // start of the cursor's path this frame, in simulation UV
  uniform vec2 uB;                // end of the path
  uniform float uRadius;          // gaussian radius in UV units
  uniform float uAmp;
  void main() {
    vec4 s = texture2D(tState, vUv);
    vec2 pa = vUv - uA;
    vec2 ba = uB - uA;
    float t = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-9), 0.0, 1.0);
    float d = length(pa - ba * t);                       // distance to the whole segment: no gaps, no dotted rings
    float bump = uAmp * exp(-(d * d) / (uRadius * uRadius));
    gl_FragColor = vec4(clamp(s.r + bump, -2.0, 2.0), s.g, 0.0, 1.0);
  }`;

// ------------------------------------------------------------------------------------------ water

const WATER_VERT = /* glsl */`
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;

const WATER_FRAG = /* glsl */`
  precision highp float;
  varying vec3 vWorld;
  uniform sampler2D tHeight;
  uniform vec2 uTexel;
  uniform vec4 uDomain;          // centre x, centre z, 1 / width, 1 / depth
  uniform vec2 uTip;             // where the water is being stirred, world x/z
  uniform float uTime;
  uniform vec3 uCamera;
  uniform vec2 uRes;
  uniform float uQuality;        // 1 = full, 0 = cheap

  const vec3 LAVENDER = vec3(0.835, 0.800, 0.953);
  const vec3 ICE      = vec3(0.745, 0.867, 0.976);
  const vec3 MINT     = vec3(0.757, 0.937, 0.882);
  const vec3 SILVER   = vec3(0.945, 0.953, 0.973);
  const vec3 PEACH    = vec3(0.984, 0.820, 0.745);
  const vec3 DEEP     = vec3(0.500, 0.580, 0.900);      // the soft lavender blue in the upper right
  vec3 lin(vec3 c) { return pow(c, vec3(2.2)); }

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }

  vec2 toUV(vec2 p) { return (p - uDomain.xy) * uDomain.zw + 0.5; }
  float H(vec2 uv) { return texture2D(tHeight, uv).r; }

  // pearly colour field, slowly moving
  vec3 pearl(vec2 p, vec2 screen) {
    float t = uTime * 0.03;
    vec2 w = p * 0.16;
    float a = noise(w * 1.3 + vec2(t, -t * 0.7));
    float b = noise(w * 2.1 + vec2(-t * 0.8, t) + 7.0);
    float c = noise(w * 0.8 + vec2(t * 0.5, t * 0.6) + 19.0);
    vec3 col = mix(lin(LAVENDER), lin(ICE), smoothstep(0.25, 0.75, a));
    col = mix(col, lin(MINT), smoothstep(0.55, 0.9, b) * 0.65);
    col = mix(col, lin(SILVER), smoothstep(0.4, 0.8, c) * 0.55);
    float warm = smoothstep(2.6, 0.0, length(p - uTip - vec2(1.5, -1.9)));   // the cream orb behind the stirred point
    col = mix(col, lin(PEACH), clamp(warm * 0.9, 0.0, 1.0));
    col += lin(vec3(1.0, 0.93, 0.84)) * pow(warm, 3.0) * 0.6;
    // deeper lavender blue in the upper right, for the surface to reflect
    float deep = smoothstep(0.35, 1.05, screen.x * 0.75 + screen.y * 0.65 - 0.25);
    col = mix(col, lin(DEEP), deep * 0.75);
    return col;
  }

  void main() {
    vec2 p = vWorld.xz;
    vec2 screen = gl_FragCoord.xy / uRes;
    vec2 uv = toUV(p);
    float e = uTexel.x;

    // height field -> normal (central differences, plus wider samples for smoothness)
    float hL = H(uv - vec2(e, 0.0)), hR = H(uv + vec2(e, 0.0));
    float hD = H(uv - vec2(0.0, e)), hU = H(uv + vec2(0.0, e));
    float hL2 = H(uv - vec2(2.0 * e, 0.0)), hR2 = H(uv + vec2(2.0 * e, 0.0));
    float hD2 = H(uv - vec2(0.0, 2.0 * e)), hU2 = H(uv + vec2(0.0, 2.0 * e));
    float h0 = H(uv);
    vec2 g = vec2((hR - hL) * 0.5 + (hR2 - hL2) * 0.125, (hU - hD) * 0.5 + (hU2 - hD2) * 0.125);
    vec2 slope = g / (e * 28.0) * 1.1;                      // height units per world unit

    float camDist = length(uCamera - vWorld);
    float calm = exp(-camDist / 30.0);                       // the same everywhere across the hero, text or not
    slope = clamp(slope * calm, vec2(-0.55), vec2(0.55));

    vec2 tq = p - uTip;
    vec3 n = normalize(vec3(-slope.x, 1.0, -slope.y));

    // colour: the pearl field seen through the surface, a little differently per channel
    vec2 off = n.xz * 3.4;
    vec3 col = vec3(pearl(p + off * 1.00, screen).r, pearl(p + off * 1.55, screen).g, pearl(p + off * 2.10, screen).b);

    // soft light and dark bands from the slope
    vec3 L = normalize(vec3(-0.45, 0.85, 0.35));
    float band = dot(n, L) - L.y;
    col *= 1.0 + clamp(band * 3.4, -0.45, 0.6);

    // thin bright highlights on the crests, and a pale sky reflection at grazing angles
    vec3 V = normalize(uCamera - vWorld);
    float spec = pow(max(dot(reflect(-L, n), V), 0.0), 55.0);
    col += lin(vec3(1.0)) * spec * 1.5 * calm;
    float fres = pow(1.0 - max(dot(n, V), 0.0), 3.0);
    col = mix(col, lin(vec3(0.97, 0.98, 1.0)), fres * 0.30);

    // a pool of light where the water is stirred, and faint caustics
    float d0 = length(tq);
    col += lin(vec3(1.0, 0.96, 0.92)) * exp(-d0 * d0 * 1.9) * 0.34;                       // pool of light at the tip
    float cells = pow(noise(p * 9.0 + uTime * 0.35) * noise(p * 13.0 - uTime * 0.28), 2.0) * 7.0;
    col += lin(vec3(0.82, 0.96, 1.0)) * cells * exp(-d0 * 0.65) * 0.07 * uQuality;       // faint caustic patches
    col += lin(vec3(0.80, 0.95, 1.0)) * min(abs(h0) * 3.0, 0.5) * 0.35 * calm;           // light gathers where the water is steep

    // far water melts into haze
    float haze = smoothstep(4.0, 24.0, length(p - uTip));
    col = mix(col, lin(vec3(0.93, 0.93, 0.98)), haze * 0.5);

    col += (hash(gl_FragCoord.xy + uTime) - 0.5) * 0.004;                                 // dither: gradients never band
    gl_FragColor = vec4(max(col, 0.0), 1.0);
    #include <colorspace_fragment>
  }`;

// ------------------------------------------------------------------------------------------ post

const CHROMA_SHADER = {                                       // a very light red/blue split toward the edges
  uniforms: { tDiffuse: { value: null }, uAmount: { value: 0.0007 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uAmount; varying vec2 vUv; void main(){
    vec2 d = (vUv - 0.5) * uAmount * 2.0;
    gl_FragColor = vec4(texture2D(tDiffuse, vUv + d).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - d).b, 1.0); }`,
};

// ------------------------------------------------------------------------------------------ the scene

export function startPearlHero(host, options = {}) {
  const small = !!options.small;                                  // phones: smaller simulation, no bloom
  const still = !!options.still;                                  // reduced motion / low power: one frame, no loop
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  const maxRatio = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
  const ladder = [2, 1.5, 1.25, 1].filter(r => r <= maxRatio);
  if (!ladder.length || ladder[0] < maxRatio) ladder.unshift(maxRatio);
  let rung = 0;
  renderer.setPixelRatio(ladder[0]);
  renderer.setClearColor(0xe6e6f3, 1);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 0.96;
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);

  // ---- the height-field simulation
  const useFloat = renderer.extensions.has('EXT_color_buffer_float') && renderer.extensions.has('OES_texture_float_linear');
  let simSize = small ? 192 : 384;
  const makeTarget = (size) => new THREE.WebGLRenderTarget(size, size, {
    type: useFloat ? THREE.FloatType : THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    depthBuffer: false,
    generateMipmaps: false,
  });
  let readTarget = makeTarget(simSize);
  let writeTarget = makeTarget(simSize);
  const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quadGeometry = new THREE.PlaneGeometry(2, 2);
  const simMaterial = new THREE.ShaderMaterial({
    vertexShader: QUAD_VERT, fragmentShader: SIM_FRAG, depthTest: false, depthWrite: false,
    uniforms: { tState: { value: null }, uTexel: { value: new THREE.Vector2(1 / simSize, 1 / simSize) }, uDamp: { value: SIM_DAMPING }, uSpeed: { value: SIM_SPEED } },
  });
  const splatMaterial = new THREE.ShaderMaterial({
    vertexShader: QUAD_VERT, fragmentShader: SPLAT_FRAG, depthTest: false, depthWrite: false,
    uniforms: { tState: { value: null }, uA: { value: new THREE.Vector2() }, uB: { value: new THREE.Vector2() }, uRadius: { value: 0.01 }, uAmp: { value: 0 } },
  });
  const simQuad = new THREE.Mesh(quadGeometry, simMaterial);
  const simScene = new THREE.Scene();
  simScene.add(simQuad);
  const runPass = (material, target) => {
    simQuad.material = material;
    renderer.setRenderTarget(target);
    renderer.render(simScene, quadCamera);
    renderer.setRenderTarget(null);
  };
  const simStep = () => {
    simMaterial.uniforms.tState.value = readTarget.texture;
    runPass(simMaterial, writeTarget);
    const t = readTarget; readTarget = writeTarget; writeTarget = t;
  };
  const splat = (ax, az, bx, bz, radiusWorld, amp) => {
    const inv = 1 / (DOMAIN_HALF * 2);
    splatMaterial.uniforms.tState.value = readTarget.texture;
    splatMaterial.uniforms.uA.value.set((ax - DOMAIN_CENTER.x) * inv + 0.5, (az - DOMAIN_CENTER.y) * inv + 0.5);
    splatMaterial.uniforms.uB.value.set((bx - DOMAIN_CENTER.x) * inv + 0.5, (bz - DOMAIN_CENTER.y) * inv + 0.5);
    splatMaterial.uniforms.uRadius.value = radiusWorld * inv;
    splatMaterial.uniforms.uAmp.value = amp;
    runPass(splatMaterial, writeTarget);
    const t = readTarget; readTarget = writeTarget; writeTarget = t;
  };

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  const resolution = new THREE.Vector2(1, 1);                    // drawing-buffer size, for gl_FragCoord maths
  const waterMaterial = new THREE.ShaderMaterial({
    vertexShader: WATER_VERT,
    fragmentShader: WATER_FRAG,
    uniforms: {
      tHeight: { value: readTarget.texture },
      uTexel: { value: new THREE.Vector2(1 / simSize, 1 / simSize) },
      uDomain: { value: new THREE.Vector4(DOMAIN_CENTER.x, DOMAIN_CENTER.y, 1 / (DOMAIN_HALF * 2), 1 / (DOMAIN_HALF * 2)) },
      uTip: { value: new THREE.Vector2(0, 0) },
      uTime: { value: 0 },
      uCamera: { value: camera.position },
      uRes: { value: resolution },
      uQuality: { value: small ? 0 : 1 },
    },
  });
  const waterGeometry = new THREE.PlaneGeometry(900, 900, 1, 1);      // far larger than the view, so the horizon is always haze, never an edge
  waterGeometry.rotateX(-Math.PI / 2);
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(waterGeometry, waterMaterial));

  // ---- post (skipped on phones): subtle bloom on the brightest glints only, a whisper of colour split
  let composer = null;
  let bloom = null;
  let chroma = null;
  const buildComposer = () => {
    const target = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: ladder[rung] <= 1.5 ? 4 : 0 });
    composer = new EffectComposer(renderer, target);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(128, 128), 0.28, 0.6, 0.97);   // high threshold: glints, not a glow
    composer.addPass(bloom);
    chroma = new ShaderPass(CHROMA_SHADER);
    composer.addPass(chroma);
    composer.addPass(new OutputPass());
  };
  if (!small) buildComposer();

  // ---- size and framing
  let width = 1;
  let height = 1;
  const tmp = new THREE.Vector3();
  const frame = () => {
    const wide = width / height;
    const aim = new THREE.Vector3(wide > 1.15 ? 1.0 : 1.6, 0.8, 0.0);
    camera.fov = wide > 1.15 ? 30 : 36;
    camera.aspect = wide;
    camera.position.set(aim.x - 0.3, 7.4, wide > 1.15 ? 13.5 : 16.5);
    camera.lookAt(aim);
    camera.clearViewOffset();
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    // shift the picture so the resting point lands about 65% across and 60% down the card
    tmp.set(restWorld.x, 0, restWorld.z).project(camera);
    const dx = (REST_NDC.x - tmp.x) * width * 0.5;
    const dy = (tmp.y - REST_NDC.y) * height * 0.5;
    camera.setViewOffset(width, height, -dx, -dy, width, height);
  };
  const restWorld = new THREE.Vector3(2.0, 0, 0.6);              // a first guess; corrected right after the first frame
  const resize = () => {
    const box = host.getBoundingClientRect();
    width = Math.max(2, Math.round(box.width));
    height = Math.max(2, Math.round(box.height));
    renderer.setSize(width, height, false);
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    const ratio = renderer.getPixelRatio();
    resolution.set(Math.round(width * ratio), Math.round(height * ratio));
    if (composer) { composer.setPixelRatio(ratio); composer.setSize(width, height); bloom.resolution.set(width * ratio * 0.5, height * ratio * 0.5); }
    frame();
    rect.left = box.left; rect.top = box.top; rect.width = box.width; rect.height = box.height;
  };
  const rect = { left: 0, top: 0, width: 1, height: 1 };

  // ---- pointer: the handler only writes numbers (no state, no DOM reads, no allocation)
  const target = { x: REST_NDC.x, y: REST_NDC.y };                // where the cursor is, in screen space (-1..1)
  const shown = { x: REST_NDC.x, y: REST_NDC.y };                 // the smoothed position that is really stirred
  let lastPointerAt = -1000;
  let elapsed = options.stillTime || 3.2;
  let rectDirty = true;
  const point = (clientX, clientY) => {
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -(((clientY - rect.top) / rect.height) * 2 - 1);
    if (nx < -1.05 || nx > 1.05 || ny < -1.05 || ny > 1.05) return;   // outside the hero: leave the idle drift running
    target.x = nx;
    target.y = ny;
    lastPointerAt = elapsed;
  };
  const onMove = (event) => {
    const list = event.getCoalescedEvents ? event.getCoalescedEvents() : null;
    const last = list && list.length ? list[list.length - 1] : event;   // every sample is seen; the last one wins
    point(last.clientX, last.clientY);
  };
  const onScroll = () => { rectDirty = true; };
  if (!still) {
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // ---- per-frame update
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const ndc = new THREE.Vector2();
  const tipWorld = new THREE.Vector3(restWorld.x, 0, restWorld.z);
  const prevTip = new THREE.Vector3(restWorld.x, 0, restWorld.z);
  const velocity = new THREE.Vector3();
  let accumulator = 0;
  let initialised = false;

  const toWorld = (sx, sy, out) => {
    ndc.set(sx, sy);
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(plane, out)) out.set(restWorld.x, 0, restWorld.z);
    return out;
  };

  const update = (dt) => {
    if (rectDirty) { const b = host.getBoundingClientRect(); rect.left = b.left; rect.top = b.top; rect.width = b.width; rect.height = b.height; rectDirty = false; }
    elapsed += dt;
    if (!initialised) {                                           // put the resting tip where the layout wants it
      toWorld(REST_NDC.x, REST_NDC.y, restWorld);
      tipWorld.copy(restWorld); prevTip.copy(restWorld);
      initialised = true;
    }

    // where the cursor wants the stir: the real cursor, or a slow figure of eight when it is away
    const idle = elapsed - lastPointerAt > 2.0;
    let wantX = target.x;
    let wantY = target.y;
    if (idle) {
      wantX = REST_NDC.x + Math.sin(elapsed * 0.42) * 0.05;
      wantY = REST_NDC.y + Math.sin(elapsed * 0.84) * 0.03;
    }
    wantX = Math.min(REACH.x1, Math.max(REACH.x0, wantX));
    wantY = Math.min(REACH.y1, Math.max(REACH.y0, wantY));

    // frame-rate independent smoothing: the same feel at 60 Hz and 144 Hz
    const k = 1 - Math.exp(-dt * 18);
    shown.x += (wantX - shown.x) * k;
    shown.y += (wantY - shown.y) * k;

    prevTip.copy(tipWorld);
    toWorld(shown.x, shown.y, tipWorld);
    velocity.copy(tipWorld).sub(prevTip).multiplyScalar(1 / Math.max(dt, 1e-4));
    const speed = Math.min(velocity.length(), 40);

    // the cursor's wake: one continuous capsule from where the tip was to where it is. Slow movement makes
    // small gentle rings, fast movement makes bigger waves.
    const moved = prevTip.distanceTo(tipWorld);
    if (moved > 1e-4) {
      splat(prevTip.x, prevTip.z, tipWorld.x, tipWorld.z, 0.11 + Math.min(speed * 0.002, 0.05), Math.min(Math.max(speed - 0.6, 0) * 0.45 * dt, 0.07));      // slow drift adds nothing; real movement adds waves
    }
    // the stirred point trembles very slightly, sending a steady train of concentric rings outward, so the water is never still
    splat(tipWorld.x, tipWorld.z, tipWorld.x, tipWorld.z, 0.22, Math.sin(elapsed * 15.0) * 0.25 * dt);

    // fixed-step simulation, so the water behaves the same at any refresh rate
    accumulator = Math.min(accumulator + dt, SIM_STEP * 5);
    while (accumulator >= SIM_STEP) { simStep(); accumulator -= SIM_STEP; }
  };

  const draw = () => {
    waterMaterial.uniforms.tHeight.value = readTarget.texture;
    waterMaterial.uniforms.uTip.value.set(tipWorld.x, tipWorld.z);
    waterMaterial.uniforms.uTime.value = elapsed;
    if (composer) composer.render(); else renderer.render(scene, camera);
  };

  // ---- watch the frame rate; if it falls under about 50fps, lower the quality a step at a time
  let last = 0;
  let average = 1000 / 60;
  let counted = 0;
  let stage = 0;
  const adapt = (dt) => {
    average = average * 0.92 + dt * 0.08;
    if (++counted < 40 || average < 20) return;                   // 20ms = 50fps
    counted = 0;
    average = 1000 / 60;
    if (rung < ladder.length - 1) {                               // 1. lower the pixel ratio: 2, 1.5, 1.25, 1
      rung++;
      renderer.setPixelRatio(ladder[rung]);
      resize();
    } else if (stage === 0 && simSize > 256) {                    // 2. a smaller simulation
      stage = 1;
      simSize = 256;
      readTarget.dispose(); writeTarget.dispose();
      readTarget = makeTarget(simSize); writeTarget = makeTarget(simSize);
      for (const m of [simMaterial.uniforms.uTexel, waterMaterial.uniforms.uTexel]) m.value.set(1 / simSize, 1 / simSize);
    } else if (stage <= 1 && composer) {                          // 3. drop the post processing
      stage = 2;
      composer.dispose();
      composer = null;
    }
  };

  let running = false;
  let raf = 0;
  const tick = (now) => {
    if (!running) return;
    const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;   // never more than 1/30 s, so a tab switch cannot upset the water
    if (last) adapt(now - last);
    last = now;
    update(dt);
    draw();
    raf = requestAnimationFrame(tick);
  };

  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  // run the simulation forward without drawing, so the first picture already has ripples in it
  const warm = (seconds) => {
    const steps = Math.round(seconds * 60);
    for (let i = 0; i < steps; i++) update(1 / 60);
  };

  const api = {
    play() { if (running || still) return; running = true; last = 0; raf = requestAnimationFrame(tick); },
    pause() { running = false; cancelAnimationFrame(raf); },
    // draw one picture; used for reduced motion, low power and the first frame
    still(seconds = 2.4) { warm(seconds); draw(); },
    // test helpers: move the pointer to a screen position (client pixels) and run the loop by hand
    point,
    advance(seconds) { warm(seconds); draw(); },
    // the largest height in the simulation, to check it stays stable
    heights() {
      const data = useFloat ? new Float32Array(4) : new Uint16Array(4);
      let peak = 0;
      const full = useFloat ? new Float32Array(simSize * simSize * 4) : null;
      if (full) { renderer.readRenderTargetPixels(readTarget, 0, 0, simSize, simSize, full); for (let i = 0; i < full.length; i += 4) peak = Math.max(peak, Math.abs(full[i])); }
      void data;
      return peak;
    },
    dispose() {
      api.pause();
      observer.disconnect();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('scroll', onScroll);
      renderer.dispose();
      canvas.remove();
    },
  };
  api.still(options.stillSeconds || 2.4);                         // always show a first frame at once
  return api;
}
