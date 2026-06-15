/** Unit tests for layout.ts — transform matrices, instances, plate placement. */
import * as THREE from 'three';
import { linearOf, instanceTransformString, layout } from '../layout';
import { geometryToMesh } from '../mesh';
import { MeshedObject } from '../types';

const IDENT = [1, 0, 0, 0, 1, 0, 0, 0, 1];

describe('linearOf', () => {
  test('no transform → identity', () => {
    expect(linearOf()).toEqual(IDENT);
    expect(linearOf({})).toEqual(IDENT);
  });

  test('uniform and per-axis scale', () => {
    expect(linearOf({ scale: 2 })).toEqual([2, 0, 0, 0, 2, 0, 0, 0, 2]);
    expect(linearOf({ scale: { x: 2, y: 3, z: 4 } })).toEqual([2, 0, 0, 0, 3, 0, 0, 0, 4]);
  });

  test('mirror negates the axis', () => {
    expect(linearOf({ mirror: { x: true } })).toEqual([-1, 0, 0, 0, 1, 0, 0, 0, 1]);
    expect(linearOf({ mirror: { z: true } })).toEqual([1, 0, 0, 0, 1, 0, 0, 0, -1]);
  });

  test('rotation about Z (90°) maps basis vectors', () => {
    const m = linearOf({ rotation: { z: 90 } });
    // R = [[cos,-sin,0],[sin,cos,0],[0,0,1]] with cos90≈0, sin90=1
    expect(m[0]).toBeCloseTo(0, 6);
    expect(m[1]).toBeCloseTo(-1, 6);
    expect(m[3]).toBeCloseTo(1, 6);
    expect(m[4]).toBeCloseTo(0, 6);
    expect(m[8]).toBeCloseTo(1, 6);
  });
});

describe('instanceTransformString', () => {
  test('identity + translation reproduces the legacy 12-value string', () => {
    expect(instanceTransformString(IDENT, 10, 20, 30)).toBe('1 0 0 0 1 0 0 0 1 10 20 30');
  });

  test('instance translate offsets the base placement', () => {
    expect(instanceTransformString(IDENT, 10, 20, 30, { translate: { x: 5, y: -2 } })).toBe(
      '1 0 0 0 1 0 0 0 1 15 18 30'
    );
  });

  test('instance scale composes into the linear part', () => {
    expect(instanceTransformString(IDENT, 0, 0, 0, { scale: 2 })).toBe('2 0 0 0 2 0 0 0 2 0 0 0');
  });
});

describe('layout — per-plate placement', () => {
  function box(): MeshedObject {
    const g = new THREE.BoxGeometry(20, 6, 20);
    g.translate(0, 3, 0);
    return { name: 'b', mesh: geometryToMesh(g), plate: 1, extruder: 1, lin: IDENT };
  }

  test('objects on the same plate share one translation (relative layout preserved)', () => {
    const out = layout([box(), box()], { x: 256, y: 256 }, 5);
    expect(out[0].tx).toBe(out[1].tx);
    expect(out[0].ty).toBe(out[1].ty);
    expect(out[0].tz).toBe(out[1].tz);
  });

  test('a centred object lands on the bed centre and drops to z=0', () => {
    const out = layout([box()], { x: 256, y: 256 }, 5);
    // box centred at origin in XZ (±10) → tx = 128 - 0 = 128; base at z=0 → tz=0
    expect(out[0].tx).toBe(128);
    expect(out[0].ty).toBe(128);
    expect(out[0].tz).toBe(0);
  });

  test('different plates occupy different bed cells', () => {
    const a = box();
    const b = box();
    b.plate = 2;
    const out = layout([a, b], { x: 256, y: 256 }, 5);
    // plate 2 is tiled into a different cell → larger tx (stride = bed + margin)
    expect(out[1].tx).toBeGreaterThan(out[0].tx + 256);
  });

  test('scale transform is reflected in the centred footprint', () => {
    const b = box();
    b.lin = linearOf({ scale: 2 }); // footprint ±20 now, still centred
    const out = layout([b], { x: 256, y: 256 }, 5);
    expect(out[0].tx).toBe(128); // symmetric scaling keeps centre at bed centre
  });
});
