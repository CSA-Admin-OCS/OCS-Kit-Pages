// A fist with the index finger pointing, built as a signed distance field (SDF) and baked once into a mesh.
//
// The hand is a union of rounded cones, ellipsoids and rounded boxes joined with a polynomial smooth
// minimum, so the parts melt into soft, skin-like joins: a wide blend where the finger and thumb meet the
// palm, a tight blend between the curled fingers so creases and grooves stay visible. A marching cubes
// pass turns the field into a BufferGeometry once at load time; normals come from the field's gradient, so
// shading is perfectly smooth. Nothing here runs per frame.
//
// Hand space: units where the index finger is 1.0 long. The fingertip is the origin, +Y runs up the finger
// toward the fist, +Z points at the viewer (the front of the fist: the folded fingers and the thumb), +X is
// to the viewer's right.
import * as THREE from 'three';
import { edgeTable, triTable } from 'three/examples/jsm/objects/MarchingCubes.js';

// ------------------------------------------------------------------------------------------ distance functions

/** Polynomial smooth minimum: blends a and b over a distance k (small k = a tight crease, large k = a soft join). */
function smin(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

/** Rounded cone from a to b with radii r1 and r2 (Inigo Quilez). */
function roundCone(px, py, pz, ax, ay, az, bx, by, bz, r1, r2) {
  const bax = bx - ax, bay = by - ay, baz = bz - az;
  const l2 = bax * bax + bay * bay + baz * baz;
  const rr = r1 - r2;
  const a2 = l2 - rr * rr;
  const il2 = 1 / l2;
  const pax = px - ax, pay = py - ay, paz = pz - az;
  const y = pax * bax + pay * bay + paz * baz;
  const z = y - l2;
  const qx = pax * l2 - bax * y, qy = pay * l2 - bay * y, qz = paz * l2 - baz * y;
  const x2 = qx * qx + qy * qy + qz * qz;
  const y2 = y * y * l2;
  const z2 = z * z * l2;
  const k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}

/** Ellipsoid centred at c with radii r (a good, cheap approximation of the true distance). */
function ellipsoid(px, py, pz, cx, cy, cz, rx, ry, rz) {
  const x = px - cx, y = py - cy, z = pz - cz;
  const k0 = Math.sqrt((x / rx) * (x / rx) + (y / ry) * (y / ry) + (z / rz) * (z / rz));
  const k1 = Math.sqrt((x / (rx * rx)) * (x / (rx * rx)) + (y / (ry * ry)) * (y / (ry * ry)) + (z / (rz * rz)) * (z / (rz * rz)));
  return k1 < 1e-9 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
}

/** Box centred at c with half sizes h and rounded corners of radius r. */
function roundBox(px, py, pz, cx, cy, cz, hx, hy, hz, r) {
  const qx = Math.abs(px - cx) - hx + r, qy = Math.abs(py - cy) - hy + r, qz = Math.abs(pz - cz) - hz + r;
  const ox = Math.max(qx, 0), oy = Math.max(qy, 0), oz = Math.max(qz, 0);
  return Math.sqrt(ox * ox + oy * oy + oz * oz) + Math.min(Math.max(qx, Math.max(qy, qz)), 0) - r;
}

// ------------------------------------------------------------------------------------------ the hand

// The curled fingers (middle, ring, pinky). Seen from the front, each finger is a column: its first segment goes
// forward from the knuckle (the rounded knuckle bump at the bottom of the column), the second folds back up over
// the front of the fist, and the third curls into the palm. x is the column, `s` scales the pinky down.
const CURLED = [
  { x: 0.215, s: 1.00, k: 1.005 },   // middle
  { x: 0.430, s: 1.00, k: 0.995 },   // ring
  { x: 0.645, s: 0.86, k: 0.965 },   // pinky: shorter, narrower, and a little lower
];

function curledFinger(x, y, z, f) {
  const s = f.s;
  const k = f.k;                      // height of this finger's base knuckle
  const r1 = 0.103 * s, r2 = 0.097 * s, r3 = 0.088 * s;
  // proximal: from the knuckle forward (toward the viewer); middle: folds back up the front; distal: curls into the palm
  let d = roundCone(x, y, z, f.x, k + 0.05, 0.02, f.x, k - 0.03 * s, 0.30 * s + 0.0, r1, r1 * 1.02);
  d = smin(d, roundCone(x, y, z, f.x, k - 0.03 * s, 0.30 * s, f.x, k + 0.27 * s, 0.31 * s, r1 * 1.02, r2), 0.022);
  d = smin(d, roundCone(x, y, z, f.x, k + 0.27 * s, 0.31 * s, f.x, k + 0.43 * s, 0.17 * s, r2, r3), 0.022);
  d = smin(d, ellipsoid(x, y, z, f.x, k - 0.03 * s, 0.31 * s, r1 * 1.08, r1 * 1.02, r1 * 1.0), 0.02);      // the knuckle bump
  return d;
}

export function handDistance(x, y, z) {
  // ---- index finger: three segments, a slight natural bend (about 10 degrees) at each joint, tapering to a soft pad
  let d = roundCone(x, y, z, 0.000, 1.020, 0.010, -0.014, 0.575, 0.030, 0.112, 0.094);                 // proximal
  d = smin(d, roundCone(x, y, z, -0.014, 0.575, 0.030, -0.040, 0.262, 0.064, 0.094, 0.082), 0.030);   // middle
  d = smin(d, roundCone(x, y, z, -0.040, 0.262, 0.064, -0.070, 0.078, 0.086, 0.082, 0.072), 0.030);   // distal
  d = smin(d, ellipsoid(x, y, z, -0.070, 0.084, 0.086, 0.072, 0.086, 0.074), 0.04);                   // the rounded pad, a touch flatter underneath
  d = smin(d, ellipsoid(x, y, z, -0.014, 0.575, 0.030, 0.098, 0.040, 0.096), 0.04);                   // the joints show as soft knuckles, not beads
  d = smin(d, ellipsoid(x, y, z, -0.040, 0.262, 0.064, 0.086, 0.034, 0.084), 0.04);
  d = smin(d, ellipsoid(x, y, z, -0.062, 0.150, -0.016, 0.060, 0.118, 0.036), 0.02);                  // a subtle fingernail curve on the back
  d = smin(d, ellipsoid(x, y, z, 0.000, 1.070, 0.080, 0.116, 0.106, 0.112), 0.04);                    // the index knuckle, the highest of the four

  // ---- palm and back of the fist: a rounded block about 0.9 wide, 0.75 tall, 0.55 deep, sitting behind the curled fingers
  let fist = roundBox(x, y, z, 0.330, 1.330, -0.080, 0.430, 0.330, 0.205, 0.190);
  fist = smin(fist, ellipsoid(x, y, z, 0.060, 1.020, 0.020, 0.185, 0.200, 0.160), 0.08);      // fills in beside the finger so it grows out of the hand
  fist = smin(fist, roundCone(x, y, z, 0.40, 1.50, -0.06, 1.75, 2.45, -0.20, 0.33, 0.29), 0.14);   // the wrist, leaving off the right edge, below the navigation

  // ---- the curled fingers: tight blends keep the grooves between them
  for (let i = 0; i < CURLED.length; i++) fist = smin(fist, curledFinger(x, y, z, CURLED[i]), 0.045);

  // ---- thumb: tucked across the front of the folded fingers, tip toward the index side, with a knuckle and a flat pad
  let thumb = roundCone(x, y, z, 0.610, 1.120, 0.450, 0.040, 1.300, 0.462, 0.116, 0.098);
  thumb = smin(thumb, ellipsoid(x, y, z, 0.430, 1.175, 0.470, 0.124, 0.108, 0.096), 0.03);      // thumb knuckle
  thumb = smin(thumb, ellipsoid(x, y, z, 0.085, 1.290, 0.474, 0.098, 0.084, 0.058), 0.03);      // the slightly flat pad
  fist = smin(fist, thumb, 0.040);

  // ---- finger and fist melt into one form with a wide blend
  return smin(d, fist, 0.11);
}

// ------------------------------------------------------------------------------------------ marching cubes

// Bourke's cube: corner offsets and the two corners each of the 12 edges joins
const CORNER = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
const EDGE = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];

/**
 * Bake the hand into a smooth BufferGeometry. `cell` is the grid spacing in hand units
 * (0.0125 gives roughly 160 cells up the hand). Returns the geometry plus a per-vertex "thickness" attribute:
 * how far the glass is, behind the surface, before it ends. The glass uses it to stay clear on thin parts
 * (the finger) and to take a little lilac where it is thick (the fist).
 */
export function bakeHand(cell = 0.0125) {
  const min = [-0.30, -0.06, -0.50];
  const max = [2.15, 3.00, 0.70];
  const nx = Math.ceil((max[0] - min[0]) / cell) + 1;
  const ny = Math.ceil((max[1] - min[1]) / cell) + 1;
  const nz = Math.ceil((max[2] - min[2]) / cell) + 1;
  const stride = [1, nx, nx * ny];
  const values = new Float32Array(nx * ny * nz).fill(NaN);
  const at = (i, j, k) => handDistance(min[0] + i * cell, min[1] + j * cell, min[2] + k * cell);

  // coarse pass: find where the surface is, then only evaluate the fine grid in a shell around it
  const C = 4;
  const cx = Math.ceil((nx - 1) / C), cy = Math.ceil((ny - 1) / C), cz = Math.ceil((nz - 1) / C);
  const cs = cell * C;
  const coarse = new Float32Array((cx + 1) * (cy + 1) * (cz + 1));
  for (let k = 0; k <= cz; k++) for (let j = 0; j <= cy; j++) for (let i = 0; i <= cx; i++) {
    coarse[i + (cx + 1) * (j + (cy + 1) * k)] = at(Math.min(i * C, nx - 1), Math.min(j * C, ny - 1), Math.min(k * C, nz - 1));
  }
  const band = cs * 1.8;
  for (let k = 0; k < cz; k++) for (let j = 0; j < cy; j++) for (let i = 0; i < cx; i++) {
    let near = false;
    for (let c = 0; c < 8 && !near; c++) {
      const v = coarse[(i + (c & 1)) + (cx + 1) * ((j + ((c >> 1) & 1)) + (cy + 1) * (k + ((c >> 2) & 1)))];
      if (Math.abs(v) < band) near = true;
    }
    if (!near) continue;
    for (let kk = 0; kk <= C; kk++) for (let jj = 0; jj <= C; jj++) for (let ii = 0; ii <= C; ii++) {
      const I = i * C + ii, J = j * C + jj, K = k * C + kk;
      if (I >= nx || J >= ny || K >= nz) continue;
      const idx = I + nx * (J + ny * K);
      if (Number.isNaN(values[idx])) values[idx] = at(I, J, K);
    }
  }

  // the surface, cell by cell; vertices are shared along edges
  const positions = [];
  const indices = [];
  const edgeVertex = new Map();
  const corner = new Float32Array(8);
  const vertexOnEdge = (i, j, k, e) => {
    const a = CORNER[EDGE[e][0]], b = CORNER[EDGE[e][1]];
    const ia = i + a[0], ja = j + a[1], ka = k + a[2];
    const ib = i + b[0], jb = j + b[1], kb = k + b[2];
    const pa = ia * stride[0] + ja * stride[1] + ka * stride[2];
    const pb = ib * stride[0] + jb * stride[1] + kb * stride[2];
    const key = Math.min(pa, pb) * 3 + (ia !== ib ? 0 : ja !== jb ? 1 : 2);
    let v = edgeVertex.get(key);
    if (v !== undefined) return v;
    const va = values[pa], vb = values[pb];
    const t = va / (va - vb);
    positions.push(
      min[0] + (ia + (ib - ia) * t) * cell,
      min[1] + (ja + (jb - ja) * t) * cell,
      min[2] + (ka + (kb - ka) * t) * cell
    );
    v = positions.length / 3 - 1;
    edgeVertex.set(key, v);
    return v;
  };
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let cube = 0;
    let known = true;
    for (let c = 0; c < 8; c++) {
      const o = CORNER[c];
      const v = values[(i + o[0]) + nx * ((j + o[1]) + ny * (k + o[2]))];
      if (Number.isNaN(v)) { known = false; break; }
      corner[c] = v;
      if (v < 0) cube |= 1 << c;
    }
    if (!known || edgeTable[cube] === 0) continue;
    const row = cube * 16;
    for (let t = 0; triTable[row + t] !== -1; t += 3) {
      indices.push(vertexOnEdge(i, j, k, triTable[row + t]), vertexOnEdge(i, j, k, triTable[row + t + 1]), vertexOnEdge(i, j, k, triTable[row + t + 2]));
    }
  }

  // smooth normals from the field's gradient, and the glass thickness behind each vertex
  const vertexCount = positions.length / 3;
  const normals = new Float32Array(vertexCount * 3);
  const thickness = new Float32Array(vertexCount);
  const h = cell * 0.5;
  for (let v = 0; v < vertexCount; v++) {
    const x = positions[v * 3], y = positions[v * 3 + 1], z = positions[v * 3 + 2];
    let nxv = handDistance(x + h, y, z) - handDistance(x - h, y, z);
    let nyv = handDistance(x, y + h, z) - handDistance(x, y - h, z);
    let nzv = handDistance(x, y, z + h) - handDistance(x, y, z - h);
    const len = Math.hypot(nxv, nyv, nzv) || 1;
    nxv /= len; nyv /= len; nzv /= len;
    normals[v * 3] = nxv; normals[v * 3 + 1] = nyv; normals[v * 3 + 2] = nzv;
    // march inward along the normal until the field turns positive again: that distance is the glass depth
    let depth = 0.04;
    for (let s = 1; s <= 12; s++) {                       // coarse steps are plenty: this only tints the glass
      depth = s * 0.05;
      if (s > 1 && handDistance(x - nxv * depth, y - nyv * depth, z - nzv * depth) > -0.004) break;
    }
    thickness[v] = Math.min(depth, 0.6);
  }
  // make every triangle face outward (the normals come from the field, so they are right)
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t], b = indices[t + 1], c = indices[t + 2];
    const ux = positions[b * 3] - positions[a * 3], uy = positions[b * 3 + 1] - positions[a * 3 + 1], uz = positions[b * 3 + 2] - positions[a * 3 + 2];
    const wx = positions[c * 3] - positions[a * 3], wy = positions[c * 3 + 1] - positions[a * 3 + 1], wz = positions[c * 3 + 2] - positions[a * 3 + 2];
    const fx = uy * wz - uz * wy, fy = uz * wx - ux * wz, fz = ux * wy - uy * wx;
    if (fx * normals[a * 3] + fy * normals[a * 3 + 1] + fz * normals[a * 3 + 2] < 0) { indices[t + 1] = c; indices[t + 2] = b; }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('aThick', new THREE.BufferAttribute(thickness, 1));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}
