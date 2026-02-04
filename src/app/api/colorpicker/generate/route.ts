import { NextRequest, NextResponse } from 'next/server';
import { S3Client, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSupabaseAdmin } from '@/lib/supabase';

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = 'em-admin-assets';
const S3_BASE_URL = `https://${BUCKET}.s3.us-east-1.amazonaws.com`;

// Check if image exists in S3
async function imageExists(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

// GET - Check if generated image exists
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const model = searchParams.get('model');
  const primary = searchParams.get('primary') || 'navy_blue';
  const accent = searchParams.get('accent') || 'royal_blue';
  const led = searchParams.get('led') || 'amber';

  if (!model) {
    return NextResponse.json({ error: 'Model is required' }, { status: 400 });
  }

  const s3Key = `colorpicker-generated/${model}/${primary}-${accent}-${led}.png`;
  const exists = await imageExists(s3Key);

  if (exists) {
    return NextResponse.json({
      exists: true,
      url: `${S3_BASE_URL}/${s3Key}`,
      s3Key,
    });
  }

  // Check if task exists in database
  const supabase = getSupabaseAdmin();
  const { data: task } = await supabase
    .from('colorpicker_tasks')
    .select('*')
    .eq('model', model)
    .eq('primary_color', primary)
    .eq('accent_color', accent)
    .eq('led_color', led)
    .single();

  return NextResponse.json({
    exists: false,
    task: task || null,
    s3Key,
  });
}

// POST - Create task for generation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { model, primary, accent, led } = body;

    if (!model) {
      return NextResponse.json({ error: 'Model is required' }, { status: 400 });
    }

    const primaryColor = primary || 'navy_blue';
    const accentColor = accent || 'royal_blue';
    const ledColor = led || 'amber';

    const s3Key = `colorpicker-generated/${model}/${primaryColor}-${accentColor}-${ledColor}.png`;

    // Check if already exists
    const exists = await imageExists(s3Key);
    if (exists) {
      return NextResponse.json({
        success: true,
        exists: true,
        url: `${S3_BASE_URL}/${s3Key}`,
        message: 'Image already exists',
      });
    }

    // Create or update task in Supabase
    const supabase = getSupabaseAdmin();

    const { data: existingTask } = await supabase
      .from('colorpicker_tasks')
      .select('*')
      .eq('model', model)
      .eq('primary_color', primaryColor)
      .eq('accent_color', accentColor)
      .eq('led_color', ledColor)
      .single();

    if (existingTask) {
      // Reset to pending if failed
      if (existingTask.status === 'failed') {
        await supabase
          .from('colorpicker_tasks')
          .update({ status: 'pending', error_message: null })
          .eq('id', existingTask.id);
      }

      return NextResponse.json({
        success: true,
        exists: false,
        taskId: existingTask.id,
        status: existingTask.status,
        message: 'Task already exists',
      });
    }

    // Create new task
    const { data: newTask, error } = await supabase
      .from('colorpicker_tasks')
      .insert({
        model,
        primary_color: primaryColor,
        accent_color: accentColor,
        led_color: ledColor,
        width: 720,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      exists: false,
      taskId: newTask.id,
      status: 'pending',
      message: 'Task created - run Modal batch processor to generate',
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
