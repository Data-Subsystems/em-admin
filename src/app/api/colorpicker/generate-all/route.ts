import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

const UI_COLORS = [
  'navy_blue', 'egyptian_blue', 'royal_blue', 'icy_blue',
  'shamrock_green', 'jolly_green', 'hunter_green',
  'silver_gray', 'matte_black', 'white',
  'indigo_purple', 'power_purple',
  'merchant_maroon', 'cardinal_red', 'racing_red',
  'tiger_orange', 'golden_yellow', 'metallic_gold',
];

const ACCENT_COLORS = [...UI_COLORS, 'none'];
const LED_COLORS = ['red', 'amber'];

// POST - Generate all color combinations for a model
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { model } = body;

    if (!model) {
      return NextResponse.json({ error: 'Model is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Get existing tasks for this model
    const { data: existingTasks } = await supabase
      .from('colorpicker_tasks')
      .select('primary_color, accent_color, led_color, status')
      .eq('model', model);

    const existingSet = new Set(
      existingTasks?.map(t => `${t.primary_color}-${t.accent_color}-${t.led_color}`) || []
    );

    // Generate all combinations
    const newTasks: Array<{
      model: string;
      primary_color: string;
      accent_color: string;
      led_color: string;
      width: number;
      status: string;
    }> = [];

    for (const primary of UI_COLORS) {
      for (const accent of ACCENT_COLORS) {
        for (const led of LED_COLORS) {
          const key = `${primary}-${accent}-${led}`;
          if (!existingSet.has(key)) {
            newTasks.push({
              model,
              primary_color: primary,
              accent_color: accent,
              led_color: led,
              width: 720,
              status: 'pending',
            });
          }
        }
      }
    }

    const totalCombinations = UI_COLORS.length * ACCENT_COLORS.length * LED_COLORS.length;
    const existingCount = existingSet.size;
    const completedCount = existingTasks?.filter(t => t.status === 'completed').length || 0;

    // Insert new tasks
    if (newTasks.length > 0) {
      const batchSize = 500;
      for (let i = 0; i < newTasks.length; i += batchSize) {
        const batch = newTasks.slice(i, i + batchSize);
        await supabase.from('colorpicker_tasks').insert(batch);
      }
    }

    return NextResponse.json({
      success: true,
      model,
      totalCombinations,
      existingTasks: existingCount,
      completedTasks: completedCount,
      newTasksCreated: newTasks.length,
      message: newTasks.length > 0
        ? `Created ${newTasks.length} new tasks. Run batch processing to generate.`
        : 'All combinations already queued or completed.',
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET - Get progress for a model
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const model = searchParams.get('model');

  if (!model) {
    return NextResponse.json({ error: 'Model is required' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: tasks } = await supabase
    .from('colorpicker_tasks')
    .select('status')
    .eq('model', model);

  if (!tasks || tasks.length === 0) {
    return NextResponse.json({
      model,
      totalTasks: 0,
      completed: 0,
      pending: 0,
      processing: 0,
      failed: 0,
      percentComplete: 0,
    });
  }

  const stats = {
    total: tasks.length,
    completed: tasks.filter(t => t.status === 'completed').length,
    pending: tasks.filter(t => t.status === 'pending').length,
    processing: tasks.filter(t => t.status === 'processing').length,
    failed: tasks.filter(t => t.status === 'failed').length,
  };

  return NextResponse.json({
    model,
    totalTasks: stats.total,
    ...stats,
    percentComplete: Math.round((stats.completed / stats.total) * 100),
  });
}
