/** Unit tests for extras.ts — custom gcode, slice info, layer ranges, thumb rels. */
import {
  buildCustomGcode,
  buildSliceInfo,
  buildLayerConfigRanges,
  buildRootRelsWithThumbs,
} from '../extras';

describe('buildCustomGcode', () => {
  test('single plate: defaults to the Bambu pause M400 U1', () => {
    const xml = buildCustomGcode([{ plate: 1, pauses: [{ atZ: 5.2 }] }]);
    expect(xml).toContain('<plate_info id="1"/>');
    expect(xml).toContain('top_z="5.2"');
    expect(xml).toContain('type="1"');
    expect(xml).toContain('extruder="1"');
    expect(xml).toContain('gcode="M400 U1"');
    expect(xml).toContain('<mode value="MultiAsSingle"/>');
  });

  test('custom gcode / extruder / type / colour are honoured and escaped', () => {
    const xml = buildCustomGcode([
      { plate: 1, pauses: [{ atZ: 3, gcode: 'M600 "x" & y', extruder: 2, type: 2, color: '#FF0000' }] },
    ]);
    expect(xml).toContain('extruder="2"');
    expect(xml).toContain('type="2"');
    expect(xml).toContain('color="#FF0000"');
    expect(xml).toContain('gcode="M600 &quot;x&quot; &amp; y"');
  });

  test('multiple plates emit sequential plate_info ids', () => {
    const xml = buildCustomGcode([
      { plate: 2, pauses: [{ atZ: 1 }] },
      { plate: 1, pauses: [{ atZ: 2 }] },
    ]);
    expect(xml).toContain('<plate_info id="1"/>');
    expect(xml).toContain('<plate_info id="2"/>');
  });
});

describe('buildSliceInfo', () => {
  test('emits per-filament summary rows', () => {
    const xml = buildSliceInfo({ filaments: [{ id: 1, type: 'PLA', color: '#000', usedG: 1.2, usedM: 0.4 }] });
    expect(xml).toContain('<filament id="1"');
    expect(xml).toContain('type="PLA"');
    expect(xml).toContain('color="#000"');
    expect(xml).toContain('used_g="1.2"');
    expect(xml).toContain('used_m="0.4"');
  });

  test('keeps the slicer header and plate index', () => {
    const xml = buildSliceInfo({ plateIndex: 3 });
    expect(xml).toContain('X-BBL-Client-Type');
    expect(xml).toContain('<metadata key="index" value="3"/>');
  });
});

describe('buildLayerConfigRanges', () => {
  test('writes Z bands with option keys', () => {
    const xml = buildLayerConfigRanges([
      { objectId: 1, ranges: [
        { minZ: 0, maxZ: 1.5, settings: { layer_height: 0.2 } },
        { minZ: 1.5, maxZ: 8, settings: { layer_height: 0.08 } },
      ] },
    ]);
    expect(xml).toContain('<object id="1">');
    expect(xml).toContain('min_z="0" max_z="1.5"');
    expect(xml).toContain('<option opt_key="layer_height">0.2</option>');
    expect(xml).toContain('min_z="1.5" max_z="8"');
    expect(xml).toContain('<option opt_key="layer_height">0.08</option>');
  });
});

describe('buildRootRelsWithThumbs', () => {
  test('includes the OPC + bambulab cover relationships', () => {
    const rels = buildRootRelsWithThumbs(true);
    expect(rels).toContain('Target="/3D/3dmodel.model"');
    expect(rels).toContain('metadata/thumbnail');
    expect(rels).toContain('cover-thumbnail-middle');
    expect(rels).toContain('cover-thumbnail-small');
  });

  test('omits the small cover when there is no small thumbnail', () => {
    expect(buildRootRelsWithThumbs(false)).not.toContain('cover-thumbnail-small');
  });
});
