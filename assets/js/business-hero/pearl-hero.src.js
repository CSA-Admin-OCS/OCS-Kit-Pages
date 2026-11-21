// Business home hero: a clear glass finger touching still water, rendered in real time with WebGL.
//
// Source for assets/js/vendor/pearl-hero.js (three.js and this file bundled into one script, so the
// page needs no CDN and no import map). To rebuild after editing, see README.md in this folder.
//
// How it works
//   - The water is a GPU height-field simulation: two ping-pong float textures hold the height and the
//     previous height, and a wave-equation shader steps them forward at a fixed 120 Hz, so the water
//     behaves the same on 60 Hz and 144 Hz screens. The cursor writes a smooth gaussian capsule (a line
//     of splats from the last position to the new one) into the height texture, so fast movement leaves
//     a continuous wake. The finger tip follows the cursor through a frame-rate independent spring.
//   - The water is shaded from the height texture (normals from central differences, fresnel, a soft
//     refraction of the pearl colour field, a little red/green/blue splitting, caustics, a meniscus
//     and contact shadow at the fingertip).
//   - The glass does not use three's transmission pass (it re-renders the scene into a full-size
//     multisampled buffer every frame). The water is rendered once into a half-size texture, and the
//     glass samples it with a refraction offset, so it bends, flips and splits into colour cheaply.
//   - Environment reflections, iridescence, clearcoat and a fresnel rim come from MeshPhysicalMaterial
//     and a studio of soft strip lights.
//   - Nothing here touches React, the DOM or allocates objects per frame: the pointer handler only
//     writes numbers, and one requestAnimationFrame loop does everything.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { bakeHand } from './hand.js';

// ------------------------------------------------------------------------------------------ constants

const DOMAIN_CENTER = new THREE.Vector2(1.4, 0.0);   // the simulated square of water, in world x/z
const DOMAIN_HALF = 14;                                // 28 x 28 world units
const REST_NDC = new THREE.Vector2(0.10, -0.32);       // where the fingertip rests, with the fist up and to the right of it
const REACH = { x0: -0.14, x1: 0.28, y0: -0.80, y1: -0.22 };  // limits for the fingertip, in screen space: the fist never leaves the hero or reaches the headline
const HAND_SCALE = 3.0;                                        // world units per hand unit (the index finger is 1 hand unit long)
const SIM_STEP = 1 / 120;                              // fixed simulation step
const SIM_SPEED = 0.2;                                 // wave speed squared, in texels per step
const SIM_DAMPING = 0.9955;
const FINGER_Y = 0.07;                                 // the tip's height above the surface

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
  uniform vec2 uTip;             // where the finger touches, world x/z
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

  // meniscus: the water climbs a little around the tip
  float rise(vec2 p) {
    float d = length(p - uTip);
    return 0.55 * exp(-d * d / 0.10) - 0.18 * exp(-pow((d - 0.50) / 0.16, 2.0));
  }

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
    float warm = smoothstep(2.6, 0.0, length(p - uTip - vec2(1.5, -1.9)));   // the cream orb behind the finger
    col = mix(col, lin(PEACH), clamp(warm * 0.9, 0.0, 1.0));
    col += lin(vec3(1.0, 0.93, 0.84)) * pow(warm, 3.0) * 0.6;
    // deeper lavender blue in the upper right, so the glass has something to refract
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

    // keep the water calmer on the left, behind the headline
    float calmLeft = mix(0.30, 1.0, smoothstep(0.12, 0.52, screen.x));
    float camDist = length(uCamera - vWorld);
    float calm = exp(-camDist / 30.0) * calmLeft;
    slope = clamp(slope * calm, vec2(-0.55), vec2(0.55));

    // the meniscus bends the normal too
    vec2 tq = p - uTip;
    float m = 0.55 * exp(-dot(tq, tq) / 0.10) - 0.18 * exp(-pow((length(tq) - 0.50) / 0.16, 2.0));
    vec2 mSlope = -tq * (1.1 * exp(-dot(tq, tq) / 0.10) / 0.10 * 0.03);
    vec3 n = normalize(vec3(-(slope.x + mSlope.x), 1.0, -(slope.y + mSlope.y)));

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

    // contact with the finger: a bright thin ring right at the tip, a soft shadow, caustic light
    float d0 = length(tq);
    col += lin(vec3(1.0, 0.98, 0.96)) * exp(-pow((d0 - 0.30) / 0.045, 2.0)) * 0.75;      // the ring where glass meets water
    col *= 1.0 - exp(-pow((d0 - 0.60) / 0.16, 2.0)) * 0.13;                               // soft contact shadow
    col += lin(vec3(1.0, 0.96, 0.92)) * exp(-d0 * d0 * 1.9) * 0.34;                       // pool of light at the tip
    float cells = pow(noise(p * 9.0 + uTime * 0.35) * noise(p * 13.0 - uTime * 0.28), 2.0) * 7.0;
    col += lin(vec3(0.82, 0.96, 1.0)) * cells * exp(-d0 * 0.65) * 0.07 * uQuality;       // faint caustic patches
    col += lin(vec3(0.80, 0.95, 1.0)) * min(abs(h0) * 3.0, 0.5) * 0.35 * calm;           // light gathers where the water is steep

    // a faint reflection of the finger is drawn separately (see the mirror mesh); far water melts into haze
    float haze = smoothstep(4.0, 24.0, length(p - uTip));
    col = mix(col, lin(vec3(0.93, 0.93, 0.98)), haze * 0.5);

    col += (hash(gl_FragCoord.xy + uTime) - 0.5) * 0.004;                                 // dither: gradients never band
    gl_FragColor = vec4(max(col, 0.0), 1.0);
    #include <colorspace_fragment>
  }`;

// ------------------------------------------------------------------------------------------ finger

/** Glass: physical reflections (environment, iridescence, clearcoat) plus a cheap refraction of the water texture. */
function glassMaterial(background, resolution, blur) {
  const material = new THREE.MeshPhysicalMaterial({
    color: 0x000000,
    metalness: 0,
    roughness: blur > 0 ? 0.22 : 0.03,
    ior: 1.5,
    iridescence: 1,
    iridescenceIOR: 1.3,
    iridescenceThicknessRange: [200, 900],
    clearcoat: 1,
    clearcoatRoughness: blur > 0 ? 0.18 : 0.02,
    envMapIntensity: blur > 0 ? 1.8 : 3.4,
    specularIntensity: 1,
  });
  const uniforms = {
    tBackground: { value: background },
    uRes: { value: resolution },
    uRefract: { value: 0.34 },
    uBlur: { value: blur },
    uTint: { value: new THREE.Color(0.68, 0.74, 1.0) },
    uRimStrength: { value: blur > 0 ? 0.8 : 1.6 },
  };
  material.userData.uniforms = uniforms;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    // the baked hand carries how thick the glass is behind each point: thin on the finger, thicker in the fist
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aThick;
        varying float vThick;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vThick = aThick;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vThick;
        uniform sampler2D tBackground;
        uniform vec2 uRes;
        uniform float uRefract;
        uniform float uBlur;
        uniform vec3 uTint;
        uniform float uRimStrength;`)
      .replace('#include <opaque_fragment>', `
        {
          vec3 vN = normalize(normal);
          vec3 vV = normalize(vViewPosition);
          float facing = clamp(dot(vN, vV), 0.0, 1.0);
          float fr = pow(1.0 - facing, 2.2);
          vec2 suv = gl_FragCoord.xy / uRes;
          // refraction: the water behind is bent, flipped and magnified, and splits into colour at the edges
          vec2 bend = vN.xy * uRefract * (0.45 + 0.9 * (1.0 - facing));
          vec3 refr;
          refr.r = texture2D(tBackground, suv - bend * 1.00).r;
          refr.g = texture2D(tBackground, suv - bend * 1.14).g;
          refr.b = texture2D(tBackground, suv - bend * 1.30).b;
          if (uBlur > 0.0) {                                   // the second finger is softer
            vec2 o = vec2(uBlur) * vec2(1.0, uRes.x / uRes.y);
            refr = 0.4 * refr
                 + 0.15 * texture2D(tBackground, suv - bend * 1.14 + vec2(o.x, 0.0)).rgb
                 + 0.15 * texture2D(tBackground, suv - bend * 1.14 - vec2(o.x, 0.0)).rgb
                 + 0.15 * texture2D(tBackground, suv - bend * 1.14 + vec2(0.0, o.y)).rgb
                 + 0.15 * texture2D(tBackground, suv - bend * 1.14 - vec2(0.0, o.y)).rgb;
          }
          // thick parts take a soft lilac blue, and a darker core line makes it read as thick glass
          float thickK = smoothstep(0.14, 0.46, vThick);          // 0 on the clear finger, 1 in the thick fist
          refr *= mix(vec3(1.0), uTint, (0.30 + 0.55 * thickK) * pow(facing, 1.2));
          refr *= 1.0 - (0.22 + 0.10 * thickK) * pow(facing, 4.0);
          refr *= 1.0 + 0.10 * thickK;                            // thick glass stays bright, never muddy
          // a strong fresnel rim: cool white from the upper right, pink and peach from behind
          vec3 coolWhite = vec3(0.86, 0.94, 1.0);
          vec3 warmPink = vec3(1.0, 0.70, 0.84);
          float fromUpperRight = smoothstep(-0.35, 0.7, vN.x * 0.7 + vN.y * 0.8);
          vec3 rim = mix(warmPink, coolWhite, fromUpperRight) * pow(1.0 - facing, 2.4) * uRimStrength;
          vec3 outline = mix(vec3(0.95, 0.90, 1.0), coolWhite, fromUpperRight) * pow(1.0 - facing, 6.0) * 1.7;   // a bright thin outline all round
          outgoingLight = refr * (1.0 - 0.55 * fr) + outgoingLight + rim + outline;
        }
        #include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => (blur > 0 ? 'pearl-glass-soft' : 'pearl-glass');
  return material;
}

/** A pale, distorted, fading mirror of the finger below the surface: a cheap reflection on the water. */
function mirrorMaterial(heightTexture) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      tHeight: { value: heightTexture },
      uDomain: { value: new THREE.Vector4(DOMAIN_CENTER.x, DOMAIN_CENTER.y, 1 / (DOMAIN_HALF * 2), 1 / (DOMAIN_HALF * 2)) },
      uTexel: { value: new THREE.Vector2(1, 1) },
    },
    vertexShader: `
      uniform sampler2D tHeight; uniform vec4 uDomain; uniform vec2 uTexel;
      varying float vDepth; varying vec3 vN;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vec2 uv = (w.xz - uDomain.xy) * uDomain.zw + 0.5;
        float hx = texture2D(tHeight, uv + vec2(uTexel.x, 0.0)).r - texture2D(tHeight, uv - vec2(uTexel.x, 0.0)).r;
        float hz = texture2D(tHeight, uv + vec2(0.0, uTexel.y)).r - texture2D(tHeight, uv - vec2(0.0, uTexel.y)).r;
        w.xz += vec2(hx, hz) * 2.2;                                   // the ripples bend the reflection
        vDepth = -w.y;
        vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `
      varying float vDepth; varying vec3 vN;
      void main() {
        float a = 0.28 * exp(-vDepth * 0.55) * (0.5 + 0.5 * abs(vN.z));
        vec3 c = pow(vec3(0.86, 0.88, 1.0), vec3(2.2));
        gl_FragColor = vec4(c, a);
        #include <colorspace_fragment>
      }`,
  });
}

// ------------------------------------------------------------------------------------------ studio light

/** A small studio of soft strips and boxes, turned into the environment map the glass reflects.
 *  The strips are bright and crisp on a dim room, so the glass gets long, curved, high-contrast highlights. */
function studioEnvironment(renderer) {
  const room = new THREE.Scene();
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(30, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `varying vec3 vP; void main(){
        vec3 top = vec3(0.50, 0.52, 0.70), mid = vec3(0.14, 0.17, 0.30), bot = vec3(0.40, 0.30, 0.34);
        vec3 c = vP.y > 0.0 ? mix(mid, top, vP.y) : mix(mid, bot, -vP.y);
        gl_FragColor = vec4(c, 1.0); }`,
    })
  );
  room.add(dome);
  const box = (w, h, color, strength, pos, edge) => {
    const mat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      uniforms: { uColor: { value: new THREE.Color(color).multiplyScalar(strength) }, uEdge: { value: edge } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 uColor; uniform float uEdge; varying vec2 vUv; void main(){ vec2 e = min(vUv, 1.0 - vUv); float f = smoothstep(0.0, uEdge, min(e.x, e.y)); gl_FragColor = vec4(uColor * f, 1.0); }',
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.set(...pos);
    mesh.lookAt(0, 1, 0);
    room.add(mesh);
  };
  box(26, 12, 0xffffff, 14, [-4, 14, 6], 0.35);                  // a big soft top box
  box(1.6, 26, 0xeaf3ff, 40, [11, 5, 5], 0.12);                  // long cool-white strip, upper right
  box(1.0, 24, 0xffffff, 40, [-9, 4, 8], 0.10);                  // thin crisp streak, left
  box(2.0, 22, 0xffa8c8, 26, [-3, 3, -12], 0.20);                // pink behind
  box(2.0, 22, 0xffc9a0, 26, [9, 2, -11], 0.20);                 // peach behind
  box(14, 1.2, 0xffffff, 30, [0, 15, -4], 0.10);                 // long overhead strip
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(room, 0.02).texture;
  pmrem.dispose();
  room.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  return texture;
}

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

  // ---- the scene: water (drawn twice: once into a half-size texture for the glass to refract, once for the screen)
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  const resolution = new THREE.Vector2(1, 1);                    // drawing-buffer size, for gl_FragCoord maths
  const background = new THREE.WebGLRenderTarget(2, 2, {
    type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, generateMipmaps: false,
  });
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
  const bgScene = new THREE.Scene();
  bgScene.add(new THREE.Mesh(waterGeometry, waterMaterial));
  const scene = new THREE.Scene();
  scene.environment = studioEnvironment(renderer);
  scene.add(new THREE.Mesh(waterGeometry, waterMaterial));

  // ---- the glass hand: a fist with the index finger pointing, baked once from a signed distance field.
  // The fingertip is the local origin, so the group below is pinned to the cursor's point on the water.
  const handGeometry = bakeHand(small ? 0.024 : 0.0165);
  const glassMain = glassMaterial(background.texture, resolution, 0);
  const handMaterial = options.matte
    ? new THREE.MeshStandardMaterial({ color: 0x9a9aa2, roughness: 0.8, metalness: 0 })
    : glassMain;
  const fingerMain = new THREE.Group();                         // follows the cursor, with the spring motion
  const handPose = new THREE.Group();                           // the fixed pose of the hand about its fingertip
  const handMesh = new THREE.Mesh(handGeometry, handMaterial);
  handMesh.scale.setScalar(HAND_SCALE);
  handPose.add(handMesh);
  handPose.rotation.order = 'XYZ';
  handPose.rotation.set(0.0, -0.30, -0.52);                     // finger pointing down and to the left at about 60 degrees, turned a little so the thumb side shows
  fingerMain.add(handPose);

  // a faint reflection of the hand on the water (a flipped, faded, rippled copy)
  const mirror = mirrorMaterial(readTarget.texture);
  mirror.uniforms.uTexel.value.set(1 / simSize, 1 / simSize);
  const mirrorGroupMain = new THREE.Group();
  const mirrorPose = new THREE.Group();
  const mirrorMesh = new THREE.Mesh(handGeometry, mirror);
  mirrorMesh.scale.setScalar(HAND_SCALE);
  mirrorPose.add(mirrorMesh);
  mirrorPose.rotation.copy(handPose.rotation);
  mirrorGroupMain.add(mirrorPose);
  mirrorGroupMain.scale.y = -1;
  if (!options.matte) scene.add(mirrorGroupMain);
  scene.add(fingerMain);

  // lights: a large soft white key, a cool blue rim and a warm peach rim (the studio environment does most of the work)
  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(-6, 9, 6);
  const blue = new THREE.PointLight(0x9fc4ff, 70, 30, 2);
  blue.position.set(8, 3, -4);
  const peach = new THREE.PointLight(0xffb9a0, 70, 30, 2);
  peach.position.set(-5, 2, -5);
  scene.add(key, blue, peach);

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
    // shift the picture so the resting fingertip lands about 67% across and 65% down the card
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
    background.setSize(Math.max(2, Math.round(width * ratio * 0.5)), Math.max(2, Math.round(height * ratio * 0.5)));
    if (composer) { composer.setPixelRatio(ratio); composer.setSize(width, height); bloom.resolution.set(width * ratio * 0.5, height * ratio * 0.5); }
    frame();
    rect.left = box.left; rect.top = box.top; rect.width = box.width; rect.height = box.height;
  };
  const rect = { left: 0, top: 0, width: 1, height: 1 };

  // ---- pointer: the handler only writes numbers (no state, no DOM reads, no allocation)
  const target = { x: REST_NDC.x, y: REST_NDC.y };                // where the cursor is, in screen space (-1..1)
  const shown = { x: REST_NDC.x, y: REST_NDC.y };                 // the spring-smoothed position the finger really follows
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
  const tiltX = { p: 0, v: 0 };
  const tiltZ = { p: 0, v: 0 };
  const rise = { p: 0, v: 0 };
  // a damped spring with a little overshoot (damping ratio about 0.45), stepped finely so it behaves the same at any frame rate
  const stepSpring = (state, target, dt) => {
    const stiffness = 70;
    const damping = 2 * 0.45 * Math.sqrt(stiffness);
    const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      state.v += (stiffness * (target - state.p) - damping * state.v) * h;
      state.p += state.v * h;
    }
  };
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

    // where the cursor wants the finger: the real cursor, or a slow figure of eight when it is away
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
      splat(prevTip.x, prevTip.z, tipWorld.x, tipWorld.z, 0.30 + Math.min(speed * 0.012, 0.35), Math.min(Math.max(speed - 0.6, 0) * 0.8 * dt, 0.20));      // slow drift adds nothing; real movement adds waves
    }
    // the fingertip trembles very slightly, sending a steady train of concentric rings outward, so the water is never still
    splat(tipWorld.x, tipWorld.z, tipWorld.x, tipWorld.z, 0.40, Math.sin(elapsed * 15.0) * 0.55 * dt);

    // fixed-step simulation, so the water behaves the same at any refresh rate
    accumulator = Math.min(accumulator + dt, SIM_STEP * 5);
    while (accumulator >= SIM_STEP) { simStep(); accumulator -= SIM_STEP; }

    // pose: the whole hand is one rigid body pinned at the fingertip. It tilts a few degrees the way the cursor
    // is moving, on a spring with a little overshoot, and the fist rises slightly when the cursor moves fast
    // (the finger gliding along the surface). The tip itself never leaves the water.
    stepSpring(tiltX, Math.max(-0.09, Math.min(0.09, velocity.z * 0.0045)), dt);
    stepSpring(tiltZ, Math.max(-0.11, Math.min(0.11, -velocity.x * 0.0055)), dt);
    stepSpring(rise, Math.min(speed * 0.0065, 0.13), dt);
    const bob = Math.sin(elapsed * 0.9) * 0.012;
    fingerMain.position.set(tipWorld.x, FINGER_Y + bob, tipWorld.z);
    fingerMain.rotation.set(tiltX.p, 0, tiltZ.p + rise.p);
    mirrorGroupMain.position.set(tipWorld.x, -(FINGER_Y + bob), tipWorld.z);
    mirrorGroupMain.rotation.copy(fingerMain.rotation);
  };

  const draw = () => {
    waterMaterial.uniforms.tHeight.value = readTarget.texture;
    waterMaterial.uniforms.uTip.value.set(tipWorld.x, tipWorld.z);
    waterMaterial.uniforms.uTime.value = elapsed;
    mirror.uniforms.tHeight.value = readTarget.texture;
    // the water, once at half size for the glass to refract...
    renderer.setRenderTarget(background);
    renderer.render(bgScene, camera);
    renderer.setRenderTarget(null);
    // ...and the full picture
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
      for (const m of [simMaterial.uniforms.uTexel, waterMaterial.uniforms.uTexel, mirror.uniforms.uTexel]) m.value.set(1 / simSize, 1 / simSize);
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
      readTarget.dispose(); writeTarget.dispose(); background.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
  api.still(options.stillSeconds || 2.4);                         // always show a first frame at once
  return api;
}
