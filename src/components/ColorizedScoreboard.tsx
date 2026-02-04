"use client";

import { useEffect, useRef, useState } from "react";

interface ColorizedScoreboardProps {
  imageUrl: string;
  faceColor: string;
  accentColor: string | null;
  ledColor: string;
  className?: string;
}

// Convert hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
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

// Check if pixel is a dark/face color (not LED, not white text)
function isFaceColor(r: number, g: number, b: number): boolean {
  const { l } = rgbToHsl(r, g, b);
  // Face colors are typically darker (not bright LEDs or white text)
  // and not pure black (borders/outlines)
  return l > 0.05 && l < 0.6;
}

// Check if pixel is an LED color (bright red/amber/orange)
function isLedColor(r: number, g: number, b: number): boolean {
  const { h, s, l } = rgbToHsl(r, g, b);
  // LEDs are bright (high lightness) and saturated
  // Red hue is around 0 or 1, orange/amber is around 0.05-0.1
  const isRedOrangeHue = h < 0.12 || h > 0.95;
  return isRedOrangeHue && s > 0.5 && l > 0.4;
}

// Check if pixel is a gray/silver color (potential accent)
function isAccentGray(r: number, g: number, b: number): boolean {
  const { s, l } = rgbToHsl(r, g, b);
  // Gray/silver has low saturation and medium lightness
  return s < 0.2 && l > 0.3 && l < 0.8;
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
  const imageRef = useRef<HTMLImageElement | null>(null);
  const originalDataRef = useRef<ImageData | null>(null);

  // Load and process image
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      imageRef.current = img;
      canvas.width = img.width;
      canvas.height = img.height;

      // Draw original image
      ctx.drawImage(img, 0, 0);

      // Store original pixel data
      originalDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);

      setLoading(false);
      setError(null);
    };

    img.onerror = () => {
      setError("Failed to load image");
      setLoading(false);
    };

    // Add cache-busting to ensure CORS headers are fetched fresh
    img.src = `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}cors=1`;
  }, [imageUrl]);

  // Apply color replacement when colors change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !originalDataRef.current) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    // Get a fresh copy of original data
    const imageData = new ImageData(
      new Uint8ClampedArray(originalDataRef.current.data),
      originalDataRef.current.width,
      originalDataRef.current.height
    );
    const data = imageData.data;

    // Parse target colors
    const targetFace = hexToRgb(faceColor);
    const targetFaceHsl = rgbToHsl(targetFace.r, targetFace.g, targetFace.b);

    const targetAccent = accentColor ? hexToRgb(accentColor) : null;
    const targetAccentHsl = targetAccent
      ? rgbToHsl(targetAccent.r, targetAccent.g, targetAccent.b)
      : null;

    const targetLed = hexToRgb(ledColor);
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
      // Check if this is an accent/gray area
      else if (targetAccentHsl && isAccentGray(r, g, b)) {
        // Apply accent color while preserving lightness
        const newRgb = hslToRgb(
          targetAccentHsl.h,
          targetAccentHsl.s * 0.7, // Reduce saturation a bit for metallic look
          pixelHsl.l
        );
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
  }, [faceColor, accentColor, ledColor, loading]);

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
