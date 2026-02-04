"""
Modal app for scoreboard image analysis using AWS Bedrock Nova Lite.
Analyzes scoreboard images to extract layout information for the customization UI.
"""

import modal
import json
import base64
import os
from pathlib import Path

# Modal app setup
app = modal.App("em-sb-customizer")

# Create image with required dependencies
image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "boto3>=1.34.0",
    "Pillow>=10.0.0",
    "httpx>=0.25.0",
)

# AWS Bedrock credentials secret
bedrock_secret = modal.Secret.from_name("bedrock-prod-credentials")


ANALYSIS_PROMPT = """Analyze this scoreboard image and extract the following information in JSON format:

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

Return ONLY valid JSON, no markdown formatting or explanation.

Example output format:
{
  "sport_type": "baseball",
  "dimensions": "wide",
  "zones": [
    {"zone_id": "guest_label", "zone_type": "text_label", "label": "GUEST", "position": {"x": 5, "y": 5, "width": 20, "height": 15}},
    {"zone_id": "guest_score", "zone_type": "score_display", "label": null, "position": {"x": 5, "y": 20, "width": 20, "height": 30}, "digit_count": 2}
  ],
  "customizable_areas": [
    {"area_id": "main_face", "area_type": "face", "current_color_hint": "purple"},
    {"area_id": "led_digits", "area_type": "led_display", "current_color_hint": "red"}
  ],
  "layout_type": "baseball_full",
  "features": ["ball_strike_out", "inning_display"]
}
"""


def analyze_image_with_nova(image_bytes: bytes, model_id: str = "us.amazon.nova-lite-v1:0") -> dict:
    """Analyze a scoreboard image using AWS Bedrock Nova Lite."""
    import boto3

    # Initialize Bedrock client
    client = boto3.client(
        "bedrock-runtime",
        region_name=os.environ.get("AWS_REGION", "us-east-1"),
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
    )

    # Encode image to base64
    image_base64 = base64.b64encode(image_bytes).decode("utf-8")

    # Build the request for Nova Lite
    request_body = {
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "image": {
                            "format": "png",
                            "source": {"bytes": image_base64}
                        }
                    },
                    {
                        "text": ANALYSIS_PROMPT
                    }
                ]
            }
        ],
        "inferenceConfig": {
            "maxTokens": 4096,
            "temperature": 0.1,
        }
    }

    # Call Bedrock
    response = client.invoke_model(
        modelId=model_id,
        body=json.dumps(request_body),
        contentType="application/json",
        accept="application/json"
    )

    # Parse response
    response_body = json.loads(response["body"].read())

    # Extract text from response
    output_text = response_body.get("output", {}).get("message", {}).get("content", [{}])[0].get("text", "")

    # Try to parse as JSON
    try:
        # Clean up potential markdown formatting
        if output_text.startswith("```"):
            output_text = output_text.split("```")[1]
            if output_text.startswith("json"):
                output_text = output_text[4:]
        output_text = output_text.strip()
        return json.loads(output_text)
    except json.JSONDecodeError as e:
        return {"error": f"Failed to parse JSON: {e}", "raw_output": output_text}


@app.function(
    image=image,
    secrets=[bedrock_secret],
    timeout=300,
)
def analyze_single_image(image_path: str, image_bytes: bytes) -> dict:
    """Analyze a single scoreboard image."""
    result = analyze_image_with_nova(image_bytes)
    return {
        "image_path": image_path,
        "analysis": result
    }


@app.function(
    image=image,
    secrets=[bedrock_secret],
    timeout=3600,
    concurrency_limit=10,  # Limit concurrent Bedrock calls
)
def analyze_batch(images: list[tuple[str, bytes]]) -> list[dict]:
    """Analyze a batch of images sequentially."""
    results = []
    for image_path, image_bytes in images:
        try:
            result = analyze_image_with_nova(image_bytes)
            results.append({
                "image_path": image_path,
                "analysis": result,
                "status": "success"
            })
        except Exception as e:
            results.append({
                "image_path": image_path,
                "error": str(e),
                "status": "error"
            })
    return results


@app.function(
    image=image,
    secrets=[bedrock_secret],
    timeout=7200,
)
def process_all_images(image_urls: list[str] = None) -> dict:
    """
    Process all scoreboard images from URLs or local paths.
    Returns analysis results for all images.
    """
    import httpx
    from concurrent.futures import ThreadPoolExecutor, as_completed

    results = []
    errors = []

    if image_urls:
        # Download and process images from URLs
        with httpx.Client(timeout=30) as client:
            for url in image_urls:
                try:
                    response = client.get(url)
                    response.raise_for_status()
                    image_bytes = response.content

                    # Extract filename from URL
                    filename = url.split("/")[-1]

                    result = analyze_image_with_nova(image_bytes)
                    results.append({
                        "filename": filename,
                        "url": url,
                        "analysis": result,
                        "status": "success"
                    })
                    print(f"Processed: {filename}")
                except Exception as e:
                    errors.append({
                        "url": url,
                        "error": str(e)
                    })
                    print(f"Error processing {url}: {e}")

    return {
        "total_processed": len(results),
        "total_errors": len(errors),
        "results": results,
        "errors": errors
    }


@app.local_entrypoint()
def main():
    """Local test entrypoint."""
    print("EM Scoreboard Customizer - Modal App")
    print("Use the web API to trigger image analysis.")
