import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import fs from "fs";
import path from "path";

const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const ANALYSIS_PROMPT = `Analyze this scoreboard image and extract the following information in JSON format:

1. **sport_type**: The sport this scoreboard is for (baseball, basketball, football, hockey, soccer, volleyball, wrestling, swimming, track, multi-sport, etc.)

2. **dimensions**: Estimated aspect ratio category (wide, standard, tall)

3. **zones**: Array of distinct zones/sections on the scoreboard. For each zone include:
   - zone_id: Unique identifier (e.g., "guest_score", "home_score", "clock", "period")
   - zone_type: One of: "score_display", "clock_display", "text_label", "indicator_lights", "period_display", "penalty_display", "count_display", "logo_area"
   - label: The text label if visible (e.g., "GUEST", "HOME", "PERIOD", "BALL", "STRIKE", "OUT")
   - position: Approximate position as {x: 0-100, y: 0-100, width: 0-100, height: 0-100} percentages
   - digit_count: Number of digits if it's a numeric display
   - has_colon: true if this is a time display with colon separator

4. **customizable_areas**: Array of areas that can be color-customized:
   - area_id: Unique identifier
   - area_type: "face" (main background), "accent_stripe", "led_display", "text"
   - current_color_hint: Description of the current color visible

5. **layout_type**: Classification of the overall layout:
   - "basic_score": Just scores and maybe clock
   - "baseball_full": Baseball with ball/strike/out
   - "hockey_penalty": Hockey/soccer with penalty timers
   - "basketball_full": Basketball with period, bonus, fouls
   - "multi_sport": Configurable for multiple sports
   - "swimming_track": Lane/heat displays

6. **features**: Array of notable features:
   - "wireless_capable", "shot_clock", "penalty_timers", "pitch_speed", "possession_arrows", etc.

Return ONLY valid JSON, no markdown formatting or explanation.`;

export interface AnalysisResult {
  sport_type: string;
  dimensions: string;
  zones: Array<{
    zone_id: string;
    zone_type: string;
    label?: string;
    position: { x: number; y: number; width: number; height: number };
    digit_count?: number;
    has_colon?: boolean;
  }>;
  customizable_areas: Array<{
    area_id: string;
    area_type: string;
    current_color_hint?: string;
  }>;
  layout_type: string;
  features: string[];
}

export async function analyzeScoreboardImage(
  imagePathOrUrl: string
): Promise<AnalysisResult> {
  let imageBase64: string;
  let mediaType: string = "image/png";

  if (imagePathOrUrl.startsWith("http")) {
    // Fetch from URL
    const response = await fetch(imagePathOrUrl);
    const buffer = await response.arrayBuffer();
    imageBase64 = Buffer.from(buffer).toString("base64");
  } else {
    // Read from file system
    const fullPath = imagePathOrUrl.startsWith("/")
      ? imagePathOrUrl
      : path.join(process.cwd(), imagePathOrUrl);
    const imageBuffer = fs.readFileSync(fullPath);
    imageBase64 = imageBuffer.toString("base64");
  }

  // Build the request for Nova Lite
  const requestBody = {
    messages: [
      {
        role: "user",
        content: [
          {
            image: {
              format: "png",
              source: { bytes: imageBase64 },
            },
          },
          {
            text: ANALYSIS_PROMPT,
          },
        ],
      },
    ],
    inferenceConfig: {
      maxTokens: 4096,
      temperature: 0.1,
    },
  };

  const command = new InvokeModelCommand({
    modelId: "us.amazon.nova-lite-v1:0",
    body: JSON.stringify(requestBody),
    contentType: "application/json",
    accept: "application/json",
  });

  const response = await client.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));

  // Extract text from response
  let outputText =
    responseBody?.output?.message?.content?.[0]?.text || "";

  // Clean up potential markdown formatting
  if (outputText.startsWith("```")) {
    outputText = outputText.split("```")[1];
    if (outputText.startsWith("json")) {
      outputText = outputText.substring(4);
    }
  }
  outputText = outputText.trim();

  return JSON.parse(outputText);
}

export async function analyzeMultipleImages(
  imagePaths: string[],
  onProgress?: (processed: number, total: number) => void
): Promise<Map<string, AnalysisResult | { error: string }>> {
  const results = new Map<string, AnalysisResult | { error: string }>();

  for (let i = 0; i < imagePaths.length; i++) {
    const imagePath = imagePaths[i];
    try {
      const result = await analyzeScoreboardImage(imagePath);
      results.set(imagePath, result);
    } catch (error) {
      results.set(imagePath, {
        error: error instanceof Error ? error.message : "Analysis failed",
      });
    }

    if (onProgress) {
      onProgress(i + 1, imagePaths.length);
    }

    // Small delay to avoid rate limiting
    if (i < imagePaths.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  return results;
}
