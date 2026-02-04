// RGB color definitions - exact values from PHP colorpicker_conf.php
export const COLORS: Record<string, [number, number, number]> = {
  // Blues
  navy_blue: [16, 43, 78],
  egyptian_blue: [35, 60, 136],
  royal_blue: [36, 98, 167],
  icy_blue: [117, 190, 233],

  // Greens
  shamrock_green: [0, 159, 72],
  jolly_green: [0, 114, 59],
  hunter_green: [14, 69, 42],

  // Neutrals
  silver_gray: [201, 199, 199],
  matte_black: [45, 42, 43],
  white: [255, 255, 255],

  // Purples
  indigo_purple: [94, 46, 134],
  power_purple: [104, 28, 91],
  merchant_maroon: [116, 17, 46],

  // Reds/Oranges/Yellows
  cardinal_red: [182, 31, 61],
  racing_red: [227, 50, 38],
  tiger_orange: [244, 121, 32],
  golden_yellow: [255, 212, 0],
  metallic_gold: [180, 151, 90],

  // LED colors
  red: [236, 27, 36],
  amber: [249, 165, 25],

  // Special
  none: [255, 255, 255],
};

// Colors available for UI selection (excluding internal-only colors)
export const UI_COLORS = Object.keys(COLORS).filter(
  (c) => !['none', 'red', 'amber'].includes(c)
);

// LED color options
export const LED_COLORS = ['red', 'amber'];

// All accent options (UI colors + none)
export const ACCENT_COLORS = [...UI_COLORS, 'none'];

// Get RGB tuple for a color name
export function getColorRGB(colorName: string): [number, number, number] {
  return COLORS[colorName] || COLORS.white;
}

// Convert color name to hex
export function colorToHex(colorName: string): string {
  const [r, g, b] = getColorRGB(colorName);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Get display name for color
export function getColorDisplayName(colorName: string): string {
  return colorName
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
