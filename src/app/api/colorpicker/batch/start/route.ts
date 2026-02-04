import { NextRequest, NextResponse } from 'next/server';

const MODAL_ENDPOINT = 'https://shortov--colorpicker-batch-generator-start-batch-processing.modal.run';

// POST - Start batch processing via Modal
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { batch_size = 100, max_parallel = 100, max_tasks } = body;

    const response = await fetch(MODAL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batch_size,
        max_parallel,
        max_tasks,
      }),
    });

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
