/** Unit tests for the pure core pack3mfFromConfig (no fetch / DOM). */
import * as fs from 'fs';
import * as path from 'path';
import * as THREE from 'three';
import { unzipSync, strFromU8 } from 'fflate';
import { pack3mfFromConfig } from '../build3mf';

const PROJECT_SETTINGS = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'bambu', 'relief', 'default', 'project_settings.config'),
  'utf8'
);

function box(): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(20, 6, 20);
  g.translate(0, 3, 0);
  return g;
}
function open(zip: Uint8Array): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, bytes] of Object.entries(unzipSync(zip))) {
    if (!name.endsWith('.png')) out[name] = strFromU8(bytes);
  }
  return out;
}

describe('pack3mfFromConfig — pure core', () => {
  test('produces a valid OPC package from a config string, no fetch', () => {
    const zip = pack3mfFromConfig({ projectSettings: PROJECT_SETTINGS }, [{ name: 'a', geometry: box() }]);
    const f = open(zip);
    for (const part of [
      '[Content_Types].xml',
      '_rels/.rels',
      'Metadata/project_settings.config',
      'Metadata/slice_info.config',
      '3D/3dmodel.model',
      'Metadata/model_settings.config',
    ]) {
      expect(f[part]).toBeDefined();
    }
    expect(f['3D/3dmodel.model']).toContain('<object id="1" type="model">');
  });

  test('empty objects throws', () => {
    expect(() => pack3mfFromConfig({ projectSettings: PROJECT_SETTINGS }, [])).toThrow('没有可导出的几何');
  });

  test('processSettings merge into project_settings and mark modified', () => {
    const zip = pack3mfFromConfig({ projectSettings: PROJECT_SETTINGS }, [{ name: 'a', geometry: box() }], undefined, {
      processSettings: { wall_loops: 4, spiral_mode: true },
    });
    const cfg = JSON.parse(open(zip)['Metadata/project_settings.config']);
    expect(cfg.wall_loops).toBe('4');
    expect(cfg.spiral_mode).toBe('1');
    const diff = String(cfg.different_settings_to_system[0]);
    expect(diff).toContain('wall_loops');
    expect(diff).toContain('spiral_mode');
  });

  test('projectSettingsOverrides wins over processSettings', () => {
    const zip = pack3mfFromConfig({ projectSettings: PROJECT_SETTINGS }, [{ name: 'a', geometry: box() }], undefined, {
      processSettings: { wall_loops: 4 },
      projectSettingsOverrides: { wall_loops: '9' },
    });
    expect(JSON.parse(open(zip)['Metadata/project_settings.config']).wall_loops).toBe('9');
  });

  test('filaments palette resizes the per-filament arrays', () => {
    const five = ['#E79D8E', '#323031', '#BEBFC1', '#FDFEFE', '#000000'];
    const zip = pack3mfFromConfig({ projectSettings: PROJECT_SETTINGS }, [{ name: 'a', geometry: box(), extruder: 5 }], undefined, {
      filaments: five,
    });
    const cfg = JSON.parse(open(zip)['Metadata/project_settings.config']);
    expect(cfg.filament_colour).toEqual(five);
    expect(cfg.nozzle_temperature.length).toBe(5);
  });

  test('metadataOverrides patch the project info block', () => {
    const zip = pack3mfFromConfig({ projectSettings: PROJECT_SETTINGS }, [{ name: 'a', geometry: box() }], { title: 't' }, {
      metadataOverrides: { Designer: 'unit-test' },
    });
    expect(open(zip)['3D/3dmodel.model']).toContain('<metadata name="Designer">unit-test</metadata>');
  });

  test('thumbnails add plate_1.png and the thumbnail relationships', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const zip = pack3mfFromConfig({ projectSettings: PROJECT_SETTINGS }, [{ name: 'a', geometry: box() }], undefined, {
      thumbnails: { middle: png, small: png },
    });
    const files = unzipSync(zip);
    expect(files['Metadata/plate_1.png']).toBeDefined();
    expect(files['Metadata/plate_1_small.png']).toBeDefined();
    expect(strFromU8(files['_rels/.rels'])).toContain('cover-thumbnail-small');
  });

  test('assembleAsOne switches to the component/child-file structure', () => {
    const zip = pack3mfFromConfig(
      { projectSettings: PROJECT_SETTINGS },
      [{ name: 'C', geometry: box(), extruder: 1 }, { name: 'M', geometry: box(), extruder: 2 }],
      { title: 'multi' },
      { assembleAsOne: true, filaments: ['#aaa', '#bbb'] }
    );
    const f = open(zip);
    expect(f['3D/Objects/colorparts.model']).toBeDefined();
    expect(f['3D/_rels/3dmodel.model.rels']).toBeDefined();
    expect(f['3D/3dmodel.model']).toContain('<components>');
  });

  test('objects with parts emit a child model even without assembleAsOne', () => {
    const zip = pack3mfFromConfig({ projectSettings: PROJECT_SETTINGS }, [
      {
        name: 'obj',
        geometry: box(),
        parts: [
          { name: 'body', geometry: box(), subtype: 'normal_part' },
          { name: 'mod', geometry: box(), subtype: 'modifier_part' },
        ],
      },
    ]);
    const f = open(zip);
    expect(f['3D/Objects/colorparts.model']).toBeDefined();
    expect(f['Metadata/model_settings.config']).toContain('subtype="modifier_part"');
  });
});
