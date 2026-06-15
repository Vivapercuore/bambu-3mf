import { escapeXml, fmt, uuid, IDENTITY12, IDENTITY16 } from './util';
import { instanceTransformString } from './layout';
import { BambuProjectMeta, today } from './templates';
import { serializeSettings, ProcessSettings } from './params';
import { PlateConfig } from './extras';
import { InstanceTransform, MeshedPart, PreparedObject, PartSubtype } from './types';

// ---- metadata block -----------------------------------------------------------------

export function buildMetadataBlock(meta: BambuProjectMeta): string {
  const date = today();
  const pairs: [string, string][] = [
    ['Application', meta.application || 'photo2relief'],
    ['BambuStudio:3mfVersion', '1'],
    ['CreationDate', date],
    ['ModificationDate', date],
    ['Title', meta.title],
    ['Designer', meta.designer || ''],
    ['Description', meta.description || ''],
    ['License', meta.license || ''],
    ...Object.entries(meta.extra || {}),
  ];
  return pairs
    .map(([k, v]) => ` <metadata name="${escapeXml(k)}">${escapeXml(v)}</metadata>`)
    .join('\n');
}

/**
 * Replace / remove / append `<metadata name=...>` lines in an existing block.
 * Each metadata element sits on its own line (as our templates store them),
 * so we can edit line-by-line without disturbing the verbatim Description.
 */
export function applyMetadataOverrides(
  block: string,
  overrides: Record<string, string | null>
): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of block.split('\n')) {
    const m = line.match(/<metadata name="([^"]+)">/);
    const name = m && m[1];
    if (name && name in overrides) {
      seen.add(name);
      const v = overrides[name];
      if (v !== null) out.push(` <metadata name="${name}">${escapeXml(v)}</metadata>`);
      // v === null → drop the field
    } else {
      out.push(line);
    }
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v !== null && !seen.has(k)) {
      out.push(` <metadata name="${k}">${escapeXml(v)}</metadata>`);
    }
  }
  return out.join('\n');
}

// ---- transform string helpers (identity → the exact legacy constants) ---------------

/** 12-value component/part transform (linear only, no translation). identity → IDENTITY12. */
function linTransform12(lin: number[]): string {
  if (isIdentity(lin)) return IDENTITY12;
  const m = [lin[0], lin[3], lin[6], lin[1], lin[4], lin[7], lin[2], lin[5], lin[8], 0, 0, 0];
  return m.map(fmt).join(' ');
}

/** 16-value 4×4 part matrix. identity → IDENTITY16. */
function linMatrix16(lin: number[]): string {
  if (isIdentity(lin)) return IDENTITY16;
  const m = [
    lin[0], lin[3], lin[6], 0,
    lin[1], lin[4], lin[7], 0,
    lin[2], lin[5], lin[8], 0,
    0, 0, 0, 1,
  ];
  return m.map(fmt).join(' ');
}

function isIdentity(lin: number[]): boolean {
  return (
    lin[0] === 1 && lin[1] === 0 && lin[2] === 0 &&
    lin[3] === 0 && lin[4] === 1 && lin[5] === 0 &&
    lin[6] === 0 && lin[7] === 0 && lin[8] === 1
  );
}

/** `<metadata key="k" value="v"/>` lines for per-object/part setting overrides (empty if none). */
function settingsLines(settings: ProcessSettings | undefined, indent: string): string {
  if (!settings) return '';
  const ser = serializeSettings(settings);
  const lines: string[] = [];
  for (const [k, v] of Object.entries(ser)) {
    if (Array.isArray(v)) continue; // per-object overrides are scalar in model_settings
    lines.push(`${indent}<metadata key="${escapeXml(k)}" value="${escapeXml(v)}"/>`);
  }
  return lines.length ? lines.join('\n') + '\n' : '';
}

function meshStat(faceCount: number): string {
  return `<mesh_stat face_count="${faceCount}" edges_fixed="0" degenerate_facets="0" facets_removed="0" facets_reversed="0" backwards_edges="0"/>`;
}

/** plater_name value for a plate (cfg.name wins, else the given fallback). */
function plateName(cfg: PlateConfig | undefined, fallback: string): string {
  return cfg && cfg.name != null ? cfg.name : fallback;
}

/** Extra per-plate `<metadata>` lines (bed type / spiral / sequence). Empty if none. */
function plateExtraLines(cfg: PlateConfig | undefined, indent: string): string {
  if (!cfg) return '';
  const lines: string[] = [];
  if (cfg.bedType) lines.push(`${indent}<metadata key="bed_type" value="${escapeXml(cfg.bedType)}"/>`);
  if (cfg.spiralMode != null)
    lines.push(`${indent}<metadata key="spiral_mode" value="${cfg.spiralMode ? '1' : '0'}"/>`);
  if (cfg.sequence) lines.push(`${indent}<metadata key="print_sequence" value="${escapeXml(cfg.sequence)}"/>`);
  return lines.length ? lines.join('\n') + '\n' : '';
}

// ---- simple (inline-mesh) package: relief / laser / calibration ----------------------

const MODEL_OPEN =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<model unit="millimeter" xml:lang="en-US" ` +
  `xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" ` +
  `xmlns:BambuStudio="http://schemas.bambulab.com/package/2021">\n`;

/** Effective instances for an object — at least one (the implicit base copy). */
function instancesOf(p: PreparedObject): (InstanceTransform | undefined)[] {
  return p.instances && p.instances.length ? p.instances : [undefined];
}

/**
 * `3D/3dmodel.model` for the simple path (one inline `<object>` per input, one
 * `<item>` per instance). With no transform / single instance this is exactly
 * the legacy output.
 */
export function buildModelXml(prepared: PreparedObject[], metaBlock: string): string {
  const objects = prepared
    .map((p, i) => `  <object id="${i + 1}" type="model">\n${p.mesh.xml}\n  </object>`)
    .join('\n');
  const items = prepared
    .flatMap((p, i) =>
      instancesOf(p).map(
        (inst) =>
          `  <item objectid="${i + 1}" transform="${instanceTransformString(
            p.lin,
            p.tx,
            p.ty,
            p.tz,
            inst
          )}" printable="1"/>`
      )
    )
    .join('\n');

  return (
    MODEL_OPEN +
    `${metaBlock}\n` +
    ` <resources>\n${objects}\n </resources>\n` +
    ` <build>\n${items}\n </build>\n` +
    `</model>`
  );
}

/** model_settings.config for the simple path. */
export function buildModelSettingsXml(
  prepared: PreparedObject[],
  withThumbnail = false,
  plateConfigs?: Record<number, PlateConfig>
): string {
  const objs = prepared
    .map((p, i) => {
      const subtype = p.subtype || 'normal_part';
      return (
        `  <object id="${i + 1}">\n` +
        `    <metadata key="name" value="${escapeXml(p.name)}"/>\n` +
        `    <metadata key="extruder" value="${p.extruder}"/>\n` +
        settingsLines(p.settings, '    ') +
        `    <part id="1" subtype="${subtype}">\n` +
        `      <metadata key="name" value="${escapeXml(p.name)}"/>\n` +
        `      <metadata key="matrix" value="${IDENTITY16}"/>\n` +
        `      <metadata key="extruder" value="${p.extruder}"/>\n` +
        `      ${meshStat(p.mesh.triangleCount)}\n` +
        `    </part>\n` +
        `  </object>`
      );
    })
    .join('\n');

  // model_instance / assemble_item carry a global running instance counter
  // (matches the legacy convention: one instance per object → 0,1,2…).
  const instSeq: number[] = [];
  let seq = 0;
  prepared.forEach((p) => {
    instSeq.push(seq);
    seq += instancesOf(p).length;
  });

  const plateIds = Array.from(new Set(prepared.map((p) => p.plate))).sort((a, b) => a - b);
  const plates = plateIds
    .map((plateId, pIdx) => {
      const instances = prepared
        .map((p, i) => ({ p, i }))
        .filter(({ p }) => p.plate === plateId)
        .flatMap(({ p, i }) =>
          instancesOf(p).map(
            (_inst, k) =>
              `    <model_instance>\n` +
              `      <metadata key="object_id" value="${i + 1}"/>\n` +
              `      <metadata key="instance_id" value="${instSeq[i] + k}"/>\n` +
              `    </model_instance>`
          )
        )
        .join('\n');
      const cfg = plateConfigs && plateConfigs[plateId];
      return (
        `  <plate>\n` +
        `    <metadata key="plater_id" value="${pIdx + 1}"/>\n` +
        `    <metadata key="plater_name" value="${escapeXml(plateName(cfg, `plate-${pIdx + 1}`))}"/>\n` +
        `    <metadata key="locked" value="${cfg && cfg.locked != null ? String(cfg.locked) : 'false'}"/>\n` +
        `    <metadata key="filament_map_mode" value="${escapeXml(cfg?.filamentMapMode || 'Auto For Flush')}"/>\n` +
        plateExtraLines(cfg, '    ') +
        (withThumbnail && pIdx === 0
          ? `    <metadata key="thumbnail_file" value="Metadata/plate_1.png"/>\n`
          : '') +
        `${instances}\n` +
        `  </plate>`
      );
    })
    .join('\n');

  const assembles = prepared
    .flatMap((p, i) =>
      instancesOf(p).map(
        (_inst, k) =>
          `   <assemble_item object_id="${i + 1}" instance_id="${instSeq[i] + k}" transform="${IDENTITY12}" offset="0 0 0" />`
      )
    )
    .join('\n');

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<config>\n${objs}\n` +
    `${plates}\n` +
    `  <assemble>\n${assembles}\n  </assemble>\n` +
    `</config>`
  );
}

// ---- assembled / component package: assembleAsOne and multi-part objects -------------

export interface AssembledFiles {
  rootModel: string;
  childModel: string;
  rels: string;
  modelSettings: string;
}

interface Member {
  childId: number;
  name: string;
  subtype: PartSubtype;
  extruder: number;
  settings?: ProcessSettings;
  lin: number[];
  meshXml: string;
  faceCount: number;
}
interface Asm {
  assemblyId: number;
  name: string;
  plate: number;
  tx: number;
  ty: number;
  tz: number;
  members: Member[];
}

/**
 * Build the component/child-file package. Two grouping modes (both preserve the
 * legacy `assembleAsOne` output byte-for-byte when no new per-part fields are set):
 *
 * - `'plate'`  (assembleAsOne): every object on a plate is one assembly's part.
 * - `'object'` (parts mode): each object is its own assembly whose members are
 *   its `parts` (or itself, if it has none) — lets parts-objects and plain
 *   objects coexist, each placed by a single transform.
 */
export function buildAssembled(
  prepared: PreparedObject[],
  metaBlock: string,
  assemblyName: string,
  withThumbnail: boolean,
  mode: 'plate' | 'object',
  plateConfigs?: Record<number, PlateConfig>
): AssembledFiles {
  const CHILD_PATH = '/3D/Objects/colorparts.model';

  const childObjs: string[] = [];
  const asms: Asm[] = [];
  let childId = 0;

  const pushMemberFromPart = (part: MeshedPart): Member => {
    childId++;
    childObjs.push(
      `  <object id="${childId}" p:UUID="${uuid()}" type="model">\n${part.mesh.xml}\n  </object>`
    );
    return {
      childId,
      name: part.name,
      subtype: part.subtype,
      extruder: part.extruder,
      settings: part.settings,
      lin: part.lin,
      meshXml: part.mesh.xml,
      faceCount: part.mesh.triangleCount,
    };
  };
  const pushMemberFromObject = (p: PreparedObject): Member => {
    childId++;
    childObjs.push(
      `  <object id="${childId}" p:UUID="${uuid()}" type="model">\n${p.mesh.xml}\n  </object>`
    );
    return {
      childId,
      name: p.name,
      subtype: p.subtype || 'normal_part',
      extruder: p.extruder,
      settings: p.settings,
      lin: p.lin,
      meshXml: p.mesh.xml,
      faceCount: p.mesh.triangleCount,
    };
  };

  if (mode === 'plate') {
    const byPlate = new Map<number, PreparedObject[]>();
    for (const p of prepared) {
      const list = byPlate.get(p.plate);
      if (list) list.push(p);
      else byPlate.set(p.plate, [p]);
    }
    for (const plateId of Array.from(byPlate.keys()).sort((a, b) => a - b)) {
      const parts = byPlate.get(plateId)!;
      const members = parts.map(pushMemberFromObject);
      asms.push({
        assemblyId: 0,
        name: assemblyName,
        plate: plateId,
        tx: parts[0].tx,
        ty: parts[0].ty,
        tz: parts[0].tz,
        members,
      });
    }
  } else {
    for (const p of prepared) {
      const members =
        p.parts && p.parts.length ? p.parts.map(pushMemberFromPart) : [pushMemberFromObject(p)];
      asms.push({
        assemblyId: 0,
        name: p.name,
        plate: p.plate,
        tx: p.tx,
        ty: p.ty,
        tz: p.tz,
        members,
      });
    }
  }
  let assemblyId = childId;
  for (const a of asms) a.assemblyId = ++assemblyId;

  const rootObjects = asms
    .map((a) => {
      const comps = a.members
        .map(
          (m) =>
            `    <component p:path="${CHILD_PATH}" objectid="${m.childId}" p:UUID="${uuid()}" transform="${linTransform12(
              m.lin
            )}"/>`
        )
        .join('\n');
      return `  <object id="${a.assemblyId}" p:UUID="${uuid()}" type="model">\n   <components>\n${comps}\n   </components>\n  </object>`;
    })
    .join('\n');

  const buildItems = asms
    .map(
      (a) =>
        `  <item objectid="${a.assemblyId}" p:UUID="${uuid()}" transform="1 0 0 0 1 0 0 0 1 ${fmt(
          a.tx
        )} ${fmt(a.ty)} ${fmt(a.tz)}" printable="1"/>`
    )
    .join('\n');

  const rootModel =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<model unit="millimeter" xml:lang="en-US" ` +
    `xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" ` +
    `xmlns:BambuStudio="http://schemas.bambulab.com/package/2021" ` +
    `xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06" ` +
    `requiredextensions="p">\n` +
    `${metaBlock}\n` +
    ` <resources>\n${rootObjects}\n </resources>\n` +
    ` <build p:UUID="${uuid()}">\n${buildItems}\n </build>\n` +
    `</model>`;

  const childModel =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<model unit="millimeter" xml:lang="en-US" ` +
    `xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" ` +
    `xmlns:BambuStudio="http://schemas.bambulab.com/package/2021" ` +
    `xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06">\n` +
    ` <metadata name="BambuStudio:3mfVersion">1</metadata>\n` +
    ` <resources>\n${childObjs.join('\n')}\n </resources>\n` +
    ` <build/>\n` +
    `</model>`;

  const rels =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n` +
    ` <Relationship Target="${CHILD_PATH}" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>\n` +
    `</Relationships>`;

  const objBlocks = asms
    .map((a) => {
      const parts = a.members
        .map(
          (m) =>
            `    <part id="${m.childId}" subtype="${m.subtype}">\n` +
            `      <metadata key="name" value="${escapeXml(m.name)}"/>\n` +
            `      <metadata key="matrix" value="${linMatrix16(m.lin)}"/>\n` +
            `      <metadata key="extruder" value="${m.extruder}"/>\n` +
            settingsLines(m.settings, '      ') +
            `      ${meshStat(m.faceCount)}\n` +
            `    </part>`
        )
        .join('\n');
      const objExtruder = a.members[0]?.extruder ?? 1;
      const faceTotal = a.members.reduce((s, m) => s + m.faceCount, 0);
      return (
        // NB: face_count really is a bare attribute (no key=/value=) — that's
        // exactly how Bambu Studio writes it in its own model_settings.config.
        `  <object id="${a.assemblyId}">\n` +
        `    <metadata key="name" value="${escapeXml(a.name)}"/>\n` +
        `    <metadata key="extruder" value="${objExtruder}"/>\n` +
        `    <metadata face_count="${faceTotal}"/>\n` +
        `${parts}\n` +
        `  </object>`
      );
    })
    .join('\n');

  // One <plate> per distinct plate; assemblies on the same plate share it with a
  // plate-local instance counter (plate mode = 1 assembly/plate → instance_id 0).
  const plateIds = Array.from(new Set(asms.map((a) => a.plate))).sort((a, b) => a - b);
  const plateBlocks = plateIds
    .map((plateId, pIdx) => {
      let local = 0;
      const insts = asms
        .filter((a) => a.plate === plateId)
        .map(
          (a) =>
            `    <model_instance>\n` +
            `      <metadata key="object_id" value="${a.assemblyId}"/>\n` +
            `      <metadata key="instance_id" value="${local++}"/>\n` +
            `    </model_instance>`
        )
        .join('\n');
      const cfg = plateConfigs && plateConfigs[plateId];
      return (
        `  <plate>\n` +
        `    <metadata key="plater_id" value="${pIdx + 1}"/>\n` +
        `    <metadata key="plater_name" value="${escapeXml(plateName(cfg, ''))}"/>\n` +
        `    <metadata key="locked" value="${cfg && cfg.locked != null ? String(cfg.locked) : 'false'}"/>\n` +
        `    <metadata key="filament_map_mode" value="${escapeXml(cfg?.filamentMapMode || 'Auto For Flush')}"/>\n` +
        plateExtraLines(cfg, '    ') +
        (withThumbnail && pIdx === 0
          ? `    <metadata key="thumbnail_file" value="Metadata/plate_1.png"/>\n`
          : '') +
        `${insts}\n` +
        `  </plate>`
      );
    })
    .join('\n');

  const assembleItems = (() => {
    const localByPlate = new Map<number, number>();
    return asms
      .map((a) => {
        const local = localByPlate.get(a.plate) ?? 0;
        localByPlate.set(a.plate, local + 1);
        return `   <assemble_item object_id="${a.assemblyId}" instance_id="${local}" transform="1 0 0 0 1 0 0 0 1 ${fmt(
          a.tx
        )} ${fmt(a.ty)} ${fmt(a.tz)}" offset="0 0 0" />`;
      })
      .join('\n');
  })();

  const modelSettings =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<config>\n${objBlocks}\n` +
    `${plateBlocks}\n` +
    `  <assemble>\n${assembleItems}\n  </assemble>\n` +
    `</config>`;

  return { rootModel, childModel, rels, modelSettings };
}
