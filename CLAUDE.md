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

## S3 Image Storage

Images are stored in AWS S3 for reliable hosting:
- **Bucket**: `em-admin-assets`
- **Path**: `/images/` (429 PNG files)
- **URL**: `https://em-admin-assets.s3.us-east-1.amazonaws.com/images/{filename}.png`
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

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/scoreboards/import | Import from data files |
| GET | /api/scoreboards | List all scoreboards |
| GET | /api/scoreboards/[id] | Get single scoreboard |
| POST | /api/scoreboards/[id]/analyze | Analyze single image |
| POST | /api/analyze/batch | Batch analyze pending |
| GET | /api/analyze/batch | Get analysis status |

## ColorizedScoreboard Component

Real-time canvas-based color replacement for scoreboard previews:

```typescript
<ColorizedScoreboard
  imageUrl={string}      // S3 image URL
  faceColor={string}     // Hex color for main face
  accentColor={string}   // Hex color for accent stripes (or null)
  ledColor={string}      // Hex color for LED displays
/>
```

**How it works:**
1. Loads original image into HTML5 Canvas
2. Stores original pixel data for reference
3. Detects pixel types using HSL color analysis:
   - **Face colors**: Dark/medium pixels (lightness 0.05-0.6)
   - **LED pixels**: Bright red/amber hue with high saturation
   - **Accent areas**: Gray/silver with low saturation
4. Applies target colors while preserving relative lightness
5. Re-renders on any color prop change

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

## Working Preferences

- Always commit and push after major changes
- Use AWS credentials from reamaze-rag project (trim trailing spaces!)
- Nova Lite model ID: `us.amazon.nova-lite-v1:0` (cross-region inference)
