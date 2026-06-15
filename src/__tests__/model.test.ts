/** Unit tests for model.ts — model.xml / model_settings.config / assembled package. */
import * as THREE from 'three';
import { buildModelXml, buildModelSettingsXml, buildAssembled } from '../model';
import { geometryToMesh } from '../mesh';
import { MeshedPart, PreparedObject } from '../types';

const IDENT = [1, 0, 0, 0, 1, 0, 0, 0, 1];

function mesh() {
  const g = new THREE.BoxGeometry(10, 4, 10);
  g.translate(0, 2, 0);
  return geometryToMesh(g);
}
function prep(name: string, extra: Partial<PreparedObject> = {}): PreparedObject {
  return { name, mesh: mesh(), plate: 1, extruder: 1, lin: IDENT, tx: 0, ty: 0, tz: 0, ...extra };
}
const count = (s: string, re: RegExp) => (s.match(re) || []).length;

describe('buildModelXml (simple path)', () => {
  test('one object + one build item by default', () => {
    const xml = buildModelXml([prep('a')], '');
    expect(xml).toContain('<object id="1" type="model">');
    expect(count(xml, /<item /g)).toBe(1);
    expect(xml).toContain('transform="1 0 0 0 1 0 0 0 1 0 0 0"');
  });

  test('instances emit one build item each', () => {
    const xml = buildModelXml([prep('a', { instances: [{}, { translate: { x: 30 } }] })], '');
    expect(count(xml, /<item /g)).toBe(2);
    expect(xml).toContain('1 0 0 0 1 0 0 0 1 30 0 0');
  });

  test('object transform appears in the build-item matrix', () => {
    const xml = buildModelXml([prep('a', { lin: [2, 0, 0, 0, 2, 0, 0, 0, 2] })], '');
    expect(xml).toContain('transform="2 0 0 0 2 0 0 0 2 0 0 0"');
  });
});

describe('buildModelSettingsXml (simple path)', () => {
  test('default part is a normal_part with no extra metadata', () => {
    const xml = buildModelSettingsXml([prep('a')]);
    expect(xml).toContain('subtype="normal_part"');
    expect(xml).toContain('<metadata key="name" value="a"/>');
  });

  test('object subtype + per-object settings are written', () => {
    const xml = buildModelSettingsXml([
      prep('mod', { subtype: 'modifier_part', settings: { wall_loops: 3, sparse_infill_density: '80%' } }),
    ]);
    expect(xml).toContain('subtype="modifier_part"');
    expect(xml).toContain('<metadata key="wall_loops" value="3"/>');
    expect(xml).toContain('<metadata key="sparse_infill_density" value="80%"/>');
  });

  test('instances produce multiple model_instance entries', () => {
    const xml = buildModelSettingsXml([prep('a', { instances: [{}, {}, {}] })]);
    expect(count(xml, /<model_instance>/g)).toBe(3);
  });

  test('plate config overrides name / bed type', () => {
    const xml = buildModelSettingsXml([prep('a')], false, {
      1: { index: 1, name: '底盘', bedType: 'Cool Plate', locked: true },
    });
    expect(xml).toContain('value="底盘"');
    expect(xml).toContain('<metadata key="bed_type" value="Cool Plate"/>');
    expect(xml).toContain('<metadata key="locked" value="true"/>');
  });
});

describe('buildAssembled', () => {
  test('plate mode groups all plate objects into one assembly', () => {
    const { rootModel, childModel, modelSettings } = buildAssembled(
      [prep('C', { extruder: 1 }), prep('M', { extruder: 2 })],
      '',
      'demo',
      false,
      'plate'
    );
    expect(count(childModel, /<object id=/g)).toBe(2); // two child meshes
    expect(count(rootModel, /<component /g)).toBe(2);
    expect(count(rootModel, /<object /g)).toBe(1); // one assembly object
    expect(modelSettings).toContain('value="demo"');
    expect(modelSettings).toContain('subtype="normal_part"');
  });

  test('object mode: one assembly per object, parts become members', () => {
    const part = (name: string, subtype: MeshedPart['subtype']): MeshedPart => ({
      name,
      mesh: mesh(),
      subtype,
      extruder: 1,
      lin: IDENT,
    });
    const obj = prep('assembly', {
      parts: [
        part('body', 'normal_part'),
        { ...part('core', 'modifier_part'), settings: { sparse_infill_density: '90%' } },
      ],
    });
    const { childModel, modelSettings } = buildAssembled([obj], '', 'assembly', false, 'object');
    expect(count(childModel, /<object id=/g)).toBe(2); // two part meshes
    expect(modelSettings).toContain('subtype="modifier_part"');
    expect(modelSettings).toContain('<metadata key="sparse_infill_density" value="90%"/>');
  });

  test('references the child model file path', () => {
    const { rootModel, rels } = buildAssembled([prep('a')], '', 'x', false, 'plate');
    expect(rootModel).toContain('p:path="/3D/Objects/colorparts.model"');
    expect(rels).toContain('Target="/3D/Objects/colorparts.model"');
  });
});
