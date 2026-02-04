// Models WITHOUT colorpicker (show static image only)
export const NO_COLORPICKER: Set<string> = new Set([
  // Currently empty in PHP but may be populated
]);

// Models WITHOUT Face/Background selection
export const NO_BACKGROUND_OPTIONS = new Set([
  '2106',
  'lx2120',
  'lx2160',
  'lx2150',
  'lx2158',
  'lx2170',
  'lx2180',
  'lx7406',
]);

// Models WITHOUT Caption selection
export const NO_CAPTION = new Set([
  '2106',
  'lx2180',
  'lx2160',
  'lx2120',
  'lx2150',
  'lx2158',
  'lx2170',
  'lx7406',
  'lx3018',
  'lx3024',
  'lx3030',
  'lx1064',
]);

// Models WITHOUT Accent selection
export const NO_ACCENT = new Set(['lx1050']);

// Models WITHOUT LED color selection
export const NO_LEDS_OPTIONS = new Set([
  'lx2160',
  'lx2120',
  'lx2150',
  'lx2158',
  'lx2170',
  'lx2106',
  'lx7406',
]);

// Multicolor LED models - LED layer NOT colorized
// Supports wildcards with *
export const MULTICOLOR_LEDS = [
  '2180',
  '2330',
  '2350',
  '2370',
  '2550',
  '2555',
  '2556',
  '2570',
  '2575',
  '2576',
  '2655',
  '2665',
  '2770',
  '8350',
  '8650',
  '8750',
  '8850',
  'lx2*', // Wildcard - all lx2xxx
  'lx8440',
];

// Exception: force single color LED despite matching wildcard
export const FORCE_SINGLE_COLOR_LED = new Set(['lx2120']);

// Check if model has multicolor LED
export function isMulticolorLed(modelId: string): boolean {
  // Check exceptions first
  for (const single of FORCE_SINGLE_COLOR_LED) {
    if (modelId.toLowerCase().includes(single.toLowerCase())) {
      return false;
    }
  }

  // Check patterns
  for (const pattern of MULTICOLOR_LEDS) {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace('*', '.+'), 'i');
      if (regex.test(modelId)) {
        return true;
      }
    } else {
      if (modelId.includes(pattern)) {
        return true;
      }
    }
  }

  return false;
}

// Check if model should show Face/Background tab
export function hasBackgroundTab(modelId: string): boolean {
  return !NO_BACKGROUND_OPTIONS.has(modelId);
}

// Check if model should show Accent tab
export function hasAccentTab(modelId: string): boolean {
  return !NO_ACCENT.has(modelId);
}

// Check if model should show LED tab
export function hasLedTab(modelId: string): boolean {
  return !NO_LEDS_OPTIONS.has(modelId) && !isMulticolorLed(modelId);
}

// Check if model should show Caption tab
export function hasCaptionTab(modelId: string): boolean {
  return !NO_CAPTION.has(modelId);
}

// Check if model has colorpicker at all
export function hasColorpicker(modelId: string): boolean {
  return !NO_COLORPICKER.has(modelId);
}

// Image size constants
export const IMAGE_SIZES = {
  DEFAULT_WIDTH: 720,
  PRINT_WIDTH: 900,
  DEFAULT_HEIGHT: 550,
  SINGLE_WIDTH: 690,
};

// Layer names in composition order
export const LAYER_ORDER = [
  'Frame',
  'Face',
  'Accent-Striping',
  'Masks',
  'LED-Glow',
  'Captions',
] as const;

export type LayerName = (typeof LAYER_ORDER)[number];
