import { NextResponse } from 'next/server';
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

// POST - Generate all color combinations for ALL models that don't have them yet
export async function POST() {
  try {
    const supabase = getSupabaseAdmin();

    // Get all scoreboard models
    const { data: scoreboards, error: scoreboardError } = await supabase
      .from('em_scoreboard_models')
      .select('model_name');

    if (scoreboardError) {
      return NextResponse.json({ error: scoreboardError.message }, { status: 500 });
    }

    if (!scoreboards || scoreboards.length === 0) {
      return NextResponse.json({ error: 'No scoreboards found' }, { status: 404 });
    }

    // Get all existing tasks
    const { data: existingTasks, error: tasksError } = await supabase
      .from('colorpicker_tasks')
      .select('model, primary_color, accent_color, led_color, status');

    if (tasksError) {
      return NextResponse.json({ error: tasksError.message }, { status: 500 });
    }

    // Build a set of existing task keys
    const existingSet = new Set(
      existingTasks?.map(t => `${t.model}-${t.primary_color}-${t.accent_color}-${t.led_color}`) || []
    );

    // Count failed tasks that will be reset
    const failedTasks = existingTasks?.filter(t => t.status === 'failed') || [];
    const failedSet = new Set(
      failedTasks.map(t => `${t.model}-${t.primary_color}-${t.accent_color}-${t.led_color}`)
    );

    // Generate all combinations for all models
    const newTasks: Array<{
      model: string;
      primary_color: string;
      accent_color: string;
      led_color: string;
      width: number;
      status: string;
    }> = [];

    const models = scoreboards.map(s => s.model_name);

    for (const model of models) {
      for (const primary of UI_COLORS) {
        for (const accent of ACCENT_COLORS) {
          for (const led of LED_COLORS) {
            const key = `${model}-${primary}-${accent}-${led}`;
            // Only add if not already exists (or if it exists but was not completed)
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
    }

    // Reset failed tasks to pending
    let resetCount = 0;
    if (failedTasks.length > 0) {
      const { data: resetData } = await supabase
        .from('colorpicker_tasks')
        .update({ status: 'pending', error_message: null, attempts: 0 })
        .eq('status', 'failed')
        .select('id');
      resetCount = resetData?.length || 0;
    }

    // Insert new tasks in batches
    if (newTasks.length > 0) {
      const batchSize = 500;
      for (let i = 0; i < newTasks.length; i += batchSize) {
        const batch = newTasks.slice(i, i + batchSize);
        await supabase.from('colorpicker_tasks').insert(batch);
      }
    }

    const totalCombinations = models.length * UI_COLORS.length * ACCENT_COLORS.length * LED_COLORS.length;
    const existingCount = existingSet.size;

    return NextResponse.json({
      success: true,
      models: models.length,
      totalCombinations,
      existingTasks: existingCount,
      failedTasksReset: resetCount,
      newTasksCreated: newTasks.length,
      message: newTasks.length > 0 || resetCount > 0
        ? `Created ${newTasks.length} new tasks, reset ${resetCount} failed tasks. Click "Start Processing" to begin.`
        : 'All combinations already queued or completed.',
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET - Get total pending/incomplete status
export async function GET() {
  const supabase = getSupabaseAdmin();

  // Get counts
  const { count: totalModels } = await supabase
    .from('em_scoreboard_models')
    .select('*', { count: 'exact', head: true });

  const { count: totalTasks } = await supabase
    .from('colorpicker_tasks')
    .select('*', { count: 'exact', head: true });

  const { count: pendingTasks } = await supabase
    .from('colorpicker_tasks')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  const { count: failedTasks } = await supabase
    .from('colorpicker_tasks')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'failed');

  const { count: completedTasks } = await supabase
    .from('colorpicker_tasks')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'completed');

  const expectedTotal = (totalModels || 0) * 684; // 18 × 19 × 2 = 684

  return NextResponse.json({
    totalModels: totalModels || 0,
    expectedTotal,
    currentTotal: totalTasks || 0,
    pending: pendingTasks || 0,
    failed: failedTasks || 0,
    completed: completedTasks || 0,
    missingTasks: expectedTotal - (totalTasks || 0),
  });
}
