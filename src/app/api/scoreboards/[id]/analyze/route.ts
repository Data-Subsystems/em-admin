import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { analyzeScoreboardImage } from "@/lib/bedrock";
import path from "path";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get the scoreboard record
    const { data: scoreboard, error: fetchError } = await supabaseAdmin
      .from("scoreboard_models")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !scoreboard) {
      return NextResponse.json(
        { error: "Scoreboard not found" },
        { status: 404 }
      );
    }

    // Update status to processing
    await supabaseAdmin
      .from("scoreboard_models")
      .update({ analysis_status: "processing" })
      .eq("id", id);

    try {
      // Analyze the image
      const imagePath = path.join(
        process.cwd(),
        "scoreboard-images",
        scoreboard.image_filename
      );

      const analysis = await analyzeScoreboardImage(imagePath);

      // Update with analysis results
      const { data: updated, error: updateError } = await supabaseAdmin
        .from("scoreboard_models")
        .update({
          sport_type: analysis.sport_type,
          dimensions: analysis.dimensions,
          layout_type: analysis.layout_type,
          zones: analysis.zones,
          customizable_areas: analysis.customizable_areas,
          features: analysis.features,
          analysis_raw: analysis,
          analysis_status: "completed",
          analyzed_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      return NextResponse.json({
        success: true,
        scoreboard: updated,
      });
    } catch (analysisError) {
      // Update with error status
      await supabaseAdmin
        .from("scoreboard_models")
        .update({
          analysis_status: "error",
          analysis_error:
            analysisError instanceof Error
              ? analysisError.message
              : "Analysis failed",
        })
        .eq("id", id);

      throw analysisError;
    }
  } catch (error) {
    console.error("Error analyzing scoreboard:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Analysis failed",
      },
      { status: 500 }
    );
  }
}
