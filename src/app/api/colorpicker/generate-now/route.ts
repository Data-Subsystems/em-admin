import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 300; // 5 minutes

// POST - Generate image immediately via Modal
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

    // Call Modal function via CLI
    const { spawn } = await import('child_process');

    const result = await new Promise<{ success: boolean; url?: string; error?: string; duration_ms?: number }>((resolve) => {
      const args = [
        'run',
        'modal_functions/colorpicker_batch.py::generate_single_image',
        '--model', model,
        '--primary', primaryColor,
        '--accent', accentColor,
        '--leds', ledColor,
      ];

      let stdout = '';
      let stderr = '';

      const proc = spawn('modal', args, {
        cwd: process.cwd(),
        env: process.env,
      });

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          console.error('Modal error:', stderr);
          resolve({ success: false, error: stderr || 'Modal execution failed' });
          return;
        }

        // Parse the JSON result from stdout
        try {
          // Find JSON in output (Modal adds extra output)
          const jsonMatch = stdout.match(/\{[\s\S]*"success"[\s\S]*\}/);
          if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            resolve(result);
          } else {
            // Try to find URL in output
            const urlMatch = stdout.match(/https:\/\/em-admin-assets\.s3\.us-east-1\.amazonaws\.com\/[^\s"]+/);
            if (urlMatch) {
              resolve({ success: true, url: urlMatch[0] });
            } else {
              resolve({ success: false, error: 'Could not parse Modal output' });
            }
          }
        } catch (e) {
          resolve({ success: false, error: `Parse error: ${e}` });
        }
      });

      // Timeout after 4 minutes
      setTimeout(() => {
        proc.kill();
        resolve({ success: false, error: 'Timeout' });
      }, 240000);
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
