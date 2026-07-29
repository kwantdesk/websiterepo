/**
 * Compact 2D simplex noise (Stefan Gustavson / Ashima Arts, public domain).
 * Ported from the local ALEPH dashboard particle terrain.
 */

const grad3 = [
  [1, 1, 0],
  [-1, 1, 0],
  [1, -1, 0],
  [-1, -1, 0],
  [1, 0, 1],
  [-1, 0, 1],
  [1, 0, -1],
  [-1, 0, -1],
  [0, 1, 1],
  [0, -1, 1],
  [0, 1, -1],
  [0, -1, -1],
] as const;

const perm = new Uint8Array(512);
const permMod12 = new Uint8Array(512);

(function seedPermutation() {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = p[i];
    p[i] = p[j];
    p[j] = t;
  }
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255];
    permMod12[i] = perm[i] % 12;
  }
})();

function dot2(g: readonly number[], x: number, y: number): number {
  return g[0] * x + g[1] * y;
}

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

export function simplex2(xin: number, yin: number): number {
  const s = (xin + yin) * F2;
  const i = Math.floor(xin + s);
  const j = Math.floor(yin + s);
  const t = (i + j) * G2;
  const x0 = xin - (i - t);
  const y0 = yin - (j - t);

  let i1: number;
  let j1: number;
  if (x0 > y0) {
    i1 = 1;
    j1 = 0;
  } else {
    i1 = 0;
    j1 = 1;
  }

  const x1 = x0 - i1 + G2;
  const y1 = y0 - j1 + G2;
  const x2 = x0 - 1 + 2 * G2;
  const y2 = y0 - 1 + 2 * G2;

  const ii = i & 255;
  const jj = j & 255;

  let n0 = 0;
  let t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 >= 0) {
    t0 *= t0;
    const gi0 = permMod12[ii + perm[jj]];
    n0 = t0 * t0 * dot2(grad3[gi0], x0, y0);
  }

  let n1 = 0;
  let t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 >= 0) {
    t1 *= t1;
    const gi1 = permMod12[ii + i1 + perm[jj + j1]];
    n1 = t1 * t1 * dot2(grad3[gi1], x1, y1);
  }

  let n2 = 0;
  let t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 >= 0) {
    t2 *= t2;
    const gi2 = permMod12[ii + 1 + perm[jj + 1]];
    n2 = t2 * t2 * dot2(grad3[gi2], x2, y2);
  }

  return 70 * (n0 + n1 + n2);
}

export function terrainHeight(x: number, z: number): number {
  const nx = x / 17;
  const nz = z / 11;
  const dome = 3.5 * Math.exp(-(nx * nx + nz * nz));

  const skirt = 1.1 * Math.exp(-(x * x) * 0.0011 - (z * z) * 0.007);

  const s1 = 1.4 * Math.exp(-((x - 6) ** 2 + (z - 2) ** 2) * 0.028);
  const s2 = 1.4 * Math.exp(-((x + 6) ** 2 + (z - 2) ** 2) * 0.028);
  const s3 = 1.2 * Math.exp(-((x - 3) ** 2 + (z + 4) ** 2) * 0.03);
  const s4 = 1.2 * Math.exp(-((x + 3) ** 2 + (z + 4) ** 2) * 0.03);

  const octave1 = simplex2(x * 0.12, z * 0.12) * 0.5;
  const octave2 = simplex2(x * 0.35 + 31.7, z * 0.35 - 12.4) * 1.0;
  const octave3 = simplex2(x * 1.0 + 88.2, z * 1.0 + 44.1) * 0.28;

  return Math.max(0, dome + skirt + s1 + s2 + s3 + s4 + octave1 + octave2 + octave3);
}
