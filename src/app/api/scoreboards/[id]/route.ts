import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Try to find by ID first, then by model_name
    let query = supabaseAdmin
      .from("em_scoreboard_models")
      .select("*");

    // Check if it looks like a UUID
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    if (isUUID) {
      query = query.eq("id", id);
    } else {
      query = query.eq("model_name", id.toLowerCase());
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Scoreboard not found" }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching scoreboard:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch scoreboard" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { data, error } = await supabaseAdmin
      .from("em_scoreboard_models")
      .update(body)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error updating scoreboard:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update scoreboard" },
      { status: 500 }
    );
  }
}
