import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sport = searchParams.get("sport");
    const layout = searchParams.get("layout");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    let query = supabaseAdmin
      .from("scoreboard_models")
      .select("*", { count: "exact" })
      .order("model_name", { ascending: true })
      .range(offset, offset + limit - 1);

    if (sport) {
      query = query.eq("sport_type", sport);
    }
    if (layout) {
      query = query.eq("layout_type", layout);
    }
    if (status) {
      query = query.eq("analysis_status", status);
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      scoreboards: data,
      total: count,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching scoreboards:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch scoreboards" },
      { status: 500 }
    );
  }
}
