"use client";

import { useEffect, useRef, useState } from "react";

interface ColorizedScoreboardProps {
  imageUrl: string;
  faceColor: string;
  accentColor: string | null;
  ledColor: string;
  className?: string;
}

// Parse color string (supports hex #rrggbb or rgb(r,g,b))
function parseColor(color: string): { r: number; g: number; b: number } {
  // Try rgb() format first
  const rgbMatch = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/i.exec(color);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10),
    };
  }

  // Try hex format
  const hexMatch = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
  if (hexMatch) {
    return {
      r: parseInt(hexMatch[1], 16),
      g: parseInt(hexMatch[2], 16),
      b: parseInt(hexMatch[3], 16),
    };
  }

  return { r: 0, g: 0, b: 0 };
}

// Convert RGB to HSL
function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return { h, s, l };
}

// Convert HSL to RGB
function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

// Check if a color is close to another (for color detection)
function isColorClose(
  r1: number, g1: number, b1: number,
  r2: number, g2: number, b2: number,
  threshold: number = 60
): boolean {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db) < threshold;
}

// Check if pixel is a face color (the main colored background)
function isFaceColor(r: number, g: number, b: number): boolean {
  // Skip if it's an LED color
  if (isLedColor(r, g, b)) return false;

  // Skip if it's an accent/border color
  if (isAccentColor(r, g, b)) return false;

  const { s, l } = rgbToHsl(r, g, b);

  // Skip black areas (LED display backgrounds) - they should stay black
  if (l < 0.15) return false;

  // Skip white/very light areas (text) - they should stay white
  if (l > 0.85) return false;

  // Skip very unsaturated areas (might be neutral elements)
  if (s < 0.1) return false;

  // This is a colored pixel that's part of the face
  return true;
}

// Check if pixel is an LED color (red/amber/orange/yellow)
function isLedColor(r: number, g: number, b: number): boolean {
  // Simple approach: LEDs are warm-colored pixels where red dominates
  // Red must be significantly higher than blue
  // Green can be high (for amber/yellow) or low (for red)

  // Red channel must be strong
  if (r < 150) return false;

  // Red must dominate over blue significantly
  if (r - b < 50) return false;

  // For red LEDs: r > g > b
  // For amber LEDs: r > g, g > b, and g is fairly high
  // For both: red is the highest channel

  const { s, l } = rgbToHsl(r, g, b);

  // Must be saturated (not gray/white)
  if (s < 0.3) return false;

  // Must be bright enough but not pure white
  if (l < 0.25 || l > 0.9) return false;

  return true;
}

// Check if pixel is a border/accent color (white or very light in original)
function isAccentColor(r: number, g: number, b: number): boolean {
  const { s, l } = rgbToHsl(r, g, b);

  // The accent/border in original images is white or very light
  // High lightness, low saturation (white/near-white)
  if (l > 0.85 && s < 0.3) return true;

  // Also catch light gray borders
  if (l > 0.7 && l < 0.9 && s < 0.15) return true;

  return false;
}

export default function ColorizedScoreboard({
  imageUrl,
  faceColor,
  accentColor,
  ledColor,
  className = "",
}: ColorizedScoreboardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [originalData, setOriginalData] = useState<ImageData | null>(null);

  // Load image
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    setLoading(true);
    setOriginalData(null);

    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // Store original pixel data in state to trigger re-render
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setOriginalData(data);
      setLoading(false);
      setError(null);
    };

    img.onerror = () => {
      setError("Failed to load image");
      setLoading(false);
    };

    img.src = imageUrl;
  }, [imageUrl]);

  // Apply color replacement when colors change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !originalData) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    // Get a fresh copy of original data
    const imageData = new ImageData(
      new Uint8ClampedArray(originalData.data),
      originalData.width,
      originalData.height
    );
    const data = imageData.data;

    // Parse target colors
    const targetFace = parseColor(faceColor);
    const targetFaceHsl = rgbToHsl(targetFace.r, targetFace.g, targetFace.b);

    const targetAccent = accentColor ? parseColor(accentColor) : null;
    const targetAccentHsl = targetAccent
      ? rgbToHsl(targetAccent.r, targetAccent.g, targetAccent.b)
      : null;

    const targetLed = parseColor(ledColor);
    const targetLedHsl = rgbToHsl(targetLed.r, targetLed.g, targetLed.b);

    // Process each pixel
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      // Skip fully transparent pixels
      if (a < 10) continue;

      const pixelHsl = rgbToHsl(r, g, b);

      // Check if this is an LED pixel (bright red/amber)
      if (isLedColor(r, g, b)) {
        // Shift LED color to target LED color while preserving brightness
        const newRgb = hslToRgb(targetLedHsl.h, targetLedHsl.s, pixelHsl.l);
        data[i] = newRgb.r;
        data[i + 1] = newRgb.g;
        data[i + 2] = newRgb.b;
      }
      // Check if this is an accent/border area (white borders in original)
      else if (targetAccentHsl && isAccentColor(r, g, b)) {
        // Apply accent color - use full saturation, slightly adjust lightness
        const newL = Math.max(0.3, Math.min(0.7, targetAccentHsl.l));
        const newRgb = hslToRgb(targetAccentHsl.h, targetAccentHsl.s, newL);
        data[i] = newRgb.r;
        data[i + 1] = newRgb.g;
        data[i + 2] = newRgb.b;
      }
      // Check if this is a face color pixel
      else if (isFaceColor(r, g, b)) {
        // Apply face color while preserving relative lightness
        const lightnessRatio = pixelHsl.l / 0.3; // Normalize based on typical face lightness
        const newL = Math.min(0.95, targetFaceHsl.l * lightnessRatio);
        const newRgb = hslToRgb(targetFaceHsl.h, targetFaceHsl.s, newL);
        data[i] = newRgb.r;
        data[i + 1] = newRgb.g;
        data[i + 2] = newRgb.b;
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }, [faceColor, accentColor, ledColor, originalData]);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 rounded-lg ${className}`}>
        <p className="text-gray-500 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 rounded-lg">
          <div className="text-white text-sm">Loading...</div>
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={`max-w-full h-auto rounded-lg ${loading ? "opacity-0" : "opacity-100"} transition-opacity`}
        style={{ maxHeight: "400px", margin: "0 auto", display: "block" }}
      />
    </div>
  );
}
