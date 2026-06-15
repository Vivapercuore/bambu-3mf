# bambu-3mf

**English** | [简体中文](./README.md)

Generate **BambuStudio-compatible `.3mf` packages** from [Three.js](https://threejs.org/)
geometry — in the browser or in Node.

It carries the full **process / filament / printer parameter catalog** (typed, with
an open index signature so *any* BambuStudio key works), and the format-level
functions BambuStudio understands: multi-color, modifiers & supports, per-triangle
painting (MMU), variable layer height, multiple plates, instances, custom gcode
(暂停层), thumbnails, and richer slice info.

> Mesh in (Three.js Y-up) → a ready-to-slice `.3mf` out. Pure, synchronous core;
> no DOM required.

**Contents:** [Highlights](#highlights) · [Install](#install) · [Quick start](#quick-start) ·
[Geometry](#geometry-convention) · [API](#api) · [Guides](#guides) ·
[Supported functions](#supported-functions) · [Parameter catalog](#process-parameter-catalog) ·
[Painting encoding](#painting-encoding) · [Testing](#testing) · [Building](#building--publishing) ·
[Status](#status--caveats)

---

## Highlights

- **Typed parameter catalog** — `ProcessSettings` / `FilamentSettings` / `PrinterSettings`
  (508 keys grounded in real Bambu exports) with autocomplete, enum literal types
  for common enumerated keys, and an index signature so unknown/future keys still pass.
- **Multi-color** — assemble parts into one registered object, palette/料表 resizing.
- **Per-triangle painting** — `paint_color` (MMU), `paint_supports`, `paint_seam`,
  `paint_fuzzy_skin` with the exact `TriangleSelector` whole-triangle encoding.
- **Modifiers & supports** — `normal` / `negative` / `modifier` / `support_enforcer` /
  `support_blocker` parts, with per-object & per-part setting overrides.
- **Placement** — rotate / scale / mirror + multiple instances (copies).
- **Variable layer height** — `layer_config_ranges.xml`.
- **Multi-plate** — per-plate name / bed type / custom gcode, plus richer
  `slice_info.config`.
- **Zero-dependency-on-your-app core** — `pack3mfFromConfig` is synchronous and
  framework-free; `pack3mf` is a thin browser convenience that `fetch`es templates.

---

## Install

```bash
npm i bambu-3mf three fflate
```

`three` is a **peer dependency** (you bring your own). `fflate` (zip) is a dependency.

---

## Quick start

### Node / any environment (pure core)

```ts
import * as THREE from 'three';
import { pack3mfFromConfig } from 'bambu-3mf';
import { readFileSync, writeFileSync } from 'fs';

const geometry = new THREE.BoxGeometry(40, 8, 40);
geometry.translate(0, 4, 0); // Y-up, base at y=0

const zip = pack3mfFromConfig(
  { projectSettings: readFileSync('project_settings.config', 'utf8') },
  [{ name: 'plate', geometry }],
  { title: 'demo', designer: 'me' },
  { processSettings: { layer_height: 0.2, sparse_infill_density: '15%' } }
);

writeFileSync('demo.3mf', zip);
```

### Browser (fetch a template from `public/bambu/<template>/`)

```ts
import { pack3mf } from 'bambu-3mf';

const zip = await pack3mf(
  'relief/default',
  [{ name: 'photo-relief', geometry }],
  { title: 'photo' }
);
// → Uint8Array; save it with your file-download helper of choice.
```

`pack3mf(template, …)` loads `project_settings.config` (required), `metadata.xml`
and `filament_settings_1.config` (optional) from `${publicBase}/bambu/${template}/`,
then calls `pack3mfFromConfig`.

---

## Geometry convention

Input geometry is **Three.js Y-up**: height on `+Y`, lying on the XZ plane, base at
`y = 0`. It is rotated into 3MF's **Z-up millimetre** frame internally. An
`Object3mf.geometry` may be a single `BufferGeometry` or an array — each array entry
is welded as an **independent solid** (touching parts stay manifold; bodies never fuse).

---

## API

### `pack3mfFromConfig(config, objects, meta?, options?) => Uint8Array`
Pure synchronous core. `config: TemplateConfig` = `{ projectSettings, metadataXml?, filamentSettings? }`.

### `pack3mf(template, objects, meta?, options?) => Promise<Uint8Array>`
Browser convenience; fetches the template files then delegates to the core.

### `Object3mf`

| field | type | meaning |
|---|---|---|
| `name` | `string` | object/part name in the slicer tree |
| `geometry` | `BufferGeometry \| BufferGeometry[]` | Y-up mesh (ignored if `parts` set) |
| `plate?` | `number` | 1-based plate (default 1) |
| `extruder?` | `number` | 1-based filament slot (default 1) |
| `transform?` | `ObjectTransform` | rotate / scale / mirror |
| `instances?` | `InstanceTransform[]` | copies (extra build items) |
| `settings?` | `ProcessSettings` | per-object setting overrides |
| `subtype?` | `PartSubtype` | whole-object role (modifier / support / …) |
| `paint?` | `TrianglePaint` | per-triangle painting on this mesh |
| `parts?` | `Part3mf[]` | multi-part object (component/child structure) |
| `layerRanges?` | `LayerRange[]` | variable layer height per Z band |

### `Pack3mfOptions`

| field | type | meaning |
|---|---|---|
| `bedSize?` | `{x,y}` | bed mm for centring (default 256) |
| `gap?` | `number` | auto-arrange gap mm (default 5) |
| `processSettings?` | `ProcessSettings` | typed overrides → `project_settings.config` |
| `projectSettingsOverrides?` | `Record<string, unknown>` | untyped overrides (**highest priority**) |
| `markModified?` | `string[]` | mark keys as modified-vs-system |
| `metadataOverrides?` | `Record<string,string\|null>` | patch `metadata.xml` 项目信息 |
| `assembleAsOne?` | `boolean` | combine each plate's objects into one registered object |
| `filaments?` | `string[]` | palette `#RRGGBB`; resizes every per-filament array & 料表 |
| `pauses?` | `PauseLayer[]` | plate-1 custom gcode (暂停层) |
| `plates?` | `PlateConfig[]` | per-plate name / bed type / custom gcode |
| `sliceInfo?` | `SliceInfoInput` | richer `slice_info.config` (filaments, weights) |
| `thumbnails?` | `{middle, small?}` | PNG bytes → `plate_1.png` / `plate_1_small.png` |
| `publicBase?` | `string` | sub-path prefix for `pack3mf` fetches |

---

## Guides

### Typed process / filament / printer parameters

```ts
import { ProcessSettings } from 'bambu-3mf';

const process: ProcessSettings = {
  layer_height: 0.12,             // number → "0.12"
  spiral_mode: true,              // boolean → "1"
  wall_loops: 3,
  sparse_infill_density: '25%',
  sparse_infill_pattern: 'gyroid',// enum literal autocomplete
  seam_position: 'aligned',
  brim_type: 'outer_only',
  any_future_bambu_key: 'value',  // index signature → still written
};
```

`processSettings` is merged into `project_settings.config` and its keys are
auto-registered in `different_settings_to_system`. The untyped
`projectSettingsOverrides` is also merged and **wins** over `processSettings`.
`validateSettings(s)` warns (non-fatally) on keys not in `KNOWN_KEYS`.

### Multi-color (registered assembly)

```ts
await pack3mf('color-positive', parts, { title }, {
  assembleAsOne: true,                       // one object, parts never drift
  filaments: ['#E79D8E', '#323031', '#BEBFC1', '#FDFEFE', '#000000'],
});
```

### Per-triangle painting (MMU / supports / seam / fuzzy)

```ts
{
  name: 'painted', geometry,
  paint: {
    color:    (tri) => faceColor[tri],   // 0 = base, 1..N = filament slot
    supports: (tri) => (isOverhang(tri) ? 1 : 0), // 1 enforce, 2 block
    seam:     (tri) => (wantSeam(tri) ? 1 : 0),
  },
}
```

`PaintInput` may be an array, a `(srcTri) => state` callback, or `{ raw: (srcTri) => string }`
to supply an exact Bambu-encoded value. Faces are indexed by **source order**.
See [Painting encoding](#painting-encoding).

### Modifiers / supports / multi-part objects

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

A whole object can also be a modifier via `subtype` (no `parts` needed).

### Placement: transform & instances

```ts
{ name: 'a', geometry, transform: { rotation: { z: 45 }, scale: 1.5 } }
{ name: 'b', geometry, instances: [{}, { translate: { x: 40 } }, { translate: { x: 80 } }] }
```

### Variable layer height

```ts
{ name: 'relief', geometry, layerRanges: [
  { minZ: 0,   maxZ: 1.5, settings: { layer_height: 0.2 } },
  { minZ: 1.5, maxZ: 8,   settings: { layer_height: 0.08 } },
]}
```

### Per-plate settings & custom gcode

```ts
{
  plates: [
    { index: 1, name: 'first', bedType: 'Textured PEI Plate',
      pauses: [{ atZ: 5.2, gcode: 'M400 U1' }] },
  ],
}
```

### Slice info & thumbnails

```ts
{
  sliceInfo: { filaments: [{ id: 1, type: 'PLA', color: '#000000', usedG: 12.3, usedM: 4.1 }] },
  thumbnails: await makeThumbnails(previewDataUrl), // browser helper
}
```

---

## Supported functions

| Capability | API | Output |
|---|---|---|
| Single-object export | `pack3mf` / `pack3mfFromConfig` | `3dmodel.model` (inline mesh) |
| Multiple objects / a laser plate | `objects[]` | one `<object>` + build item each |
| Multiple plates | `Object3mf.plate` | tiled bed cells, one `<plate>` each |
| Full process / filament / printer params | `processSettings` + `projectSettingsOverrides` | `project_settings.config` |
| Mark modified-vs-system | auto + `markModified` | `different_settings_to_system` |
| Project info (项目信息) | `meta` + `metadataOverrides` | `metadata.xml` block |
| Multi-color registered assembly | `assembleAsOne` | component + child `.model` |
| Filament palette / 料表 resize | `filaments` | per-filament arrays + flush matrix |
| Object transform (rotate/scale/mirror) | `transform` | build-item matrix |
| Instances (copies) | `instances` | extra build items + `model_instance` |
| Per-object setting overrides | `Object3mf.settings` | `model_settings.config` `<metadata>` |
| Multi-part objects | `parts` | parent `<components>` + child meshes |
| Modifier / negative / support parts | `subtype` | `<part subtype="…">` |
| Per-part setting overrides | `Part3mf.settings` | `<part>` `<metadata>` |
| Per-triangle color (MMU) | `paint.color` | `paint_color` on `<triangle>` |
| Per-triangle support enforce/block | `paint.supports` | `paint_supports` |
| Per-triangle seam | `paint.seam` | `paint_seam` |
| Per-triangle fuzzy skin | `paint.fuzzy` | `paint_fuzzy_skin` |
| Variable layer height | `layerRanges` | `layer_config_ranges.xml` |
| Per-plate name / bed type / spiral / sequence | `plates` | `model_settings.config` `<plate>` |
| Custom gcode / 暂停层 (per plate) | `pauses` / `plates[].pauses` | `custom_gcode_per_layer.xml` |
| Wipe tower placement | `processSettings.wipe_tower_x/y/...` | `project_settings.config` |
| Filament summary / weights | `sliceInfo` | `slice_info.config` |
| Project thumbnails | `thumbnails` (+ `makeThumbnails`) | `plate_1.png` + OPC rels |

---

## Process parameter catalog

Three typed interfaces, **508 keys total**, derived from real Bambu exports. Common
enumerated keys have literal-union types; every interface has an index signature, so
**any additional BambuStudio key is accepted** (serialized via `serializeSettings`).

| Interface | Keys | Covers |
|---|---|---|
| `ProcessSettings` | 310 | quality, walls, infill, speed, support, seam, ironing, prime tower, raft, brim, compensation, bridging |
| `FilamentSettings` | 101 | temperatures, cooling/fans, retraction, flow, change-flush, pressure advance |
| `PrinterSettings` | 97 | machine model, printable area, nozzle, machine limits, gcode hooks, host, change times |

### Enum literal types

| Key(s) | Type | Values |
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
<summary><b>ProcessSettings — all 310 keys</b></summary>

`accel_to_decel_enable`, `accel_to_decel_factor`, `apply_scarf_seam_on_circles`, `apply_top_surface_compensation`, `auto_disable_filter_on_overheat`, `avoid_crossing_wall_includes_support`, `bottom_color_penetration_layers`, `bottom_shell_layers`, `bottom_shell_thickness`, `bottom_surface_pattern`, `bridge_angle`, `bridge_flow`, `bridge_no_support`, `bridge_speed`, `brim_object_gap`, `brim_type`, `brim_width`, `circle_compensation_manual_offset`, `circle_compensation_speed`, `compatible_printers_condition`, `cooling_filter_enabled`, `counter_coef_1`, `counter_coef_2`, `counter_coef_3`, `counter_limit_max`, `counter_limit_min`, `default_acceleration`, `default_jerk`, `default_nozzle_volume_type`, `detect_floating_vertical_shell`, `detect_narrow_internal_solid_infill`, `detect_overhang_wall`, `detect_thin_wall`, `diameter_limit`, `different_settings_to_system`, `draft_shield`, `elefant_foot_compensation`, `embedding_wall_into_infill`, `enable_arc_fitting`, `enable_circle_compensation`, `enable_height_slowdown`, `enable_overhang_speed`, `enable_pre_heating`, `enable_prime_tower`, `enable_support`, `enable_wrapping_detection`, `enforce_support_layers`, `ensure_vertical_shell_thickness`, `exclude_object`, `filename_format`, `fill_multiline`, `filter_out_gap_fill`, `first_layer_print_sequence`, `first_x_layer_fan_speed`, `flush_into_infill`, `flush_into_objects`, `flush_into_support`, `flush_multiplier`, `flush_volumes_matrix`, `flush_volumes_vector`, `from`, `fuzzy_skin`, `fuzzy_skin_point_distance`, `fuzzy_skin_thickness`, `gap_infill_speed`, `gcode_add_line_number`, `grab_length`, `group_algo_with_time`, `has_scarf_joint_seam`, `hole_coef_1`, `hole_coef_2`, `hole_coef_3`, `hole_limit_max`, `hole_limit_min`, `hotend_cooling_rate`, `hotend_heating_rate`, `impact_strength_z`, `independent_support_layer_height`, `infill_combination`, `infill_direction`, `infill_instead_top_bottom_surfaces`, `infill_jerk`, `infill_lock_depth`, `infill_rotate_step`, `infill_shift_step`, `infill_wall_overlap`, `inherits`, `inherits_group`, `initial_layer_acceleration`, `initial_layer_flow_ratio`, `initial_layer_infill_speed`, `initial_layer_jerk`, `initial_layer_line_width`, `initial_layer_print_height`, `initial_layer_speed`, `initial_layer_travel_acceleration`, `inner_wall_acceleration`, `inner_wall_jerk`, `inner_wall_line_width`, `inner_wall_speed`, `interface_shells`, `interlocking_beam`, `interlocking_beam_layer_count`, `interlocking_beam_width`, `interlocking_boundary_avoidance`, `interlocking_depth`, `interlocking_orientation`, `internal_bridge_support_thickness`, `internal_solid_infill_line_width`, `internal_solid_infill_pattern`, `internal_solid_infill_speed`, `ironing_direction`, `ironing_flow`, `ironing_inset`, `ironing_pattern`, `ironing_spacing`, `ironing_speed`, `ironing_type`, `is_infill_first`, `layer_height`, `line_width`, `locked_skeleton_infill_pattern`, `locked_skin_infill_pattern`, `long_retractions_when_ec`, `master_extruder_id`, `max_bridge_length`, `max_layer_height`, `max_travel_detour_distance`, `min_bead_width`, `min_feature_size`, `min_layer_height`, `minimum_sparse_infill_area`, `mmu_segmented_region_interlocking_depth`, `mmu_segmented_region_max_width`, `name`, `no_slow_down_for_cooling_on_outwalls`, `only_one_wall_first_layer`, `ooze_prevention`, `other_layers_print_sequence`, `other_layers_print_sequence_nums`, `outer_wall_acceleration`, `outer_wall_jerk`, `outer_wall_line_width`, `outer_wall_speed`, `overhang_1_4_speed`, `overhang_2_4_speed`, `overhang_3_4_speed`, `overhang_4_4_speed`, `overhang_threshold_participating_cooling`, `overhang_totally_speed`, `override_filament_scarf_seam_setting`, `physical_extruder_map`, `post_process`, `pre_start_fan_time`, `precise_outer_wall`, `precise_z_height`, `prime_tower_brim_width`, `prime_tower_enable_framework`, `prime_tower_extra_rib_length`, `prime_tower_fillet_wall`, `prime_tower_flat_ironing`, `prime_tower_infill_gap`, `prime_tower_lift_height`, `prime_tower_lift_speed`, `prime_tower_max_speed`, `prime_tower_rib_wall`, `prime_tower_rib_width`, `prime_tower_skip_points`, `prime_tower_width`, `prime_volume`, `prime_volume_mode`, `print_extruder_id`, `print_extruder_variant`, `print_flow_ratio`, `print_sequence`, `print_settings_id`, `printing_by_object_gcode`, `process_notes`, `raft_contact_distance`, `raft_expansion`, `raft_first_layer_density`, `raft_first_layer_expansion`, `raft_layers`, `reduce_crossing_wall`, `reduce_infill_retraction`, `resolution`, `retraction_distances_when_ec`, `retraction_length`, `retraction_minimum_travel`, `retraction_speed`, `role_base_wipe_speed`, `scarf_angle_threshold`, `seam_gap`, `seam_placement_away_from_overhangs`, `seam_position`, `seam_slope_conditional`, `seam_slope_entire_loop`, `seam_slope_gap`, `seam_slope_inner_walls`, `seam_slope_min_length`, `seam_slope_start_height`, `seam_slope_steps`, `seam_slope_type`, `skeleton_infill_density`, `skeleton_infill_line_width`, `skin_infill_density`, `skin_infill_depth`, `skin_infill_line_width`, `skirt_distance`, `skirt_height`, `skirt_loops`, `slice_closing_radius`, `slicing_mode`, `slowdown_end_acc`, `slowdown_end_height`, `slowdown_end_speed`, `slowdown_start_acc`, `slowdown_start_height`, `slowdown_start_speed`, `small_perimeter_speed`, `small_perimeter_threshold`, `smooth_coefficient`, `smooth_speed_discontinuity_area`, `solid_infill_filament`, `sparse_infill_acceleration`, `sparse_infill_anchor`, `sparse_infill_anchor_max`, `sparse_infill_density`, `sparse_infill_filament`, `sparse_infill_line_width`, `sparse_infill_pattern`, `sparse_infill_speed`, `spiral_mode`, `spiral_mode_max_xy_smoothing`, `spiral_mode_smooth`, `support_angle`, `support_base_pattern`, `support_base_pattern_spacing`, `support_bottom_interface_spacing`, `support_bottom_z_distance`, `support_cooling_filter`, `support_critical_regions_only`, `support_expansion`, `support_filament`, `support_interface_bottom_layers`, `support_interface_filament`, `support_interface_loop_pattern`, `support_interface_not_for_body`, `support_interface_pattern`, `support_interface_spacing`, `support_interface_speed`, `support_interface_top_layers`, `support_line_width`, `support_object_first_layer_gap`, `support_object_skip_flush`, `support_object_xy_distance`, `support_on_build_plate_only`, `support_remove_small_overhang`, `support_speed`, `support_style`, `support_threshold_angle`, `support_top_z_distance`, `support_type`, `symmetric_infill_y_axis`, `thick_bridges`, `timelapse_type`, `top_area_threshold`, `top_color_penetration_layers`, `top_one_wall_type`, `top_shell_layers`, `top_shell_thickness`, `top_solid_infill_flow_ratio`, `top_surface_acceleration`, `top_surface_jerk`, `top_surface_line_width`, `top_surface_pattern`, `top_surface_speed`, `top_z_overrides_xy_distance`, `travel_acceleration`, `travel_jerk`, `travel_speed`, `travel_speed_z`, `tree_support_branch_angle`, `tree_support_branch_diameter`, `tree_support_branch_diameter_angle`, `tree_support_branch_distance`, `tree_support_brim_width`, `tree_support_wall_count`, `version`, `vertical_shell_speed`, `volumetric_speed_coefficients`, `wall_distribution_count`, `wall_filament`, `wall_generator`, `wall_loops`, `wall_sequence`, `wall_transition_angle`, `wall_transition_filter_deviation`, `wall_transition_length`, `wipe_speed`, `wipe_tower_no_sparse_layers`, `wipe_tower_rotation_angle`, `wipe_tower_x`, `wipe_tower_y`, `wrapping_detection_gcode`, `wrapping_detection_layers`, `wrapping_exclude_area`, `xy_contour_compensation`, `xy_hole_compensation`, `z_direction_outwall_speed_continuous`
</details>

<details>
<summary><b>FilamentSettings — all 101 keys</b></summary>

`activate_air_filtration`, `additional_cooling_fan_speed`, `chamber_temperatures`, `close_fan_the_first_x_layers`, `complete_print_exhaust_fan_speed`, `cool_plate_temp`, `cool_plate_temp_initial_layer`, `default_filament_colour`, `default_filament_profile`, `during_print_exhaust_fan_speed`, `enable_long_retraction_when_cut`, `enable_overhang_bridge_fan`, `enable_pressure_advance`, `eng_plate_temp`, `eng_plate_temp_initial_layer`, `fan_cooling_layer_time`, `fan_direction`, `fan_max_speed`, `fan_min_speed`, `filament_adaptive_volumetric_speed`, `filament_adhesiveness_category`, `filament_change_length`, `filament_change_length_nc`, `filament_colour`, `filament_colour_type`, `filament_cooling_before_tower`, `filament_cost`, `filament_density`, `filament_deretraction_speed`, `filament_diameter`, `filament_end_gcode`, `filament_extruder_variant`, `filament_flow_ratio`, `filament_flush_temp`, `filament_flush_volumetric_speed`, `filament_ids`, `filament_is_support`, `filament_long_retractions_when_cut`, `filament_map`, `filament_map_mode`, `filament_max_volumetric_speed`, `filament_minimal_purge_on_wipe_tower`, `filament_multi_colour`, `filament_notes`, `filament_nozzle_map`, `filament_pre_cooling_temperature`, `filament_pre_cooling_temperature_nc`, `filament_prime_volume`, `filament_prime_volume_nc`, `filament_printable`, `filament_ramming_travel_time`, `filament_ramming_travel_time_nc`, `filament_ramming_volumetric_speed`, `filament_ramming_volumetric_speed_nc`, `filament_retract_before_wipe`, `filament_retract_length_nc`, `filament_retract_restart_extra`, `filament_retract_when_changing_layer`, `filament_retraction_distances_when_cut`, `filament_retraction_length`, `filament_retraction_minimum_travel`, `filament_retraction_speed`, `filament_scarf_gap`, `filament_scarf_height`, `filament_scarf_length`, `filament_scarf_seam_type`, `filament_self_index`, `filament_settings_id`, `filament_shrink`, `filament_soluble`, `filament_start_gcode`, `filament_type`, `filament_velocity_adaptation_factor`, `filament_vendor`, `filament_volume_map`, `filament_wipe`, `filament_wipe_distance`, `filament_z_hop`, `filament_z_hop_types`, `full_fan_speed_layer`, `hot_plate_temp`, `hot_plate_temp_initial_layer`, `long_retractions_when_cut`, `nozzle_temperature`, `nozzle_temperature_initial_layer`, `nozzle_temperature_range_high`, `nozzle_temperature_range_low`, `overhang_fan_speed`, `overhang_fan_threshold`, `pressure_advance`, `reduce_fan_stop_start_freq`, `required_nozzle_HRC`, `retraction_distances_when_cut`, `slow_down_for_layer_cooling`, `slow_down_layer_time`, `slow_down_min_speed`, `supertack_plate_temp`, `supertack_plate_temp_initial_layer`, `temperature_vitrification`, `textured_plate_temp`, `textured_plate_temp_initial_layer`
</details>

<details>
<summary><b>PrinterSettings — all 97 keys</b></summary>

`auxiliary_fan`, `bed_custom_model`, `bed_custom_texture`, `bed_exclude_area`, `bed_temperature_formula`, `before_layer_change_gcode`, `best_object_pos`, `change_filament_gcode`, `curr_bed_type`, `default_print_profile`, `deretraction_speed`, `extruder_ams_count`, `extruder_clearance_dist_to_rod`, `extruder_clearance_height_to_lid`, `extruder_clearance_height_to_rod`, `extruder_clearance_max_radius`, `extruder_clearance_radius`, `extruder_colour`, `extruder_max_nozzle_count`, `extruder_nozzle_stats`, `extruder_offset`, `extruder_printable_area`, `extruder_printable_height`, `extruder_type`, `extruder_variant_list`, `gcode_flavor`, `head_wrap_detect_zone`, `host_type`, `layer_change_gcode`, `machine_end_gcode`, `machine_hotend_change_time`, `machine_load_filament_time`, `machine_max_acceleration_e`, `machine_max_acceleration_extruding`, `machine_max_acceleration_retracting`, `machine_max_acceleration_travel`, `machine_max_acceleration_x`, `machine_max_acceleration_y`, `machine_max_acceleration_z`, `machine_max_jerk_e`, `machine_max_jerk_x`, `machine_max_jerk_y`, `machine_max_jerk_z`, `machine_max_speed_e`, `machine_max_speed_x`, `machine_max_speed_y`, `machine_max_speed_z`, `machine_min_extruding_rate`, `machine_min_travel_rate`, `machine_pause_gcode`, `machine_prepare_compensation_time`, `machine_start_gcode`, `machine_switch_extruder_time`, `machine_unload_filament_time`, `nozzle_diameter`, `nozzle_flush_dataset`, `nozzle_height`, `nozzle_type`, `nozzle_volume`, `nozzle_volume_type`, `print_compatible_printers`, `printable_area`, `printable_height`, `printer_extruder_id`, `printer_extruder_variant`, `printer_model`, `printer_notes`, `printer_settings_id`, `printer_structure`, `printer_technology`, `printer_variant`, `printhost_authorization_type`, `printhost_ssl_ignore_revoke`, `retract_before_wipe`, `retract_length_toolchange`, `retract_lift_above`, `retract_lift_below`, `retract_restart_extra`, `retract_restart_extra_toolchange`, `retract_when_changing_layer`, `scan_first_layer`, `silent_mode`, `single_extruder_multi_material`, `standby_temperature_delta`, `start_end_points`, `support_air_filtration`, `support_chamber_temp_control`, `template_custom_gcode`, `thumbnail_size`, `time_lapse_gcode`, `upward_compatible_machine`, `use_firmware_retraction`, `use_relative_e_distances`, `wipe`, `wipe_distance`, `z_hop`, `z_hop_types`
</details>

---

## Painting encoding

Each painted `<triangle>` carries a hex string matching BambuStudio's
`TriangleSelector::serialize` for a **whole (non-subdivided) triangle**: one nibble
`(split_sides=00) | (state<<2)`; states 0–2 fit directly, state ≥ 3 uses the escape
marker `0b11` (`c`) followed by `state-3` as nibbles (`f` = +15, continue).

| state | meaning (color) | encoded |
|---|---|---|
| 0 | unpainted (base extruder) | *(attribute omitted)* |
| 1 | filament slot 1 | `4` |
| 2 | filament slot 2 | `8` |
| 3 | filament slot 3 | `c0` |
| 4 | filament slot 4 | `c1` |
| 18 | filament slot 18 | `cf0` |

`encodePaintFacet(state)` exposes this; `paint.color[tri] = slot` (1-based). For
`paint.supports`, `1` = enforcer, `2` = blocker. Use `{ raw }` to bypass the encoder.

---

## Testing

88 tests across 7 suites (`src/__tests__/`), run with Jest + ts-jest:

| Suite | Covers |
|---|---|
| `pack3mf.test.ts` | **regression snapshots** (relief + multi-color output is byte-for-byte stable) and end-to-end feature assertions |
| `core.test.ts` | `pack3mfFromConfig` pure path — package parts, processSettings merge & priority, filament resize, metadata overrides, thumbnails, assembled / parts |
| `mesh.test.ts` | Y-up→Z-up mapping, per-solid welding, degenerate skip, paint attributes, `encodePaintFacet` (incl. multi-nibble states & raw escape) |
| `params.test.ts` | `serializeSettings`, `validateSettings`, `KNOWN_KEYS` |
| `layout.test.ts` | `linearOf` (scale/mirror/rotation), `instanceTransformString`, per-plate placement & centring |
| `model.test.ts` | `buildModelXml` / `buildModelSettingsXml` / `buildAssembled` (plate & object modes) |
| `extras.test.ts` | custom gcode, slice info, layer-config ranges, thumbnail rels |

```bash
npm test               # all suites
npm test -- --watch    # watch mode
```

The snapshot suite is the safety net: any change that alters the default output
fails loudly, guaranteeing existing exports never regress.

---

## Building / publishing

```bash
npm install            # deps (three is a peer dependency)
npm run build          # tsc → dist/ (JS + .d.ts)
npm test               # jest
npm publish
```

`dist/` and `node_modules/` are gitignored.

---

## Status & caveats

- **Verified by tests**: default relief/laser/color output is byte-for-byte unchanged
  (snapshots); paint encoding, subtypes, instances, transforms, layer ranges,
  per-object/part overrides, per-plate metadata and slice info are asserted end-to-end.
- **Whole-triangle painting only** — partial/subdivided painting is not emitted yet.
- The painting, `layer_config_ranges.xml`, and per-plate metadata formats are grounded
  in BambuStudio source; **open a sample in BambuStudio to confirm** for your version.
- `layerRanges` are emitted on the simple (inline) path; map object ids if combining
  with `assembleAsOne`.

---

## License

MIT © vivapercuore. Not affiliated with Bamblab / BambuStudio.
