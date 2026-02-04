import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET - Get batch processing status and model list
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const model = searchParams.get('model');

  const supabase = getSupabaseAdmin();

  // If model specified, get all completed images for that model
  if (model) {
    const { data: tasks } = await supabase
      .from('colorpicker_tasks')
      .select('*')
      .eq('model', model)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false });

    return NextResponse.json({ tasks: tasks || [] });
  }

  // Get overall stats
  const { count: totalCount } = await supabase
    .from('colorpicker_tasks')
    .select('*', { count: 'exact', head: true });

  const { count: completedCount } = await supabase
    .from('colorpicker_tasks')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'completed');

  const { count: failedCount } = await supabase
    .from('colorpicker_tasks')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'failed');

  const { count: pendingCount } = await supabase
    .from('colorpicker_tasks')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  const { count: processingCount } = await supabase
    .from('colorpicker_tasks')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'processing');

  // Get per-model progress
  const { data: modelStats } = await supabase
    .from('colorpicker_tasks')
    .select('model, status')
    .limit(50000);

  // Aggregate by model
  const modelProgress: Record<string, { total: number; completed: number; failed: number; pending: number }> = {};
  modelStats?.forEach((task) => {
    if (!modelProgress[task.model]) {
      modelProgress[task.model] = { total: 0, completed: 0, failed: 0, pending: 0 };
    }
    modelProgress[task.model].total++;
    if (task.status === 'completed') modelProgress[task.model].completed++;
    if (task.status === 'failed') modelProgress[task.model].failed++;
    if (task.status === 'pending') modelProgress[task.model].pending++;
  });

  // Get recent batches
  const { data: batches } = await supabase
    .from('colorpicker_batches')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  return NextResponse.json({
    stats: {
      total: totalCount || 0,
      completed: completedCount || 0,
      failed: failedCount || 0,
      pending: pendingCount || 0,
      processing: processingCount || 0,
      percentComplete: totalCount ? Math.round(((completedCount || 0) / totalCount) * 100 * 100) / 100 : 0,
    },
    models: Object.entries(modelProgress)
      .map(([model, stats]) => ({
        model,
        ...stats,
        percentComplete: stats.total ? Math.round((stats.completed / stats.total) * 100) : 0,
      }))
      .sort((a, b) => b.percentComplete - a.percentComplete || a.model.localeCompare(b.model)),
    batches: batches || [],
  });
}

// POST - Stop batch processing
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action } = body;

  const supabase = getSupabaseAdmin();

  if (action === 'stop') {
    // Mark all processing tasks as pending to stop current batch
    const { error } = await supabase
      .from('colorpicker_tasks')
      .update({ status: 'pending', container_id: null })
      .eq('status', 'processing');

    // Mark running batches as stopped
    await supabase
      .from('colorpicker_batches')
      .update({ status: 'stopped' })
      .eq('status', 'running');

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Batch processing stopped. Processing tasks reset to pending.',
    });
  }

  if (action === 'reset-failed') {
    // Reset failed tasks to pending for retry
    const { data, error } = await supabase
      .from('colorpicker_tasks')
      .update({ status: 'pending', error_message: null, attempts: 0 })
      .eq('status', 'failed')
      .select('id');

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Reset ${data?.length || 0} failed tasks to pending.`,
    });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
