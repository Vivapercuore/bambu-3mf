# bambu-3mf

[English](./README-en.md) | **简体中文**

从 [Three.js](https://threejs.org/) 几何生成 **BambuStudio 兼容的 `.3mf`** —— 浏览器或 Node 均可。

内置完整的**工艺 / 耗材 / 打印机参数目录**（带类型，且有开放索引签名，*任意* BambuStudio 键都能写），
以及 BambuStudio 认识的格式级功能：多色、modifier 与支撑、逐三角面绘制（MMU）、可变层高、多盘、
多实例、自定义 G-code（暂停层）、缩略图、更丰富的 slice 信息。

> 进：Three.js 几何（Y-up）；出：可直接切片的 `.3mf`。纯同步核心，不依赖 DOM。

**目录：** [亮点](#亮点) · [安装](#安装) · [快速上手](#快速上手) · [几何约定](#几何约定) ·
[API](#api) · [指南](#指南) · [支持的功能](#支持的功能) · [工艺参数目录](#工艺参数目录) ·
[绘制编码](#绘制编码) · [测试](#测试) · [构建/发布](#构建--发布) · [状态与注意事项](#状态与注意事项)

---

## 亮点

- **类型化参数目录** —— `ProcessSettings` / `FilamentSettings` / `PrinterSettings`（508 个键，
  来自真实 Bambu 导出），有补全、常见枚举键给字面量类型，索引签名让未知/未来键照样写入。
- **多色** —— 把多个部件合成一个套准对象，调色板/料表自动缩放。
- **逐三角面绘制** —— `paint_color`（MMU）、`paint_supports`、`paint_seam`、`paint_fuzzy_skin`，
  采用与 `TriangleSelector` 完全一致的整面编码。
- **Modifier 与支撑** —— `normal` / `negative` / `modifier` / `support_enforcer` /
  `support_blocker` 部件，支持按对象、按 part 的参数覆盖。
- **摆放** —— 旋转 / 缩放 / 镜像 + 多实例（拷贝）。
- **可变层高** —— `layer_config_ranges.xml`。
- **多盘** —— 逐盘名称 / 床型 / 自定义 G-code，外加更丰富的 `slice_info.config`。
- **核心不依赖你的 app** —— `pack3mfFromConfig` 是同步、无框架的；`pack3mf` 只是浏览器侧 fetch
  模板的便捷封装。

---

## 安装

```bash
npm i bambu-3mf three
```

`three` 是 **peer 依赖**（由你提供，全工程共用同一份）。`fflate`（zip）是普通依赖，随包**自动安装**。

---

## 快速上手

### Node / 任意环境（纯核心）

```ts
import * as THREE from 'three';
import { pack3mfFromConfig } from 'bambu-3mf';
import { readFileSync, writeFileSync } from 'fs';

const geometry = new THREE.BoxGeometry(40, 8, 40);
geometry.translate(0, 4, 0); // Y-up，底面在 y=0

const zip = pack3mfFromConfig(
  { projectSettings: readFileSync('project_settings.config', 'utf8') },
  [{ name: 'plate', geometry }],
  { title: 'demo', designer: 'me' },
  { processSettings: { layer_height: 0.2, sparse_infill_density: '15%' } }
);

writeFileSync('demo.3mf', zip);
```

### 浏览器（从 `public/bambu/<template>/` fetch 模板）

```ts
import { pack3mf } from 'bambu-3mf';

const zip = await pack3mf(
  'relief/default',
  [{ name: 'photo-relief', geometry }],
  { title: 'photo' }
);
// → Uint8Array；用你喜欢的下载方式保存。
```

`pack3mf(template, …)` 会从 `${publicBase}/bambu/${template}/` 加载 `project_settings.config`
（必需）、`metadata.xml` 和 `filament_settings_1.config`（可选），然后调用 `pack3mfFromConfig`。

---

## 几何约定

输入几何是 **Three.js Y-up**：高度在 `+Y`，平铺在 XZ 平面，底面在 `y = 0`。内部会旋转到 3MF 的
**Z-up 毫米**坐标系。`Object3mf.geometry` 可以是单个 `BufferGeometry`，也可以是数组 —— 数组每一项
都作为**独立实体**焊接（相邻部件保持流形，实体之间绝不融合）。

---

## API

### `pack3mfFromConfig(config, objects, meta?, options?) => Uint8Array`
纯同步核心。`config: TemplateConfig` = `{ projectSettings, metadataXml?, filamentSettings? }`。

### `pack3mf(template, objects, meta?, options?) => Promise<Uint8Array>`
浏览器便捷封装；fetch 模板文件后委托给核心。

### `Object3mf`

| 字段 | 类型 | 含义 |
|---|---|---|
| `name` | `string` | 切片器树里的对象/部件名 |
| `geometry` | `BufferGeometry \| BufferGeometry[]` | Y-up 网格（设了 `parts` 时忽略） |
| `plate?` | `number` | 1-based 盘号（默认 1） |
| `extruder?` | `number` | 1-based 料槽（默认 1） |
| `transform?` | `ObjectTransform` | 旋转 / 缩放 / 镜像 |
| `instances?` | `InstanceTransform[]` | 拷贝（额外 build item） |
| `settings?` | `ProcessSettings` | 按对象的参数覆盖 |
| `subtype?` | `PartSubtype` | 整对象角色（modifier / 支撑 / …） |
| `paint?` | `TrianglePaint` | 此网格的逐三角面绘制 |
| `parts?` | `Part3mf[]` | 多 part 对象（component/子文件结构） |
| `layerRanges?` | `LayerRange[]` | 按 Z 区间的可变层高 |

### `Pack3mfOptions`

| 字段 | 类型 | 含义 |
|---|---|---|
| `bedSize?` | `{x,y}` | 居中用的热床尺寸（默认 256） |
| `gap?` | `number` | 自动排版间距 mm（默认 5） |
| `processSettings?` | `ProcessSettings` | 类型化覆盖 → `project_settings.config` |
| `projectSettingsOverrides?` | `Record<string, unknown>` | 无类型覆盖（**最高优先级**） |
| `markModified?` | `string[]` | 标记为相对系统预设已改 |
| `metadataOverrides?` | `Record<string,string\|null>` | 修补 `metadata.xml` 项目信息 |
| `assembleAsOne?` | `boolean` | 把每盘对象合成一个套准对象 |
| `filaments?` | `string[]` | 调色板 `#RRGGBB`；缩放所有 per-filament 数组和料表 |
| `pauses?` | `PauseLayer[]` | 盘 1 的自定义 G-code（暂停层） |
| `plates?` | `PlateConfig[]` | 逐盘名称 / 床型 / 自定义 G-code |
| `sliceInfo?` | `SliceInfoInput` | 更丰富的 `slice_info.config`（耗材、用量） |
| `thumbnails?` | `{middle, small?}` | PNG 字节 → `plate_1.png` / `plate_1_small.png` |
| `publicBase?` | `string` | `pack3mf` fetch 用的子路径前缀 |

---

## 指南

### 类型化工艺 / 耗材 / 打印机参数

```ts
import { ProcessSettings } from 'bambu-3mf';

const process: ProcessSettings = {
  layer_height: 0.12,             // number → "0.12"
  spiral_mode: true,              // boolean → "1"
  wall_loops: 3,
  sparse_infill_density: '25%',
  sparse_infill_pattern: 'gyroid',// 枚举字面量补全
  seam_position: 'aligned',
  brim_type: 'outer_only',
  any_future_bambu_key: 'value',  // 索引签名 → 照样写入
};
```

`processSettings` 会并入 `project_settings.config`，其键自动登记进 `different_settings_to_system`。
无类型的 `projectSettingsOverrides` 也会并入，且**优先级高于** `processSettings`。
`validateSettings(s)` 对不在 `KNOWN_KEYS` 的键给出（非致命）警告。

### 多色（套准组合体）

```ts
await pack3mf('color-positive', parts, { title }, {
  assembleAsOne: true,                       // 一个对象，各 part 绝不漂移
  filaments: ['#E79D8E', '#323031', '#BEBFC1', '#FDFEFE', '#000000'],
});
```

### 逐三角面绘制（MMU / 支撑 / 缝线 / 模糊皮肤）

```ts
{
  name: 'painted', geometry,
  paint: {
    color:    (tri) => faceColor[tri],   // 0 = 底色，1..N = 料槽
    supports: (tri) => (isOverhang(tri) ? 1 : 0), // 1 强制，2 禁止
    seam:     (tri) => (wantSeam(tri) ? 1 : 0),
  },
}
```

`PaintInput` 可以是数组、`(srcTri) => state` 回调，或 `{ raw: (srcTri) => string }`
（直接给出 Bambu 精确编码值）。面按**源面序**索引。详见 [绘制编码](#绘制编码)。

### Modifier / 支撑 / 多 part 对象

```ts
{
  name: 'bracket',
  parts: [
    { name: 'body', geometry: body, subtype: 'normal_part' },
    { name: 'denser core', geometry: coreBox, subtype: 'modifier_part',
      settings: { sparse_infill_density: '80%' } },
    { name: 'no-support zone', geometry: zone, subtype: 'support_blocker' },
  ],
}
```

整个对象也可以通过 `subtype` 成为 modifier（不需要 `parts`）。

### 摆放：变换与实例

```ts
{ name: 'a', geometry, transform: { rotation: { z: 45 }, scale: 1.5 } }
{ name: 'b', geometry, instances: [{}, { translate: { x: 40 } }, { translate: { x: 80 } }] }
```

### 可变层高

```ts
{ name: 'relief', geometry, layerRanges: [
  { minZ: 0,   maxZ: 1.5, settings: { layer_height: 0.2 } },
  { minZ: 1.5, maxZ: 8,   settings: { layer_height: 0.08 } },
]}
```

### 逐盘设置与自定义 G-code

```ts
{
  plates: [
    { index: 1, name: 'first', bedType: 'Textured PEI Plate',
      pauses: [{ atZ: 5.2, gcode: 'M400 U1' }] },
  ],
}
```

### Slice 信息与缩略图

```ts
{
  sliceInfo: { filaments: [{ id: 1, type: 'PLA', color: '#000000', usedG: 12.3, usedM: 4.1 }] },
  thumbnails: await makeThumbnails(previewDataUrl), // 浏览器辅助函数
}
```

---

## 支持的功能

| 能力 | API | 产物 |
|---|---|---|
| 单对象导出 | `pack3mf` / `pack3mfFromConfig` | `3dmodel.model`（内联网格） |
| 多对象 / 一整盘激光件 | `objects[]` | 每个对象一个 `<object>` + build item |
| 多盘 | `Object3mf.plate` | 平铺的热床格，各自一个 `<plate>` |
| 完整工艺 / 耗材 / 打印机参数 | `processSettings` + `projectSettingsOverrides` | `project_settings.config` |
| 标记相对系统已改 | 自动 + `markModified` | `different_settings_to_system` |
| 项目信息 | `meta` + `metadataOverrides` | `metadata.xml` 块 |
| 多色套准组合体 | `assembleAsOne` | component + 子 `.model` |
| 调色板 / 料表缩放 | `filaments` | per-filament 数组 + 冲刷矩阵 |
| 对象变换（旋转/缩放/镜像） | `transform` | build-item 矩阵 |
| 实例（拷贝） | `instances` | 额外 build item + `model_instance` |
| 按对象参数覆盖 | `Object3mf.settings` | `model_settings.config` `<metadata>` |
| 多 part 对象 | `parts` | 父 `<components>` + 子网格 |
| Modifier / negative / 支撑 part | `subtype` | `<part subtype="…">` |
| 按 part 参数覆盖 | `Part3mf.settings` | `<part>` `<metadata>` |
| 逐面颜色（MMU） | `paint.color` | `<triangle>` 上 `paint_color` |
| 逐面支撑强制/禁止 | `paint.supports` | `paint_supports` |
| 逐面缝线 | `paint.seam` | `paint_seam` |
| 逐面模糊皮肤 | `paint.fuzzy` | `paint_fuzzy_skin` |
| 可变层高 | `layerRanges` | `layer_config_ranges.xml` |
| 逐盘名 / 床型 / 螺旋 / 顺序 | `plates` | `model_settings.config` `<plate>` |
| 自定义 G-code / 暂停层（逐盘） | `pauses` / `plates[].pauses` | `custom_gcode_per_layer.xml` |
| 擦料塔位置 | `processSettings.wipe_tower_x/y/...` | `project_settings.config` |
| 耗材摘要 / 用量 | `sliceInfo` | `slice_info.config` |
| 项目缩略图 | `thumbnails`（+ `makeThumbnails`） | `plate_1.png` + OPC rels |

---

## 工艺参数目录

三个类型化接口，**共 508 键**，来自真实 Bambu 导出。常见枚举键有字面量联合类型；每个接口都有
索引签名，所以**任何额外的 BambuStudio 键也能写**（经 `serializeSettings` 序列化）。

| 接口 | 键数 | 覆盖 |
|---|---|---|
| `ProcessSettings` | 310 | 质量、墙、填充、速度、支撑、接缝、熨烫、擦料塔、raft、brim、补偿、桥接 |
| `FilamentSettings` | 101 | 温度、冷却/风扇、回抽、流量、换色冲刷、压力提前 |
| `PrinterSettings` | 97 | 机型、可打印区域、喷嘴、机器极限、G-code 钩子、host、换料时间 |

### 枚举字面量类型

| 键 | 类型 | 取值 |
|---|---|---|
| `wall_generator` | `WallGenerator` | `classic`, `arachne` |
| `wall_sequence` | `WallSequence` | `inner wall/outer wall`, `outer wall/inner wall`, `inner-outer-inner wall` |
| `seam_position` | `SeamPosition` | `nearest`, `aligned`, `back`, `random` |
| `seam_slope_type` | `SeamSlopeType` | `none`, `external`, `all` |
| `top/bottom/internal_solid_infill_pattern` | `SurfacePattern` | `concentric`, `zig-zag`, `monotonic`, `monotonicline`, `alignedrectilinear`, `hilbertcurve`, `archimedeanchords`, `octagramspiral` |
| `sparse_infill_pattern` | `SparseInfillPattern` | `grid`, `gyroid`, `honeycomb`, `cubic`, `adaptivecubic`, `lightning`, `tri-hexagon`, `3dhoneycomb`, `crosshatch`, … |
| `brim_type` | `BrimType` | `auto_brim`, `brim_ears`, `outer_only`, `inner_only`, `outer_and_inner`, `no_brim` |
| `support_type` | `SupportType` | `normal(auto)`, `tree(auto)`, `normal(manual)`, `tree(manual)` |
| `support_style` | `SupportStyle` | `default`, `grid`, `snug`, `tree_slim`, `tree_strong`, `tree_hybrid`, `organic` |
| `support_base_pattern` | `SupportBasePattern` | `default`, `rectilinear`, `rectilinear-grid`, `honeycomb`, `lightning`, `hollow` |
| `support_interface_pattern` | `SupportInterfacePattern` | `auto`, `rectilinear`, `concentric`, `rectilinear_interlaced`, `grid` |
| `ironing_type` | `IroningType` | `no ironing`, `top`, `topmost`, `solid` |
| `ironing_pattern` | `IroningPattern` | `concentric`, `zig-zag` |
| `fuzzy_skin` | `FuzzySkin` | `none`, `external`, `all`, `allwalls` |
| `draft_shield` | `DraftShield` | `disabled`, `limited`, `enabled` |
| `print_sequence` | `PrintSequence` | `by layer`, `by object` |
| `slicing_mode` | `SlicingMode` | `regular`, `even_odd`, `close_holes` |
| `top_one_wall_type` | `TopOneWallType` | `all top`, `none`, `topmost` |
| `gcode_flavor` | `GcodeFlavor` | `marlin`, `klipper`, `reprapfirmware`, … |
| `curr_bed_type` | `BedType` | `Cool Plate`, `Engineering Plate`, `High Temp Plate`, `Textured PEI Plate`, `Textured Cool Plate`, `Supertack Plate` |
| `printer_structure` | `PrinterStructure` | `corexy`, `i3`, `hbot`, `delta`, `kossel` |

<details>
<summary><b>ProcessSettings —— 全部 310 键</b></summary>

`accel_to_decel_enable`, `accel_to_decel_factor`, `apply_scarf_seam_on_circles`, `apply_top_surface_compensation`, `auto_disable_filter_on_overheat`, `avoid_crossing_wall_includes_support`, `bottom_color_penetration_layers`, `bottom_shell_layers`, `bottom_shell_thickness`, `bottom_surface_pattern`, `bridge_angle`, `bridge_flow`, `bridge_no_support`, `bridge_speed`, `brim_object_gap`, `brim_type`, `brim_width`, `circle_compensation_manual_offset`, `circle_compensation_speed`, `compatible_printers_condition`, `cooling_filter_enabled`, `counter_coef_1`, `counter_coef_2`, `counter_coef_3`, `counter_limit_max`, `counter_limit_min`, `default_acceleration`, `default_jerk`, `default_nozzle_volume_type`, `detect_floating_vertical_shell`, `detect_narrow_internal_solid_infill`, `detect_overhang_wall`, `detect_thin_wall`, `diameter_limit`, `different_settings_to_system`, `draft_shield`, `elefant_foot_compensation`, `embedding_wall_into_infill`, `enable_arc_fitting`, `enable_circle_compensation`, `enable_height_slowdown`, `enable_overhang_speed`, `enable_pre_heating`, `enable_prime_tower`, `enable_support`, `enable_wrapping_detection`, `enforce_support_layers`, `ensure_vertical_shell_thickness`, `exclude_object`, `filename_format`, `fill_multiline`, `filter_out_gap_fill`, `first_layer_print_sequence`, `first_x_layer_fan_speed`, `flush_into_infill`, `flush_into_objects`, `flush_into_support`, `flush_multiplier`, `flush_volumes_matrix`, `flush_volumes_vector`, `from`, `fuzzy_skin`, `fuzzy_skin_point_distance`, `fuzzy_skin_thickness`, `gap_infill_speed`, `gcode_add_line_number`, `grab_length`, `group_algo_with_time`, `has_scarf_joint_seam`, `hole_coef_1`, `hole_coef_2`, `hole_coef_3`, `hole_limit_max`, `hole_limit_min`, `hotend_cooling_rate`, `hotend_heating_rate`, `impact_strength_z`, `independent_support_layer_height`, `infill_combination`, `infill_direction`, `infill_instead_top_bottom_surfaces`, `infill_jerk`, `infill_lock_depth`, `infill_rotate_step`, `infill_shift_step`, `infill_wall_overlap`, `inherits`, `inherits_group`, `initial_layer_acceleration`, `initial_layer_flow_ratio`, `initial_layer_infill_speed`, `initial_layer_jerk`, `initial_layer_line_width`, `initial_layer_print_height`, `initial_layer_speed`, `initial_layer_travel_acceleration`, `inner_wall_acceleration`, `inner_wall_jerk`, `inner_wall_line_width`, `inner_wall_speed`, `interface_shells`, `interlocking_beam`, `interlocking_beam_layer_count`, `interlocking_beam_width`, `interlocking_boundary_avoidance`, `interlocking_depth`, `interlocking_orientation`, `internal_bridge_support_thickness`, `internal_solid_infill_line_width`, `internal_solid_infill_pattern`, `internal_solid_infill_speed`, `ironing_direction`, `ironing_flow`, `ironing_inset`, `ironing_pattern`, `ironing_spacing`, `ironing_speed`, `ironing_type`, `is_infill_first`, `layer_height`, `line_width`, `locked_skeleton_infill_pattern`, `locked_skin_infill_pattern`, `long_retractions_when_ec`, `master_extruder_id`, `max_bridge_length`, `max_layer_height`, `max_travel_detour_distance`, `min_bead_width`, `min_feature_size`, `min_layer_height`, `minimum_sparse_infill_area`, `mmu_segmented_region_interlocking_depth`, `mmu_segmented_region_max_width`, `name`, `no_slow_down_for_cooling_on_outwalls`, `only_one_wall_first_layer`, `ooze_prevention`, `other_layers_print_sequence`, `other_layers_print_sequence_nums`, `outer_wall_acceleration`, `outer_wall_jerk`, `outer_wall_line_width`, `outer_wall_speed`, `overhang_1_4_speed`, `overhang_2_4_speed`, `overhang_3_4_speed`, `overhang_4_4_speed`, `overhang_threshold_participating_cooling`, `overhang_totally_speed`, `override_filament_scarf_seam_setting`, `physical_extruder_map`, `post_process`, `pre_start_fan_time`, `precise_outer_wall`, `precise_z_height`, `prime_tower_brim_width`, `prime_tower_enable_framework`, `prime_tower_extra_rib_length`, `prime_tower_fillet_wall`, `prime_tower_flat_ironing`, `prime_tower_infill_gap`, `prime_tower_lift_height`, `prime_tower_lift_speed`, `prime_tower_max_speed`, `prime_tower_rib_wall`, `prime_tower_rib_width`, `prime_tower_skip_points`, `prime_tower_width`, `prime_volume`, `prime_volume_mode`, `print_extruder_id`, `print_extruder_variant`, `print_flow_ratio`, `print_sequence`, `print_settings_id`, `printing_by_object_gcode`, `process_notes`, `raft_contact_distance`, `raft_expansion`, `raft_first_layer_density`, `raft_first_layer_expansion`, `raft_layers`, `reduce_crossing_wall`, `reduce_infill_retraction`, `resolution`, `retraction_distances_when_ec`, `retraction_length`, `retraction_minimum_travel`, `retraction_speed`, `role_base_wipe_speed`, `scarf_angle_threshold`, `seam_gap`, `seam_placement_away_from_overhangs`, `seam_position`, `seam_slope_conditional`, `seam_slope_entire_loop`, `seam_slope_gap`, `seam_slope_inner_walls`, `seam_slope_min_length`, `seam_slope_start_height`, `seam_slope_steps`, `seam_slope_type`, `skeleton_infill_density`, `skeleton_infill_line_width`, `skin_infill_density`, `skin_infill_depth`, `skin_infill_line_width`, `skirt_distance`, `skirt_height`, `skirt_loops`, `slice_closing_radius`, `slicing_mode`, `slowdown_end_acc`, `slowdown_end_height`, `slowdown_end_speed`, `slowdown_start_acc`, `slowdown_start_height`, `slowdown_start_speed`, `small_perimeter_speed`, `small_perimeter_threshold`, `smooth_coefficient`, `smooth_speed_discontinuity_area`, `solid_infill_filament`, `sparse_infill_acceleration`, `sparse_infill_anchor`, `sparse_infill_anchor_max`, `sparse_infill_density`, `sparse_infill_filament`, `sparse_infill_line_width`, `sparse_infill_pattern`, `sparse_infill_speed`, `spiral_mode`, `spiral_mode_max_xy_smoothing`, `spiral_mode_smooth`, `support_angle`, `support_base_pattern`, `support_base_pattern_spacing`, `support_bottom_interface_spacing`, `support_bottom_z_distance`, `support_cooling_filter`, `support_critical_regions_only`, `support_expansion`, `support_filament`, `support_interface_bottom_layers`, `support_interface_filament`, `support_interface_loop_pattern`, `support_interface_not_for_body`, `support_interface_pattern`, `support_interface_spacing`, `support_interface_speed`, `support_interface_top_layers`, `support_line_width`, `support_object_first_layer_gap`, `support_object_skip_flush`, `support_object_xy_distance`, `support_on_build_plate_only`, `support_remove_small_overhang`, `support_speed`, `support_style`, `support_threshold_angle`, `support_top_z_distance`, `support_type`, `symmetric_infill_y_axis`, `thick_bridges`, `timelapse_type`, `top_area_threshold`, `top_color_penetration_layers`, `top_one_wall_type`, `top_shell_layers`, `top_shell_thickness`, `top_solid_infill_flow_ratio`, `top_surface_acceleration`, `top_surface_jerk`, `top_surface_line_width`, `top_surface_pattern`, `top_surface_speed`, `top_z_overrides_xy_distance`, `travel_acceleration`, `travel_jerk`, `travel_speed`, `travel_speed_z`, `tree_support_branch_angle`, `tree_support_branch_diameter`, `tree_support_branch_diameter_angle`, `tree_support_branch_distance`, `tree_support_brim_width`, `tree_support_wall_count`, `version`, `vertical_shell_speed`, `volumetric_speed_coefficients`, `wall_distribution_count`, `wall_filament`, `wall_generator`, `wall_loops`, `wall_sequence`, `wall_transition_angle`, `wall_transition_filter_deviation`, `wall_transition_length`, `wipe_speed`, `wipe_tower_no_sparse_layers`, `wipe_tower_rotation_angle`, `wipe_tower_x`, `wipe_tower_y`, `wrapping_detection_gcode`, `wrapping_detection_layers`, `wrapping_exclude_area`, `xy_contour_compensation`, `xy_hole_compensation`, `z_direction_outwall_speed_continuous`
</details>

<details>
<summary><b>FilamentSettings —— 全部 101 键</b></summary>

`activate_air_filtration`, `additional_cooling_fan_speed`, `chamber_temperatures`, `close_fan_the_first_x_layers`, `complete_print_exhaust_fan_speed`, `cool_plate_temp`, `cool_plate_temp_initial_layer`, `default_filament_colour`, `default_filament_profile`, `during_print_exhaust_fan_speed`, `enable_long_retraction_when_cut`, `enable_overhang_bridge_fan`, `enable_pressure_advance`, `eng_plate_temp`, `eng_plate_temp_initial_layer`, `fan_cooling_layer_time`, `fan_direction`, `fan_max_speed`, `fan_min_speed`, `filament_adaptive_volumetric_speed`, `filament_adhesiveness_category`, `filament_change_length`, `filament_change_length_nc`, `filament_colour`, `filament_colour_type`, `filament_cooling_before_tower`, `filament_cost`, `filament_density`, `filament_deretraction_speed`, `filament_diameter`, `filament_end_gcode`, `filament_extruder_variant`, `filament_flow_ratio`, `filament_flush_temp`, `filament_flush_volumetric_speed`, `filament_ids`, `filament_is_support`, `filament_long_retractions_when_cut`, `filament_map`, `filament_map_mode`, `filament_max_volumetric_speed`, `filament_minimal_purge_on_wipe_tower`, `filament_multi_colour`, `filament_notes`, `filament_nozzle_map`, `filament_pre_cooling_temperature`, `filament_pre_cooling_temperature_nc`, `filament_prime_volume`, `filament_prime_volume_nc`, `filament_printable`, `filament_ramming_travel_time`, `filament_ramming_travel_time_nc`, `filament_ramming_volumetric_speed`, `filament_ramming_volumetric_speed_nc`, `filament_retract_before_wipe`, `filament_retract_length_nc`, `filament_retract_restart_extra`, `filament_retract_when_changing_layer`, `filament_retraction_distances_when_cut`, `filament_retraction_length`, `filament_retraction_minimum_travel`, `filament_retraction_speed`, `filament_scarf_gap`, `filament_scarf_height`, `filament_scarf_length`, `filament_scarf_seam_type`, `filament_self_index`, `filament_settings_id`, `filament_shrink`, `filament_soluble`, `filament_start_gcode`, `filament_type`, `filament_velocity_adaptation_factor`, `filament_vendor`, `filament_volume_map`, `filament_wipe`, `filament_wipe_distance`, `filament_z_hop`, `filament_z_hop_types`, `full_fan_speed_layer`, `hot_plate_temp`, `hot_plate_temp_initial_layer`, `long_retractions_when_cut`, `nozzle_temperature`, `nozzle_temperature_initial_layer`, `nozzle_temperature_range_high`, `nozzle_temperature_range_low`, `overhang_fan_speed`, `overhang_fan_threshold`, `pressure_advance`, `reduce_fan_stop_start_freq`, `required_nozzle_HRC`, `retraction_distances_when_cut`, `slow_down_for_layer_cooling`, `slow_down_layer_time`, `slow_down_min_speed`, `supertack_plate_temp`, `supertack_plate_temp_initial_layer`, `temperature_vitrification`, `textured_plate_temp`, `textured_plate_temp_initial_layer`
</details>

<details>
<summary><b>PrinterSettings —— 全部 97 键</b></summary>

`auxiliary_fan`, `bed_custom_model`, `bed_custom_texture`, `bed_exclude_area`, `bed_temperature_formula`, `before_layer_change_gcode`, `best_object_pos`, `change_filament_gcode`, `curr_bed_type`, `default_print_profile`, `deretraction_speed`, `extruder_ams_count`, `extruder_clearance_dist_to_rod`, `extruder_clearance_height_to_lid`, `extruder_clearance_height_to_rod`, `extruder_clearance_max_radius`, `extruder_clearance_radius`, `extruder_colour`, `extruder_max_nozzle_count`, `extruder_nozzle_stats`, `extruder_offset`, `extruder_printable_area`, `extruder_printable_height`, `extruder_type`, `extruder_variant_list`, `gcode_flavor`, `head_wrap_detect_zone`, `host_type`, `layer_change_gcode`, `machine_end_gcode`, `machine_hotend_change_time`, `machine_load_filament_time`, `machine_max_acceleration_e`, `machine_max_acceleration_extruding`, `machine_max_acceleration_retracting`, `machine_max_acceleration_travel`, `machine_max_acceleration_x`, `machine_max_acceleration_y`, `machine_max_acceleration_z`, `machine_max_jerk_e`, `machine_max_jerk_x`, `machine_max_jerk_y`, `machine_max_jerk_z`, `machine_max_speed_e`, `machine_max_speed_x`, `machine_max_speed_y`, `machine_max_speed_z`, `machine_min_extruding_rate`, `machine_min_travel_rate`, `machine_pause_gcode`, `machine_prepare_compensation_time`, `machine_start_gcode`, `machine_switch_extruder_time`, `machine_unload_filament_time`, `nozzle_diameter`, `nozzle_flush_dataset`, `nozzle_height`, `nozzle_type`, `nozzle_volume`, `nozzle_volume_type`, `print_compatible_printers`, `printable_area`, `printable_height`, `printer_extruder_id`, `printer_extruder_variant`, `printer_model`, `printer_notes`, `printer_settings_id`, `printer_structure`, `printer_technology`, `printer_variant`, `printhost_authorization_type`, `printhost_ssl_ignore_revoke`, `retract_before_wipe`, `retract_length_toolchange`, `retract_lift_above`, `retract_lift_below`, `retract_restart_extra`, `retract_restart_extra_toolchange`, `retract_when_changing_layer`, `scan_first_layer`, `silent_mode`, `single_extruder_multi_material`, `standby_temperature_delta`, `start_end_points`, `support_air_filtration`, `support_chamber_temp_control`, `template_custom_gcode`, `thumbnail_size`, `time_lapse_gcode`, `upward_compatible_machine`, `use_firmware_retraction`, `use_relative_e_distances`, `wipe`, `wipe_distance`, `z_hop`, `z_hop_types`
</details>

---

## 绘制编码

每个被绘制的 `<triangle>` 携带一个十六进制字符串，与 BambuStudio 的 `TriangleSelector::serialize`
对**整个（未细分）三角面**的编码一致：一个 nibble = `(split_sides=00) | (state<<2)`；状态 0–2 直接放下，
状态 ≥ 3 用转义标记 `0b11`（`c`），后跟 `state-3` 的若干 nibble（`f` = +15，继续）。

| state | 含义（颜色） | 编码 |
|---|---|---|
| 0 | 未绘制（底色料槽） | *（不写属性）* |
| 1 | 料槽 1 | `4` |
| 2 | 料槽 2 | `8` |
| 3 | 料槽 3 | `c0` |
| 4 | 料槽 4 | `c1` |
| 18 | 料槽 18 | `cf0` |

`encodePaintFacet(state)` 暴露此编码；`paint.color[tri] = slot`（1-based）。`paint.supports` 中
`1` = 强制、`2` = 禁止。用 `{ raw }` 可绕过编码器。

---

## 测试

`src/__tests__/` 下 7 个套件、88 个用例，用 Jest + ts-jest 跑：

| 套件 | 覆盖 |
|---|---|
| `pack3mf.test.ts` | **回归快照**（relief + 多色输出逐字节稳定）与端到端功能断言 |
| `core.test.ts` | `pack3mfFromConfig` 纯路径 —— 包结构、processSettings 合并与优先级、料表缩放、metadata 覆盖、缩略图、assembled / parts |
| `mesh.test.ts` | Y-up→Z-up 映射、按 solid 焊接、退化面跳过、绘制属性、`encodePaintFacet`（含多 nibble 状态与 raw 逃逸） |
| `params.test.ts` | `serializeSettings`、`validateSettings`、`KNOWN_KEYS` |
| `layout.test.ts` | `linearOf`（缩放/镜像/旋转）、`instanceTransformString`、逐盘摆放与居中 |
| `model.test.ts` | `buildModelXml` / `buildModelSettingsXml` / `buildAssembled`（plate 与 object 模式） |
| `extras.test.ts` | 自定义 gcode、slice 信息、层高区间、缩略图 rels |

```bash
npm test               # 全部套件
npm test -- --watch    # watch 模式
```

快照套件是安全网：任何改动若改变默认输出都会立刻失败，确保现有导出不回归。

---

## 构建 / 发布

```bash
npm install            # 依赖（three 是 peer 依赖）
npm run build          # tsc → dist/（JS + .d.ts）
npm test               # jest
npm publish
```

`dist/` 与 `node_modules/` 已 gitignore。

---

## 状态与注意事项

- **已被测试验证**：默认的 relief/laser/color 输出逐字节不变（快照）；绘制编码、subtype、实例、变换、
  层高区间、按对象/part 覆盖、逐盘 metadata、slice 信息均有端到端断言。
- **仅整面绘制** —— 部分面/细分绘制尚未输出。
- 绘制、`layer_config_ranges.xml`、逐盘 metadata 的格式基于 BambuStudio 源码；**请在 BambuStudio
  实际打开一份样件**按你的版本确认。
- `layerRanges` 在简单（内联）路径上输出；若与 `assembleAsOne` 组合，需自行映射 object id。

---

## 许可

MIT © vivapercuore。与 Bambulab / BambuStudio 无关联。
