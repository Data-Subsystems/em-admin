import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import fs from "fs";
import path from "path";

interface ColorEntry {
  name: string;
  "scoreboard-face": Record<string, string>;
  "accent-striping": Record<string, string>;
  "led-color": Record<string, string> | "none";
}

export async function POST(request: NextRequest) {
  try {
    // Read the colors JSON file
    const colorsPath = path.join(process.cwd(), "data", "scoreboard-colors.json");
    const colorsData = fs.readFileSync(colorsPath, "utf-8");
    const colors: ColorEntry[] = JSON.parse(colorsData);

    // Get list of images in the scoreboard-images directory
    const imagesDir = path.join(process.cwd(), "scoreboard-images");
    const imageFiles = fs.readdirSync(imagesDir).filter((f) => f.endsWith(".png"));

    // Create a map of image filename to color config
    const colorMap = new Map<string, ColorEntry>();
    for (const entry of colors) {
      // Normalize filename to lowercase for matching
      const filename = entry.name.toLowerCase();
      colorMap.set(filename, entry);
    }

    // Prepare records for insertion
    const records = imageFiles.map((filename) => {
      // Extract model name (remove .png extension)
      const modelName = filename.replace(".png", "").toLowerCase();

      // Find matching color config
      const colorConfig = colorMap.get(filename.toLowerCase());

      return {
        model_name: modelName,
        image_filename: filename,
        image_url: `/scoreboards/${filename}`,
        color_config: colorConfig
          ? {
              "scoreboard-face": colorConfig["scoreboard-face"],
              "accent-striping": colorConfig["accent-striping"],
              "led-color": colorConfig["led-color"],
            }
          : null,
        analysis_status: "pending",
      };
    });

    // Upsert records (update if exists, insert if not)
    const { data, error } = await supabaseAdmin
      .from("scoreboard_models")
      .upsert(records, {
        onConflict: "model_name",
        ignoreDuplicates: false,
      })
      .select();

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Copy images to public folder for serving
    const publicDir = path.join(process.cwd(), "public", "scoreboards");
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    let copiedCount = 0;
    for (const filename of imageFiles) {
      const src = path.join(imagesDir, filename);
      const dest = path.join(publicDir, filename);
      if (!fs.existsSync(dest)) {
        fs.copyFileSync(src, dest);
        copiedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      imported: records.length,
      withColorConfig: records.filter((r) => r.color_config).length,
      imagesCopied: copiedCount,
    });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 500 }
    );
  }
}
