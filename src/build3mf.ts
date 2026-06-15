import { zipSync, strToU8, Zippable } from 'fflate';
import { CONTENT_TYPES, ROOT_RELS, SLICE_INFO, BambuProjectMeta } from './templates';
import { geometryToMesh, GeometryInput, MeshXml, TrianglePaint, V3 } from './mesh';
import { linearOf, layout } from './layout';
import {
  buildMetadataBlock,
  applyMetadataOverrides,
  buildModelXml,
  buildModelSettingsXml,
  buildAssembled,
} from './model';
import {
  buildCustomGcode,
  buildRootRelsWithThumbs,
  buildSliceInfo,
  buildLayerConfigRanges,
  fetchText,
  PauseLayer,
  PlateConfig,
  PlateGcode,
  SliceInfoInput,
  ObjectLayerRanges,
} from './extras';
import { serializeSettings, validateSettings, ProcessSettings } from './params';
import {
  InstanceTransform,
  LayerRange,
  MeshedObject,
  MeshedPart,
  ObjectTransform,
  Part3mf,
  PartSubtype,
} from './types';

/**
 * Generate a Bambu Studio `.3mf` (OPC ZIP) from Three.js geometries, carrying
 * 项目信息 (metadata) and 工艺参数 (the per-feature `project_settings.config`).
 *
 * Geometry convention: input geometries are Three.js **Y-up** (height on +Y,
 * laid on the XZ plane, base at y=0) exactly as relief/laser produce them.
 * They are rotated into 3MF's **Z-up, millimetre** frame here, then placed on
 * the plate via each build item's translation.
 *
 * The module is split across sibling files (`mesh`/`layout`/`model`/`extras`/
 * `params`/`types`); this file orchestrates them and re-exports the public API,
 * so existing `import … from '../export/bambu/build3mf'` keeps working. All new
 * capabilities are **opt-in** optional fields — with none set, the output is the
 * same as before.
 */

/** Known template folders under public/bambu/ (any string path is accepted). */
export type BambuTemplate =
  | 'relief/precision'
  | 'relief/default'
  | 'relief/speed'
  | 'laser'
  | (string & {});

/** One model that becomes a top-level `<object>` on the plate. */
export interface Object3mf {
  /** Human-readable part/object name (shown in the slicer tree). */
  name: string;
  /**
   * World-space geometry, **Y-up** — a Three.js `BufferGeometry` or a raw
   * {@link RawMesh} (`{ position, index? }`, so STL/OBJ/any parser works without
   * three). May be an array (e.g. all parts on a laser plate); each entry is
   * welded as an independent solid (never fused across solids) so touching parts
   * stay manifold. Ignored when `parts` is set.
   */
  geometry: GeometryInput | GeometryInput[];
  /**
   * 1-based print plate this object should sit on. Objects sharing a plate are
   * auto-arranged together on one bed; different plates each get their own bed
   * (bed-local coordinates, so plates may overlap in space). Default: plate 1.
   */
  plate?: number;
  /** 1-based filament slot (color) this object prints with. Default 1. */
  extruder?: number;
  /** Rotation / scale / mirror applied via the build-item transform (mesh untouched). */
  transform?: ObjectTransform;
  /** Multiple copies of this object (extra build items). Default: one. */
  instances?: InstanceTransform[];
  /** Per-object process-setting overrides → `<metadata>` in model_settings.config. */
  settings?: ProcessSettings;
  /** Object role; a whole object can be a modifier / support / negative volume. Default normal. */
  subtype?: PartSubtype;
  /** Per-triangle painting (color / supports / seam / fuzzy) on this object's mesh. */
  paint?: TrianglePaint;
  /**
   * Multi-part object: modifier / support / negative sub-volumes that move with
   * the object. When set, `geometry`/`paint`/`subtype` on the object itself are
   * ignored and the object is emitted via the component/child-file structure.
   */
  parts?: Part3mf[];
  /** Variable layer height: per-Z config bands → layer_config_ranges.xml (simple path). */
  layerRanges?: LayerRange[];
}

export interface Pack3mfOptions {
  /** Plate (bed) size in mm for centring/auto-arrange. Default 256 (Bambu A1/X1). */
  bedSize?: { x: number; y: number };
  /** Gap between objects when auto-arranging multiple (mm). Default 5. */
  gap?: number;
  /**
   * Shallow-merge these keys into the template's `project_settings.config`
   * (values are strings, as Bambu stores them). Highest priority — wins over
   * `processSettings`. Use for custom mode to force `layer_height` etc.
   */
  projectSettingsOverrides?: Record<string, unknown>;
  /**
   * Typed process/filament/printer overrides (see {@link ProcessSettings}). Merged
   * into `project_settings.config` (serialized to Bambu's string form) **before**
   * `projectSettingsOverrides`, and auto-registered as modified-vs-system. The
   * untyped `projectSettingsOverrides` stays available and takes precedence.
   */
  processSettings?: ProcessSettings;
  /**
   * Path prefix where `public/bambu/` is served. Empty (default) means served at
   * the origin root. Set to a sub-path (e.g. `/photo2stl`) only if deployed under one.
   */
  publicBase?: string;
  /** Patch the template's `metadata.xml` (项目信息): set/append a field, or `null` to remove. */
  metadataOverrides?: Record<string, string | null>;
  /** Register these keys into `different_settings_to_system[0]` (modified vs system preset). */
  markModified?: string[];
  /**
   * Combine all objects on each plate into one assembled object (parts of a single
   * body) — mirrors a Bambu multi-color export. Use for多色正片 where colors must
   * stay registered. Default false (relief/laser stay separate).
   */
  assembleAsOne?: boolean;
  /**
   * Per-filament colours (hex like `#FF0000`), one per slot. Resizes every
   * per-filament array in `project_settings.config` to this count and sets the
   * colour arrays (so referencing slot N while the profile declares fewer
   * filaments doesn't make Bambu reset the料表 and discard the custom 工艺参数).
   */
  filaments?: string[];
  /** Emit `Metadata/custom_gcode_per_layer.xml` 暂停层 for plate 1 (legacy single-plate). */
  pauses?: PauseLayer[];
  /** Per-plate settings (name / bed type / custom gcode …) written to model_settings.config. */
  plates?: PlateConfig[];
  /** Richer `Metadata/slice_info.config` (filament colours/types/weights for the project browser). */
  sliceInfo?: SliceInfoInput;
  /** Project thumbnails (PNG bytes): `middle`→plate_1.png, `small`→plate_1_small.png. */
  thumbnails?: { middle: Uint8Array; small?: Uint8Array };
}

const DEFAULT_BED = { x: 256, y: 256 };

/**
 * Resize an F×F flush-volume matrix (row-major, mm³) to N×N. Diagonal stays 0;
 * off-diagonal reuses the template value when the modulo-mapped pair is itself
 * off-diagonal, else falls back to the template's max (a safe over-purge).
 */
function resizeFlushMatrix(v: unknown[], F: number, n: number): string[] {
  const num = v.map((x) => Number(x) || 0);
  let maxOff = 0;
  for (let i = 0; i < F; i++)
    for (let j = 0; j < F; j++)
      if (i !== j) maxOff = Math.max(maxOff, num[i * F + j]);
  const fallback = maxOff || 280;
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) out.push('0');
      else {
        const oi = i % F, oj = j % F;
        out.push(String(oi !== oj ? num[oi * F + oj] : fallback));
      }
    }
  }
  return out;
}

/**
 * Make `project_settings.config` consistent for a palette of `colours.length`
 * filaments. The template is authored for F (=4, CMYK) filaments; a 5-colour
 * palette needs every per-filament array stretched to N so Bambu doesn't reject
 * the料表. Arrays are recognised purely by length (len F → per-filament; len 2F →
 * variant pairs; len F² → flush matrix), with an explicit blocklist for length-F
 * arrays that are NOT per-filament (machine limits, bed/printable area, printers).
 */
function resizeFilaments(obj: Record<string, unknown>, colours: string[]): void {
  const n = colours.length;
  const F = Array.isArray(obj.filament_colour) ? obj.filament_colour.length : 4;
  const blocked = (k: string) =>
    k.startsWith('machine_max_') ||
    k === 'bed_exclude_area' ||
    k === 'printable_area' ||
    k === 'print_compatible_printers';

  if (n !== F) {
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (!Array.isArray(v) || blocked(k)) continue;
      const L = v.length;
      if (L === F) obj[k] = Array.from({ length: n }, (_, i) => v[i % F]);
      else if (L === 2 * F)
        obj[k] = Array.from({ length: 2 * n }, (_, i) => v[2 * (Math.floor(i / 2) % F) + (i % 2)]);
      else if (L === F * F) obj[k] = resizeFlushMatrix(v, F, n);
    }
    if (Array.isArray(obj.filament_self_index))
      obj.filament_self_index = Array.from({ length: 2 * n }, (_, i) => String(Math.floor(i / 2) + 1));
  }

  // Colours are always set from the palette (the template ships CMYK colours).
  obj.filament_colour = colours.slice();
  obj.filament_multi_colour = colours.slice();
  if (Array.isArray(obj.default_filament_colour)) obj.default_filament_colour = colours.map(() => '');
}

/** Synthetic mesh (bbox only, never emitted) for a parts-object, so layout has bounds. */
function partsBoundsMesh(parts: MeshedPart[]): MeshXml {
  const min: V3 = { x: Infinity, y: Infinity, z: Infinity };
  const max: V3 = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const p of parts) {
    const b = p.mesh.bbox;
    min.x = Math.min(min.x, b.min.x); min.y = Math.min(min.y, b.min.y); min.z = Math.min(min.z, b.min.z);
    max.x = Math.max(max.x, b.max.x); max.y = Math.max(max.y, b.max.y); max.z = Math.max(max.z, b.max.z);
  }
  return { xml: '', triangleCount: 0, bbox: { min, max } };
}

/** Turn a public Object3mf into the internal meshed form (build meshes, resolve transforms). */
function meshObject(o: Object3mf): MeshedObject {
  const plate = o.plate ?? 1;
  const extruder = o.extruder ?? 1;
  if (o.parts && o.parts.length) {
    const parts: MeshedPart[] = o.parts.map((part: Part3mf) => ({
      name: part.name,
      mesh: geometryToMesh(part.geometry, part.paint),
      subtype: part.subtype || 'normal_part',
      extruder: part.extruder ?? extruder,
      settings: part.settings,
      lin: linearOf(part.transform),
    }));
    return {
      name: o.name,
      mesh: partsBoundsMesh(parts),
      plate,
      extruder,
      lin: linearOf(o.transform),
      settings: o.settings,
      instances: o.instances,
      layerRanges: o.layerRanges,
      parts,
    };
  }
  return {
    name: o.name,
    mesh: geometryToMesh(o.geometry, o.paint),
    plate,
    extruder,
    lin: linearOf(o.transform),
    subtype: o.subtype,
    settings: o.settings,
    instances: o.instances,
    layerRanges: o.layerRanges,
  };
}

/** Pre-loaded template parts — the contents of the `public/bambu/<template>/` files. */
export interface TemplateConfig {
  /** `project_settings.config` JSON string (工艺参数). Required. */
  projectSettings: string;
  /** `metadata.xml` (项目信息) — injected verbatim. Optional. */
  metadataXml?: string;
  /** `filament_settings_1.config`. Optional. */
  filamentSettings?: string;
}

/**
 * Pure, **synchronous** core: build a `.3mf` from already-loaded template
 * strings. No `fetch` / DOM, so it runs in Node, Web Workers, or any bundler —
 * this is the function to use when publishing/embedding the library. {@link pack3mf}
 * is a thin browser convenience that fetches the template files then calls this.
 *
 * Geometry convention is Three.js **Y-up** (height +Y, base y=0), rotated into
 * 3MF Z-up here. All new capabilities are opt-in optional fields on
 * {@link Object3mf} / {@link Pack3mfOptions}.
 */
export function pack3mfFromConfig(
  config: TemplateConfig,
  objects: Object3mf[],
  meta: BambuProjectMeta = { title: 'model' },
  options: Pack3mfOptions = {}
): Uint8Array {
  if (!objects.length) throw new Error('没有可导出的几何');
  const bed = options.bedSize || DEFAULT_BED;
  const gap = options.gap ?? 5;

  const meshed = objects.map(meshObject);
  const prepared = layout(meshed, bed, gap);

  const projectSettings = config.projectSettings;
  const metadataXml = config.metadataXml;
  const filamentSettings = config.filamentSettings;

  let metaBlock = metadataXml || buildMetadataBlock(meta);
  if (options.metadataOverrides) {
    metaBlock = applyMetadataOverrides(metaBlock, options.metadataOverrides);
  }

  // Typed process settings → Bambu string form (scalars only here; arrays kept).
  const typedOverrides = options.processSettings
    ? serializeSettings(options.processSettings)
    : undefined;
  if (options.processSettings) validateSettings(options.processSettings);

  let projectSettingsText = projectSettings as string;
  if (
    options.projectSettingsOverrides ||
    options.markModified ||
    options.filaments?.length ||
    typedOverrides
  ) {
    const obj = JSON.parse(projectSettingsText);
    // Resize the料表 to the palette first, then let explicit overrides win.
    if (options.filaments?.length) {
      resizeFilaments(obj, options.filaments);
    }
    if (typedOverrides) Object.assign(obj, typedOverrides);
    if (options.projectSettingsOverrides) {
      Object.assign(obj, options.projectSettingsOverrides);
    }
    // Mark modified: explicit list ∪ all typed processSettings keys.
    const modified = new Set(options.markModified || []);
    if (typedOverrides) for (const k of Object.keys(typedOverrides)) modified.add(k);
    if (modified.size && Array.isArray(obj.different_settings_to_system)) {
      const cur = String(obj.different_settings_to_system[0] || '')
        .split(';')
        .filter(Boolean);
      modified.forEach((k) => {
        if (!cur.includes(k)) cur.push(k);
      });
      obj.different_settings_to_system[0] = cur.join(';');
    }
    projectSettingsText = JSON.stringify(obj, null, 4);
  }

  const plateConfigs: Record<number, PlateConfig> | undefined = options.plates?.length
    ? Object.fromEntries(options.plates.map((p) => [p.index, p] as [number, PlateConfig]))
    : undefined;

  const files: Zippable = {
    '[Content_Types].xml': strToU8(CONTENT_TYPES),
    '_rels/.rels': strToU8(
      options.thumbnails ? buildRootRelsWithThumbs(!!options.thumbnails.small) : ROOT_RELS
    ),
    'Metadata/project_settings.config': strToU8(projectSettingsText),
    'Metadata/slice_info.config': strToU8(
      options.sliceInfo ? buildSliceInfo(options.sliceInfo) : SLICE_INFO
    ),
  };
  if (options.thumbnails) {
    files['Metadata/plate_1.png'] = options.thumbnails.middle;
    if (options.thumbnails.small) {
      files['Metadata/plate_1_small.png'] = options.thumbnails.small;
    }
  }

  // Path selection: assembleAsOne (group per plate) > any object has parts
  // (one assembly per object) > simple inline objects.
  const anyParts = meshed.some((m) => m.parts && m.parts.length);
  if (options.assembleAsOne || anyParts) {
    const mode = options.assembleAsOne ? 'plate' : 'object';
    const { rootModel, childModel, rels, modelSettings } = buildAssembled(
      prepared,
      metaBlock,
      meta.title || '组合体',
      !!options.thumbnails,
      mode,
      plateConfigs
    );
    files['3D/3dmodel.model'] = strToU8(rootModel);
    files['3D/Objects/colorparts.model'] = strToU8(childModel);
    files['3D/_rels/3dmodel.model.rels'] = strToU8(rels);
    files['Metadata/model_settings.config'] = strToU8(modelSettings);
  } else {
    files['3D/3dmodel.model'] = strToU8(buildModelXml(prepared, metaBlock));
    files['Metadata/model_settings.config'] = strToU8(
      buildModelSettingsXml(prepared, !!options.thumbnails, plateConfigs)
    );
    // Variable layer height (simple path): object resource id = its index + 1.
    const layerRangeObjs: ObjectLayerRanges[] = prepared
      .map((p, i) => ({ objectId: i + 1, ranges: p.layerRanges }))
      .filter((o): o is ObjectLayerRanges => !!o.ranges && o.ranges.length > 0);
    if (layerRangeObjs.length) {
      files['Metadata/layer_config_ranges.xml'] = strToU8(buildLayerConfigRanges(layerRangeObjs));
    }
  }

  if (filamentSettings) {
    files['Metadata/filament_settings_1.config'] = strToU8(filamentSettings);
  }

  // Custom gcode (暂停层): legacy `pauses` → plate 1, plus any per-plate pauses.
  const platePauses: PlateGcode[] = [];
  if (options.pauses?.length) platePauses.push({ plate: 1, pauses: options.pauses });
  if (options.plates) {
    for (const pc of options.plates) {
      if (pc.pauses?.length) platePauses.push({ plate: pc.index, pauses: pc.pauses });
    }
  }
  if (platePauses.length) {
    files['Metadata/custom_gcode_per_layer.xml'] = strToU8(buildCustomGcode(platePauses));
  }

  return zipSync(files);
}

/**
 * Build a Bambu `.3mf` from a template served under `public/bambu/<template>/`
 * (browser convenience around {@link pack3mfFromConfig}).
 *
 * @param template e.g. `'relief/default'`, `'relief/precision'`, `'laser'`.
 *   The folder must contain `project_settings.config` (工艺参数). It may also
 *   contain `metadata.xml` (项目信息) and `filament_settings_1.config`; both optional.
 * @param meta Fallback 项目信息 used only when the template has no metadata.xml.
 */
export async function pack3mf(
  template: BambuTemplate,
  objects: Object3mf[],
  meta: BambuProjectMeta = { title: 'model' },
  options: Pack3mfOptions = {}
): Promise<Uint8Array> {
  if (!objects.length) throw new Error('没有可导出的几何');
  const dir = `${options.publicBase || ''}/bambu/${template}`;
  const [projectSettings, metadataXml, filamentSettings] = await Promise.all([
    fetchText(`${dir}/project_settings.config`, true),
    fetchText(`${dir}/metadata.xml`, false),
    fetchText(`${dir}/filament_settings_1.config`, false),
  ]);
  return pack3mfFromConfig(
    {
      projectSettings: projectSettings as string,
      metadataXml: metadataXml || undefined,
      filamentSettings: filamentSettings || undefined,
    },
    objects,
    meta,
    options
  );
}

// ---- public re-exports (so consumers can import everything from build3mf) ------------

export type { BambuProjectMeta } from './templates';
export type { TrianglePaint, PaintInput } from './mesh';
export { encodePaintFacet } from './mesh';
export type {
  Vec3,
  ObjectTransform,
  InstanceTransform,
  PartSubtype,
  Part3mf,
  LayerRange,
} from './types';
export type {
  PauseLayer,
  PlateConfig,
  SliceInfoInput,
  SliceInfoFilament,
  ObjectLayerRanges,
} from './extras';
export type {
  ConfigValue,
  ConfigScalar,
  ProcessSettings,
  FilamentSettings,
  PrinterSettings,
  BambuSettings,
} from './params';
export { serializeSettings, validateSettings, KNOWN_KEYS } from './params';
