/**
 * bambu-3mf — generate BambuStudio-compatible `.3mf` packages from Three.js
 * geometry, in the browser or Node.
 *
 * Public entry point. The app may also import directly from `./build3mf`
 * (kept for backward compatibility); new code / external consumers should
 * import from here.
 */

// Core builders ----------------------------------------------------------------------
export { pack3mf, pack3mfFromConfig } from './build3mf';
export type { TemplateConfig, BambuTemplate, Object3mf, Pack3mfOptions } from './build3mf';

// Typed parameter catalog (process / filament / printer settings + enums) -------------
export * from './params';

// Geometry placement, parts, painting, layer ranges ----------------------------------
export * from './types';
export {
  geometryToMesh,
  encodePaintFacet,
} from './mesh';
export type { MeshXml, TrianglePaint, PaintInput } from './mesh';

// Per-plate config, custom gcode, slice info, layer-range / thumbnail writers ---------
export {
  buildCustomGcode,
  buildSliceInfo,
  buildLayerConfigRanges,
  buildRootRelsWithThumbs,
} from './extras';
export type {
  PauseLayer,
  PlateGcode,
  PlateConfig,
  SliceInfoFilament,
  SliceInfoInput,
  ObjectLayerRanges,
} from './extras';

// Static OPC parts -------------------------------------------------------------------
export { CONTENT_TYPES, ROOT_RELS, SLICE_INFO, today } from './templates';
export type { BambuProjectMeta } from './templates';

// Optional browser-only thumbnail helpers (Image/canvas) -----------------------------
export { makeThumbnail, makeThumbnails } from './thumbnail';
