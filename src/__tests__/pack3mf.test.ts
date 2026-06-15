/**
 * pack3mf 回归 + 结构测试。
 *
 * 用 fs 把 public/bambu/ 下的真实模板喂给 mock 的 fetch，端到端跑 pack3mf，再用 fflate 解包断言。
 * 目的：
 *  1) 回归 —— 不传任何新选项时，relief（单体）与 color（assembleAsOne）路径产出的关键 XML 与基线快照一致；
 *  2) 结构 —— 新功能（变换/实例/per-object 覆盖/subtype/绘制/可变层高/逐盘/slice_info）确实出现且格式正确。
 *
 * 注意：assembled 路径含随机 UUID，断言前统一用占位符归一，避免每次运行快照漂移。
 */
import * as fs from 'fs';
import * as path from 'path';
import * as THREE from 'three';
import { unzipSync, strFromU8 } from 'fflate';
import { pack3mf, encodePaintFacet, serializeSettings } from '../build3mf';

const PUBLIC = path.join(__dirname, 'fixtures');

// 把 /bambu/... 的 fetch 映射到磁盘上的 public/bambu/...；缺文件→404（与静态托管一致）。
// 装到所有全局作用域上（jsdom 下 build3mf 看到的 fetch 来自 window/globalThis，未必是 global）。
const fetchMock = async (url: string) => {
  const rel = String(url).replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '');
  const file = path.join(PUBLIC, rel);
  if (!fs.existsSync(file)) {
    return { ok: false, status: 404, text: async () => 'Not Found' };
  }
  const text = fs.readFileSync(file, 'utf8');
  return { ok: true, status: 200, text: async () => text };
};
for (const scope of [globalThis, global, typeof window !== 'undefined' ? window : undefined]) {
  if (scope) (scope as any).fetch = fetchMock;
}

/** A unit box centred on XZ with base at y=0 (mirrors relief/laser Y-up convention). */
function box(w = 10, h = 4, d = 10): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(0, h / 2, 0);
  return g;
}

function open(zip: Uint8Array): Record<string, string> {
  const files = unzipSync(zip);
  const out: Record<string, string> = {};
  for (const [name, bytes] of Object.entries(files)) {
    // 仅文本部件转字符串（png 跳过）
    if (!name.endsWith('.png')) out[name] = strFromU8(bytes);
  }
  return out;
}

/** UUID 归一，便于对 assembled 路径快照。 */
function normalize(xml: string): string {
  return xml.replace(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, 'UUID');
}

describe('pack3mf 回归（默认路径，不传新选项）', () => {
  test('relief 单体：3dmodel.model 与 model_settings.config 稳定', async () => {
    const zip = await pack3mf('relief/default', [{ name: 'photo-relief', geometry: box() }]);
    const f = open(zip);
    expect(Object.keys(f).sort()).toMatchSnapshot('relief-parts');
    expect(f['3D/3dmodel.model']).toMatchSnapshot('relief-model');
    expect(f['Metadata/model_settings.config']).toMatchSnapshot('relief-model-settings');
  });

  test('color assembleAsOne：组合体结构稳定（UUID 归一）', async () => {
    const zip = await pack3mf(
      'color-positive',
      [
        { name: 'C', geometry: box(), extruder: 1 },
        { name: 'M', geometry: box(), extruder: 2 },
      ],
      { title: 'demo' },
      { assembleAsOne: true, filaments: ['#E79D8E', '#323031'] }
    );
    const f = open(zip);
    expect(Object.keys(f).sort()).toMatchSnapshot('color-parts');
    expect(normalize(f['3D/3dmodel.model'])).toMatchSnapshot('color-root-model');
    expect(normalize(f['3D/Objects/colorparts.model'])).toMatchSnapshot('color-child-model');
    expect(normalize(f['Metadata/model_settings.config'])).toMatchSnapshot('color-model-settings');
  });
});

describe('encodePaintFacet（对齐 TriangleSelector 整面编码）', () => {
  test.each([
    [0, ''],
    [1, '4'],
    [2, '8'],
    [3, 'c0'],
    [4, 'c1'],
    [17, 'ce'],
    [18, 'cf0'],
  ])('state %i → "%s"', (state, hex) => {
    expect(encodePaintFacet(state as number)).toBe(hex);
  });
});

describe('serializeSettings（类型化值 → Bambu 字符串形态）', () => {
  test('number→字符串, boolean→"0"/"1", 数组逐元素, undefined 跳过', () => {
    expect(
      serializeSettings({
        layer_height: 0.2,
        spiral_mode: true,
        gcode_add_line_number: false,
        flush_volumes_vector: [140, 140],
        dropped: undefined,
      })
    ).toEqual({
      layer_height: '0.2',
      spiral_mode: '1',
      gcode_add_line_number: '0',
      flush_volumes_vector: ['140', '140'],
    });
  });
});

describe('新功能：结构断言（端到端，relief 模板）', () => {
  async function packRelief(objects: any[], options: any = {}) {
    const zip = await pack3mf('relief/default', objects, undefined, options);
    return open(zip);
  }

  test('逐三角面绘制：paint_color / paint_supports 写到 <triangle>', async () => {
    const f = await packRelief([
      {
        name: 'painted',
        geometry: box(),
        paint: { color: (tri: number) => (tri === 0 ? 2 : 0), supports: (tri: number) => (tri === 1 ? 1 : 0) },
      },
    ]);
    expect(f['3D/3dmodel.model']).toContain('paint_color="8"');
    expect(f['3D/3dmodel.model']).toContain('paint_supports="4"');
  });

  test('对象级 subtype 与 per-object 覆盖写入 model_settings', async () => {
    const f = await packRelief([
      { name: 'mod', geometry: box(), subtype: 'modifier_part', settings: { wall_loops: 3 } },
    ]);
    expect(f['Metadata/model_settings.config']).toContain('subtype="modifier_part"');
    expect(f['Metadata/model_settings.config']).toContain('<metadata key="wall_loops" value="3"/>');
  });

  test('多实例：两个 build item + 两个 model_instance', async () => {
    const f = await packRelief([
      { name: 'copies', geometry: box(), instances: [{}, { translate: { x: 30 } }] },
    ]);
    const items = (f['3D/3dmodel.model'].match(/<item /g) || []).length;
    const minst = (f['Metadata/model_settings.config'].match(/<model_instance>/g) || []).length;
    expect(items).toBe(2);
    expect(minst).toBe(2);
  });

  test('变换：缩放进入 build-item 矩阵的线性部分', async () => {
    const f = await packRelief([{ name: 's', geometry: box(), transform: { scale: 2 } }]);
    expect(f['3D/3dmodel.model']).toContain('transform="2 0 0 0 2 0 0 0 2 ');
  });

  test('可变层高：layer_config_ranges.xml 写出 Z 区间与 option', async () => {
    const f = await packRelief([
      { name: 'r', geometry: box(), layerRanges: [{ minZ: 0, maxZ: 2, settings: { layer_height: 0.1 } }] },
    ]);
    const lr = f['Metadata/layer_config_ranges.xml'];
    expect(lr).toBeDefined();
    expect(lr).toContain('min_z="0" max_z="2"');
    expect(lr).toContain('<option opt_key="layer_height">0.1</option>');
  });

  test('多 part 对象：走 component/child 结构，part 携带 subtype + 设置', async () => {
    const f = await packRelief([
      {
        name: 'assembly',
        geometry: box(),
        parts: [
          { name: 'base', geometry: box(), subtype: 'normal_part' },
          { name: 'mod', geometry: box(), subtype: 'modifier_part', settings: { sparse_infill_density: '80%' } },
        ],
      },
    ]);
    expect(f['3D/Objects/colorparts.model']).toBeDefined();
    expect(f['Metadata/model_settings.config']).toContain('subtype="modifier_part"');
    expect(f['Metadata/model_settings.config']).toContain('<metadata key="sparse_infill_density" value="80%"/>');
  });

  test('processSettings 并入 project_settings 并标记 modified', async () => {
    const f = await packRelief([{ name: 'p', geometry: box() }], { processSettings: { wall_loops: 4 } });
    const cfg = JSON.parse(f['Metadata/project_settings.config']);
    expect(cfg.wall_loops).toBe('4');
    expect(String(cfg.different_settings_to_system[0])).toContain('wall_loops');
  });

  test('projectSettingsOverrides 覆盖优先于 processSettings', async () => {
    const f = await packRelief([{ name: 'p', geometry: box() }], {
      processSettings: { wall_loops: 4 },
      projectSettingsOverrides: { wall_loops: '9' },
    });
    expect(JSON.parse(f['Metadata/project_settings.config']).wall_loops).toBe('9');
  });

  test('plates：plater_name / bed_type 写入，且 per-plate 暂停层生成 custom gcode', async () => {
    const f = await packRelief([{ name: 'p', geometry: box() }], {
      plates: [{ index: 1, name: '底盘A', bedType: 'Cool Plate', pauses: [{ atZ: 5 }] }],
    });
    expect(f['Metadata/model_settings.config']).toContain('value="底盘A"');
    expect(f['Metadata/model_settings.config']).toContain('<metadata key="bed_type" value="Cool Plate"/>');
    expect(f['Metadata/custom_gcode_per_layer.xml']).toContain('M400 U1');
  });

  test('sliceInfo：耗材摘要写入 slice_info.config', async () => {
    const f = await packRelief([{ name: 'p', geometry: box() }], {
      sliceInfo: { filaments: [{ type: 'PLA', color: '#000000', usedG: 1.2, usedM: 0.4 }] },
    });
    expect(f['Metadata/slice_info.config']).toContain('<filament');
    expect(f['Metadata/slice_info.config']).toContain('type="PLA"');
    expect(f['Metadata/slice_info.config']).toContain('used_g="1.2"');
  });
});
