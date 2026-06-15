import * as THREE from 'three';
import { fmt } from './util';
import {
  InstanceTransform,
  MeshedObject,
  ObjectTransform,
  PreparedObject,
} from './types';

/** Normalise negative zero to +0 so matrices/placements never carry a stray `-0`. */
const nz = (v: number): number => (v === 0 ? 0 : v);

/**
 * Build the 3×3 linear part of an object transform, stored row-major in
 * **column-vector convention** (`v' = A·v`). Rotation is `Rz·Ry·Rx` (Euler
 * degrees, X applied first); scale is uniform or per-axis; mirror negates an
 * axis' scale. Identity (no transform) → `[1,0,0, 0,1,0, 0,0,1]`.
 */
export function linearOf(t?: ObjectTransform): number[] {
  if (!t) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const sc = t.scale;
  let sx = 1, sy = 1, sz = 1;
  if (typeof sc === 'number') sx = sy = sz = sc;
  else if (sc) {
    sx = sc.x ?? 1;
    sy = sc.y ?? 1;
    sz = sc.z ?? 1;
  }
  if (t.mirror?.x) sx = -sx;
  if (t.mirror?.y) sy = -sy;
  if (t.mirror?.z) sz = -sz;

  const d = Math.PI / 180;
  const rx = (t.rotation?.x ?? 0) * d;
  const ry = (t.rotation?.y ?? 0) * d;
  const rz = (t.rotation?.z ?? 0) * d;
  const cx = Math.cos(rx), snx = Math.sin(rx);
  const cy = Math.cos(ry), sny = Math.sin(ry);
  const cz = Math.cos(rz), snz = Math.sin(rz);

  // R = Rz·Ry·Rx (column convention)
  const r = [
    cz * cy, cz * sny * snx - snz * cx, cz * sny * cx + snz * snx,
    snz * cy, snz * sny * snx + cz * cx, snz * sny * cx - cz * snx,
    -sny, cy * snx, cy * cx,
  ];
  // A = R · diag(sx,sy,sz)  →  A[i][j] = R[i][j]·s[j]
  const s = [sx, sy, sz];
  return r.map((v, i) => nz(v * s[i % 3]));
}

/** C = A·B for two row-major 3×3 matrices (column convention). */
function matMul(a: number[], b: number[]): number[] {
  const c = new Array(9).fill(0);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      for (let k = 0; k < 3; k++) c[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j];
  return c;
}

/** Apply a column-convention 3×3 (row-major storage) to a point. */
function applyMat3(a: number[], x: number, y: number, z: number): [number, number, number] {
  return [
    a[0] * x + a[1] * y + a[2] * z,
    a[3] * x + a[4] * y + a[5] * z,
    a[6] * x + a[7] * y + a[8] * z,
  ];
}

/** Transform an AABB by a linear 3×3 (8 corners) and return the new AABB. */
function transformBounds(
  lin: number[],
  bbox: { min: THREE.Vector3; max: THREE.Vector3 }
): { min: THREE.Vector3; max: THREE.Vector3 } {
  const isIdentity =
    lin[0] === 1 && lin[1] === 0 && lin[2] === 0 &&
    lin[3] === 0 && lin[4] === 1 && lin[5] === 0 &&
    lin[6] === 0 && lin[7] === 0 && lin[8] === 1;
  if (isIdentity) return bbox;
  const { min, max } = bbox;
  const lo = new THREE.Vector3(Infinity, Infinity, Infinity);
  const hi = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  for (const X of [min.x, max.x])
    for (const Y of [min.y, max.y])
      for (const Z of [min.z, max.z]) {
        const [x, y, z] = applyMat3(lin, X, Y, Z);
        lo.x = Math.min(lo.x, x); lo.y = Math.min(lo.y, y); lo.z = Math.min(lo.z, z);
        hi.x = Math.max(hi.x, x); hi.y = Math.max(hi.y, y); hi.z = Math.max(hi.z, z);
      }
  return { min: lo, max: hi };
}

/** An object's world-space AABB: union of its parts (if any) else its mesh, each through its linear transform. */
function worldBounds(o: MeshedObject): { min: THREE.Vector3; max: THREE.Vector3 } {
  if (o.parts && o.parts.length) {
    const lo = new THREE.Vector3(Infinity, Infinity, Infinity);
    const hi = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
    for (const p of o.parts) {
      const b = transformBounds(p.lin, p.mesh.bbox);
      lo.min(b.min);
      hi.max(b.max);
    }
    return { min: lo, max: hi };
  }
  return transformBounds(o.lin, o.mesh.bbox);
}

/**
 * Compose an instance's transform onto an object's base placement. Returns the
 * 12-value build-item transform string. Default instance (identity, no offset)
 * with an identity object linear yields exactly `"1 0 0 0 1 0 0 0 1 tx ty tz"`.
 */
export function instanceTransformString(
  baseLin: number[],
  tx: number,
  ty: number,
  tz: number,
  inst?: InstanceTransform
): string {
  const lin = inst ? matMul(linearOf(inst), baseLin) : baseLin;
  const dx = tx + (inst?.translate?.x ?? 0);
  const dy = ty + (inst?.translate?.y ?? 0);
  const dz = tz + (inst?.translate?.z ?? 0);
  // 3MF row-major (row-vector convention) = transpose of our column-convention A.
  const m = [
    lin[0], lin[3], lin[6],
    lin[1], lin[4], lin[7],
    lin[2], lin[5], lin[8],
    dx, dy, dz,
  ];
  return m.map(fmt).join(' ');
}

/**
 * Place one plate's objects on its bed cell, **preserving their relative
 * layout**. `(cellX, cellY)` is the world-space origin of this plate's bed so
 * that distinct plates occupy distinct, non-overlapping regions.
 *
 * The input geometries already carry the faithful arrangement, so we must NOT
 * re-pack them — instead we translate the whole plate rigidly so its combined
 * (transformed) footprint is centred on its bed cell; every part keeps its
 * original position and the parts stay non-overlapping exactly as designed.
 */
function layoutPlate(
  objects: MeshedObject[],
  bed: { x: number; y: number },
  cellX: number,
  cellY: number
): PreparedObject[] {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity;
  for (const o of objects) {
    const { min, max } = worldBounds(o);
    if (min.x < minX) minX = min.x;
    if (min.y < minY) minY = min.y;
    if (min.z < minZ) minZ = min.z;
    if (max.x > maxX) maxX = max.x;
    if (max.y > maxY) maxY = max.y;
  }
  // Single shared translation centres the plate's combined bbox on its bed cell
  // and drops it onto the bed surface; relative positions are untouched.
  const tx = nz(cellX + bed.x / 2 - (minX + maxX) / 2);
  const ty = nz(cellY + bed.y / 2 - (minY + maxY) / 2);
  const tz = nz(-minZ);
  return objects.map((o) => ({ ...o, tx, ty, tz }));
}

/**
 * Auto-arrange objects per print plate. Objects are grouped by their `plate`
 * id; each plate is placed on its own bed cell, and the cells are tiled in a
 * grid in world space so plates never physically overlap. Relative part
 * positions within a plate are preserved. Returns objects ordered by plate.
 */
export function layout(
  objects: MeshedObject[],
  bed: { x: number; y: number },
  _gap: number
): PreparedObject[] {
  const byPlate = new Map<number, MeshedObject[]>();
  for (const o of objects) {
    const list = byPlate.get(o.plate);
    if (list) list.push(o);
    else byPlate.set(o.plate, [o]);
  }
  const out: PreparedObject[] = [];
  const plateIds = Array.from(byPlate.keys()).sort((a, b) => a - b);
  // Grid of bed cells (near-square), one per plate, spaced by the bed size plus
  // a margin so adjacent beds keep clear of each other.
  const margin = 60;
  const strideX = bed.x + margin;
  const strideY = bed.y + margin;
  const cols = Math.max(1, Math.ceil(Math.sqrt(plateIds.length)));
  plateIds.forEach((plate, i) => {
    const cellX = (i % cols) * strideX;
    const cellY = Math.floor(i / cols) * strideY;
    out.push(...layoutPlate(byPlate.get(plate)!, bed, cellX, cellY));
  });
  return out;
}
