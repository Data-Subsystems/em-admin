import { COLORS } from './colors';

// Custom default Background/Face colors (instead of navy_blue)
export const CUSTOM_BACKGROUND: Record<string, string> = {
  '2106': 'matte_black',
  lx2160: 'matte_black',
  lx2120: 'matte_black',
  lx2150: 'matte_black',
  lx2158: 'white',
  lx2170: 'matte_black',
  lx2180: 'matte_black',
  lx1320: 'jolly_green',
  lx1360: 'matte_black',
  lx1360b: 'matte_black',
  lx1390b: 'indigo_purple',
  lx1390f: 'indigo_purple',
  lx1390: 'power_purple',
  lx3150: 'matte_black',
  lx3250: 'hunter_green',
  lx3450f: 'navy_blue',
  lx3450b: 'cardinal_red',
  lx3450: 'cardinal_red',
  lx3885: 'hunter_green',
  lx3880: 'indigo_purple',
  lx3845: 'matte_black',
  lx3840: 'cardinal_red',
  lx1360f: 'hunter_green',
  lx3740: 'matte_black',
  lx1160: 'indigo_purple',
  lx1130: 'merchant_maroon',
  lx1070: 'icy_blue',
  lx1060: 'matte_black',
  lx1050: 'indigo_purple',
  lx1030: 'jolly_green',
  lx1341: 'racing_red',
  lx1340: 'indigo_purple',
  lx1260: 'metallic_gold',
  lx1250: 'indigo_purple',
  '1780': 'navy_blue',
  '1750': 'merchant_maroon',
  '1730': 'royal_blue',
  '1720': 'hunter_green',
  lx1480: 'matte_black',
  lx1440: 'indigo_purple',
  lx2370: 'hunter_green',
  lx2350: 'royal_blue',
  lx2330: 'shamrock_green',
  lx2770: 'hunter_green',
  lx2576: 'navy_blue',
  lx2575: 'navy_blue',
  lx2570: 'cardinal_red',
  lx2556: 'cardinal_red',
  lx2550: 'matte_black',
  lx2655: 'matte_black',
  lx2665: 'indigo_purple',
  lx2545: 'hunter_green',
  lx6650: 'matte_black',
  lx6630: 'cardinal_red',
  lx8850: 'indigo_purple',
  lx8750: 'jolly_green',
  lx8650: 'cardinal_red',
  lx8350: 'matte_black',
  lx2655v: 'matte_black',
  lx2665v: 'indigo_purple',
};

// Custom default Accent colors (instead of royal_blue)
export const CUSTOM_ACCENT: Record<string, string> = {
  lx1070: 'egyptian_blue',
  lx2160: 'white',
  lx2120: 'white',
  lx2150: 'white',
  lx2158: 'white',
  lx2170: 'white',
  lx2180: 'white',
  lx1320: 'white',
  lx1360: 'white',
  lx1360b: 'white',
  lx1390b: 'metallic_gold',
  lx1390f: 'metallic_gold',
  lx1390: 'metallic_gold',
  lx3150: 'white',
  lx3250: 'white',
  lx3450f: 'white',
  lx3450b: 'silver_gray',
  lx3450: 'silver_gray',
  lx3885: 'metallic_gold',
  lx3880: 'metallic_gold',
  lx3845: 'white',
  lx3840: 'white',
  lx1360f: 'white',
  lx3740: 'golden_yellow',
  lx1160: 'white',
  lx1130: 'white',
  lx1060: 'white',
  lx1050: 'indigo_purple',
  lx1030: 'white',
  lx1341: 'white',
  lx1340: 'white',
  lx1260: 'matte_black',
  lx1250: 'white',
  '1780': 'metallic_gold',
  '1750': 'white',
  '1730': 'white',
  '1720': 'white',
  lx1480: 'metallic_gold',
  lx1440: 'white',
  '2106': 'white',
  lx2370: 'white',
  lx2350: 'white',
  lx2330: 'white',
  lx2770: 'white',
  lx2576: 'white',
  lx2575: 'white',
  lx2570: 'white',
  lx2556: 'white',
  lx2550: 'white',
  lx2655: 'white',
  lx2665: 'metallic_gold',
  lx2545: 'white',
  lx6650: 'white',
  lx6630: 'white',
  lx8850: 'white',
  lx8750: 'white',
  lx8650: 'white',
  lx8350: 'metallic_gold',
  lx2655v: 'white',
  lx2665v: 'metallic_gold',
};

// Custom default Caption colors (instead of white)
export const CUSTOM_CAPTION: Record<string, string> = {
  '2106': 'white',
  lx2180: 'white',
  lx1260: 'matte_black',
  lx2158: 'matte_black',
};

// Custom default LED colors (instead of amber)
export const CUSTOM_LEDS: Record<string, string> = {
  lx2160: 'red',
  lx2150: 'red',
  lx2120: 'red',
  lx2158: 'red',
  lx2170: 'red',
  lx2106: 'red',
  lx1360: 'red',
  lx1320: 'red',
  lx3150: 'red',
  lx3250: 'red',
  lx3885: 'red',
  lx3845: 'red',
  lx1160: 'red',
  lx1070: 'red',
  lx1050: 'red',
  lx1030: 'red',
  lx1340: 'red',
  lx1260: 'red',
  lx1720: 'red',
  lx1440: 'red',
  lx6650: 'red',
  lx3450: 'red',
};

// Standard defaults
const STANDARD_DEFAULTS = {
  primary: 'navy_blue',
  accent: 'royal_blue',
  caption: 'white',
  leds: 'amber',
};

// Get default colors for a model
export function getModelDefaults(modelId: string): {
  primary: string;
  accent: string;
  caption: string;
  leds: string;
} {
  return {
    primary: CUSTOM_BACKGROUND[modelId] || STANDARD_DEFAULTS.primary,
    accent: CUSTOM_ACCENT[modelId] || STANDARD_DEFAULTS.accent,
    caption: CUSTOM_CAPTION[modelId] || STANDARD_DEFAULTS.caption,
    leds: CUSTOM_LEDS[modelId] || STANDARD_DEFAULTS.leds,
  };
}

// Validate that all custom colors reference valid color names
export function validateCustomColors(): string[] {
  const errors: string[] = [];
  const allColors = Object.keys(COLORS);

  const checkMap = (map: Record<string, string>, mapName: string) => {
    for (const [model, color] of Object.entries(map)) {
      if (!allColors.includes(color)) {
        errors.push(`${mapName}['${model}'] references invalid color: ${color}`);
      }
    }
  };

  checkMap(CUSTOM_BACKGROUND, 'CUSTOM_BACKGROUND');
  checkMap(CUSTOM_ACCENT, 'CUSTOM_ACCENT');
  checkMap(CUSTOM_CAPTION, 'CUSTOM_CAPTION');
  checkMap(CUSTOM_LEDS, 'CUSTOM_LEDS');

  return errors;
}
