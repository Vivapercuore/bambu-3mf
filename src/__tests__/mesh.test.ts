/** Unit tests for mesh.ts — geometry → 3MF mesh, welding, paint encoding. */
import * as THREE from 'three';
import { geometryToMesh, encodePaintFacet } from '../mesh';

/** Build a non-indexed BufferGeometry from a flat vertex array (Y-up). */
function geom(verts: number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
  return g;
}
/** A flat quad in the XZ plane = two triangles sharing an edge. */
function quad(): THREE.BufferGeometry {
  return geom([
    0, 0, 0, 1, 0, 0, 1, 0, 1,
    0, 0, 0, 1, 0, 1, 0, 0, 1,
  ]);
}
const vertexCount = (xml: string) => (xml.match(/<vertex /g) || []).length;

describe('encodePaintFacet — whole-triangle TriangleSelector encoding', () => {
  test.each([
    [0, ''],
    [1, '4'],
    [2, '8'],
    [3, 'c0'],
    [4, 'c1'],
    [5, 'c2'],
    [14, 'cb'],
    [17, 'ce'],
    [18, 'cf0'],
    [33, 'cff0'],
  ])('state %i → "%s"', (state, hex) => {
    expect(encodePaintFacet(state as number)).toBe(hex);
  });

  test('clamps negatives / floors fractionals to 0 → unpainted', () => {
    expect(encodePaintFacet(-3)).toBe('');
    expect(encodePaintFacet(0.9)).toBe('');
    expect(encodePaintFacet(2.7)).toBe('8');
  });
});

describe('geometryToMesh — Y-up → Z-up mapping', () => {
  test('maps (x,y,z) → (x,-z,y), preserving winding', () => {
    const m = geometryToMesh(geom([1, 0, 0, 0, 0, 0, 0, 0, 3]));
    expect(m.triangleCount).toBe(1);
    expect(m.xml).toContain('<vertex x="1" y="0" z="0"/>');
    expect(m.xml).toContain('<vertex x="0" y="0" z="0"/>');
    expect(m.xml).toContain('<vertex x="0" y="-3" z="0"/>'); // -z, y swap
  });

  test('reports Z-up bounds', () => {
    const m = geometryToMesh(geom([2, 0, 0, 0, 5, 0, 0, 0, 4]));
    expect(m.bbox.min.x).toBe(0);
    expect(m.bbox.max.x).toBe(2);
    expect(m.bbox.max.z).toBe(5); // original +Y becomes +Z
    expect(m.bbox.min.y).toBe(-4); // original +Z becomes -Y
  });
});

describe('geometryToMesh — welding', () => {
  test('welds coincident vertices within one solid', () => {
    const m = geometryToMesh(quad());
    expect(m.triangleCount).toBe(2);
    expect(vertexCount(m.xml)).toBe(4); // shared edge welded
  });

  test('never welds across solids (array input keeps bodies disjoint)', () => {
    const m = geometryToMesh([quad(), quad()]);
    expect(m.triangleCount).toBe(4);
    expect(vertexCount(m.xml)).toBe(8); // 4 + 4, no sharing
  });

  test('skips degenerate triangles produced by welding', () => {
    // a "triangle" with two identical vertices collapses → no faces → throws
    expect(() => geometryToMesh(geom([0, 0, 0, 0, 0, 0, 1, 0, 0]))).toThrow('几何为空');
  });

  test('empty geometry throws', () => {
    expect(() => geometryToMesh(new THREE.BufferGeometry())).toThrow('几何为空');
  });
});

describe('geometryToMesh — painting', () => {
  test('color array → paint_color per source face', () => {
    const m = geometryToMesh(quad(), { color: [1, 2] });
    expect(m.xml).toContain('paint_color="4"');
    expect(m.xml).toContain('paint_color="8"');
  });

  test('callback form + state 0 leaves a face unpainted', () => {
    const m = geometryToMesh(quad(), { color: (t) => (t === 0 ? 3 : 0) });
    expect(m.xml).toContain('paint_color="c0"');
    expect((m.xml.match(/paint_color=/g) || []).length).toBe(1);
  });

  test('raw escape hatch passes the attribute value through verbatim', () => {
    const m = geometryToMesh(quad(), { color: { raw: (t) => (t === 0 ? 'ABC' : null) } });
    expect(m.xml).toContain('paint_color="ABC"');
  });

  test('supports/seam/fuzzy emit their own attributes', () => {
    const m = geometryToMesh(quad(), {
      supports: (t) => (t === 0 ? 1 : 0),
      seam: (t) => (t === 1 ? 1 : 0),
      fuzzy: (t) => (t === 0 ? 1 : 0),
    });
    expect(m.xml).toContain('paint_supports="4"');
    expect(m.xml).toContain('paint_seam="4"');
    expect(m.xml).toContain('paint_fuzzy_skin="4"');
  });

  test('source-face index is global across multiple solids', () => {
    // 2 solids × 2 tris = faces 0..3; paint only face index 2 (first of 2nd solid)
    const m = geometryToMesh([quad(), quad()], { supports: (t) => (t === 2 ? 1 : 0) });
    expect((m.xml.match(/paint_supports=/g) || []).length).toBe(1);
    expect(m.xml).toContain('paint_supports="4"');
  });
});
