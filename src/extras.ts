import { escapeXml, fmt } from './util';
import { LayerRange } from './types';
import { serializeSettings } from './params';

/** One custom-gcode insertion (暂停层) for `custom_gcode_per_layer.xml`. */
export interface PauseLayer {
  /**
   * Bambu inserts the gcode **before printing the layer whose top reaches this
   * Z** (mm) — the pause fires after the layer below finishes. To pause once
   * everything below height H is printed, pass `H + layer_height` (the top of
   * the first layer above H), not H itself.
   */
  atZ: number;
  /** G-code to inject; default Bambu pause `M400 U1`. */
  gcode?: string;
  /** Active extruder/filament at the pause (1-based). Default 1. */
  extruder?: number;
  /** Insertion type: 1 = pause/insert custom gcode (default), 2 = colour/tool change. */
  type?: number;
  /** Optional colour tag (used by colour-change entries). */
  color?: string;
}

/** Per-plate custom-gcode (暂停层 / 插入 G-code). */
export interface PlateGcode {
  /** 1-based plate id these entries belong to. */
  plate: number;
  pauses: PauseLayer[];
}

/** Per-plate overrides written into model_settings.config `<plate>` and custom gcode. */
export interface PlateConfig {
  /** 1-based plate id. */
  index: number;
  /** Plate name shown in the slicer (empty = unnamed). */
  name?: string;
  /** Heated-bed type, e.g. `"Textured PEI Plate"`, `"Cool Plate"`. */
  bedType?: string;
  /** Per-plate spiral/vase mode. */
  spiralMode?: boolean;
  /** Print sequence on this plate, e.g. `"by layer"` / `"by object"`. */
  sequence?: string;
  /** Lock the plate against auto-arrange. */
  locked?: boolean;
  /** Filament map mode, default `"Auto For Flush"`. */
  filamentMapMode?: string;
  /** Per-plate custom gcode (暂停层). */
  pauses?: PauseLayer[];
}

/** One filament's slice summary for the richer slice_info.config. */
export interface SliceInfoFilament {
  /** 1-based slot. Defaults to its array position. */
  id?: number;
  /** AMS tray info id, e.g. `"GFA00"`. */
  trayInfoIdx?: string;
  /** Material, e.g. `"PLA"`. */
  type?: string;
  /** Colour `#RRGGBB`. */
  color?: string;
  /** Used length (m) / weight (g) — shown in the project browser. */
  usedM?: number;
  usedG?: number;
}

export interface SliceInfoInput {
  /** 1-based plate index. Default 1. */
  plateIndex?: number;
  filaments?: SliceInfoFilament[];
}

/**
 * `Metadata/custom_gcode_per_layer.xml` — one `<plate>` per entry. A single
 * plate of pauses reproduces the legacy single-plate output exactly.
 */
export function buildCustomGcode(platePauses: PlateGcode[]): string {
  const sorted = [...platePauses].sort((a, b) => a.plate - b.plate);
  const plates = sorted
    .map((pp, idx) => {
      const layers = pp.pauses
        .map(
          (p) =>
            `<layer top_z="${fmt(p.atZ)}" type="${p.type ?? 1}" extruder="${p.extruder ?? 1}" color="${escapeXml(
              p.color ?? ''
            )}" extra="" gcode="${escapeXml(p.gcode ?? 'M400 U1')}"/>`
        )
        .join('\n');
      return (
        `<plate>\n<plate_info id="${idx + 1}"/>\n` +
        `${layers}\n` +
        `<mode value="MultiAsSingle"/>\n</plate>`
      );
    })
    .join('\n');
  return (
    `<?xml version="1.0" encoding="utf-8"?>\n` +
    `<custom_gcodes_per_layer>\n${plates}\n</custom_gcodes_per_layer>`
  );
}

/**
 * `Metadata/slice_info.config` enriched with per-filament summary. Header mirrors
 * the static {@link import('./templates').SLICE_INFO}.
 */
export function buildSliceInfo(input: SliceInfoInput): string {
  const filaments = (input.filaments || [])
    .map((f, i) => {
      const attrs = [
        `id="${f.id ?? i + 1}"`,
        f.trayInfoIdx ? `tray_info_idx="${escapeXml(f.trayInfoIdx)}"` : '',
        f.type ? `type="${escapeXml(f.type)}"` : '',
        f.color ? `color="${escapeXml(f.color)}"` : '',
        f.usedM != null ? `used_m="${fmt(f.usedM)}"` : '',
        f.usedG != null ? `used_g="${fmt(f.usedG)}"` : '',
      ]
        .filter(Boolean)
        .join(' ');
      return `    <filament ${attrs} />`;
    })
    .join('\n');
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<config>\n` +
    `  <header>\n` +
    `    <header_item key="X-BBL-Client-Type" value="slicer"/>\n` +
    `    <header_item key="X-BBL-Client-Version" value="02.04.00.70"/>\n` +
    `  </header>\n` +
    `  <plate>\n` +
    `    <metadata key="index" value="${input.plateIndex ?? 1}"/>\n` +
    (filaments ? `${filaments}\n` : '') +
    `  </plate>\n` +
    `</config>`
  );
}

/** One object's variable-layer-height ranges. `objectId` is the 3MF object resource id. */
export interface ObjectLayerRanges {
  objectId: number;
  ranges: LayerRange[];
}

/**
 * `Metadata/layer_config_ranges.xml` — per-object Z bands each carrying config
 * options (typically `layer_height`). Structure follows the PrusaSlicer/Orca/
 * Bambu shared reader: `<objects><object id><range min_z max_z><option opt_key>`.
 */
export function buildLayerConfigRanges(objects: ObjectLayerRanges[]): string {
  const body = objects
    .map((o) => {
      const ranges = o.ranges
        .map((r) => {
          const opts = Object.entries(serializeSettings(r.settings))
            .filter(([, v]) => !Array.isArray(v))
            .map(([k, v]) => `   <option opt_key="${escapeXml(k)}">${escapeXml(v as string)}</option>`)
            .join('\n');
          return `  <range min_z="${fmt(r.minZ)}" max_z="${fmt(r.maxZ)}">\n${opts}\n  </range>`;
        })
        .join('\n');
      return ` <object id="${o.objectId}">\n${ranges}\n </object>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<objects>\n${body}\n</objects>`;
}

/**
 * `_rels/.rels` with thumbnail relationships — mirrors Bambu Studio's own
 * output (OPC thumbnail for the OS shell + bambulab cover thumbnails).
 */
export function buildRootRelsWithThumbs(hasSmall: boolean): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n` +
    ` <Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>\n` +
    ` <Relationship Target="/Metadata/plate_1.png" Id="rel-2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/thumbnail"/>\n` +
    ` <Relationship Target="/Metadata/plate_1.png" Id="rel-4" Type="http://schemas.bambulab.com/package/2021/cover-thumbnail-middle"/>\n` +
    (hasSmall
      ? ` <Relationship Target="/Metadata/plate_1_small.png" Id="rel-5" Type="http://schemas.bambulab.com/package/2021/cover-thumbnail-small"/>\n`
      : '') +
    `</Relationships>`
  );
}

/** Fetch a template part; treats SPA index.html fallbacks as "missing". */
export async function fetchText(url: string, required: boolean): Promise<string | null> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch (e) {
    if (required) throw new Error(`无法加载模板 ${url}：${(e as Error).message}`);
    return null;
  }
  if (!res.ok) {
    if (required) throw new Error(`无法加载模板 ${url}（HTTP ${res.status}）`);
    return null;
  }
  const text = await res.text();
  // Static / SPA hosts (e.g. create-react-app) serve index.html with HTTP 200
  // for paths that don't exist. If we asked for a config/metadata file and got
  // the app's HTML page back, treat it as missing rather than injecting the
  // page's markup into the 3MF (which corrupts the XML → "no geometry").
  const head = text.slice(0, 256).trim().toLowerCase();
  if (head.startsWith('<!doctype html') || head.startsWith('<html')) {
    if (required) throw new Error(`模板 ${url} 不存在（服务器返回了应用首页 HTML）`);
    return null;
  }
  return text;
}
