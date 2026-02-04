const S3_BUCKET = 'em-admin-assets';
const S3_REGION = 'us-east-1';
const S3_BASE_URL = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com`;

// Normalize model name for file paths
export function normalizeModelName(model: string): string {
  return model
    .replace('-fourface', '-4')
    .replace('lx2665b', 'lx2665v')
    .replace('lx2655b', 'lx2655v')
    .replace('lx2545b', 'lx2545v');
}

// Get S3 key for a mask layer
export function getS3MaskKey(model: string, layer: string): string {
  const normalizedModel = normalizeModelName(model);
  return `masks/${normalizedModel}/${layer}.png`;
}

// Get S3 key for generated image
export function getS3OutputKey(
  model: string,
  primary: string,
  accent: string,
  leds: string,
  width: number = 720
): string {
  const sizeSuffix = width === 720 ? '' : width === 1200 ? '@2x' : '-print';
  return `colorpicker-generated/${model}/${primary}-${accent}-${leds}${sizeSuffix}.png`;
}

// Get public URL for generated image
export function getColorPickerImageUrl(
  model: string,
  primary: string,
  accent: string,
  leds: string,
  size: 'default' | 'retina' | 'print' = 'default'
): string {
  // Normalize accent if 'none'
  const normalizedAccent = accent === 'none' ? primary : accent;

  const sizeSuffix = size === 'retina' ? '@2x' : size === 'print' ? '-print' : '';

  return `${S3_BASE_URL}/colorpicker-generated/${model}/${primary}-${normalizedAccent}-${leds}${sizeSuffix}.png`;
}

// Get public URL for mask layer (for debugging)
export function getMaskUrl(model: string, layer: string): string {
  const normalizedModel = normalizeModelName(model);
  return `${S3_BASE_URL}/masks/${normalizedModel}/${layer}.png`;
}
