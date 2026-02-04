import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

export const maxDuration = 300; // 5 minutes

const MODAL_ENDPOINT = 'https://shortov--colorpicker-batch-generator-generate-single-image.modal.run';

// POST - Generate image immediately via Modal
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { model, primary, accent, led, session_id } = body;

    if (!model) {
      return NextResponse.json({ error: 'Model is required' }, { status: 400 });
    }

    const primaryColor = primary || 'navy_blue';
    const accentColor = accent || 'royal_blue';
    const ledColor = led || 'amber';

    // Generate session_id for progress tracking if not provided
    const sessionId = session_id || randomUUID();

    // Call Modal endpoint
    const response = await fetch(MODAL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        primary: primaryColor,
        accent: accentColor,
        leds: ledColor,
        session_id: sessionId,
      }),
    });

    const result = await response.json();
    return NextResponse.json({
      ...result,
      session_id: sessionId,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
