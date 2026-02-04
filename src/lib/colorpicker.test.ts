import { describe, it, expect } from 'vitest';
import {
  UI_COLORS,
  ACCENT_COLORS,
  LED_COLORS,
  generateAllColorCombinations,
  getTotalCombinations,
  getCombinationKey,
  parseCombinationKey,
  isValidUIColor,
  isValidAccentColor,
  isValidLEDColor,
  getNewCombinations,
  getS3Key,
  parseS3Key,
  calculateStats,
  groupTasksByModel,
  getColorDisplayName,
  COLOR_DISPLAY_NAMES,
} from './colorpicker';

describe('Color Constants', () => {
  it('should have 18 UI colors', () => {
    expect(UI_COLORS.length).toBe(18);
  });

  it('should have 19 accent colors (18 UI colors + none)', () => {
    expect(ACCENT_COLORS.length).toBe(19);
    expect(ACCENT_COLORS).toContain('none');
  });

  it('should have 2 LED colors', () => {
    expect(LED_COLORS.length).toBe(2);
    expect(LED_COLORS).toContain('red');
    expect(LED_COLORS).toContain('amber');
  });

  it('should include all expected UI colors', () => {
    const expectedColors = [
      'navy_blue', 'egyptian_blue', 'royal_blue', 'icy_blue',
      'shamrock_green', 'jolly_green', 'hunter_green',
      'silver_gray', 'matte_black', 'white',
      'indigo_purple', 'power_purple',
      'merchant_maroon', 'cardinal_red', 'racing_red',
      'tiger_orange', 'golden_yellow', 'metallic_gold',
    ];
    expectedColors.forEach(color => {
      expect(UI_COLORS).toContain(color);
    });
  });

  it('should have accent colors containing all UI colors plus none', () => {
    UI_COLORS.forEach(color => {
      expect(ACCENT_COLORS).toContain(color);
    });
    expect(ACCENT_COLORS).toContain('none');
  });
});

describe('generateAllColorCombinations', () => {
  it('should generate 684 combinations (18 × 19 × 2)', () => {
    const combinations = generateAllColorCombinations();
    expect(combinations.length).toBe(684);
  });

  it('should have unique combinations', () => {
    const combinations = generateAllColorCombinations();
    const keys = combinations.map(c =>
      `${c.primary_color}-${c.accent_color}-${c.led_color}`
    );
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(combinations.length);
  });

  it('should include all valid primary colors', () => {
    const combinations = generateAllColorCombinations();
    const primaryColors = new Set(combinations.map(c => c.primary_color));
    UI_COLORS.forEach(color => {
      expect(primaryColors.has(color)).toBe(true);
    });
  });

  it('should include all valid accent colors', () => {
    const combinations = generateAllColorCombinations();
    const accentColors = new Set(combinations.map(c => c.accent_color));
    ACCENT_COLORS.forEach(color => {
      expect(accentColors.has(color)).toBe(true);
    });
  });

  it('should include all valid LED colors', () => {
    const combinations = generateAllColorCombinations();
    const ledColors = new Set(combinations.map(c => c.led_color));
    LED_COLORS.forEach(color => {
      expect(ledColors.has(color)).toBe(true);
    });
  });

  it('should have correct combination structure', () => {
    const combinations = generateAllColorCombinations();
    combinations.forEach(combo => {
      expect(combo).toHaveProperty('primary_color');
      expect(combo).toHaveProperty('accent_color');
      expect(combo).toHaveProperty('led_color');
    });
  });
});

describe('getTotalCombinations', () => {
  it('should return 684', () => {
    expect(getTotalCombinations()).toBe(684);
  });

  it('should match the length of generated combinations', () => {
    const combinations = generateAllColorCombinations();
    expect(getTotalCombinations()).toBe(combinations.length);
  });
});

describe('getCombinationKey', () => {
  it('should create a valid key from colors', () => {
    const key = getCombinationKey('navy_blue', 'white', 'red');
    expect(key).toBe('navy_blue-white-red');
  });

  it('should handle none accent color', () => {
    const key = getCombinationKey('matte_black', 'none', 'amber');
    expect(key).toBe('matte_black-none-amber');
  });

  it('should create consistent keys', () => {
    const key1 = getCombinationKey('royal_blue', 'silver_gray', 'red');
    const key2 = getCombinationKey('royal_blue', 'silver_gray', 'red');
    expect(key1).toBe(key2);
  });
});

describe('parseCombinationKey', () => {
  it('should parse a valid key', () => {
    const result = parseCombinationKey('navy_blue-white-red');
    expect(result).toEqual({
      primary_color: 'navy_blue',
      accent_color: 'white',
      led_color: 'red',
    });
  });

  it('should parse a key with none accent', () => {
    const result = parseCombinationKey('matte_black-none-amber');
    expect(result).toEqual({
      primary_color: 'matte_black',
      accent_color: 'none',
      led_color: 'amber',
    });
  });

  it('should return null for invalid key format', () => {
    expect(parseCombinationKey('invalid')).toBeNull();
    expect(parseCombinationKey('one-two')).toBeNull();
    expect(parseCombinationKey('a-b-c-d')).toBeNull();
  });

  it('should return null for invalid primary color', () => {
    expect(parseCombinationKey('invalid_color-white-red')).toBeNull();
  });

  it('should return null for invalid accent color', () => {
    expect(parseCombinationKey('navy_blue-invalid_accent-red')).toBeNull();
  });

  it('should return null for invalid LED color', () => {
    expect(parseCombinationKey('navy_blue-white-green')).toBeNull();
  });

  it('should round-trip with getCombinationKey', () => {
    const original = { primary_color: 'royal_blue', accent_color: 'silver_gray', led_color: 'red' } as const;
    const key = getCombinationKey(original.primary_color, original.accent_color, original.led_color);
    const parsed = parseCombinationKey(key);
    expect(parsed).toEqual(original);
  });
});

describe('Color Validation', () => {
  describe('isValidUIColor', () => {
    it('should return true for valid UI colors', () => {
      UI_COLORS.forEach(color => {
        expect(isValidUIColor(color)).toBe(true);
      });
    });

    it('should return false for invalid colors', () => {
      expect(isValidUIColor('invalid')).toBe(false);
      expect(isValidUIColor('none')).toBe(false);
      expect(isValidUIColor('')).toBe(false);
    });
  });

  describe('isValidAccentColor', () => {
    it('should return true for valid accent colors', () => {
      ACCENT_COLORS.forEach(color => {
        expect(isValidAccentColor(color)).toBe(true);
      });
    });

    it('should return true for none', () => {
      expect(isValidAccentColor('none')).toBe(true);
    });

    it('should return false for invalid colors', () => {
      expect(isValidAccentColor('invalid')).toBe(false);
      expect(isValidAccentColor('')).toBe(false);
    });
  });

  describe('isValidLEDColor', () => {
    it('should return true for valid LED colors', () => {
      expect(isValidLEDColor('red')).toBe(true);
      expect(isValidLEDColor('amber')).toBe(true);
    });

    it('should return false for invalid colors', () => {
      expect(isValidLEDColor('green')).toBe(false);
      expect(isValidLEDColor('blue')).toBe(false);
      expect(isValidLEDColor('none')).toBe(false);
      expect(isValidLEDColor('')).toBe(false);
    });
  });
});

describe('getNewCombinations', () => {
  it('should return all combinations when none exist', () => {
    const existingKeys = new Set<string>();
    const newCombos = getNewCombinations(existingKeys);
    expect(newCombos.length).toBe(684);
  });

  it('should exclude existing combinations', () => {
    const existingKeys = new Set(['navy_blue-white-red', 'matte_black-none-amber']);
    const newCombos = getNewCombinations(existingKeys);
    expect(newCombos.length).toBe(682);
  });

  it('should return empty array when all combinations exist', () => {
    const allKeys = new Set(
      generateAllColorCombinations().map(c =>
        getCombinationKey(c.primary_color, c.accent_color, c.led_color)
      )
    );
    const newCombos = getNewCombinations(allKeys);
    expect(newCombos.length).toBe(0);
  });

  it('should not include excluded keys', () => {
    const excludedKey = 'royal_blue-silver_gray-red';
    const existingKeys = new Set([excludedKey]);
    const newCombos = getNewCombinations(existingKeys);

    const newKeys = newCombos.map(c =>
      getCombinationKey(c.primary_color, c.accent_color, c.led_color)
    );
    expect(newKeys).not.toContain(excludedKey);
  });
});

describe('S3 Key Functions', () => {
  describe('getS3Key', () => {
    it('should generate correct S3 key with double-dash delimiter', () => {
      const key = getS3Key('lx3360', 'navy_blue', 'white', 'red');
      expect(key).toBe('generated/lx3360/navy_blue--white--red.png');
    });

    it('should handle none accent', () => {
      const key = getS3Key('lx2545', 'matte_black', 'none', 'amber');
      expect(key).toBe('generated/lx2545/matte_black--none--amber.png');
    });

    it('should handle various model names', () => {
      expect(getS3Key('bb-1000', 'white', 'cardinal_red', 'red')).toBe(
        'generated/bb-1000/white--cardinal_red--red.png'
      );
      expect(getS3Key('fball_pro', 'silver_gray', 'none', 'amber')).toBe(
        'generated/fball_pro/silver_gray--none--amber.png'
      );
    });
  });

  describe('parseS3Key', () => {
    it('should parse valid S3 key', () => {
      const result = parseS3Key('generated/lx3360/navy_blue--white--red.png');
      expect(result).toEqual({
        model: 'lx3360',
        primary: 'navy_blue',
        accent: 'white',
        led: 'red',
      });
    });

    it('should parse key with none accent', () => {
      const result = parseS3Key('generated/lx2545/matte_black--none--amber.png');
      expect(result).toEqual({
        model: 'lx2545',
        primary: 'matte_black',
        accent: 'none',
        led: 'amber',
      });
    });

    it('should parse key with underscore colors', () => {
      const result = parseS3Key('generated/model1/royal_blue--silver_gray--red.png');
      expect(result).toEqual({
        model: 'model1',
        primary: 'royal_blue',
        accent: 'silver_gray',
        led: 'red',
      });
    });

    it('should return null for invalid format', () => {
      expect(parseS3Key('invalid')).toBeNull();
      expect(parseS3Key('generated/model/invalid.png')).toBeNull();
      expect(parseS3Key('images/lx3360.png')).toBeNull();
      expect(parseS3Key('')).toBeNull();
    });

    it('should round-trip with getS3Key', () => {
      const model = 'lx3360';
      const primary = 'royal_blue';
      const accent = 'silver_gray';
      const led = 'red';

      const s3Key = getS3Key(model, primary, accent, led);
      const parsed = parseS3Key(s3Key);

      expect(parsed).toEqual({ model, primary, accent, led });
    });
  });
});

describe('calculateStats', () => {
  it('should calculate correct stats for empty array', () => {
    const stats = calculateStats([]);
    expect(stats).toEqual({
      total: 0,
      completed: 0,
      pending: 0,
      processing: 0,
      failed: 0,
      percentComplete: 0,
    });
  });

  it('should calculate correct stats for all completed', () => {
    const tasks = [
      { status: 'completed' },
      { status: 'completed' },
      { status: 'completed' },
    ];
    const stats = calculateStats(tasks);
    expect(stats).toEqual({
      total: 3,
      completed: 3,
      pending: 0,
      processing: 0,
      failed: 0,
      percentComplete: 100,
    });
  });

  it('should calculate correct stats for mixed statuses', () => {
    const tasks = [
      { status: 'completed' },
      { status: 'completed' },
      { status: 'pending' },
      { status: 'processing' },
      { status: 'failed' },
    ];
    const stats = calculateStats(tasks);
    expect(stats).toEqual({
      total: 5,
      completed: 2,
      pending: 1,
      processing: 1,
      failed: 1,
      percentComplete: 40,
    });
  });

  it('should round percentComplete to integer', () => {
    const tasks = [
      { status: 'completed' },
      { status: 'pending' },
      { status: 'pending' },
    ];
    const stats = calculateStats(tasks);
    expect(stats.percentComplete).toBe(33); // 33.33... rounds to 33
  });

  it('should handle 0% correctly', () => {
    const tasks = [
      { status: 'pending' },
      { status: 'pending' },
    ];
    const stats = calculateStats(tasks);
    expect(stats.percentComplete).toBe(0);
  });
});

describe('groupTasksByModel', () => {
  it('should return empty object for empty array', () => {
    const result = groupTasksByModel([]);
    expect(result).toEqual({});
  });

  it('should group tasks by model', () => {
    const tasks = [
      { model: 'lx3360', status: 'completed' },
      { model: 'lx3360', status: 'pending' },
      { model: 'lx2545', status: 'completed' },
    ];
    const result = groupTasksByModel(tasks);

    expect(Object.keys(result)).toHaveLength(2);
    expect(result['lx3360'].total).toBe(2);
    expect(result['lx3360'].completed).toBe(1);
    expect(result['lx3360'].pending).toBe(1);
    expect(result['lx2545'].total).toBe(1);
    expect(result['lx2545'].completed).toBe(1);
  });

  it('should calculate correct percentages for each model', () => {
    const tasks = [
      { model: 'model1', status: 'completed' },
      { model: 'model1', status: 'completed' },
      { model: 'model1', status: 'pending' },
      { model: 'model1', status: 'pending' },
      { model: 'model2', status: 'completed' },
    ];
    const result = groupTasksByModel(tasks);

    expect(result['model1'].percentComplete).toBe(50);
    expect(result['model2'].percentComplete).toBe(100);
  });
});

describe('getColorDisplayName', () => {
  it('should return display name for known colors', () => {
    expect(getColorDisplayName('navy_blue')).toBe('Navy Blue');
    expect(getColorDisplayName('matte_black')).toBe('Matte Black');
    expect(getColorDisplayName('none')).toBe('None');
    expect(getColorDisplayName('red')).toBe('Red');
    expect(getColorDisplayName('amber')).toBe('Amber');
  });

  it('should return the input for unknown colors', () => {
    expect(getColorDisplayName('unknown_color')).toBe('unknown_color');
    expect(getColorDisplayName('custom')).toBe('custom');
  });

  it('should have display names for all UI colors', () => {
    UI_COLORS.forEach(color => {
      const displayName = getColorDisplayName(color);
      expect(displayName).not.toBe(color); // Should have a formatted name
      expect(displayName.length).toBeGreaterThan(0);
    });
  });

  it('should have display names for LED colors', () => {
    LED_COLORS.forEach(color => {
      const displayName = getColorDisplayName(color);
      expect(displayName.length).toBeGreaterThan(0);
    });
  });
});

describe('COLOR_DISPLAY_NAMES', () => {
  it('should have entries for all UI colors', () => {
    UI_COLORS.forEach(color => {
      expect(COLOR_DISPLAY_NAMES[color]).toBeDefined();
    });
  });

  it('should have entry for none', () => {
    expect(COLOR_DISPLAY_NAMES['none']).toBe('None');
  });

  it('should have entries for LED colors', () => {
    LED_COLORS.forEach(color => {
      expect(COLOR_DISPLAY_NAMES[color]).toBeDefined();
    });
  });

  it('should have properly formatted display names', () => {
    // Display names should be Title Case with spaces
    Object.values(COLOR_DISPLAY_NAMES).forEach(name => {
      expect(name).toMatch(/^[A-Z][a-zA-Z ]*$/);
    });
  });
});
