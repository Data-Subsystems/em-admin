import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET - Check generation progress by session_id
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('session_id');

  if (!sessionId) {
    return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('colorpicker_generation_progress')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      // No progress record found yet - might still be starting
      // or table doesn't exist yet
      return NextResponse.json({
        status: 'pending',
        current_step: 'Starting...',
        step_number: 0,
        progress_percent: 5, // Show some progress to indicate we're waiting
      });
    }

    return NextResponse.json({
      status: data.status,
      current_step: data.current_step,
      step_number: data.step_number,
      total_steps: data.total_steps,
      progress_percent: data.progress_percent,
      result_url: data.result_url,
      error_message: data.error_message,
      started_at: data.started_at,
      completed_at: data.completed_at,
    });
  } catch (error) {
    // If table doesn't exist, return pending status
    console.error('Progress check error:', error);
    return NextResponse.json({
      status: 'pending',
      current_step: 'Connecting...',
      step_number: 0,
      progress_percent: 5,
    });
  }
}
