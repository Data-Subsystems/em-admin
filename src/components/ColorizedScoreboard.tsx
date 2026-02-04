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
  const rgbMatch = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/i.exec(color);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10),
    };
  }
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
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn: h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6; break;
      case gn: h = ((bn - rn) / d + 2) / 6; break;
      case bn: h = ((rn - gn) / d + 4) / 6; break;
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

    ctx.imageSmoothingEnabled = false;
    setLoading(true);
    setOriginalData(null);

    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0);

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

  // Apply color replacement
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !originalData) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const imageData = new ImageData(
      new Uint8ClampedArray(originalData.data),
      originalData.width,
      originalData.height
    );
    const data = imageData.data;

    // Parse target colors
    const targetFace = parseColor(faceColor);
    const targetAccent = accentColor ? parseColor(accentColor) : null;
    const targetLed = parseColor(ledColor);
    const targetLedHsl = rgbToHsl(targetLed.r, targetLed.g, targetLed.b);

    const width = originalData.width;
    const height = originalData.height;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (a < 10) continue;

      const { h, s, l } = rgbToHsl(r, g, b);

      // Calculate pixel position
      const pixelIndex = i / 4;
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);

      // 1. BLACK pixels (LED display backgrounds) - L < 12%
      if (l < 0.12) {
        continue; // Keep black
      }

      // 2. LED pixels (warm red/amber colors) - include antialiasing pixels
      // More inclusive detection to catch edge glow pixels too
      const isWarmHue = h < 0.15 || h > 0.85;
      const isLedPixel = isWarmHue && r > g && r > b && r > 80 && (r - b > 20);

      if (isLedPixel && l > 0.12 && l < 0.90) {
        // Shift hue to target LED color, preserve saturation and luminosity
        const newRgb = hslToRgb(targetLedHsl.h, Math.max(s, targetLedHsl.s * 0.5), l);
        data[i] = newRgb.r;
        data[i + 1] = newRgb.g;
        data[i + 2] = newRgb.b;
        continue;
      }

      // 3. WHITE pixels (L > 95%) - check if it's a FRAME LINE or TEXT
      // Frame lines detected from image analysis:
      // - Outer horizontal: Y=6-10 (top), Y=280-284 (bottom section)
      // - Inner section (BALL/STRIKE/OUT): Y=22-27 (top), Y=199-203 (bottom)
      // - Vertical: X=66-69 (left), X=548-551 (right)
      if (l > 0.95) {
        // All horizontal frames span the full width between vertical frames
        const isOuterHorizontalFrame =
          ((y >= 6 && y <= 10) || (y >= 280 && y <= 284)) &&
          (x >= 66 && x <= 551);

        // Inner horizontal frames also span full width to connect with vertical frames
        const isInnerHorizontalFrame =
          ((y >= 22 && y <= 27) || (y >= 199 && y <= 203)) &&
          (x >= 66 && x <= 551);

        // Vertical frames span the full height
        const isVerticalFrame =
          ((x >= 66 && x <= 69) || (x >= 548 && x <= 551)) &&
          (y >= 6 && y <= 284);

        const isFrameLine = isOuterHorizontalFrame || isInnerHorizontalFrame || isVerticalFrame;

        if (isFrameLine && targetAccent) {
          data[i] = targetAccent.r;
          data[i + 1] = targetAccent.g;
          data[i + 2] = targetAccent.b;
        }
        // else keep white as-is (text)
        continue;
      }

      // 4. GRAY pixels (L > 60%, S < 15%) - TEXT, keep unchanged
      if (s < 0.15 && l > 0.60) {
        continue; // Don't touch text
      }

      // 5. COLORED/SATURATED pixels - check if OUTER PERIMETER (accent) or FACE
      if (s > 0.15) {
        // Outer perimeter frame only - don't create frames that don't exist
        const outerFrameThickness = 6;
        const isOuterPerimeter =
          x < outerFrameThickness ||
          x >= width - outerFrameThickness ||
          y < outerFrameThickness ||
          y >= height - outerFrameThickness;

        if (isOuterPerimeter && targetAccent) {
          data[i] = targetAccent.r;
          data[i + 1] = targetAccent.g;
          data[i + 2] = targetAccent.b;
        } else {
          data[i] = targetFace.r;
          data[i + 1] = targetFace.g;
          data[i + 2] = targetFace.b;
        }
        continue;
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
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg min-h-[200px]">
          <div className="text-gray-500 text-sm">Loading...</div>
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={`max-w-full h-auto ${loading ? "opacity-0" : "opacity-100"} transition-opacity`}
        style={{
          margin: "0 auto",
          display: "block",
          imageRendering: "crisp-edges"
        }}
      />
    </div>
  );
}
