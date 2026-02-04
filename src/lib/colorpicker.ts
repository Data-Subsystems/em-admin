/**
 * ColorPicker utility functions for batch image generation
 */

export const UI_COLORS = [
  'navy_blue', 'egyptian_blue', 'royal_blue', 'icy_blue',
  'shamrock_green', 'jolly_green', 'hunter_green',
  'silver_gray', 'matte_black', 'white',
  'indigo_purple', 'power_purple',
  'merchant_maroon', 'cardinal_red', 'racing_red',
  'tiger_orange', 'golden_yellow', 'metallic_gold',
] as const;

export const ACCENT_COLORS = [...UI_COLORS, 'none'] as const;
export const LED_COLORS = ['red', 'amber'] as const;

export type UIColor = typeof UI_COLORS[number];
export type AccentColor = typeof ACCENT_COLORS[number];
export type LEDColor = typeof LED_COLORS[number];

export interface ColorCombination {
  primary_color: UIColor;
  accent_color: AccentColor;
  led_color: LEDColor;
}

/**
 * Generate all possible color combinations for a scoreboard model
 * Total: 18 face colors × 19 accent colors × 2 LED colors = 684 combinations
 */
export function generateAllColorCombinations(): ColorCombination[] {
  const combinations: ColorCombination[] = [];

  for (const primary of UI_COLORS) {
    for (const accent of ACCENT_COLORS) {
      for (const led of LED_COLORS) {
        combinations.push({
          primary_color: primary,
          accent_color: accent,
          led_color: led,
        });
      }
    }
  }

  return combinations;
}

/**
 * Get the total number of possible color combinations
 */
export function getTotalCombinations(): number {
  return UI_COLORS.length * ACCENT_COLORS.length * LED_COLORS.length;
}

/**
 * Create a unique key for a color combination
 */
export function getCombinationKey(
  primary: string,
  accent: string,
  led: string
): string {
  return `${primary}-${accent}-${led}`;
}

/**
 * Parse a combination key back into its components
 */
export function parseCombinationKey(key: string): ColorCombination | null {
  const parts = key.split('-');
  if (parts.length !== 3) return null;

  const [primary, accent, led] = parts;

  if (!isValidUIColor(primary)) return null;
  if (!isValidAccentColor(accent)) return null;
  if (!isValidLEDColor(led)) return null;

  return {
    primary_color: primary as UIColor,
    accent_color: accent as AccentColor,
    led_color: led as LEDColor,
  };
}

/**
 * Validate if a string is a valid UI color
 */
export function isValidUIColor(color: string): color is UIColor {
  return (UI_COLORS as readonly string[]).includes(color);
}

/**
 * Validate if a string is a valid accent color
 */
export function isValidAccentColor(color: string): color is AccentColor {
  return (ACCENT_COLORS as readonly string[]).includes(color);
}

/**
 * Validate if a string is a valid LED color
 */
export function isValidLEDColor(color: string): color is LEDColor {
  return (LED_COLORS as readonly string[]).includes(color);
}

/**
 * Filter out existing combinations from all possible combinations
 */
export function getNewCombinations(
  existingKeys: Set<string>
): ColorCombination[] {
  return generateAllColorCombinations().filter(
    (combo) => !existingKeys.has(getCombinationKey(
      combo.primary_color,
      combo.accent_color,
      combo.led_color
    ))
  );
}

/**
 * Generate S3 key for a generated image
 * Uses double-dash delimiter to avoid conflicts with underscores in color names
 */
export function getS3Key(
  model: string,
  primary: string,
  accent: string,
  led: string
): string {
  return `generated/${model}/${primary}--${accent}--${led}.png`;
}

/**
 * Parse model and colors from S3 key
 */
export function parseS3Key(s3Key: string): {
  model: string;
  primary: string;
  accent: string;
  led: string;
} | null {
  // generated/{model}/{primary}--{accent}--{led}.png
  const match = s3Key.match(/^generated\/([^/]+)\/([^-]+(?:_[^-]+)?)--([^-]+(?:_[^-]+)?)--([^.]+)\.png$/);
  if (!match) return null;

  const [, model, primary, accent, led] = match;
  return { model, primary, accent, led };
}

/**
 * Calculate batch processing statistics
 */
export interface BatchStats {
  total: number;
  completed: number;
  pending: number;
  processing: number;
  failed: number;
  percentComplete: number;
}

export function calculateStats(tasks: Array<{ status: string }>): BatchStats {
  const total = tasks.length;
  const completed = tasks.filter(t => t.status === 'completed').length;
  const pending = tasks.filter(t => t.status === 'pending').length;
  const processing = tasks.filter(t => t.status === 'processing').length;
  const failed = tasks.filter(t => t.status === 'failed').length;

  return {
    total,
    completed,
    pending,
    processing,
    failed,
    percentComplete: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

/**
 * Group tasks by model
 */
export function groupTasksByModel(
  tasks: Array<{ model: string; status: string }>
): Record<string, BatchStats> {
  const groups: Record<string, Array<{ status: string }>> = {};

  for (const task of tasks) {
    if (!groups[task.model]) {
      groups[task.model] = [];
    }
    groups[task.model].push({ status: task.status });
  }

  const result: Record<string, BatchStats> = {};
  for (const [model, modelTasks] of Object.entries(groups)) {
    result[model] = calculateStats(modelTasks);
  }

  return result;
}

/**
 * Color display names for UI
 */
export const COLOR_DISPLAY_NAMES: Record<string, string> = {
  navy_blue: 'Navy Blue',
  egyptian_blue: 'Egyptian Blue',
  royal_blue: 'Royal Blue',
  icy_blue: 'Icy Blue',
  shamrock_green: 'Shamrock Green',
  jolly_green: 'Jolly Green',
  hunter_green: 'Hunter Green',
  silver_gray: 'Silver Gray',
  matte_black: 'Matte Black',
  white: 'White',
  indigo_purple: 'Indigo Purple',
  power_purple: 'Power Purple',
  merchant_maroon: 'Merchant Maroon',
  cardinal_red: 'Cardinal Red',
  racing_red: 'Racing Red',
  tiger_orange: 'Tiger Orange',
  golden_yellow: 'Golden Yellow',
  metallic_gold: 'Metallic Gold',
  none: 'None',
  red: 'Red',
  amber: 'Amber',
};

/**
 * Get display name for a color
 */
export function getColorDisplayName(color: string): string {
  return COLOR_DISPLAY_NAMES[color] || color;
}
