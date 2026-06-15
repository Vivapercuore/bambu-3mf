import { fmt } from './util';

/** A 3-component point (mm). */
export interface V3 {
  x: number;
  y: number;
  z: number;
}
/** Axis-aligned bounds. */
export interface Bounds {
  min: V3;
  max: V3;
}

/**
 * A framework-agnostic triangle mesh: a flat **Y-up** vertex array (`position`,
 * x,y,z,x,y,z,…) and an optional `index`. This is what you pass when the data
 * comes from STL / OBJ / a custom parser — **no Three.js required**.
 *
 * Example (binary STL → RawMesh): parse each facet's 3 vertices into one
 * `Float32Array` of positions and pass `{ position }` (STL is already a
 * triangle soup, so no index is needed).
 */
export interface RawMesh {
  /** Flat Y-up vertex coords, length = 3 × vertexCount. */
  position: ArrayLike<number>;
  /** Optional triangle index (length = 3 × triangleCount). Omit for a triangle soup. */
  index?: ArrayLike<number>;
}

/** Minimal per-vertex accessor (a structural subset of THREE.BufferAttribute). */
interface AttributeLike {
  count: number;
  getX(i: number): number;
  getY(i: number): number;
  getZ(i: number): number;
}
/**
 * The structural shape of a `THREE.BufferGeometry` we rely on — declared here so
 * the library never has to `import 'three'`. A real `THREE.BufferGeometry`
 * satisfies this, so you can pass one directly; `three` stays an *optional* peer.
 */
export interface MeshLike {
  getAttribute(name: string): AttributeLike;
  index?: unknown;
  toNonIndexed?(): MeshLike;
}

/** Anything {@link geometryToMesh} accepts for one solid. */
export type GeometryInput = MeshLike | RawMesh;

/** A `<mesh>` body plus its triangle count and 3MF-space (Z-up) bounds. */
export interface MeshXml {
  /** `<mesh>…</mesh>` body. */
  xml: string;
  triangleCount: number;
  /** Axis-aligned bounds in 3MF (Z-up) coordinates, mm. */
  bbox: Bounds;
}

/**
 * Per-face painting state, indexed by **source triangle order** (0-based, across
 * all geometries passed to {@link geometryToMesh}, counting every source face
 * including any later welded away). A value of `0` means "unpainted" (the face
 * keeps the object/part's own extruder); see {@link encodePaintFacet} for the
 * meaning of non-zero states.
 *
 * Either an array (`paint[srcTri]`) or a callback. A callback returning the raw
 * encoded attribute string is the escape hatch for advanced users who already
 * know BambuStudio's exact value.
 */
export type PaintInput =
  | ArrayLike<number>
  | ((srcTri: number) => number)
  | { raw: (srcTri: number) => string | null | undefined };

/**
 * Triangle painting layers, mirroring BambuStudio's `<triangle>` paint
 * attributes. Each is optional and independent:
 * - `color`   → `paint_color`         (MMU / multi-colour; state = filament slot, 1-based)
 * - `supports`→ `paint_supports`      (1 = enforcer, 2 = blocker)
 * - `seam`    → `paint_seam`          (1 = enforce a seam here)
 * - `fuzzy`   → `paint_fuzzy_skin`    (1 = fuzzy skin here)
 */
export interface TrianglePaint {
  color?: PaintInput;
  supports?: PaintInput;
  seam?: PaintInput;
  fuzzy?: PaintInput;
}

/**
 * Encode one **whole** (non-subdivided) triangle's facet state into the hex
 * string BambuStudio stores on a paint attribute, matching
 * `TriangleSelector::serialize`/`deserialize`:
 *
 * One nibble = `(split_sides=0b00) | (state<<2)`; states 0–2 fit directly
 * (state 1 → `0b0100` = `"4"`, state 2 → `"8"`). For state ≥ 3 the nibble's high
 * two bits are the escape marker `0b11` (`"c"`), followed by `(state-3)` written
 * as 4-bit nibbles LSB-first, where each full `0xf` nibble means "+15 and
 * continue". So state 3 → `"c0"`, 4 → `"c1"`, 17 → `"ce"`, 18 → `"cf0"`.
 *
 * Returns `''` for state 0 (caller should then omit the attribute).
 */
export function encodePaintFacet(state: number): string {
  const s = Math.max(0, Math.floor(state));
  if (s === 0) return '';
  if (s < 3) return (s << 2).toString(16); // "4" or "8"
  let n = s - 3;
  let out = 'c'; // 0b1100: split=00, escape marker in high bits
  while (n >= 15) {
    out += 'f';
    n -= 15;
  }
  out += n.toString(16);
  return out;
}

/** Normalise a PaintInput into `(srcTri) => rawAttrString | ''`. */
function paintReader(p: PaintInput | undefined): ((tri: number) => string) | null {
  if (p == null) return null;
  if (typeof p === 'function') return (tri) => encodePaintFacet(p(tri) || 0);
  if ('raw' in (p as any) && typeof (p as any).raw === 'function') {
    const raw = (p as { raw: (t: number) => string | null | undefined }).raw;
    return (tri) => raw(tri) || '';
  }
  const arr = p as ArrayLike<number>;
  return (tri) => encodePaintFacet(arr[tri] || 0);
}

/** Uniform per-vertex accessor over one input solid (THREE-like or raw). */
function accessorOf(input: GeometryInput): AttributeLike {
  // THREE-like: has getAttribute(). Expand an indexed geometry to non-indexed.
  if (typeof (input as MeshLike).getAttribute === 'function') {
    const ml = input as MeshLike;
    const g = ml.index && ml.toNonIndexed ? ml.toNonIndexed() : ml;
    return g.getAttribute('position');
  }
  // RawMesh: flat position array, optional index.
  const raw = input as RawMesh;
  const p = raw.position;
  if (raw.index) {
    const idx = raw.index;
    return {
      count: idx.length,
      getX: (i) => p[idx[i] * 3],
      getY: (i) => p[idx[i] * 3 + 1],
      getZ: (i) => p[idx[i] * 3 + 2],
    };
  }
  return {
    count: (p.length / 3) | 0,
    getX: (i) => p[i * 3],
    getY: (i) => p[i * 3 + 1],
    getZ: (i) => p[i * 3 + 2],
  };
}

/**
 * Convert one or more geometries (Three.js `BufferGeometry`, or a raw
 * {@link RawMesh}) to a single 3MF mesh. Input is **Y-up**; the mapping
 * (x,y,z)→(x,−z,y) is a +90° rotation about X (det=+1), so triangle winding —
 * and outward normals — is preserved into 3MF's Z-up frame.
 *
 * Welding is done **per input geometry**: vertices are only merged within the
 * same solid, never across solids. Merging across solids fuses coincident/
 * touching vertices of independent bodies into shared edges, which slicers
 * report as non-manifold; keeping each body's vertex set disjoint yields a clean
 * "multiple separate solids in one object" mesh.
 *
 * When `paint` is supplied, per-face paint attributes are emitted on the
 * `<triangle>` elements; faces are indexed by **source order** (see
 * {@link PaintInput}).
 */
export function geometryToMesh(
  input: GeometryInput | GeometryInput[],
  paint?: TrianglePaint
): MeshXml {
  const geoms = Array.isArray(input) ? input : [input];

  const readColor = paint && paintReader(paint.color);
  const readSupports = paint && paintReader(paint.supports);
  const readSeam = paint && paintReader(paint.seam);
  const readFuzzy = paint && paintReader(paint.fuzzy);
  const hasPaint = !!(readColor || readSupports || readSeam || readFuzzy);

  const vLines: string[] = [];
  const tLines: string[] = [];
  const min: V3 = { x: Infinity, y: Infinity, z: Infinity };
  const max: V3 = { x: -Infinity, y: -Infinity, z: -Infinity };

  let triangleCount = 0;
  let srcTri = 0; // global source-face index, for paint lookup
  for (const geom of geoms) {
    const pos = accessorOf(geom);
    if (!pos || !pos.count) continue;

    // Per-geometry weld map: keys map to global vertex ids in vLines, but the
    // map is reset for each solid so distinct bodies never share a vertex.
    const index = new Map<string, number>();
    const vertexId = (X: string, Y: string, Z: string): number => {
      const key = `${X},${Y},${Z}`;
      let id = index.get(key);
      if (id === undefined) {
        id = vLines.length;
        vLines.push(`    <vertex x="${X}" y="${Y}" z="${Z}"/>`);
        index.set(key, id);
        const x = +X, y = +Y, z = +Z;
        if (x < min.x) min.x = x; if (x > max.x) max.x = x;
        if (y < min.y) min.y = y; if (y > max.y) max.y = y;
        if (z < min.z) min.z = z; if (z > max.z) max.z = z;
      }
      return id;
    };

    for (let i = 0; i < pos.count; i += 3, srcTri++) {
      const ids: number[] = [];
      for (let k = 0; k < 3; k++) {
        const j = i + k;
        // Y-up → 3MF Z-up: x'=x, y'=-z, z'=y
        ids.push(vertexId(fmt(pos.getX(j)), fmt(-pos.getZ(j)), fmt(pos.getY(j))));
      }
      // Skip degenerate triangles produced by welding coincident verts.
      if (ids[0] === ids[1] || ids[1] === ids[2] || ids[0] === ids[2]) continue;
      if (!hasPaint) {
        tLines.push(`    <triangle v1="${ids[0]}" v2="${ids[1]}" v3="${ids[2]}"/>`);
      } else {
        let attrs = '';
        const sup = readSupports && readSupports(srcTri);
        const seam = readSeam && readSeam(srcTri);
        const col = readColor && readColor(srcTri);
        const fuz = readFuzzy && readFuzzy(srcTri);
        if (sup) attrs += ` paint_supports="${sup}"`;
        if (seam) attrs += ` paint_seam="${seam}"`;
        if (col) attrs += ` paint_color="${col}"`;
        if (fuz) attrs += ` paint_fuzzy_skin="${fuz}"`;
        tLines.push(`    <triangle v1="${ids[0]}" v2="${ids[1]}" v3="${ids[2]}"${attrs}/>`);
      }
      triangleCount++;
    }
  }
  if (!triangleCount) throw new Error('几何为空，无法导出');

  const xml =
    `   <mesh>\n` +
    `    <vertices>\n${vLines.join('\n')}\n    </vertices>\n` +
    `    <triangles>\n${tLines.join('\n')}\n    </triangles>\n` +
    `   </mesh>`;

  return { xml, triangleCount, bbox: { min, max } };
}
