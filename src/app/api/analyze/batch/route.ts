import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { analyzeScoreboardImage } from "@/lib/bedrock";
import path from "path";

export const maxDuration = 300; // 5 minutes max for Vercel

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const limit = body.limit || 10; // Process 10 at a time by default
    const forceReanalyze = body.forceReanalyze || false;

    // Create a job record
    const { data: job, error: jobError } = await supabaseAdmin
      .from("em_analysis_jobs")
      .insert({
        status: "running",
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (jobError) {
      return NextResponse.json({ error: jobError.message }, { status: 500 });
    }

    // Get scoreboards to analyze
    let query = supabaseAdmin
      .from("em_scoreboard_models")
      .select("*")
      .limit(limit);

    if (!forceReanalyze) {
      query = query.eq("analysis_status", "pending");
    }

    const { data: scoreboards, error: fetchError } = await query;

    if (fetchError) {
      await supabaseAdmin
        .from("em_analysis_jobs")
        .update({ status: "failed", error_message: fetchError.message })
        .eq("id", job.id);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!scoreboards || scoreboards.length === 0) {
      await supabaseAdmin
        .from("em_analysis_jobs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          total_images: 0,
        })
        .eq("id", job.id);

      return NextResponse.json({
        jobId: job.id,
        message: "No scoreboards to analyze",
        processed: 0,
      });
    }

    // Update job with total count
    await supabaseAdmin
      .from("em_analysis_jobs")
      .update({ total_images: scoreboards.length })
      .eq("id", job.id);

    let processedCount = 0;
    let errorCount = 0;
    const results: Array<{ model_name: string; status: string; error?: string }> = [];

    // Process each scoreboard
    for (const scoreboard of scoreboards) {
      try {
        // Update status to processing
        await supabaseAdmin
          .from("em_scoreboard_models")
          .update({ analysis_status: "processing" })
          .eq("id", scoreboard.id);

        // Analyze the image
        const imagePath = path.join(
          process.cwd(),
          "scoreboard-images",
          scoreboard.image_filename
        );

        const analysis = await analyzeScoreboardImage(imagePath);

        // Update with analysis results
        await supabaseAdmin
          .from("em_scoreboard_models")
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
          .eq("id", scoreboard.id);

        processedCount++;
        results.push({ model_name: scoreboard.model_name, status: "success" });

        // Update job progress
        await supabaseAdmin
          .from("em_analysis_jobs")
          .update({ processed_images: processedCount, error_count: errorCount })
          .eq("id", job.id);

        // Small delay between requests
        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (error) {
        errorCount++;
        const errorMessage = error instanceof Error ? error.message : "Unknown error";

        await supabaseAdmin
          .from("em_scoreboard_models")
          .update({
            analysis_status: "error",
            analysis_error: errorMessage,
          })
          .eq("id", scoreboard.id);

        results.push({
          model_name: scoreboard.model_name,
          status: "error",
          error: errorMessage,
        });

        // Update job progress
        await supabaseAdmin
          .from("em_analysis_jobs")
          .update({ processed_images: processedCount, error_count: errorCount })
          .eq("id", job.id);
      }
    }

    // Mark job as completed
    await supabaseAdmin
      .from("em_analysis_jobs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        processed_images: processedCount,
        error_count: errorCount,
      })
      .eq("id", job.id);

    return NextResponse.json({
      jobId: job.id,
      processed: processedCount,
      errors: errorCount,
      results,
    });
  } catch (error) {
    console.error("Batch analysis error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Batch analysis failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Get the latest job status
    const { data: jobs, error } = await supabaseAdmin
      .from("em_analysis_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get analysis status counts
    const { data: statusCounts, error: countError } = await supabaseAdmin
      .from("em_scoreboard_models")
      .select("analysis_status")
      .then((result) => {
        if (result.error) return result;
        const counts: Record<string, number> = {};
        for (const row of result.data || []) {
          const status = row.analysis_status || "unknown";
          counts[status] = (counts[status] || 0) + 1;
        }
        return { data: counts, error: null };
      });

    return NextResponse.json({
      jobs,
      statusCounts: statusCounts || {},
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get status" },
      { status: 500 }
    );
  }
}
