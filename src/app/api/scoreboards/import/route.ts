import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const COLORS_URL = "https://www.electro-mech.com/wp-content/uploads/manuals/scoreboard-colors.txt";
const S3_BUCKET_URL = process.env.S3_BUCKET_URL || "https://em-admin-assets.s3.us-east-1.amazonaws.com";

interface ColorEntry {
  name: string;
  "scoreboard-face": Record<string, string>;
  "accent-striping": Record<string, string>;
  "led-color": Record<string, string> | "none";
}

export async function POST(request: NextRequest) {
  try {
    // Fetch colors JSON from remote URL
    const response = await fetch(COLORS_URL);
    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch colors: ${response.statusText}` },
        { status: 500 }
      );
    }

    const colors: ColorEntry[] = await response.json();

    // Deduplicate by lowercase filename
    const seenNames = new Set<string>();
    const uniqueColors: ColorEntry[] = [];

    for (const entry of colors) {
      const lowerName = entry.name.toLowerCase();
      if (!seenNames.has(lowerName)) {
        seenNames.add(lowerName);
        uniqueColors.push(entry);
      }
    }

    // Prepare records for insertion
    const records = uniqueColors.map((entry) => {
      // Extract model name (remove .png extension)
      const filename = entry.name;
      const modelName = filename.replace(/\.png$/i, "").toLowerCase();

      return {
        model_name: modelName,
        image_filename: filename.toLowerCase(),
        image_url: `${S3_BUCKET_URL}/${filename.toLowerCase()}`,
        color_config: {
          "scoreboard-face": entry["scoreboard-face"],
          "accent-striping": entry["accent-striping"],
          "led-color": entry["led-color"],
        },
        analysis_status: "pending",
      };
    });

    // Upsert records (update if exists, insert if not)
    const { data, error } = await supabaseAdmin
      .from("em_scoreboard_models")
      .upsert(records, {
        onConflict: "model_name",
        ignoreDuplicates: false,
      })
      .select();

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      imported: records.length,
      s3_bucket: S3_BUCKET_URL,
    });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Get count of scoreboards
    const { count, error } = await supabaseAdmin
      .from("em_scoreboard_models")
      .select("*", { count: "exact", head: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      total: count || 0,
      colors_url: COLORS_URL,
      s3_bucket: S3_BUCKET_URL,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get status" },
      { status: 500 }
    );
  }
}
