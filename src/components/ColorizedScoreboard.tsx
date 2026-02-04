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
      const isWarmHue = h < 0.15 || h > 0.85;
      const isLedPixel = isWarmHue && r > g && r > b && r > 80 && (r - b > 20);

      if (isLedPixel && l > 0.12 && l < 0.90) {
        const newRgb = hslToRgb(targetLedHsl.h, Math.max(s, targetLedHsl.s * 0.5), l);
        data[i] = newRgb.r;
        data[i + 1] = newRgb.g;
        data[i + 2] = newRgb.b;
        continue;
      }

      // 3. LIGHT pixels (L > 50%, S < 25%) - could be FRAME or TEXT
      // Check frame position FIRST before assuming it's text
      if (s < 0.25 && l > 0.50) {
        // Frame positions (relative to image dimensions for flexibility)
        const outerFrameThickness = Math.max(6, Math.round(width * 0.01));

        // Outer perimeter (very edge of scoreboard)
        const isOuterPerimeter =
          x < outerFrameThickness ||
          x >= width - outerFrameThickness ||
          y < outerFrameThickness ||
          y >= height - outerFrameThickness;

        // Inner horizontal frame lines (BALL/STRIKE/OUT section borders)
        // These run across the full width
        const innerFrameTop1 = Math.round(height * 0.04);    // ~22 for 550px
        const innerFrameTop2 = Math.round(height * 0.05);    // ~28 for 550px
        const innerFrameBot1 = Math.round(height * 0.36);    // ~198 for 550px
        const innerFrameBot2 = Math.round(height * 0.37);    // ~204 for 550px

        const isInnerHorizontalFrame =
          ((y >= innerFrameTop1 && y <= innerFrameTop2) ||
           (y >= innerFrameBot1 && y <= innerFrameBot2));

        // Vertical frame lines at left and right edges (inside outer perimeter)
        const vertFrameLeft1 = Math.round(width * 0.11);     // ~64 for 579px
        const vertFrameLeft2 = Math.round(width * 0.12);     // ~70 for 579px
        const vertFrameRight1 = Math.round(width * 0.94);    // ~544 for 579px
        const vertFrameRight2 = Math.round(width * 0.96);    // ~556 for 579px

        const isVerticalFrame =
          ((x >= vertFrameLeft1 && x <= vertFrameLeft2) ||
           (x >= vertFrameRight1 && x <= vertFrameRight2)) &&
          y > outerFrameThickness && y < height - outerFrameThickness;

        const isFrameLine = isOuterPerimeter || isInnerHorizontalFrame || isVerticalFrame;

        if (isFrameLine && targetAccent) {
          data[i] = targetAccent.r;
          data[i + 1] = targetAccent.g;
          data[i + 2] = targetAccent.b;
        }
        // else: it's text - keep unchanged
        continue;
      }

      // 4. COLORED/SATURATED pixels - this is the FACE background
      if (s > 0.15) {
        // Check outer perimeter for accent color
        const outerFrameThickness = Math.max(6, Math.round(width * 0.01));
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
