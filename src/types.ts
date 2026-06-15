/**
 * Shared types for the bambu export module. Kept in their own file so
 * `mesh`/`layout`/`model`/`extras` can reference them without import cycles
 * (`build3mf.ts` is the orchestrator and imports all of these).
 */
import { GeometryInput, MeshXml, TrianglePaint } from './mesh';
import { ProcessSettings } from './params';

export interface Vec3 {
  x?: number;
  y?: number;
  z?: number;
}

/**
 * A rigid/affine transform applied to an object (or part) **in 3MF Z-up space**,
 * realised through the build-item / part transform matrix (the mesh vertices are
 * never rewritten). Rotation is Euler degrees applied X→Y→Z; scale is uniform or
 * per-axis; mirror flips an axis. All fields optional (default = identity).
 */
export interface ObjectTransform {
  rotation?: Vec3;
  scale?: number | Vec3;
  mirror?: { x?: boolean; y?: boolean; z?: boolean };
}

/** One copy of an object. `translate` is an extra world offset (mm) for the copy. */
export interface InstanceTransform extends ObjectTransform {
  translate?: Vec3;
}

/** BambuStudio part roles (ModelVolumeType serialization). */
export type PartSubtype =
  | 'normal_part'
  | 'negative_part'
  | 'modifier_part'
  | 'support_enforcer'
  | 'support_blocker';

/** One sub-part of a multi-part object (modifier / support / negative volume, etc.). */
export interface Part3mf {
  /** Part name shown in the slicer tree. */
  name: string;
  /** World-space geometry, Y-up — a THREE.BufferGeometry or a raw {@link RawMesh} (welded per entry). */
  geometry: GeometryInput | GeometryInput[];
  /** Part role. Default `normal_part`. */
  subtype?: PartSubtype;
  /** 1-based filament slot for this part. Default inherits the object's. */
  extruder?: number;
  /** Per-part process-setting overrides → `<metadata key value>` in model_settings.config. */
  settings?: ProcessSettings;
  /** Per-triangle painting for this part's mesh. */
  paint?: TrianglePaint;
  /** Part-local transform (relative to the object). */
  transform?: ObjectTransform;
}

/** One variable-layer-height range on an object → `layer_config_ranges.xml`. */
export interface LayerRange {
  /** Range start Z (mm). */
  minZ: number;
  /** Range end Z (mm). */
  maxZ: number;
  /** Settings active in this Z band (typically `{ layer_height }`, but any keys allowed). */
  settings: ProcessSettings;
}

// ---- internal (post-meshing) shapes -------------------------------------------------

/** A part after its geometry has been turned into a 3MF mesh. */
export interface MeshedPart {
  name: string;
  mesh: MeshXml;
  subtype: PartSubtype;
  extruder: number;
  settings?: ProcessSettings;
  /** column-convention 3×3 linear (row-major storage) from the part transform. */
  lin: number[];
}

/** An object after meshing, before plate layout. */
export interface MeshedObject {
  name: string;
  mesh: MeshXml;
  plate: number;
  extruder: number;
  /** column-convention 3×3 linear (row-major storage) from the object transform. */
  lin: number[];
  subtype?: PartSubtype;
  settings?: ProcessSettings;
  instances?: InstanceTransform[];
  layerRanges?: LayerRange[];
  /** If present, this object is multi-part (built via the component/child-file path). */
  parts?: MeshedPart[];
}

/** A meshed object with its plate translation resolved. */
export interface PreparedObject extends MeshedObject {
  /** Plate translation (mm) applied via the build item transform. */
  tx: number;
  ty: number;
  tz: number;
}
