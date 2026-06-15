/**
 * BambuStudio 参数目录（typed catalog）—— bambu-3mf 的“整理/管理”主交付物。
 *
 * 键集来源：真实 Bambu 导出（process / filament / printer 合并去重，共 508 键），
 * 名称与 Bambu 当前版本一致；常见枚举键给出字面量联合类型，常用键带中文标签。每个接口都带索引
 * 签名 —— **已知键有类型与补全、未知或未来新增键也能照常写入**，从而真正“支持一切参数调整”。
 *
 * 用法：把 {@link ProcessSettings}/{@link FilamentSettings}/{@link PrinterSettings} 传给 pack3mf 的
 * `processSettings` 选项；序列化由 {@link serializeSettings} 完成（number→字符串、boolean→"0"/"1"、
 * 数组保持 string[]）。无类型的 `projectSettingsOverrides` 仍并存且优先级最高。
 *
 * 注意：键集最初由 public/bambu/ 下的真实配置自动汇总生成，之后按需手工维护（增删键、补充标签/枚举）。
 */

/** Bambu 把所有值都存成字符串或字符串数组；输入侧允许更自然的 JS 类型，由 serializeSettings 归一。 */
export type ConfigScalar = string | number | boolean;
export type ConfigValue = ConfigScalar | ConfigScalar[];
/** 布尔语义键：Bambu 存 "0"/"1"，这里也接受 boolean / 0 / 1。 */
export type BoolLike = boolean | 0 | 1 | '0' | '1';
/** 数值键：接受 number 或其字符串形式。 */
export type NumLike = number | string;
/** 百分比键：接受 "85%" 这类字符串或裸 number。 */
export type PctLike = string | number;
/** 数组键（per-filament / 矩阵 / 区域等）。 */
export type ConfigArray = (string | number | boolean)[];

// ---- 枚举字面量类型（常见可选值；仍可写其它字符串，由索引签名兜底）----
export type WallGenerator = "classic" | "arachne";
export type WallSequence = "inner wall/outer wall" | "outer wall/inner wall" | "inner-outer-inner wall";
export type SeamPosition = "nearest" | "aligned" | "back" | "random";
export type SeamSlopeType = "none" | "external" | "all";
export type SurfacePattern = "concentric" | "zig-zag" | "monotonic" | "monotonicline" | "alignedrectilinear" | "hilbertcurve" | "archimedeanchords" | "octagramspiral";
export type SparseInfillPattern = "concentric" | "zig-zag" | "grid" | "line" | "cubic" | "triangles" | "tri-hexagon" | "gyroid" | "honeycomb" | "adaptivecubic" | "alignedrectilinear" | "lightning" | "3dhoneycomb" | "crosshatch" | "supportcubic" | "zigzag";
export type BrimType = "auto_brim" | "brim_ears" | "outer_only" | "inner_only" | "outer_and_inner" | "no_brim";
export type SupportType = "normal(auto)" | "tree(auto)" | "normal(manual)" | "tree(manual)";
export type SupportStyle = "default" | "grid" | "snug" | "tree_slim" | "tree_strong" | "tree_hybrid" | "organic";
export type SupportBasePattern = "default" | "rectilinear" | "rectilinear-grid" | "honeycomb" | "lightning" | "hollow";
export type SupportInterfacePattern = "auto" | "rectilinear" | "concentric" | "rectilinear_interlaced" | "grid";
export type IroningType = "no ironing" | "top" | "topmost" | "solid";
export type IroningPattern = "concentric" | "zig-zag";
export type FuzzySkin = "none" | "external" | "all" | "allwalls";
export type DraftShield = "disabled" | "limited" | "enabled";
export type PrintSequence = "by layer" | "by object";
export type SlicingMode = "regular" | "even_odd" | "close_holes";
export type TopOneWallType = "all top" | "none" | "topmost";
export type GcodeFlavor = "marlin" | "klipper" | "reprapfirmware" | "reprap" | "smoothie" | "repetier" | "machinekit" | "no-extrusion";
export type BedType = "Cool Plate" | "Engineering Plate" | "High Temp Plate" | "Textured PEI Plate" | "Textured Cool Plate" | "Supertack Plate";
export type PrinterStructure = "corexy" | "i3" | "hbot" | "delta" | "kossel";

/**
 * 工艺 / 打印参数（质量、墙、填充、速度、支撑、接缝、熨烫、擦料塔、补偿、薄壁、桥接等）。
 *
 * 已知键有类型与补全；索引签名允许任意未知/未来键透传 —— 真正“支持一切参数”。
 */
export interface ProcessSettings {
  /** 任意未列出的 BambuStudio 键照样可写（值会被 {@link serializeSettings} 规范化）。 */
  [key: string]: ConfigValue | undefined;
  accel_to_decel_enable?: BoolLike;
  accel_to_decel_factor?: PctLike;
  apply_scarf_seam_on_circles?: BoolLike;
  apply_top_surface_compensation?: BoolLike;
  auto_disable_filter_on_overheat?: BoolLike;
  avoid_crossing_wall_includes_support?: BoolLike;
  bottom_color_penetration_layers?: NumLike;
  /** 底部壳层数 */
  bottom_shell_layers?: NumLike;
  bottom_shell_thickness?: BoolLike;
  bottom_surface_pattern?: SurfacePattern;
  bridge_angle?: BoolLike;
  bridge_flow?: BoolLike;
  bridge_no_support?: BoolLike;
  bridge_speed?: NumLike | ConfigArray;
  brim_object_gap?: NumLike;
  /** Brim 类型 */
  brim_type?: BrimType;
  /** Brim 宽度 (mm) */
  brim_width?: NumLike;
  circle_compensation_manual_offset?: BoolLike;
  circle_compensation_speed?: ConfigArray;
  compatible_printers_condition?: string;
  cooling_filter_enabled?: BoolLike;
  counter_coef_1?: ConfigArray;
  counter_coef_2?: ConfigArray;
  counter_coef_3?: ConfigArray;
  counter_limit_max?: ConfigArray;
  counter_limit_min?: ConfigArray;
  default_acceleration?: NumLike | ConfigArray;
  default_jerk?: BoolLike;
  default_nozzle_volume_type?: ConfigArray;
  detect_floating_vertical_shell?: BoolLike;
  detect_narrow_internal_solid_infill?: BoolLike;
  detect_overhang_wall?: BoolLike;
  detect_thin_wall?: BoolLike;
  diameter_limit?: ConfigArray;
  different_settings_to_system?: ConfigArray;
  draft_shield?: DraftShield;
  /** 象脚补偿 (mm) */
  elefant_foot_compensation?: NumLike;
  embedding_wall_into_infill?: BoolLike;
  enable_arc_fitting?: BoolLike;
  enable_circle_compensation?: BoolLike;
  enable_height_slowdown?: ConfigArray;
  enable_overhang_speed?: BoolLike | ConfigArray;
  enable_pre_heating?: BoolLike;
  /** 启用擦料塔 */
  enable_prime_tower?: BoolLike;
  /** 启用支撑 */
  enable_support?: BoolLike;
  enable_wrapping_detection?: BoolLike;
  enforce_support_layers?: BoolLike;
  ensure_vertical_shell_thickness?: BoolLike | string;
  exclude_object?: BoolLike;
  filename_format?: string;
  fill_multiline?: BoolLike;
  filter_out_gap_fill?: BoolLike;
  first_layer_print_sequence?: ConfigArray;
  first_x_layer_fan_speed?: ConfigArray;
  flush_into_infill?: BoolLike;
  flush_into_objects?: BoolLike;
  flush_into_support?: BoolLike;
  flush_multiplier?: BoolLike | ConfigArray;
  /** 换色冲刷量矩阵 (mm³) */
  flush_volumes_matrix?: ConfigArray;
  /** 换色冲刷量向量 (mm³) */
  flush_volumes_vector?: ConfigArray;
  from?: string;
  /** 模糊皮肤 */
  fuzzy_skin?: FuzzySkin;
  fuzzy_skin_point_distance?: NumLike;
  fuzzy_skin_thickness?: NumLike;
  gap_infill_speed?: NumLike | ConfigArray;
  gcode_add_line_number?: BoolLike;
  grab_length?: ConfigArray;
  group_algo_with_time?: BoolLike;
  has_scarf_joint_seam?: BoolLike;
  hole_coef_1?: ConfigArray;
  hole_coef_2?: ConfigArray;
  hole_coef_3?: ConfigArray;
  hole_limit_max?: ConfigArray;
  hole_limit_min?: ConfigArray;
  hotend_cooling_rate?: ConfigArray;
  hotend_heating_rate?: ConfigArray;
  impact_strength_z?: ConfigArray;
  independent_support_layer_height?: BoolLike;
  infill_combination?: BoolLike;
  /** 填充方向 (°) */
  infill_direction?: NumLike;
  infill_instead_top_bottom_surfaces?: BoolLike;
  infill_jerk?: NumLike;
  infill_lock_depth?: BoolLike;
  infill_rotate_step?: BoolLike;
  infill_shift_step?: NumLike;
  infill_wall_overlap?: PctLike;
  inherits?: string;
  inherits_group?: ConfigArray;
  initial_layer_acceleration?: NumLike | ConfigArray;
  initial_layer_flow_ratio?: BoolLike;
  initial_layer_infill_speed?: NumLike | ConfigArray;
  initial_layer_jerk?: NumLike;
  initial_layer_line_width?: NumLike;
  /** 首层层高 (mm) */
  initial_layer_print_height?: NumLike;
  initial_layer_speed?: NumLike | ConfigArray;
  initial_layer_travel_acceleration?: ConfigArray;
  inner_wall_acceleration?: BoolLike | ConfigArray;
  inner_wall_jerk?: NumLike;
  inner_wall_line_width?: NumLike;
  /** 内墙速度 (mm/s) */
  inner_wall_speed?: NumLike | ConfigArray;
  interface_shells?: BoolLike;
  interlocking_beam?: BoolLike;
  interlocking_beam_layer_count?: NumLike;
  interlocking_beam_width?: NumLike;
  interlocking_boundary_avoidance?: NumLike;
  interlocking_depth?: NumLike;
  interlocking_orientation?: NumLike;
  internal_bridge_support_thickness?: NumLike;
  internal_solid_infill_line_width?: NumLike;
  internal_solid_infill_pattern?: SurfacePattern;
  internal_solid_infill_speed?: NumLike | ConfigArray;
  ironing_direction?: NumLike;
  ironing_flow?: PctLike;
  ironing_inset?: NumLike;
  ironing_pattern?: IroningPattern;
  ironing_spacing?: NumLike;
  ironing_speed?: NumLike;
  /** 熨烫类型 */
  ironing_type?: IroningType;
  is_infill_first?: BoolLike;
  /** 层高 (mm) */
  layer_height?: NumLike;
  /** 默认线宽 (mm) */
  line_width?: NumLike;
  locked_skeleton_infill_pattern?: string;
  locked_skin_infill_pattern?: string;
  long_retractions_when_ec?: ConfigArray;
  master_extruder_id?: BoolLike;
  max_bridge_length?: BoolLike | NumLike;
  max_layer_height?: ConfigArray;
  max_travel_detour_distance?: BoolLike;
  min_bead_width?: PctLike;
  min_feature_size?: PctLike;
  min_layer_height?: ConfigArray;
  minimum_sparse_infill_area?: NumLike;
  mmu_segmented_region_interlocking_depth?: BoolLike;
  mmu_segmented_region_max_width?: BoolLike;
  name?: string;
  no_slow_down_for_cooling_on_outwalls?: ConfigArray;
  only_one_wall_first_layer?: BoolLike;
  ooze_prevention?: BoolLike;
  other_layers_print_sequence?: ConfigArray;
  other_layers_print_sequence_nums?: BoolLike;
  outer_wall_acceleration?: NumLike | ConfigArray;
  outer_wall_jerk?: NumLike;
  outer_wall_line_width?: NumLike;
  /** 外墙速度 (mm/s) */
  outer_wall_speed?: NumLike | ConfigArray;
  overhang_1_4_speed?: NumLike | BoolLike | ConfigArray;
  overhang_2_4_speed?: NumLike | ConfigArray;
  overhang_3_4_speed?: NumLike | ConfigArray;
  overhang_4_4_speed?: NumLike | ConfigArray;
  overhang_threshold_participating_cooling?: ConfigArray;
  overhang_totally_speed?: NumLike | ConfigArray;
  override_filament_scarf_seam_setting?: BoolLike;
  physical_extruder_map?: ConfigArray;
  post_process?: ConfigArray;
  pre_start_fan_time?: ConfigArray;
  precise_outer_wall?: BoolLike;
  precise_z_height?: BoolLike;
  prime_tower_brim_width?: NumLike;
  prime_tower_enable_framework?: BoolLike;
  prime_tower_extra_rib_length?: BoolLike;
  prime_tower_fillet_wall?: BoolLike;
  prime_tower_flat_ironing?: BoolLike;
  prime_tower_infill_gap?: PctLike;
  prime_tower_lift_height?: NumLike;
  prime_tower_lift_speed?: NumLike;
  prime_tower_max_speed?: NumLike;
  prime_tower_rib_wall?: BoolLike;
  prime_tower_rib_width?: NumLike;
  prime_tower_skip_points?: BoolLike;
  /** 擦料塔宽度 (mm) */
  prime_tower_width?: NumLike;
  prime_volume?: NumLike;
  prime_volume_mode?: string;
  print_extruder_id?: ConfigArray;
  print_extruder_variant?: ConfigArray;
  print_flow_ratio?: BoolLike;
  /** 打印顺序 */
  print_sequence?: PrintSequence;
  print_settings_id?: string;
  printing_by_object_gcode?: string;
  process_notes?: string;
  raft_contact_distance?: NumLike;
  raft_expansion?: NumLike;
  raft_first_layer_density?: PctLike;
  raft_first_layer_expansion?: NumLike;
  raft_layers?: BoolLike;
  reduce_crossing_wall?: BoolLike;
  reduce_infill_retraction?: BoolLike;
  /** 分辨率 (mm) */
  resolution?: NumLike;
  retraction_distances_when_ec?: ConfigArray;
  retraction_length?: ConfigArray;
  retraction_minimum_travel?: ConfigArray;
  retraction_speed?: ConfigArray;
  role_base_wipe_speed?: BoolLike;
  scarf_angle_threshold?: NumLike;
  seam_gap?: PctLike;
  seam_placement_away_from_overhangs?: BoolLike;
  /** 接缝位置 */
  seam_position?: SeamPosition;
  seam_slope_conditional?: BoolLike;
  seam_slope_entire_loop?: BoolLike;
  seam_slope_gap?: BoolLike;
  seam_slope_inner_walls?: BoolLike;
  seam_slope_min_length?: NumLike;
  seam_slope_start_height?: PctLike;
  seam_slope_steps?: NumLike;
  seam_slope_type?: SeamSlopeType;
  skeleton_infill_density?: PctLike;
  skeleton_infill_line_width?: NumLike;
  skin_infill_density?: PctLike;
  skin_infill_depth?: NumLike;
  skin_infill_line_width?: NumLike;
  skirt_distance?: NumLike;
  skirt_height?: BoolLike;
  skirt_loops?: BoolLike;
  slice_closing_radius?: NumLike;
  slicing_mode?: SlicingMode;
  slowdown_end_acc?: ConfigArray;
  slowdown_end_height?: ConfigArray;
  slowdown_end_speed?: ConfigArray;
  slowdown_start_acc?: ConfigArray;
  slowdown_start_height?: ConfigArray;
  slowdown_start_speed?: ConfigArray;
  small_perimeter_speed?: PctLike | ConfigArray;
  small_perimeter_threshold?: BoolLike | ConfigArray;
  smooth_coefficient?: NumLike;
  smooth_speed_discontinuity_area?: BoolLike;
  solid_infill_filament?: BoolLike;
  sparse_infill_acceleration?: PctLike | ConfigArray;
  sparse_infill_anchor?: PctLike;
  sparse_infill_anchor_max?: NumLike;
  /** 稀疏填充密度 (%) */
  sparse_infill_density?: PctLike;
  sparse_infill_filament?: BoolLike;
  sparse_infill_line_width?: NumLike;
  /** 稀疏填充图案 */
  sparse_infill_pattern?: SparseInfillPattern;
  /** 填充速度 (mm/s) */
  sparse_infill_speed?: NumLike | ConfigArray;
  /** 螺旋花瓶模式 */
  spiral_mode?: BoolLike;
  spiral_mode_max_xy_smoothing?: PctLike;
  spiral_mode_smooth?: BoolLike;
  support_angle?: BoolLike;
  support_base_pattern?: SupportBasePattern;
  support_base_pattern_spacing?: NumLike;
  support_bottom_interface_spacing?: NumLike;
  support_bottom_z_distance?: NumLike;
  support_cooling_filter?: BoolLike;
  support_critical_regions_only?: BoolLike;
  support_expansion?: BoolLike;
  support_filament?: BoolLike;
  support_interface_bottom_layers?: NumLike;
  support_interface_filament?: BoolLike;
  support_interface_loop_pattern?: BoolLike;
  support_interface_not_for_body?: BoolLike;
  support_interface_pattern?: SupportInterfacePattern;
  support_interface_spacing?: NumLike;
  support_interface_speed?: NumLike | ConfigArray;
  support_interface_top_layers?: NumLike;
  support_line_width?: NumLike;
  support_object_first_layer_gap?: NumLike;
  support_object_skip_flush?: BoolLike;
  support_object_xy_distance?: NumLike;
  support_on_build_plate_only?: BoolLike;
  support_remove_small_overhang?: BoolLike;
  support_speed?: NumLike | ConfigArray;
  /** 支撑样式 */
  support_style?: SupportStyle;
  /** 支撑临界角 (°) */
  support_threshold_angle?: NumLike;
  support_top_z_distance?: NumLike;
  /** 支撑类型 */
  support_type?: SupportType;
  symmetric_infill_y_axis?: BoolLike;
  thick_bridges?: BoolLike;
  timelapse_type?: BoolLike;
  top_area_threshold?: PctLike;
  top_color_penetration_layers?: NumLike;
  top_one_wall_type?: TopOneWallType;
  /** 顶部壳层数 */
  top_shell_layers?: BoolLike | NumLike;
  /** 顶部壳厚 (mm) */
  top_shell_thickness?: NumLike | BoolLike;
  top_solid_infill_flow_ratio?: BoolLike;
  top_surface_acceleration?: NumLike | ConfigArray;
  top_surface_jerk?: NumLike;
  top_surface_line_width?: NumLike;
  top_surface_pattern?: SurfacePattern;
  top_surface_speed?: NumLike | ConfigArray;
  top_z_overrides_xy_distance?: BoolLike;
  travel_acceleration?: ConfigArray;
  travel_jerk?: NumLike;
  /** 空驶速度 (mm/s) */
  travel_speed?: NumLike | ConfigArray;
  travel_speed_z?: BoolLike | ConfigArray;
  tree_support_branch_angle?: NumLike;
  tree_support_branch_diameter?: NumLike;
  tree_support_branch_diameter_angle?: NumLike;
  tree_support_branch_distance?: NumLike;
  tree_support_brim_width?: BoolLike;
  tree_support_wall_count?: BoolLike | NumLike;
  version?: string;
  vertical_shell_speed?: ConfigArray;
  volumetric_speed_coefficients?: ConfigArray;
  wall_distribution_count?: BoolLike;
  wall_filament?: BoolLike;
  /** 墙生成器 */
  wall_generator?: WallGenerator;
  /** 墙圈数 */
  wall_loops?: NumLike | BoolLike;
  wall_sequence?: WallSequence;
  wall_transition_angle?: NumLike;
  wall_transition_filter_deviation?: PctLike;
  wall_transition_length?: PctLike;
  wipe_speed?: PctLike;
  wipe_tower_no_sparse_layers?: BoolLike;
  wipe_tower_rotation_angle?: BoolLike;
  wipe_tower_x?: ConfigArray;
  wipe_tower_y?: ConfigArray;
  wrapping_detection_gcode?: string;
  wrapping_detection_layers?: NumLike;
  wrapping_exclude_area?: ConfigArray;
  xy_contour_compensation?: BoolLike;
  xy_hole_compensation?: BoolLike;
  z_direction_outwall_speed_continuous?: BoolLike;
}

/**
 * 耗材参数（温度、风扇 / 冷却、回抽、流量、换色冲刷、压力提前、per-filament 数组）。
 *
 * 已知键有类型与补全；索引签名允许任意未知/未来键透传 —— 真正“支持一切参数”。
 */
export interface FilamentSettings {
  /** 任意未列出的 BambuStudio 键照样可写（值会被 {@link serializeSettings} 规范化）。 */
  [key: string]: ConfigValue | undefined;
  activate_air_filtration?: ConfigArray;
  additional_cooling_fan_speed?: ConfigArray;
  chamber_temperatures?: ConfigArray;
  close_fan_the_first_x_layers?: ConfigArray;
  complete_print_exhaust_fan_speed?: ConfigArray;
  /** 低温板温度 (°C) */
  cool_plate_temp?: ConfigArray;
  cool_plate_temp_initial_layer?: ConfigArray;
  default_filament_colour?: ConfigArray;
  default_filament_profile?: ConfigArray;
  during_print_exhaust_fan_speed?: ConfigArray;
  enable_long_retraction_when_cut?: NumLike;
  enable_overhang_bridge_fan?: ConfigArray;
  enable_pressure_advance?: ConfigArray;
  eng_plate_temp?: ConfigArray;
  eng_plate_temp_initial_layer?: ConfigArray;
  fan_cooling_layer_time?: ConfigArray;
  fan_direction?: string;
  /** 最大风扇转速 (%) */
  fan_max_speed?: ConfigArray;
  /** 最小风扇转速 (%) */
  fan_min_speed?: ConfigArray;
  filament_adaptive_volumetric_speed?: ConfigArray;
  filament_adhesiveness_category?: ConfigArray;
  filament_change_length?: ConfigArray;
  filament_change_length_nc?: ConfigArray;
  /** 耗材颜色 (#RRGGBB) */
  filament_colour?: ConfigArray;
  filament_colour_type?: ConfigArray;
  filament_cooling_before_tower?: ConfigArray;
  filament_cost?: ConfigArray;
  filament_density?: ConfigArray;
  filament_deretraction_speed?: ConfigArray;
  filament_diameter?: ConfigArray;
  filament_end_gcode?: ConfigArray;
  filament_extruder_variant?: ConfigArray;
  /** 流量比 */
  filament_flow_ratio?: ConfigArray;
  filament_flush_temp?: ConfigArray;
  filament_flush_volumetric_speed?: ConfigArray;
  filament_ids?: ConfigArray;
  filament_is_support?: ConfigArray;
  filament_long_retractions_when_cut?: ConfigArray;
  filament_map?: ConfigArray;
  filament_map_mode?: string;
  /** 最大体积速度 (mm³/s) */
  filament_max_volumetric_speed?: ConfigArray;
  filament_minimal_purge_on_wipe_tower?: ConfigArray;
  filament_multi_colour?: ConfigArray;
  filament_notes?: string;
  filament_nozzle_map?: ConfigArray;
  filament_pre_cooling_temperature?: ConfigArray;
  filament_pre_cooling_temperature_nc?: ConfigArray;
  filament_prime_volume?: ConfigArray;
  filament_prime_volume_nc?: ConfigArray;
  filament_printable?: ConfigArray;
  filament_ramming_travel_time?: ConfigArray;
  filament_ramming_travel_time_nc?: ConfigArray;
  filament_ramming_volumetric_speed?: ConfigArray;
  filament_ramming_volumetric_speed_nc?: ConfigArray;
  filament_retract_before_wipe?: ConfigArray;
  filament_retract_length_nc?: ConfigArray;
  filament_retract_restart_extra?: ConfigArray;
  filament_retract_when_changing_layer?: ConfigArray;
  filament_retraction_distances_when_cut?: ConfigArray;
  filament_retraction_length?: ConfigArray;
  filament_retraction_minimum_travel?: ConfigArray;
  filament_retraction_speed?: ConfigArray;
  filament_scarf_gap?: ConfigArray;
  filament_scarf_height?: ConfigArray;
  filament_scarf_length?: ConfigArray;
  filament_scarf_seam_type?: ConfigArray;
  filament_self_index?: ConfigArray;
  filament_settings_id?: ConfigArray;
  filament_shrink?: ConfigArray;
  filament_soluble?: ConfigArray;
  filament_start_gcode?: ConfigArray;
  /** 耗材类型 */
  filament_type?: ConfigArray;
  filament_velocity_adaptation_factor?: ConfigArray;
  filament_vendor?: ConfigArray;
  filament_volume_map?: ConfigArray;
  filament_wipe?: ConfigArray;
  filament_wipe_distance?: ConfigArray;
  filament_z_hop?: ConfigArray;
  filament_z_hop_types?: ConfigArray;
  full_fan_speed_layer?: ConfigArray;
  /** 热床温度 (°C) */
  hot_plate_temp?: ConfigArray;
  hot_plate_temp_initial_layer?: ConfigArray;
  long_retractions_when_cut?: ConfigArray;
  /** 喷嘴温度 (°C) */
  nozzle_temperature?: ConfigArray;
  /** 首层喷嘴温度 (°C) */
  nozzle_temperature_initial_layer?: ConfigArray;
  nozzle_temperature_range_high?: ConfigArray;
  nozzle_temperature_range_low?: ConfigArray;
  overhang_fan_speed?: ConfigArray;
  overhang_fan_threshold?: ConfigArray;
  pressure_advance?: ConfigArray;
  reduce_fan_stop_start_freq?: ConfigArray;
  required_nozzle_HRC?: ConfigArray;
  retraction_distances_when_cut?: ConfigArray;
  slow_down_for_layer_cooling?: ConfigArray;
  slow_down_layer_time?: ConfigArray;
  slow_down_min_speed?: ConfigArray;
  supertack_plate_temp?: ConfigArray;
  supertack_plate_temp_initial_layer?: ConfigArray;
  temperature_vitrification?: ConfigArray;
  textured_plate_temp?: ConfigArray;
  textured_plate_temp_initial_layer?: ConfigArray;
}

/**
 * 打印机参数（机型、可打印区域、喷嘴、机器极限、G-code 钩子、host、换料时间等）。
 *
 * 已知键有类型与补全；索引签名允许任意未知/未来键透传 —— 真正“支持一切参数”。
 */
export interface PrinterSettings {
  /** 任意未列出的 BambuStudio 键照样可写（值会被 {@link serializeSettings} 规范化）。 */
  [key: string]: ConfigValue | undefined;
  auxiliary_fan?: BoolLike;
  bed_custom_model?: string;
  bed_custom_texture?: string;
  bed_exclude_area?: ConfigArray;
  bed_temperature_formula?: string;
  before_layer_change_gcode?: string;
  best_object_pos?: string;
  /** 换料 G-code */
  change_filament_gcode?: string;
  /** 当前热床类型 */
  curr_bed_type?: BedType;
  default_print_profile?: string;
  deretraction_speed?: ConfigArray;
  extruder_ams_count?: ConfigArray;
  extruder_clearance_dist_to_rod?: NumLike;
  extruder_clearance_height_to_lid?: NumLike;
  extruder_clearance_height_to_rod?: NumLike;
  extruder_clearance_max_radius?: NumLike;
  extruder_clearance_radius?: NumLike;
  extruder_colour?: ConfigArray;
  extruder_max_nozzle_count?: ConfigArray;
  extruder_nozzle_stats?: ConfigArray;
  extruder_offset?: ConfigArray;
  extruder_printable_area?: ConfigArray;
  extruder_printable_height?: ConfigArray;
  extruder_type?: ConfigArray;
  extruder_variant_list?: ConfigArray;
  /** G-code 风格 */
  gcode_flavor?: GcodeFlavor;
  head_wrap_detect_zone?: ConfigArray;
  host_type?: string;
  /** 层切换 G-code */
  layer_change_gcode?: string;
  /** 结束 G-code */
  machine_end_gcode?: string;
  machine_hotend_change_time?: BoolLike;
  machine_load_filament_time?: NumLike;
  machine_max_acceleration_e?: ConfigArray;
  machine_max_acceleration_extruding?: ConfigArray;
  machine_max_acceleration_retracting?: ConfigArray;
  machine_max_acceleration_travel?: ConfigArray;
  machine_max_acceleration_x?: ConfigArray;
  machine_max_acceleration_y?: ConfigArray;
  machine_max_acceleration_z?: ConfigArray;
  machine_max_jerk_e?: ConfigArray;
  machine_max_jerk_x?: ConfigArray;
  machine_max_jerk_y?: ConfigArray;
  machine_max_jerk_z?: ConfigArray;
  machine_max_speed_e?: ConfigArray;
  machine_max_speed_x?: ConfigArray;
  machine_max_speed_y?: ConfigArray;
  machine_max_speed_z?: ConfigArray;
  machine_min_extruding_rate?: ConfigArray;
  machine_min_travel_rate?: ConfigArray;
  /** 暂停 G-code */
  machine_pause_gcode?: string;
  machine_prepare_compensation_time?: NumLike;
  /** 开始 G-code */
  machine_start_gcode?: string;
  machine_switch_extruder_time?: BoolLike;
  machine_unload_filament_time?: NumLike;
  /** 喷嘴直径 (mm) */
  nozzle_diameter?: ConfigArray;
  nozzle_flush_dataset?: ConfigArray;
  nozzle_height?: NumLike;
  nozzle_type?: string | ConfigArray;
  nozzle_volume?: NumLike | ConfigArray;
  nozzle_volume_type?: ConfigArray;
  print_compatible_printers?: ConfigArray;
  /** 可打印区域 */
  printable_area?: ConfigArray;
  /** 可打印高度 (mm) */
  printable_height?: NumLike;
  printer_extruder_id?: ConfigArray;
  printer_extruder_variant?: ConfigArray;
  /** 打印机型号 */
  printer_model?: string;
  printer_notes?: string;
  printer_settings_id?: string;
  printer_structure?: PrinterStructure;
  printer_technology?: string;
  printer_variant?: NumLike;
  printhost_authorization_type?: string;
  printhost_ssl_ignore_revoke?: BoolLike;
  retract_before_wipe?: ConfigArray;
  retract_length_toolchange?: ConfigArray;
  retract_lift_above?: ConfigArray;
  retract_lift_below?: ConfigArray;
  retract_restart_extra?: ConfigArray;
  retract_restart_extra_toolchange?: ConfigArray;
  retract_when_changing_layer?: ConfigArray;
  scan_first_layer?: BoolLike;
  silent_mode?: BoolLike;
  single_extruder_multi_material?: BoolLike;
  standby_temperature_delta?: NumLike;
  start_end_points?: ConfigArray;
  support_air_filtration?: BoolLike;
  support_chamber_temp_control?: BoolLike;
  template_custom_gcode?: string;
  thumbnail_size?: ConfigArray;
  time_lapse_gcode?: string;
  upward_compatible_machine?: ConfigArray;
  use_firmware_retraction?: BoolLike;
  use_relative_e_distances?: BoolLike;
  wipe?: ConfigArray;
  wipe_distance?: ConfigArray;
  z_hop?: ConfigArray;
  z_hop_types?: ConfigArray;
}


/** 已知键全集（三类合并），供 {@link validateSettings} 判定未知键。 */
export const KNOWN_KEYS: ReadonlySet<string> = new Set([
  "accel_to_decel_enable",
  "accel_to_decel_factor",
  "activate_air_filtration",
  "additional_cooling_fan_speed",
  "apply_scarf_seam_on_circles",
  "apply_top_surface_compensation",
  "auto_disable_filter_on_overheat",
  "auxiliary_fan",
  "avoid_crossing_wall_includes_support",
  "bed_custom_model",
  "bed_custom_texture",
  "bed_exclude_area",
  "bed_temperature_formula",
  "before_layer_change_gcode",
  "best_object_pos",
  "bottom_color_penetration_layers",
  "bottom_shell_layers",
  "bottom_shell_thickness",
  "bottom_surface_pattern",
  "bridge_angle",
  "bridge_flow",
  "bridge_no_support",
  "bridge_speed",
  "brim_object_gap",
  "brim_type",
  "brim_width",
  "chamber_temperatures",
  "change_filament_gcode",
  "circle_compensation_manual_offset",
  "circle_compensation_speed",
  "close_fan_the_first_x_layers",
  "compatible_printers_condition",
  "complete_print_exhaust_fan_speed",
  "cool_plate_temp",
  "cool_plate_temp_initial_layer",
  "cooling_filter_enabled",
  "counter_coef_1",
  "counter_coef_2",
  "counter_coef_3",
  "counter_limit_max",
  "counter_limit_min",
  "curr_bed_type",
  "default_acceleration",
  "default_filament_colour",
  "default_filament_profile",
  "default_jerk",
  "default_nozzle_volume_type",
  "default_print_profile",
  "deretraction_speed",
  "detect_floating_vertical_shell",
  "detect_narrow_internal_solid_infill",
  "detect_overhang_wall",
  "detect_thin_wall",
  "diameter_limit",
  "different_settings_to_system",
  "draft_shield",
  "during_print_exhaust_fan_speed",
  "elefant_foot_compensation",
  "embedding_wall_into_infill",
  "enable_arc_fitting",
  "enable_circle_compensation",
  "enable_height_slowdown",
  "enable_long_retraction_when_cut",
  "enable_overhang_bridge_fan",
  "enable_overhang_speed",
  "enable_pre_heating",
  "enable_pressure_advance",
  "enable_prime_tower",
  "enable_support",
  "enable_wrapping_detection",
  "enforce_support_layers",
  "eng_plate_temp",
  "eng_plate_temp_initial_layer",
  "ensure_vertical_shell_thickness",
  "exclude_object",
  "extruder_ams_count",
  "extruder_clearance_dist_to_rod",
  "extruder_clearance_height_to_lid",
  "extruder_clearance_height_to_rod",
  "extruder_clearance_max_radius",
  "extruder_clearance_radius",
  "extruder_colour",
  "extruder_max_nozzle_count",
  "extruder_nozzle_stats",
  "extruder_offset",
  "extruder_printable_area",
  "extruder_printable_height",
  "extruder_type",
  "extruder_variant_list",
  "fan_cooling_layer_time",
  "fan_direction",
  "fan_max_speed",
  "fan_min_speed",
  "filament_adaptive_volumetric_speed",
  "filament_adhesiveness_category",
  "filament_change_length",
  "filament_change_length_nc",
  "filament_colour",
  "filament_colour_type",
  "filament_cooling_before_tower",
  "filament_cost",
  "filament_density",
  "filament_deretraction_speed",
  "filament_diameter",
  "filament_end_gcode",
  "filament_extruder_variant",
  "filament_flow_ratio",
  "filament_flush_temp",
  "filament_flush_volumetric_speed",
  "filament_ids",
  "filament_is_support",
  "filament_long_retractions_when_cut",
  "filament_map",
  "filament_map_mode",
  "filament_max_volumetric_speed",
  "filament_minimal_purge_on_wipe_tower",
  "filament_multi_colour",
  "filament_notes",
  "filament_nozzle_map",
  "filament_pre_cooling_temperature",
  "filament_pre_cooling_temperature_nc",
  "filament_prime_volume",
  "filament_prime_volume_nc",
  "filament_printable",
  "filament_ramming_travel_time",
  "filament_ramming_travel_time_nc",
  "filament_ramming_volumetric_speed",
  "filament_ramming_volumetric_speed_nc",
  "filament_retract_before_wipe",
  "filament_retract_length_nc",
  "filament_retract_restart_extra",
  "filament_retract_when_changing_layer",
  "filament_retraction_distances_when_cut",
  "filament_retraction_length",
  "filament_retraction_minimum_travel",
  "filament_retraction_speed",
  "filament_scarf_gap",
  "filament_scarf_height",
  "filament_scarf_length",
  "filament_scarf_seam_type",
  "filament_self_index",
  "filament_settings_id",
  "filament_shrink",
  "filament_soluble",
  "filament_start_gcode",
  "filament_type",
  "filament_velocity_adaptation_factor",
  "filament_vendor",
  "filament_volume_map",
  "filament_wipe",
  "filament_wipe_distance",
  "filament_z_hop",
  "filament_z_hop_types",
  "filename_format",
  "fill_multiline",
  "filter_out_gap_fill",
  "first_layer_print_sequence",
  "first_x_layer_fan_speed",
  "flush_into_infill",
  "flush_into_objects",
  "flush_into_support",
  "flush_multiplier",
  "flush_volumes_matrix",
  "flush_volumes_vector",
  "from",
  "full_fan_speed_layer",
  "fuzzy_skin",
  "fuzzy_skin_point_distance",
  "fuzzy_skin_thickness",
  "gap_infill_speed",
  "gcode_add_line_number",
  "gcode_flavor",
  "grab_length",
  "group_algo_with_time",
  "has_scarf_joint_seam",
  "head_wrap_detect_zone",
  "hole_coef_1",
  "hole_coef_2",
  "hole_coef_3",
  "hole_limit_max",
  "hole_limit_min",
  "host_type",
  "hot_plate_temp",
  "hot_plate_temp_initial_layer",
  "hotend_cooling_rate",
  "hotend_heating_rate",
  "impact_strength_z",
  "independent_support_layer_height",
  "infill_combination",
  "infill_direction",
  "infill_instead_top_bottom_surfaces",
  "infill_jerk",
  "infill_lock_depth",
  "infill_rotate_step",
  "infill_shift_step",
  "infill_wall_overlap",
  "inherits",
  "inherits_group",
  "initial_layer_acceleration",
  "initial_layer_flow_ratio",
  "initial_layer_infill_speed",
  "initial_layer_jerk",
  "initial_layer_line_width",
  "initial_layer_print_height",
  "initial_layer_speed",
  "initial_layer_travel_acceleration",
  "inner_wall_acceleration",
  "inner_wall_jerk",
  "inner_wall_line_width",
  "inner_wall_speed",
  "interface_shells",
  "interlocking_beam",
  "interlocking_beam_layer_count",
  "interlocking_beam_width",
  "interlocking_boundary_avoidance",
  "interlocking_depth",
  "interlocking_orientation",
  "internal_bridge_support_thickness",
  "internal_solid_infill_line_width",
  "internal_solid_infill_pattern",
  "internal_solid_infill_speed",
  "ironing_direction",
  "ironing_flow",
  "ironing_inset",
  "ironing_pattern",
  "ironing_spacing",
  "ironing_speed",
  "ironing_type",
  "is_infill_first",
  "layer_change_gcode",
  "layer_height",
  "line_width",
  "locked_skeleton_infill_pattern",
  "locked_skin_infill_pattern",
  "long_retractions_when_cut",
  "long_retractions_when_ec",
  "machine_end_gcode",
  "machine_hotend_change_time",
  "machine_load_filament_time",
  "machine_max_acceleration_e",
  "machine_max_acceleration_extruding",
  "machine_max_acceleration_retracting",
  "machine_max_acceleration_travel",
  "machine_max_acceleration_x",
  "machine_max_acceleration_y",
  "machine_max_acceleration_z",
  "machine_max_jerk_e",
  "machine_max_jerk_x",
  "machine_max_jerk_y",
  "machine_max_jerk_z",
  "machine_max_speed_e",
  "machine_max_speed_x",
  "machine_max_speed_y",
  "machine_max_speed_z",
  "machine_min_extruding_rate",
  "machine_min_travel_rate",
  "machine_pause_gcode",
  "machine_prepare_compensation_time",
  "machine_start_gcode",
  "machine_switch_extruder_time",
  "machine_unload_filament_time",
  "master_extruder_id",
  "max_bridge_length",
  "max_layer_height",
  "max_travel_detour_distance",
  "min_bead_width",
  "min_feature_size",
  "min_layer_height",
  "minimum_sparse_infill_area",
  "mmu_segmented_region_interlocking_depth",
  "mmu_segmented_region_max_width",
  "name",
  "no_slow_down_for_cooling_on_outwalls",
  "nozzle_diameter",
  "nozzle_flush_dataset",
  "nozzle_height",
  "nozzle_temperature",
  "nozzle_temperature_initial_layer",
  "nozzle_temperature_range_high",
  "nozzle_temperature_range_low",
  "nozzle_type",
  "nozzle_volume",
  "nozzle_volume_type",
  "only_one_wall_first_layer",
  "ooze_prevention",
  "other_layers_print_sequence",
  "other_layers_print_sequence_nums",
  "outer_wall_acceleration",
  "outer_wall_jerk",
  "outer_wall_line_width",
  "outer_wall_speed",
  "overhang_1_4_speed",
  "overhang_2_4_speed",
  "overhang_3_4_speed",
  "overhang_4_4_speed",
  "overhang_fan_speed",
  "overhang_fan_threshold",
  "overhang_threshold_participating_cooling",
  "overhang_totally_speed",
  "override_filament_scarf_seam_setting",
  "physical_extruder_map",
  "post_process",
  "pre_start_fan_time",
  "precise_outer_wall",
  "precise_z_height",
  "pressure_advance",
  "prime_tower_brim_width",
  "prime_tower_enable_framework",
  "prime_tower_extra_rib_length",
  "prime_tower_fillet_wall",
  "prime_tower_flat_ironing",
  "prime_tower_infill_gap",
  "prime_tower_lift_height",
  "prime_tower_lift_speed",
  "prime_tower_max_speed",
  "prime_tower_rib_wall",
  "prime_tower_rib_width",
  "prime_tower_skip_points",
  "prime_tower_width",
  "prime_volume",
  "prime_volume_mode",
  "print_compatible_printers",
  "print_extruder_id",
  "print_extruder_variant",
  "print_flow_ratio",
  "print_sequence",
  "print_settings_id",
  "printable_area",
  "printable_height",
  "printer_extruder_id",
  "printer_extruder_variant",
  "printer_model",
  "printer_notes",
  "printer_settings_id",
  "printer_structure",
  "printer_technology",
  "printer_variant",
  "printhost_authorization_type",
  "printhost_ssl_ignore_revoke",
  "printing_by_object_gcode",
  "process_notes",
  "raft_contact_distance",
  "raft_expansion",
  "raft_first_layer_density",
  "raft_first_layer_expansion",
  "raft_layers",
  "reduce_crossing_wall",
  "reduce_fan_stop_start_freq",
  "reduce_infill_retraction",
  "required_nozzle_HRC",
  "resolution",
  "retract_before_wipe",
  "retract_length_toolchange",
  "retract_lift_above",
  "retract_lift_below",
  "retract_restart_extra",
  "retract_restart_extra_toolchange",
  "retract_when_changing_layer",
  "retraction_distances_when_cut",
  "retraction_distances_when_ec",
  "retraction_length",
  "retraction_minimum_travel",
  "retraction_speed",
  "role_base_wipe_speed",
  "scan_first_layer",
  "scarf_angle_threshold",
  "seam_gap",
  "seam_placement_away_from_overhangs",
  "seam_position",
  "seam_slope_conditional",
  "seam_slope_entire_loop",
  "seam_slope_gap",
  "seam_slope_inner_walls",
  "seam_slope_min_length",
  "seam_slope_start_height",
  "seam_slope_steps",
  "seam_slope_type",
  "silent_mode",
  "single_extruder_multi_material",
  "skeleton_infill_density",
  "skeleton_infill_line_width",
  "skin_infill_density",
  "skin_infill_depth",
  "skin_infill_line_width",
  "skirt_distance",
  "skirt_height",
  "skirt_loops",
  "slice_closing_radius",
  "slicing_mode",
  "slow_down_for_layer_cooling",
  "slow_down_layer_time",
  "slow_down_min_speed",
  "slowdown_end_acc",
  "slowdown_end_height",
  "slowdown_end_speed",
  "slowdown_start_acc",
  "slowdown_start_height",
  "slowdown_start_speed",
  "small_perimeter_speed",
  "small_perimeter_threshold",
  "smooth_coefficient",
  "smooth_speed_discontinuity_area",
  "solid_infill_filament",
  "sparse_infill_acceleration",
  "sparse_infill_anchor",
  "sparse_infill_anchor_max",
  "sparse_infill_density",
  "sparse_infill_filament",
  "sparse_infill_line_width",
  "sparse_infill_pattern",
  "sparse_infill_speed",
  "spiral_mode",
  "spiral_mode_max_xy_smoothing",
  "spiral_mode_smooth",
  "standby_temperature_delta",
  "start_end_points",
  "supertack_plate_temp",
  "supertack_plate_temp_initial_layer",
  "support_air_filtration",
  "support_angle",
  "support_base_pattern",
  "support_base_pattern_spacing",
  "support_bottom_interface_spacing",
  "support_bottom_z_distance",
  "support_chamber_temp_control",
  "support_cooling_filter",
  "support_critical_regions_only",
  "support_expansion",
  "support_filament",
  "support_interface_bottom_layers",
  "support_interface_filament",
  "support_interface_loop_pattern",
  "support_interface_not_for_body",
  "support_interface_pattern",
  "support_interface_spacing",
  "support_interface_speed",
  "support_interface_top_layers",
  "support_line_width",
  "support_object_first_layer_gap",
  "support_object_skip_flush",
  "support_object_xy_distance",
  "support_on_build_plate_only",
  "support_remove_small_overhang",
  "support_speed",
  "support_style",
  "support_threshold_angle",
  "support_top_z_distance",
  "support_type",
  "symmetric_infill_y_axis",
  "temperature_vitrification",
  "template_custom_gcode",
  "textured_plate_temp",
  "textured_plate_temp_initial_layer",
  "thick_bridges",
  "thumbnail_size",
  "time_lapse_gcode",
  "timelapse_type",
  "top_area_threshold",
  "top_color_penetration_layers",
  "top_one_wall_type",
  "top_shell_layers",
  "top_shell_thickness",
  "top_solid_infill_flow_ratio",
  "top_surface_acceleration",
  "top_surface_jerk",
  "top_surface_line_width",
  "top_surface_pattern",
  "top_surface_speed",
  "top_z_overrides_xy_distance",
  "travel_acceleration",
  "travel_jerk",
  "travel_speed",
  "travel_speed_z",
  "tree_support_branch_angle",
  "tree_support_branch_diameter",
  "tree_support_branch_diameter_angle",
  "tree_support_branch_distance",
  "tree_support_brim_width",
  "tree_support_wall_count",
  "upward_compatible_machine",
  "use_firmware_retraction",
  "use_relative_e_distances",
  "version",
  "vertical_shell_speed",
  "volumetric_speed_coefficients",
  "wall_distribution_count",
  "wall_filament",
  "wall_generator",
  "wall_loops",
  "wall_sequence",
  "wall_transition_angle",
  "wall_transition_filter_deviation",
  "wall_transition_length",
  "wipe",
  "wipe_distance",
  "wipe_speed",
  "wipe_tower_no_sparse_layers",
  "wipe_tower_rotation_angle",
  "wipe_tower_x",
  "wipe_tower_y",
  "wrapping_detection_gcode",
  "wrapping_detection_layers",
  "wrapping_exclude_area",
  "xy_contour_compensation",
  "xy_hole_compensation",
  "z_direction_outwall_speed_continuous",
  "z_hop",
  "z_hop_types",
]);

/** 把一个标量规范化成 Bambu 的字符串表示。 */
function scalarToStr(v: ConfigScalar): string {
  if (typeof v === 'boolean') return v ? '1' : '0';
  return String(v);
}

/**
 * 将类型化设置规范化成 Bambu `.config` 期望的形态：标量 → string，数组 → string[]。
 * undefined 值会被跳过（方便用扩展运算 / 可选字段拼装）。
 */
export function serializeSettings(
  s: Record<string, ConfigValue | undefined>
): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [k, v] of Object.entries(s)) {
    if (v === undefined) continue;
    out[k] = Array.isArray(v) ? v.map(scalarToStr) : scalarToStr(v);
  }
  return out;
}

/**
 * 返回 `s` 中不在 {@link KNOWN_KEYS} 的键（未知 / 拼写错误 / 新版本新增）。**非致命** ——
 * 默认仅 console.warn，键仍会被写入（保持“只加不减、不阻断”）。传 warn=false 静默。
 */
export function validateSettings(
  s: Record<string, ConfigValue | undefined>,
  warn = true
): string[] {
  const unknown = Object.keys(s).filter((k) => !KNOWN_KEYS.has(k));
  if (warn && unknown.length) {
    // eslint-disable-next-line no-console
    console.warn('[bambu params] 未知参数键（仍会写入）:', unknown.join(', '));
  }
  return unknown;
}

/** 三类设置的并集类型，便于一次性传入混合键。 */
export type BambuSettings = ProcessSettings & FilamentSettings & PrinterSettings;
