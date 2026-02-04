import modal
import boto3
from PIL import Image, ImageOps, ImageEnhance
import numpy as np
import io
import os
import re
from datetime import datetime, timezone
from typing import Optional
from supabase import create_client, Client

# Modal app definition
app = modal.App("colorpicker-batch-generator")

# Image with all dependencies
image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "pillow",
    "boto3",
    "numpy",
    "supabase",
    "fastapi",
)

# Volume for caching masks between containers
masks_volume = modal.Volume.from_name("colorpicker-masks-cache", create_if_missing=True)

# ============================================================
# COLOR CONFIGURATION (from PHP colorpicker_conf.php)
# ============================================================

COLORS = {
    'navy_blue': (16, 43, 78),
    'egyptian_blue': (35, 60, 136),
    'royal_blue': (36, 98, 167),
    'icy_blue': (117, 190, 233),
    'shamrock_green': (0, 159, 72),
    'jolly_green': (0, 114, 59),
    'hunter_green': (14, 69, 42),
    'silver_gray': (201, 199, 199),
    'matte_black': (45, 42, 43),
    'white': (255, 255, 255),
    'indigo_purple': (94, 46, 134),
    'power_purple': (104, 28, 91),
    'merchant_maroon': (116, 17, 46),
    'cardinal_red': (182, 31, 61),
    'racing_red': (227, 50, 38),
    'tiger_orange': (244, 121, 32),
    'golden_yellow': (255, 212, 0),
    'metallic_gold': (180, 151, 90),
    'red': (236, 27, 36),
    'amber': (249, 165, 25),
    'none': (255, 255, 255),
}

UI_COLORS = [c for c in COLORS.keys() if c not in ['none', 'red', 'amber']]
LED_COLORS = ['red', 'amber']
ACCENT_COLORS = UI_COLORS + ['none']

# Multicolor LED models (LED layer not colorized)
MULTICOLOR_LEDS = [
    '2180', '2330', '2350', '2370', '2550', '2555', '2556',
    '2570', '2575', '2576', '2655', '2665', '2770',
    '8350', '8650', '8750', '8850', 'lx2*', 'lx8440',
]
FORCE_SINGLE_COLOR_LED = ['lx2120']


def is_multicolor_led(model_id: str) -> bool:
    """Check if model has multicolor LED (LED layer should not be colorized)"""
    model_lower = model_id.lower()

    # Check exceptions first
    for single in FORCE_SINGLE_COLOR_LED:
        if single.lower() in model_lower:
            return False

    # Check patterns
    for pattern in MULTICOLOR_LEDS:
        if '*' in pattern:
            regex = pattern.replace('*', '.+')
            if re.search(regex, model_id, re.IGNORECASE):
                return True
        else:
            if pattern in model_id:
                return True

    return False


def normalize_model_name(model: str) -> str:
    """Normalize model name for file paths"""
    return (model
        .replace('-fourface', '-4')
        .replace('lx2665b', 'lx2665v')
        .replace('lx2655b', 'lx2655v')
        .replace('lx2545b', 'lx2545v'))


# ============================================================
# IMAGE GENERATOR CLASS
# ============================================================

@app.cls(
    image=image,
    cpu=1.0,
    memory=1024,
    volumes={"/cache": masks_volume},
    secrets=[
        modal.Secret.from_name("aws-credentials"),
        modal.Secret.from_name("supabase-credentials"),
    ],
    timeout=3600,
    retries=2,
    max_containers=100,  # Allow up to 100 concurrent containers
)
class ImageGenerator:

    @modal.enter()
    def setup(self):
        """Initialize connections on container start"""
        self.s3 = boto3.client('s3')
        self.bucket = 'em-admin-assets'
        self.masks_cache = {}

        # Supabase client
        self.supabase: Client = create_client(
            os.environ['SUPABASE_URL'],
            os.environ['SUPABASE_SERVICE_KEY']
        )

        # Container ID for tracking
        self.container_id = os.environ.get('MODAL_TASK_ID', 'unknown')

        # Sync masks from S3 to local volume
        self._sync_masks()

    def _sync_masks(self):
        """Download all masks from S3 to local volume (once per container)"""
        sync_marker = "/cache/masks_synced_v3"
        if os.path.exists(sync_marker):
            return

        print("Syncing masks from S3...")
        paginator = self.s3.get_paginator('list_objects_v2')

        count = 0
        for page in paginator.paginate(Bucket=self.bucket, Prefix='masks/'):
            for obj in page.get('Contents', []):
                key = obj['Key']
                local_path = f"/cache/{key}"

                os.makedirs(os.path.dirname(local_path), exist_ok=True)

                if not os.path.exists(local_path):
                    try:
                        response = self.s3.get_object(Bucket=self.bucket, Key=key)
                        with open(local_path, 'wb') as f:
                            f.write(response['Body'].read())
                        count += 1
                    except Exception as e:
                        print(f"Error downloading {key}: {e}")

        open(sync_marker, 'w').close()
        print(f"Masks synced! Downloaded {count} files.")

    def get_mask(self, model: str, layer: str) -> Optional[Image.Image]:
        """Load mask from local cache"""
        model_normalized = normalize_model_name(model)

        # Try different path variations
        paths_to_try = [
            f"/cache/masks/{model_normalized}/{layer}.png",
            f"/cache/masks/{model_normalized.lower()}/{layer}.png",
            f"/cache/masks/{model_normalized.upper()}/{layer}.png",
            f"/cache/masks/{model}/{layer}.png",
        ]

        for path in paths_to_try:
            if os.path.exists(path):
                try:
                    return Image.open(path)
                except Exception as e:
                    print(f"Error loading {path}: {e}")
                    continue

        return None

    def colorize_image(self, img: Image.Image, color_name: str, negate: bool = True) -> Image.Image:
        """
        Colorize image using PHP-compatible algorithm.

        PHP algorithm steps:
        1. Grayscale
        2. Contrast (increase)
        3. Negate (optional)
        4. Colorize (additive - adds color to dark areas)

        The masks have:
        - Alpha channel defining where the layer appears
        - RGB values that get transformed to the target color
        """
        rgb = COLORS.get(color_name, (255, 255, 255))

        # Ensure RGBA
        if img.mode != 'RGBA':
            img = img.convert('RGBA')

        # Get alpha channel
        alpha = img.split()[3]

        # Convert to grayscale
        gray = ImageOps.grayscale(img)

        # Increase contrast (PHP uses negative value = more contrast)
        enhancer = ImageEnhance.Contrast(gray)
        contrasted = enhancer.enhance(2.0)

        # Negate if needed
        if negate:
            contrasted = ImageOps.invert(contrasted)

        # PHP-style additive colorize: adds color values to each pixel
        # Dark areas (0) become the target color
        # Light areas (255) stay white (clamped at 255)
        gray_arr = np.array(contrasted, dtype=np.int32)
        r, g, b = rgb

        # Create colored image using additive colorization
        h, w = gray_arr.shape
        colored = np.zeros((h, w, 3), dtype=np.uint8)
        colored[:, :, 0] = np.clip(gray_arr + r, 0, 255).astype(np.uint8)
        colored[:, :, 1] = np.clip(gray_arr + g, 0, 255).astype(np.uint8)
        colored[:, :, 2] = np.clip(gray_arr + b, 0, 255).astype(np.uint8)

        result = Image.fromarray(colored, 'RGB').convert('RGBA')
        result.putalpha(alpha)

        return result

    def generate_image(
        self,
        model: str,
        primary: str,
        accent: str,
        leds: str,
        width: int = 720,
    ) -> Optional[bytes]:
        """Generate single scoreboard PNG"""

        # Normalize
        model_normalized = normalize_model_name(model)

        # If accent is 'none', use primary color
        accent_color = primary if accent in ('none', 'n/a') else accent

        layers = []

        # 1. Frame (no colorize)
        frame = self.get_mask(model_normalized, "Frame")
        if frame:
            layers.append(('Frame', frame.convert('RGBA')))

        # 2. Face (colorize with primary, negate=True - white mask needs inversion)
        face = self.get_mask(model_normalized, "Face")
        if face:
            layers.append(('Face', self.colorize_image(face, primary, negate=True)))

        # 3. Accent-Striping (colorize with accent, negate=True)
        accent_layer = self.get_mask(model_normalized, "Accent-Striping")
        if accent_layer:
            layers.append(('Accent-Striping', self.colorize_image(accent_layer, accent_color, negate=True)))

        # 4. Masks (no colorize)
        masks = self.get_mask(model_normalized, "Masks")
        if masks:
            layers.append(('Masks', masks.convert('RGBA')))

        # 5. LED-Glow (colorize unless multicolor, negate=True)
        led_layer = self.get_mask(model_normalized, "LED-Glow")
        if led_layer:
            if is_multicolor_led(model):
                # For multicolor, add LED layer without colorization
                layers.append(('LED-Glow', led_layer.convert('RGBA')))
            else:
                layers.append(('LED-Glow', self.colorize_image(led_layer, leds, negate=True)))

        # 6. Captions (colorize with white, negate=True)
        captions = self.get_mask(model_normalized, "Captions")
        if captions:
            layers.append(('Captions', self.colorize_image(captions, 'white', negate=True)))

        if not layers:
            return None

        # Composite all layers
        result = Image.new('RGBA', layers[0][1].size, (0, 0, 0, 0))
        for name, layer in layers:
            if layer.size != result.size:
                layer = layer.resize(result.size, Image.LANCZOS)
            result = Image.alpha_composite(result, layer)

        # Resize if needed
        if width and width != result.width:
            ratio = width / result.width
            new_height = int(result.height * ratio)
            result = result.resize((width, new_height), Image.LANCZOS)

        # Convert to PNG bytes
        buffer = io.BytesIO()
        result.save(buffer, format='PNG', optimize=True)
        return buffer.getvalue()

    def update_task_status(
        self,
        task_id: str,
        status: str,
        s3_key: str = None,
        file_size: int = None,
        error: str = None,
    ):
        """Update task status in Supabase"""
        try:
            # Get current attempts
            current = self.supabase.table('colorpicker_tasks').select('attempts').eq('id', task_id).single().execute()
            current_attempts = current.data.get('attempts', 0) if current.data else 0

            update_data = {
                'status': status,
                'updated_at': datetime.now(timezone.utc).isoformat(),
                'container_id': self.container_id,
            }

            if status == 'processing':
                update_data['started_at'] = datetime.now(timezone.utc).isoformat()
                update_data['attempts'] = current_attempts + 1

            if status == 'completed':
                update_data['completed_at'] = datetime.now(timezone.utc).isoformat()
                update_data['s3_key'] = s3_key
                update_data['file_size_bytes'] = file_size
                update_data['error_message'] = None

            if status == 'failed':
                update_data['error_message'] = error[:1000] if error else 'Unknown error'

            self.supabase.table('colorpicker_tasks').update(update_data).eq('id', task_id).execute()
        except Exception as e:
            print(f"Error updating task status: {e}")

    @modal.method()
    def process_batch(self, tasks: list[dict]) -> dict:
        """
        Process a batch of tasks
        Each task: {id, model, primary_color, accent_color, led_color, width}
        """
        results = {"success": 0, "failed": 0, "skipped": 0, "errors": []}

        for task in tasks:
            task_id = task['id']

            try:
                # Mark as processing
                self.update_task_status(task_id, 'processing')

                # Generate image
                image_bytes = self.generate_image(
                    model=task['model'],
                    primary=task['primary_color'],
                    accent=task['accent_color'],
                    leds=task['led_color'],
                    width=task.get('width', 720),
                )

                if not image_bytes:
                    self.update_task_status(task_id, 'failed', error='No layers found for model')
                    results["failed"] += 1
                    results["errors"].append(f"{task['model']}: No layers")
                    continue

                # Build S3 key
                s3_key = f"colorpicker-generated/{task['model']}/{task['primary_color']}-{task['accent_color']}-{task['led_color']}.png"

                # Upload to S3
                self.s3.put_object(
                    Bucket=self.bucket,
                    Key=s3_key,
                    Body=image_bytes,
                    ContentType='image/png',
                    CacheControl='public, max-age=31536000, immutable',
                )

                # Update status
                self.update_task_status(
                    task_id,
                    'completed',
                    s3_key=s3_key,
                    file_size=len(image_bytes),
                )

                results["success"] += 1

            except Exception as e:
                self.update_task_status(task_id, 'failed', error=str(e))
                results["failed"] += 1
                results["errors"].append(f"{task.get('model', 'unknown')}: {str(e)[:100]}")

        return results


# ============================================================
# SINGLE IMAGE GENERATION (for UI calls)
# ============================================================

@app.function(
    image=image,
    cpu=1.0,
    memory=1024,
    volumes={"/cache": masks_volume},
    secrets=[
        modal.Secret.from_name("aws-credentials"),
        modal.Secret.from_name("supabase-credentials"),
    ],
    timeout=300,
)
@modal.fastapi_endpoint(method="POST", docs=True)
def generate_single_image(item: dict) -> dict:
    """
    Generate a single image immediately (called from API).
    POST body: {"model": "lx1234", "primary": "navy_blue", "accent": "royal_blue", "leds": "amber", "session_id": "..."}
    Returns the S3 URL on success.
    """
    import time
    start = time.time()

    # Extract parameters from request body
    model = item.get('model')
    primary = item.get('primary', 'navy_blue')
    accent = item.get('accent', 'royal_blue')
    leds = item.get('leds', 'amber')
    width = item.get('width', 720)
    session_id = item.get('session_id')  # For progress tracking

    if not model:
        return {"success": False, "error": "Model is required"}

    s3 = boto3.client('s3')
    bucket = 'em-admin-assets'

    # Initialize Supabase for progress tracking
    supabase = None
    progress_id = None
    if session_id:
        try:
            supabase = create_client(
                os.environ['SUPABASE_URL'],
                os.environ['SUPABASE_SERVICE_KEY']
            )
            # Create progress record
            result = supabase.table('colorpicker_generation_progress').insert({
                'session_id': session_id,
                'model': model,
                'primary_color': primary,
                'accent_color': accent,
                'led_color': leds,
                'status': 'running',
                'current_step': 'Initializing...',
                'step_number': 0,
                'progress_percent': 0,
                'started_at': datetime.now(timezone.utc).isoformat(),
            }).execute()
            progress_id = result.data[0]['id'] if result.data else None
        except Exception as e:
            print(f"Warning: Could not create progress record: {e}")

    def update_progress(step: str, step_number: int, percent: int):
        """Update progress in Supabase"""
        if supabase and progress_id:
            try:
                supabase.table('colorpicker_generation_progress').update({
                    'current_step': step,
                    'step_number': step_number,
                    'progress_percent': percent,
                    'updated_at': datetime.now(timezone.utc).isoformat(),
                }).eq('id', progress_id).execute()
            except Exception as e:
                print(f"Warning: Could not update progress: {e}")

    def complete_progress(success: bool, url: str = None, error: str = None):
        """Mark progress as complete or error"""
        if supabase and progress_id:
            try:
                data = {
                    'status': 'completed' if success else 'error',
                    'current_step': 'Complete!' if success else 'Error',
                    'step_number': 7 if success else -1,
                    'progress_percent': 100 if success else 0,
                    'completed_at': datetime.now(timezone.utc).isoformat(),
                    'updated_at': datetime.now(timezone.utc).isoformat(),
                }
                if url:
                    data['result_url'] = url
                if error:
                    data['error_message'] = error[:500]
                supabase.table('colorpicker_generation_progress').update(data).eq('id', progress_id).execute()
            except Exception as e:
                print(f"Warning: Could not complete progress: {e}")

    # Build S3 key
    s3_key = f"colorpicker-generated/{model}/{primary}-{accent}-{leds}.png"
    result_url = f"https://{bucket}.s3.us-east-1.amazonaws.com/{s3_key}"

    # Step 1: Check if already exists
    update_progress("Checking cache...", 1, 10)
    try:
        s3.head_object(Bucket=bucket, Key=s3_key)
        complete_progress(True, url=result_url)
        return {
            "success": True,
            "exists": True,
            "url": result_url,
            "session_id": session_id,
            "duration_ms": int((time.time() - start) * 1000),
        }
    except:
        pass  # Doesn't exist, generate it

    # Step 2: Sync masks if needed
    update_progress("Loading masks...", 2, 20)
    sync_marker = "/cache/masks_synced_v3"
    if not os.path.exists(sync_marker):
        print("Syncing masks from S3...")
        paginator = s3.get_paginator('list_objects_v2')
        count = 0
        for page in paginator.paginate(Bucket=bucket, Prefix='masks/'):
            for obj in page.get('Contents', []):
                key = obj['Key']
                local_path = f"/cache/{key}"
                os.makedirs(os.path.dirname(local_path), exist_ok=True)
                if not os.path.exists(local_path):
                    try:
                        response = s3.get_object(Bucket=bucket, Key=key)
                        with open(local_path, 'wb') as f:
                            f.write(response['Body'].read())
                        count += 1
                    except Exception as e:
                        print(f"Error downloading {key}: {e}")
        open(sync_marker, 'w').close()
        print(f"Masks synced! Downloaded {count} files.")

    # Generate image using same logic as ImageGenerator
    model_normalized = normalize_model_name(model)
    accent_color = primary if accent in ('none', 'n/a') else accent

    def get_mask(m: str, layer: str):
        paths = [
            f"/cache/masks/{m}/{layer}.png",
            f"/cache/masks/{m.lower()}/{layer}.png",
            f"/cache/masks/{m.upper()}/{layer}.png",
        ]
        for path in paths:
            if os.path.exists(path):
                try:
                    return Image.open(path)
                except:
                    continue
        return None

    def colorize(img: Image.Image, color_name: str, negate: bool = True) -> Image.Image:
        """PHP-compatible additive colorization"""
        rgb = COLORS.get(color_name, (255, 255, 255))
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
        alpha = img.split()[3]

        gray = ImageOps.grayscale(img)
        enhancer = ImageEnhance.Contrast(gray)
        contrasted = enhancer.enhance(2.0)

        if negate:
            contrasted = ImageOps.invert(contrasted)

        # PHP-style additive colorize
        gray_arr = np.array(contrasted, dtype=np.int32)
        r, g, b = rgb
        h, w = gray_arr.shape
        colored = np.zeros((h, w, 3), dtype=np.uint8)
        colored[:, :, 0] = np.clip(gray_arr + r, 0, 255).astype(np.uint8)
        colored[:, :, 1] = np.clip(gray_arr + g, 0, 255).astype(np.uint8)
        colored[:, :, 2] = np.clip(gray_arr + b, 0, 255).astype(np.uint8)

        result = Image.fromarray(colored, 'RGB').convert('RGBA')
        result.putalpha(alpha)
        return result

    layers = []

    # Step 3: Build layers - Frame
    update_progress("Loading frame...", 3, 30)
    frame = get_mask(model_normalized, "Frame")
    if frame:
        layers.append(frame.convert('RGBA'))

    # Step 4: Build layers - Face
    update_progress("Colorizing face...", 4, 45)
    face = get_mask(model_normalized, "Face")
    if face:
        layers.append(colorize(face, primary, negate=True))  # Face: white mask needs inversion

    # Accent striping
    accent_layer = get_mask(model_normalized, "Accent-Striping")
    if accent_layer:
        layers.append(colorize(accent_layer, accent_color, negate=True))

    masks = get_mask(model_normalized, "Masks")
    if masks:
        layers.append(masks.convert('RGBA'))

    # Step 5: Build layers - LEDs
    update_progress("Colorizing LEDs...", 5, 60)
    led_layer = get_mask(model_normalized, "LED-Glow")
    if led_layer:
        if is_multicolor_led(model):
            layers.append(led_layer.convert('RGBA'))
        else:
            layers.append(colorize(led_layer, leds, negate=True))

    # Captions
    captions = get_mask(model_normalized, "Captions")
    if captions:
        layers.append(colorize(captions, 'white', negate=True))

    if not layers:
        complete_progress(False, error=f"No layers found for model {model}")
        return {
            "success": False,
            "error": f"No layers found for model {model}",
            "session_id": session_id,
            "duration_ms": int((time.time() - start) * 1000),
        }

    # Step 6: Composite all layers
    update_progress("Compositing layers...", 6, 75)
    result = Image.new('RGBA', layers[0].size, (0, 0, 0, 0))
    for layer in layers:
        if layer.size != result.size:
            layer = layer.resize(result.size, Image.LANCZOS)
        result = Image.alpha_composite(result, layer)

    # Resize if needed
    if width and width != result.width:
        ratio = width / result.width
        new_height = int(result.height * ratio)
        result = result.resize((width, new_height), Image.LANCZOS)

    # Save to bytes
    buffer = io.BytesIO()
    result.save(buffer, format='PNG', optimize=True)
    image_bytes = buffer.getvalue()

    # Step 7: Upload to S3
    update_progress("Uploading to S3...", 7, 90)
    s3.put_object(
        Bucket=bucket,
        Key=s3_key,
        Body=image_bytes,
        ContentType='image/png',
        CacheControl='public, max-age=31536000, immutable',
    )

    # Update Supabase task if exists
    if supabase:
        try:
            supabase.table('colorpicker_tasks').update({
                'status': 'completed',
                's3_key': s3_key,
                'file_size_bytes': len(image_bytes),
                'completed_at': datetime.now(timezone.utc).isoformat(),
            }).eq('model', model).eq('primary_color', primary).eq('accent_color', accent).eq('led_color', leds).execute()
        except Exception as e:
            print(f"Warning: Could not update Supabase task: {e}")

    # Mark progress complete
    complete_progress(True, url=result_url)

    return {
        "success": True,
        "exists": False,
        "url": result_url,
        "session_id": session_id,
        "size_bytes": len(image_bytes),
        "duration_ms": int((time.time() - start) * 1000),
    }


# ============================================================
# ORCHESTRATOR FUNCTIONS
# ============================================================

@app.function(
    image=image,
    secrets=[modal.Secret.from_name("aws-credentials")],
    timeout=7200,
)
def discover_models() -> list[str]:
    """Discover all models from S3 masks/ folder"""
    s3 = boto3.client('s3')

    response = s3.list_objects_v2(
        Bucket='em-admin-assets',
        Prefix='masks/',
        Delimiter='/',
    )

    models = []
    for prefix in response.get('CommonPrefixes', []):
        model = prefix['Prefix'].replace('masks/', '').rstrip('/')
        if model:
            models.append(model)

    print(f"Discovered {len(models)} models: {models[:10]}...")
    return models


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("supabase-credentials")],
    timeout=7200,
)
def populate_tasks(models: list[str] = None, reset_failed: bool = True):
    """
    Populate colorpicker_tasks table with all combinations.
    Skip existing completed tasks.
    Optionally reset failed tasks for retry.
    """
    supabase = create_client(
        os.environ['SUPABASE_URL'],
        os.environ['SUPABASE_SERVICE_KEY']
    )

    if models is None:
        models = discover_models.remote()

    print(f"Populating tasks for {len(models)} models")

    # Reset failed tasks if requested
    if reset_failed:
        result = supabase.table('colorpicker_tasks').update({
            'status': 'pending',
            'error_message': None,
        }).eq('status', 'failed').lt('attempts', 3).execute()
        print(f"Reset {len(result.data) if result.data else 0} failed tasks to pending")

    # Get existing task combinations to skip
    print("Fetching existing tasks...")
    existing = set()

    # Paginate through existing tasks
    page_size = 1000
    offset = 0
    while True:
        result = supabase.table('colorpicker_tasks').select(
            'model, primary_color, accent_color, led_color'
        ).range(offset, offset + page_size - 1).execute()

        if not result.data:
            break

        for r in result.data:
            existing.add((r['model'], r['primary_color'], r['accent_color'], r['led_color']))

        offset += page_size
        if len(result.data) < page_size:
            break

    print(f"Found {len(existing)} existing tasks")

    # Generate all combinations
    new_tasks = []
    for model in models:
        for primary in UI_COLORS:
            for accent in ACCENT_COLORS:
                for led in LED_COLORS:
                    combo = (model, primary, accent, led)
                    if combo not in existing:
                        new_tasks.append({
                            'model': model,
                            'primary_color': primary,
                            'accent_color': accent,
                            'led_color': led,
                            'width': 720,
                            'status': 'pending',
                        })

    print(f"New tasks to create: {len(new_tasks)}")

    # Batch insert new tasks
    if new_tasks:
        batch_size = 500
        for i in range(0, len(new_tasks), batch_size):
            batch = new_tasks[i:i + batch_size]
            try:
                supabase.table('colorpicker_tasks').insert(batch).execute()
                print(f"Inserted {i + len(batch)}/{len(new_tasks)} tasks")
            except Exception as e:
                print(f"Error inserting batch at {i}: {e}")

    print(f"Created {len(new_tasks)} new tasks")

    # Update model stats
    for model in models:
        total = len(UI_COLORS) * len(ACCENT_COLORS) * len(LED_COLORS)
        try:
            supabase.table('colorpicker_models').upsert({
                'model': model,
                'total_combinations': total,
                'is_multicolor_led': is_multicolor_led(model),
            }).execute()
        except Exception as e:
            print(f"Error upserting model {model}: {e}")

    return len(new_tasks)


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("supabase-credentials")],
    timeout=14400,  # 4 hours
)
@modal.fastapi_endpoint(method="POST", docs=True)
def start_batch_processing(item: dict = {}) -> dict:
    """
    Start batch processing via web endpoint.
    POST body (optional): {"batch_size": 100, "max_parallel": 100, "max_tasks": 1000}
    """
    batch_size = item.get('batch_size', 100)
    max_parallel = item.get('max_parallel', 100)
    max_tasks = item.get('max_tasks')

    # Spawn the batch processing as a background task
    run_batch_processing.spawn(
        batch_size=batch_size,
        max_parallel=max_parallel,
        max_tasks=max_tasks,
    )

    return {
        "success": True,
        "message": f"Batch processing started with batch_size={batch_size}, max_parallel={max_parallel}",
        "max_tasks": max_tasks,
    }


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("supabase-credentials")],
    timeout=14400,  # 4 hours
)
def run_batch_processing(
    batch_size: int = 100,
    max_parallel: int = 100,  # Scale up to 100 containers
    max_tasks: int = None,
):
    """
    Main orchestrator - fetch pending tasks and distribute to workers
    """
    import time

    supabase = create_client(
        os.environ['SUPABASE_URL'],
        os.environ['SUPABASE_SERVICE_KEY']
    )

    # Create batch record
    batch_result = supabase.table('colorpicker_batches').insert({
        'total_tasks': 0,
        'status': 'running',
    }).execute()
    batch_id = batch_result.data[0]['id']

    print(f"Started batch {batch_id}")

    start_time = time.time()
    total_success = 0
    total_failed = 0

    try:
        iteration = 0
        while True:
            iteration += 1

            # Fetch pending tasks
            limit = batch_size * max_parallel
            if max_tasks:
                remaining = max_tasks - total_success - total_failed
                if remaining <= 0:
                    break
                limit = min(limit, remaining)

            result = supabase.table('colorpicker_tasks').select('*').eq(
                'status', 'pending'
            ).lt('attempts', 3).limit(limit).execute()

            tasks = result.data

            if not tasks:
                print("No more pending tasks")
                break

            print(f"\n[Iteration {iteration}] Processing {len(tasks)} tasks...")

            # Update batch_id for these tasks (in chunks to avoid URL length limits)
            task_ids = [t['id'] for t in tasks]
            chunk_size = 100  # Supabase IN clause limit
            for i in range(0, len(task_ids), chunk_size):
                chunk = task_ids[i:i + chunk_size]
                try:
                    supabase.table('colorpicker_tasks').update({
                        'batch_id': batch_id
                    }).in_('id', chunk).execute()
                except Exception as e:
                    print(f"Warning: Could not update batch_id for chunk: {e}")

            # Split into batches for parallel processing
            batches = [
                tasks[i:i + batch_size]
                for i in range(0, len(tasks), batch_size)
            ]

            print(f"Split into {len(batches)} batches of ~{batch_size} each")

            # Process in parallel using Modal's map
            generator = ImageGenerator()
            results = list(generator.process_batch.map(batches, order_outputs=False))

            # Aggregate results
            batch_success = 0
            batch_failed = 0
            for r in results:
                batch_success += r["success"]
                batch_failed += r["failed"]

            total_success += batch_success
            total_failed += batch_failed

            # Update batch stats
            elapsed = time.time() - start_time
            supabase.table('colorpicker_batches').update({
                'completed_tasks': total_success,
                'failed_tasks': total_failed,
                'total_tasks': total_success + total_failed,
                'images_per_second': total_success / elapsed if elapsed > 0 else 0,
            }).eq('id', batch_id).execute()

            rate = total_success / elapsed if elapsed > 0 else 0
            print(f"Progress: {total_success} success, {total_failed} failed, {rate:.1f} img/sec")

    except Exception as e:
        print(f"Error in batch processing: {e}")
        supabase.table('colorpicker_batches').update({
            'status': 'failed',
            'completed_tasks': total_success,
            'failed_tasks': total_failed,
        }).eq('id', batch_id).execute()
        raise e

    # Mark batch as completed
    elapsed = time.time() - start_time
    supabase.table('colorpicker_batches').update({
        'status': 'completed',
        'completed_at': datetime.now(timezone.utc).isoformat(),
        'total_duration_seconds': int(elapsed),
        'images_per_second': total_success / elapsed if elapsed > 0 else 0,
    }).eq('id', batch_id).execute()

    print(f"\n{'='*60}")
    print(f"BATCH COMPLETED")
    print(f"{'='*60}")
    print(f"Duration: {elapsed/60:.1f} minutes")
    print(f"Success: {total_success:,}")
    print(f"Failed: {total_failed:,}")
    print(f"Rate: {total_success/elapsed:.1f} images/sec")

    return {
        "batch_id": batch_id,
        "success": total_success,
        "failed": total_failed,
        "elapsed_minutes": elapsed / 60,
        "images_per_second": total_success / elapsed if elapsed > 0 else 0,
    }


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("supabase-credentials")],
    timeout=300,
)
def get_status() -> dict:
    """Get current processing status"""
    supabase = create_client(
        os.environ['SUPABASE_URL'],
        os.environ['SUPABASE_SERVICE_KEY']
    )

    # Get overall stats using raw count queries
    total = supabase.table('colorpicker_tasks').select('id', count='exact').execute()
    completed = supabase.table('colorpicker_tasks').select('id', count='exact').eq('status', 'completed').execute()
    failed = supabase.table('colorpicker_tasks').select('id', count='exact').eq('status', 'failed').execute()
    pending = supabase.table('colorpicker_tasks').select('id', count='exact').eq('status', 'pending').execute()
    processing = supabase.table('colorpicker_tasks').select('id', count='exact').eq('status', 'processing').execute()

    total_count = total.count or 0
    completed_count = completed.count or 0
    failed_count = failed.count or 0
    pending_count = pending.count or 0
    processing_count = processing.count or 0

    percent = (completed_count / total_count * 100) if total_count > 0 else 0

    return {
        'total_tasks': total_count,
        'completed': completed_count,
        'failed': failed_count,
        'pending': pending_count,
        'processing': processing_count,
        'percent_complete': round(percent, 2),
    }


# ============================================================
# CLI ENTRYPOINT
# ============================================================

@app.local_entrypoint()
def main(
    action: str = "status",
    batch_size: int = 100,
    max_parallel: int = 90,
    max_tasks: int = None,
    reset_failed: bool = True,
):
    """
    CLI entrypoint for colorpicker batch processing.

    Actions:
      discover  - List all models from S3 masks folder
      populate  - Create tasks in Supabase for all color combinations
      run       - Process pending tasks
      status    - Show current progress

    Examples:
      modal run colorpicker_batch.py --action discover
      modal run colorpicker_batch.py --action populate
      modal run colorpicker_batch.py --action run --batch-size 100 --max-parallel 90
      modal run colorpicker_batch.py --action run --max-tasks 1000
      modal run colorpicker_batch.py --action status
    """

    if action == "discover":
        models = discover_models.remote()
        print(f"\nFound {len(models)} models:")
        for m in sorted(models):
            mc = "🎨" if is_multicolor_led(m) else "  "
            print(f"  {mc} {m}")
        print(f"\n🎨 = Multicolor LED (LED layer not colorized)")

    elif action == "populate":
        count = populate_tasks.remote(reset_failed=reset_failed)
        print(f"\nCreated/updated {count} tasks")

    elif action == "run":
        result = run_batch_processing.remote(
            batch_size=batch_size,
            max_parallel=max_parallel,
            max_tasks=max_tasks,
        )
        print(f"\nBatch result: {result}")

    elif action == "status":
        stats = get_status.remote()
        print(f"\n{'='*50}")
        print(f"COLORPICKER BATCH STATUS")
        print(f"{'='*50}")
        print(f"Total tasks:  {stats['total_tasks']:,}")
        print(f"Completed:    {stats['completed']:,} ({stats['percent_complete']}%)")
        print(f"Failed:       {stats['failed']:,}")
        print(f"Pending:      {stats['pending']:,}")
        print(f"Processing:   {stats['processing']:,}")

        # Progress bar
        pct = stats['percent_complete']
        bar_width = 40
        filled = int(bar_width * pct / 100)
        bar = '█' * filled + '░' * (bar_width - filled)
        print(f"\n[{bar}] {pct}%")

    else:
        print(f"Unknown action: {action}")
        print("Available actions: discover, populate, run, status")
