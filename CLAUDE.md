# EM Scoreboard Customizer

Electro-Mech Scoreboard Image Tool - Analyzes scoreboard images using Amazon Nova Lite to create universal customization configurations.

## Stack

- **Frontend**: Next.js 14 (App Router) + Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **AI**: AWS Bedrock Nova Lite (vision model for image analysis)
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
│   │   ├── scoreboards/          # Scoreboard CRUD
│   │   │   ├── route.ts          # List scoreboards
│   │   │   ├── import/route.ts   # Import from files
│   │   │   └── [id]/
│   │   │       ├── route.ts      # Get/update scoreboard
│   │   │       └── analyze/route.ts  # Analyze single
│   │   └── analyze/
│   │       └── batch/route.ts    # Batch analysis
│   └── page.tsx                  # Main UI
├── lib/
│   ├── supabase.ts              # DB client + types
│   └── bedrock.ts               # AWS Bedrock client
data/
├── scoreboard-colors.json       # Color configs from source
scoreboard-images/               # Original images (429 PNGs)
modal_app/
└── main.py                      # Modal batch processing
supabase/
└── migrations/                  # Database schema
```

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

## Workflow

1. **Import**: `POST /api/scoreboards/import` loads images and color configs
2. **Analyze**: Click "Analyze" to process images with Nova Lite
3. **Customize**: Select colors and export JSON configuration
4. **Export**: Copy configuration to clipboard

## Working Preferences

- Always commit and push after major changes
- Use AWS credentials from reamaze-rag project (trim trailing spaces!)
- Nova Lite model ID: `us.amazon.nova-lite-v1:0` (cross-region inference)
