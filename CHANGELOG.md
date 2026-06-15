# Changelog

All notable changes to **bambu-3mf** are documented here. The format is loosely
based on [Keep a Changelog](https://keepachangelog.com/).

## [0.1.0] — 2026-06

First extracted/packaged release. Builds on the in-app `pack3mf` exporter, made
**purely additive** (every existing relief / laser / multi-color export is
byte-for-byte unchanged, proven by snapshot tests).

### Added — packaging & API
- `pack3mfFromConfig(config, objects, meta, options)` — pure, **synchronous**
  core that takes the template strings directly (no `fetch`/DOM → works in Node,
  Web Workers, any bundler).
- `pack3mf(template, objects, meta, options)` — browser convenience that fetches
  `public/bambu/<template>/` then delegates to the core (unchanged signature).
- Single public entry `index.ts`; published as `bambu-3mf` with `dist/` + `.d.ts`.

### Added — typed parameter catalog
- `ProcessSettings` / `FilamentSettings` / `PrinterSettings` (508 keys grounded in
  real Bambu exports) with an index signature so any unlisted/future key still
  passes through. 21 enum literal types for the common enumerated keys.
- `serializeSettings`, `validateSettings`, `KNOWN_KEYS`.

### Added — format-level functions (all opt-in)
- Object `transform` (rotate / scale / mirror) and `instances` (copies).
- Multi-part objects (`parts`) with `subtype` (modifier / negative / support
  enforcer / blocker) and per-object / per-part setting overrides.
- Per-triangle painting (`paint`): `paint_color` (MMU), `paint_supports`,
  `paint_seam`, `paint_fuzzy_skin` — whole-triangle encoding matching
  `TriangleSelector::serialize`.
- Variable layer height (`layerRanges` → `layer_config_ranges.xml`).
- Per-plate settings (`plates`: name / bed type / custom gcode …) and richer
  `slice_info.config` (`sliceInfo`).

### Notes
- Whole-triangle painting only; partial (subdivided) painting is not yet emitted.
- Painting / layer-range / per-plate metadata formats are grounded in BambuStudio
  source but should be confirmed by opening a sample in BambuStudio.
