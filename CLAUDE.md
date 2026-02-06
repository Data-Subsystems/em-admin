# EM Admin

Electro-Mech Scoreboard Customizer - Allows users to preview scoreboard models with custom color configurations using real-time canvas-based color replacement.

## Stack

- **Frontend**: Next.js 14 (App Router) + Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **AI**: AWS Bedrock Nova Lite (vision model for image analysis)
- **Storage**: AWS S3 (em-admin-assets bucket for 429 scoreboard images)
- **Processing**: Modal.com (optional, for batch processing)
- **Deployment**: Vercel

## Commands

```bash
npm run dev          # Dev server on port 3000
npm run build        # Production build
npm run lint         # ESLint
npm test             # Run tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage
```

## Architecture

```
src/
├── app/
│   ├── api/
│   │   ├── auth/login/           # Authentication
│   │   ├── scoreboards/          # Scoreboard CRUD
│   │   │   ├── route.ts          # List scoreboards
│   │   │   ├── import/route.ts   # Import from files
│   │   │   └── [id]/
│   │   │       ├── route.ts      # Get/update scoreboard
│   │   │       └── analyze/route.ts  # Analyze single
│   │   └── analyze/
│   │       └── batch/route.ts    # Batch analysis
│   ├── page.tsx                  # Main UI (tabs: Library, Customizer, Analysis)
│   └── layout.tsx                # Root layout
├── components/
│   └── ColorizedScoreboard.tsx   # Canvas-based color replacement
├── lib/
│   ├── supabase.ts              # DB client + types + color palette
│   └── bedrock.ts               # AWS Bedrock client
├── middleware.ts                # Auth middleware
data/
├── scoreboard-colors.json       # Color configs from source
modal_app/
└── main.py                      # Modal batch processing
supabase/
└── migrations/                  # Database schema
```

## Image Storage

Images are stored in AWS S3 and served via a custom subdomain:
- **Bucket**: `em-admin-assets` (AWS S3)
- **Path**: `/images/` (429 PNG files)
- **URL**: `https://img.electro-mech.com/images/{filename}.png`
- **CDN**: Cloudflare Worker (`s3-img-proxy`) proxies requests to S3
- **Source**: Downloaded from electro-mech.com ZIP archive

## Data Sources

- **Images**: https://www.electro-mech.com/wp-content/uploads/manuals/scoreboard-images.zip (429 PNGs)
- **Colors**: https://www.electro-mech.com/wp-content/uploads/manuals/scoreboard-colors.txt (JSON)

## Color Palette

All scoreboard models share the same color options:

**Face Colors** (18 options):
- Blues: navy_blue, egyptian_blue, royal_blue, icy_blue
- Greens: shamrock_green, jolly_green, hunter_green
- Neutrals: silver_gray, matte_black, white
- Purples: indigo_purple, power_purple
- Reds: merchant_maroon, cardinal_red, racing_red
- Warm: tiger_orange, golden_yellow, metallic_gold

**Accent Striping**: Same 18 colors + "none"

**LED Colors**: red, amber (or "none" for some models)

## Image Analysis Schema

Nova Lite extracts:
- `sport_type`: baseball, basketball, hockey, soccer, etc.
- `dimensions`: wide, standard, tall
- `layout_type`: basic_score, baseball_full, hockey_penalty, etc.
- `zones`: Array of detected display zones with positions
- `customizable_areas`: face, accent_stripe, led_display areas
- `features`: wireless_capable, shot_clock, penalty_timers, etc.

## Environment Variables

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
```

## Supabase Tables

- `scoreboard_models`: All scoreboard models with analysis results
- `analysis_jobs`: Batch job tracking
- `custom_configurations`: User-created customizations
- `colorpicker_tasks`: Batch generation task queue (model, colors, status, s3_key)
- `colorpicker_batches`: Batch processing job history

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/scoreboards/import | Import from data files |
| GET | /api/scoreboards | List all scoreboards |
| GET | /api/scoreboards/[id] | Get single scoreboard |
| POST | /api/scoreboards/[id]/analyze | Analyze single image |
| POST | /api/analyze/batch | Batch analyze pending |
| GET | /api/analyze/batch | Get analysis status |

### ColorPicker Batch Generation

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/colorpicker/generate-all | Queue all 684 color combinations for a model |
| GET | /api/colorpicker/generate-all?model=X | Get progress for a model |
| GET | /api/colorpicker/batch | Get overall batch status and model progress |
| GET | /api/colorpicker/batch?model=X | Get completed images for a model |
| POST | /api/colorpicker/batch/start | Start batch processing via Modal |
| POST | /api/colorpicker/batch | Stop batch (action=stop) or reset failed (action=reset-failed) |
| POST | /api/colorpicker/reset-stuck | Reset tasks stuck in processing >5min |
| GET | /api/colorpicker/debug | Debug stuck/pending tasks |

## ColorizedScoreboard Component

Real-time canvas-based color replacement for scoreboard previews:

```typescript
<ColorizedScoreboard
  imageUrl={string}      // S3 image URL (via /api/images proxy)
  faceColor={string}     // Hex color for main face background
  accentColor={string}   // Hex color for frame lines (or null for no change)
  ledColor={string}      // Hex color for LED digit displays
/>
```

**Layer-based color replacement algorithm:**

The component splits the image into 5 logical layers, then renders each with the appropriate color:

| Layer | Detection Criteria | Color Applied |
|-------|-------------------|---------------|
| **Black** | L < 12% | Keep original (LED backgrounds) |
| **Face** | Matches dominant saturated color | User's face color |
| **Striping** | Pure white (R,G,B ≥ 250) | User's accent color |
| **Label** | Gray/desaturated (S < 15%, L > 50%) | Keep original (text) |
| **Digit** | Warm hue, red-dominant, NOT face color | User's LED color (hue-shifted) |

**Processing steps:**
1. Load original image into HTML5 Canvas
2. **Find dominant face color**: Count saturated pixels, find most common (quantized to 20-unit buckets)
3. **Classify pixels**: Assign each pixel to a layer based on HSL values
4. **Render layers**: Apply target colors based on layer type
5. **Re-render**: Automatically updates when any color prop changes

**Key design decisions:**
- Face detection happens FIRST to prevent red/orange faces from being misclassified as LEDs
- Pure white (≥250) = frame lines; gray (<250) = text labels (universal across all scoreboards)
- LED pixels are hue-shifted (not replaced) to preserve glow/antialiasing effects
- Outer 6px perimeter of face layer also receives accent color (colored border)

## UI Tabs

1. **Scoreboards Library**: Grid of all 429 models, click to select for customization
2. **Customizer**: Color pickers for face/accent/LED with live canvas preview
3. **Analysis**: Batch processing controls and status for AI analysis

## State Persistence

UI state is persisted to localStorage:
- `em_selected_model`: Currently selected scoreboard model
- `em_face_color`: Selected face color
- `em_accent_color`: Selected accent color
- `em_led_color`: Selected LED color
- `em_active_tab`: Current active tab

## Workflow

1. **Import**: `POST /api/scoreboards/import` loads images and color configs
2. **Browse**: Select a scoreboard from the Library tab
3. **Customize**: Pick colors in Customizer tab with live preview
4. **Analyze** (optional): Process images with Nova Lite for zone detection
5. **Export**: Copy configuration to clipboard

## Batch Image Generation

The ColorPicker batch system generates pre-rendered images for all color combinations:

**Color Combinations per Model**: 18 face × 19 accent × 2 LED = **684 images**

**Workflow**:
1. Click "Generate All" to queue tasks for a model
2. Click "Start Processing" to run on Modal.com (up to 1000 containers)
3. Monitor progress in real-time via Supabase
4. Generated images stored in S3: `generated/{model}/{primary}--{accent}--{led}.png`

**Modal Processing** (`modal_functions/colorpicker_batch.py`):
- PHP-style additive colorization: `pixel + color` (not multiplicative)
- Layer-based composition: Frame, Face, Accent-Striping, Masks, LED-Glow, Captions
- All mask layers use white content requiring `negate=True` before colorization
- Images resized to match original dimensions from electro-mech.com

**Task Status Flow**: pending → processing → completed/failed

## Testing

Test framework: Vitest with jsdom environment

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

Coverage thresholds: 80% for branches, functions, lines, statements

## Working Preferences

- Always commit and push after major changes
- Use AWS credentials from reamaze-rag project (trim trailing spaces!)
- Nova Lite model ID: `us.amazon.nova-lite-v1:0` (cross-region inference)
