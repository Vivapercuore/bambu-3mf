/** Unit tests for params.ts — typed catalog serialization & validation. */
import { serializeSettings, validateSettings, KNOWN_KEYS } from '../params';

describe('serializeSettings', () => {
  test('numbers, booleans, strings, percents', () => {
    expect(
      serializeSettings({
        layer_height: 0.2,
        wall_loops: 3,
        spiral_mode: true,
        gcode_add_line_number: false,
        sparse_infill_density: '15%',
        seam_position: 'aligned',
      })
    ).toEqual({
      layer_height: '0.2',
      wall_loops: '3',
      spiral_mode: '1',
      gcode_add_line_number: '0',
      sparse_infill_density: '15%',
      seam_position: 'aligned',
    });
  });

  test('arrays are mapped element-wise (booleans too)', () => {
    expect(serializeSettings({ flush_volumes_vector: [140, 140], filament_is_support: [false, true] })).toEqual({
      flush_volumes_vector: ['140', '140'],
      filament_is_support: ['0', '1'],
    });
  });

  test('undefined values are dropped', () => {
    expect(serializeSettings({ a: 1, b: undefined })).toEqual({ a: '1' });
  });
});

describe('validateSettings', () => {
  test('returns [] for all-known keys, no warning', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(validateSettings({ layer_height: 0.2, wall_loops: 3 })).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  test('reports unknown keys and warns once', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const unknown = validateSettings({ layer_height: 0.2, not_a_real_key: 1, typo_key: 2 });
    expect(unknown.sort()).toEqual(['not_a_real_key', 'typo_key']);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  test('warn=false stays silent but still reports', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(validateSettings({ bogus: 1 }, false)).toEqual(['bogus']);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('KNOWN_KEYS catalog', () => {
  test('contains 508 keys across the three groups', () => {
    expect(KNOWN_KEYS.size).toBe(508);
  });

  test('includes representative process / filament / printer keys', () => {
    for (const k of ['layer_height', 'sparse_infill_pattern', 'support_type', 'nozzle_temperature', 'filament_type', 'nozzle_diameter', 'machine_start_gcode']) {
      expect(KNOWN_KEYS.has(k)).toBe(true);
    }
    expect(KNOWN_KEYS.has('definitely_not_a_key')).toBe(false);
  });
});
