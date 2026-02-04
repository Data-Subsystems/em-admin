import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET - Debug stuck tasks
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const model = searchParams.get('model');

  const supabase = getSupabaseAdmin();

  // Get non-completed tasks
  let query = supabase
    .from('colorpicker_tasks')
    .select('*')
    .neq('status', 'completed')
    .order('status', { ascending: true });

  if (model) {
    query = query.eq('model', model);
  }

  const { data, error } = await query.limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Group by status
  const byStatus: Record<string, number> = {};
  data?.forEach(t => {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1;
  });

  return NextResponse.json({
    total: data?.length || 0,
    byStatus,
    tasks: data?.map(t => ({
      model: t.model,
      colors: `${t.primary_color}/${t.accent_color}/${t.led_color}`,
      status: t.status,
      attempts: t.attempts,
      error: t.error_message,
      updatedAt: t.updated_at,
    })),
  });
}
