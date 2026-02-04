import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// POST - Reset stuck processing tasks
export async function POST() {
  const supabase = getSupabaseAdmin();

  // Reset tasks that have been processing for more than 5 minutes
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('colorpicker_tasks')
    .update({ status: 'pending' })
    .eq('status', 'processing')
    .lt('updated_at', fiveMinutesAgo)
    .select('id, model, primary_color, accent_color, led_color');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    reset: data?.length || 0,
    tasks: data,
  });
}
