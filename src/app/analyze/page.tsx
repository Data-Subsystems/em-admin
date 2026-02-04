"use client";

import { useEffect, useRef, useState } from "react";

interface ColorInfo {
  rgb: string;
  hex: string;
  count: number;
  r: number;
  g: number;
  b: number;
  h: number;
  s: number;
  l: number;
}

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
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h, s, l };
}

export default function AnalyzePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [colors, setColors] = useState<ColorInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredPixel, setHoveredPixel] = useState<{ x: number; y: number; color: ColorInfo } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    setLoading(true);
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Collect unique colors
      const colorCounts = new Map<string, { count: number; r: number; g: number; b: number }>();

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        if (a < 10) continue;

        const key = `${r},${g},${b}`;
        const existing = colorCounts.get(key);
        if (existing) {
          existing.count++;
        } else {
          colorCounts.set(key, { count: 1, r, g, b });
        }
      }

      // Sort by frequency and convert to array
      const sorted = [...colorCounts.entries()]
        .map(([key, val]) => {
          const hsl = rgbToHsl(val.r, val.g, val.b);
          const hex = "#" + [val.r, val.g, val.b].map(c => c.toString(16).padStart(2, "0")).join("");
          return {
            rgb: key,
            hex,
            count: val.count,
            r: val.r,
            g: val.g,
            b: val.b,
            ...hsl,
          };
        })
        .sort((a, b) => b.count - a.count);

      setColors(sorted);
      setLoading(false);
    };

    img.onerror = () => {
      console.error("Failed to load image");
      setLoading(false);
    };

    img.src = "/api/images/lx1020-tcart.png";
  }, []);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    const pixel = ctx.getImageData(x, y, 1, 1).data;
    const r = pixel[0];
    const g = pixel[1];
    const b = pixel[2];
    const hsl = rgbToHsl(r, g, b);
    const hex = "#" + [r, g, b].map(c => c.toString(16).padStart(2, "0")).join("");

    setHoveredPixel({
      x,
      y,
      color: {
        rgb: `${r},${g},${b}`,
        hex,
        count: 0,
        r, g, b,
        ...hsl,
      },
    });
  };

  const categorizeColor = (c: ColorInfo): string => {
    // Black (LED background)
    if (c.l < 0.08) return "BLACK (LED bg)";

    // Pure white (borders)
    if (c.l > 0.95 && c.s < 0.1) return "WHITE (border)";

    // Light gray (could be border or label)
    if (c.l > 0.85 && c.s < 0.15) return "LIGHT (border/label?)";

    // Warm colors with high red (LEDs)
    if (c.r > 180 && c.r > c.g && c.r - c.b > 80 && c.l > 0.3) return "LED (red/amber)";

    // Dark maroon (existing labels)
    if (c.h < 0.1 || c.h > 0.9) {
      if (c.l > 0.1 && c.l < 0.35 && c.s > 0.3) return "MAROON (label)";
    }

    // Medium saturation, colored = face
    if (c.s > 0.15 && c.l > 0.15 && c.l < 0.85) return "FACE";

    return "OTHER";
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <h1 className="text-2xl font-bold mb-4">Scoreboard Image Analyzer</h1>

      <div className="flex gap-4">
        <div className="flex-1">
          <h2 className="font-semibold mb-2">Original Image (click to sample)</h2>
          <div className="bg-white p-2 rounded shadow">
            {loading && <div className="text-gray-500 p-4">Loading...</div>}
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              className="max-w-full cursor-crosshair"
              style={{ imageRendering: "pixelated" }}
            />
          </div>

          {hoveredPixel && (
            <div className="mt-4 p-4 bg-white rounded shadow">
              <h3 className="font-semibold">Clicked Pixel ({hoveredPixel.x}, {hoveredPixel.y})</h3>
              <div className="flex items-center gap-2 mt-2">
                <div
                  className="w-12 h-12 border-2 border-gray-300"
                  style={{ backgroundColor: hoveredPixel.color.hex }}
                />
                <div className="text-sm">
                  <div><strong>RGB:</strong> {hoveredPixel.color.r}, {hoveredPixel.color.g}, {hoveredPixel.color.b}</div>
                  <div><strong>Hex:</strong> {hoveredPixel.color.hex}</div>
                  <div><strong>HSL:</strong> H={Math.round(hoveredPixel.color.h * 360)}° S={Math.round(hoveredPixel.color.s * 100)}% L={Math.round(hoveredPixel.color.l * 100)}%</div>
                  <div><strong>Category:</strong> {categorizeColor(hoveredPixel.color)}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="w-96 max-h-screen overflow-auto">
          <h2 className="font-semibold mb-2">Color Analysis ({colors.length} unique colors)</h2>
          <div className="bg-white rounded shadow">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-200">
                <tr>
                  <th className="p-1 text-left">Color</th>
                  <th className="p-1 text-left">Count</th>
                  <th className="p-1 text-left">RGB</th>
                  <th className="p-1 text-left">HSL</th>
                  <th className="p-1 text-left">Category</th>
                </tr>
              </thead>
              <tbody>
                {colors.slice(0, 100).map((c, i) => (
                  <tr key={i} className="border-t hover:bg-gray-50">
                    <td className="p-1">
                      <div
                        className="w-6 h-6 border border-gray-300"
                        style={{ backgroundColor: c.hex }}
                      />
                    </td>
                    <td className="p-1">{c.count}</td>
                    <td className="p-1 font-mono">{c.r},{c.g},{c.b}</td>
                    <td className="p-1 font-mono">
                      {Math.round(c.h * 360)}° {Math.round(c.s * 100)}% {Math.round(c.l * 100)}%
                    </td>
                    <td className="p-1">{categorizeColor(c)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
