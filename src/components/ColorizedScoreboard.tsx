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

  // Apply color replacement using layer-based approach
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !originalData) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const width = originalData.width;
    const height = originalData.height;
    const srcData = originalData.data;

    // Parse target colors
    const targetFace = parseColor(faceColor);
    const targetAccent = accentColor ? parseColor(accentColor) : null;
    const targetLed = parseColor(ledColor);
    const targetLedHsl = rgbToHsl(targetLed.r, targetLed.g, targetLed.b);

    // Step 1: Find the dominant saturated color (this is the FACE color)
    // This prevents red/orange faces from being detected as LEDs
    const colorCounts = new Map<string, number>();

    for (let i = 0; i < srcData.length; i += 4) {
      const r = srcData[i];
      const g = srcData[i + 1];
      const b = srcData[i + 2];
      const a = srcData[i + 3];

      if (a < 10) continue;

      const { s, l } = rgbToHsl(r, g, b);

      // Only count saturated, non-black, non-white pixels
      if (s > 0.20 && l > 0.15 && l < 0.85) {
        // Quantize to reduce variations (group similar colors)
        const qr = Math.round(r / 20) * 20;
        const qg = Math.round(g / 20) * 20;
        const qb = Math.round(b / 20) * 20;
        const key = `${qr},${qg},${qb}`;
        colorCounts.set(key, (colorCounts.get(key) || 0) + 1);
      }
    }

    // Find the dominant face color
    let dominantFaceColor = { r: 0, g: 0, b: 0 };
    let maxCount = 0;
    for (const [key, count] of colorCounts) {
      if (count > maxCount) {
        maxCount = count;
        const [r, g, b] = key.split(',').map(Number);
        dominantFaceColor = { r, g, b };
      }
    }

    // Helper: Check if a color is similar to the dominant face color
    const isSimilarToFace = (r: number, g: number, b: number): boolean => {
      const tolerance = 60; // Allow some variation
      return Math.abs(r - dominantFaceColor.r) < tolerance &&
             Math.abs(g - dominantFaceColor.g) < tolerance &&
             Math.abs(b - dominantFaceColor.b) < tolerance;
    };

    // Step 2: Classify each pixel into layers
    const layers = new Uint8Array(width * height); // 0=transparent, 1=black, 2=face, 3=striping, 4=label, 5=digit

    for (let i = 0; i < srcData.length; i += 4) {
      const r = srcData[i];
      const g = srcData[i + 1];
      const b = srcData[i + 2];
      const a = srcData[i + 3];
      const pixelIndex = i / 4;

      if (a < 10) {
        layers[pixelIndex] = 0; // Transparent
        continue;
      }

      const { h, s, l } = rgbToHsl(r, g, b);

      // Classification priority (order matters):

      // 1. BLACK - LED backgrounds (very dark)
      if (l < 0.12) {
        layers[pixelIndex] = 1;
        continue;
      }

      // 2. FACE - Check if similar to dominant face color FIRST
      // This prevents red/orange faces from being misclassified as LEDs
      if (isSimilarToFace(r, g, b)) {
        layers[pixelIndex] = 2;
        continue;
      }

      // 3. DIGIT - LED pixels (warm red/amber hue, red-dominant)
      // Only if NOT similar to face color
      const isWarmHue = h < 0.15 || h > 0.85;
      if (isWarmHue && r > g && r > b && r > 80 && (r - b > 20) && l < 0.90) {
        layers[pixelIndex] = 5;
        continue;
      }

      // 4. STRIPING - Pure white pixels (frame lines)
      if (r >= 250 && g >= 250 && b >= 250) {
        layers[pixelIndex] = 3;
        continue;
      }

      // 5. LABEL - Gray/light desaturated pixels (text)
      if (s < 0.15 && l > 0.50) {
        layers[pixelIndex] = 4;
        continue;
      }

      // 6. FACE - Any other saturated colored pixels
      if (s > 0.10) {
        layers[pixelIndex] = 2;
        continue;
      }

      // Default: treat as face
      layers[pixelIndex] = 2;
    }

    // Step 2: Render layers to output
    const imageData = new ImageData(width, height);
    const outData = imageData.data;

    for (let i = 0; i < srcData.length; i += 4) {
      const pixelIndex = i / 4;
      const layer = layers[pixelIndex];
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);

      // Get original pixel values for reference
      const origR = srcData[i];
      const origG = srcData[i + 1];
      const origB = srcData[i + 2];
      const origA = srcData[i + 3];

      switch (layer) {
        case 0: // Transparent
          outData[i] = 0;
          outData[i + 1] = 0;
          outData[i + 2] = 0;
          outData[i + 3] = 0;
          break;

        case 1: // Black (LED background)
          outData[i] = origR;
          outData[i + 1] = origG;
          outData[i + 2] = origB;
          outData[i + 3] = origA;
          break;

        case 2: // Face (background)
          // Outer perimeter gets accent color if set
          const outerFrameThickness = 6;
          const isOuterPerimeter =
            x < outerFrameThickness ||
            x >= width - outerFrameThickness ||
            y < outerFrameThickness ||
            y >= height - outerFrameThickness;

          if (isOuterPerimeter && targetAccent) {
            outData[i] = targetAccent.r;
            outData[i + 1] = targetAccent.g;
            outData[i + 2] = targetAccent.b;
          } else {
            outData[i] = targetFace.r;
            outData[i + 1] = targetFace.g;
            outData[i + 2] = targetFace.b;
          }
          outData[i + 3] = origA;
          break;

        case 3: // Striping (frame lines)
          if (targetAccent) {
            outData[i] = targetAccent.r;
            outData[i + 1] = targetAccent.g;
            outData[i + 2] = targetAccent.b;
          } else {
            outData[i] = origR;
            outData[i + 1] = origG;
            outData[i + 2] = origB;
          }
          outData[i + 3] = origA;
          break;

        case 4: // Label (text) - keep original
          outData[i] = origR;
          outData[i + 1] = origG;
          outData[i + 2] = origB;
          outData[i + 3] = origA;
          break;

        case 5: // Digit (LED)
          const { s, l } = rgbToHsl(origR, origG, origB);
          const newRgb = hslToRgb(targetLedHsl.h, Math.max(s, targetLedHsl.s * 0.5), l);
          outData[i] = newRgb.r;
          outData[i + 1] = newRgb.g;
          outData[i + 2] = newRgb.b;
          outData[i + 3] = origA;
          break;
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
