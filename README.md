# EM Admin - Scoreboard Customizer

Electro-Mech Scoreboard Customizer allows users to preview and generate scoreboard models with custom color configurations. Features real-time canvas-based color replacement and batch image generation.

## Features

- **Scoreboard Library**: Browse 429 scoreboard models from Electro-Mech
- **Live Customizer**: Real-time canvas-based color preview with 18 face colors, 19 accent options, and 2 LED colors
- **Batch Generation**: Generate all 684 color variations per model using Modal.com serverless processing
- **Progress Tracking**: Real-time progress monitoring via Supabase

## Tech Stack

- **Frontend**: Next.js 16 (App Router) + Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **AI**: AWS Bedrock Nova Lite (vision model for image analysis)
- **Storage**: AWS S3 (em-admin-assets bucket)
- **Processing**: Modal.com (batch image generation with up to 1000 containers)
- **Testing**: Vitest
- **Deployment**: Vercel

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run tests
npm test

# Run tests with coverage
npm test:coverage

# Build for production
npm run build
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Color Combinations

Each scoreboard model supports **684 unique color combinations**:
- **18 Face Colors**: Blues (4), Greens (3), Neutrals (3), Purples (2), Reds (3), Warm (3)
- **19 Accent Colors**: Same 18 colors + "none"
- **2 LED Colors**: Red, Amber

Total: 18 × 19 × 2 = **684 combinations per model**

## Environment Variables

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
```

## Batch Processing

The batch processing system generates pre-rendered images for all color combinations:

1. **Generate All**: Click "Generate All" to queue all 684 color variations for a model
2. **Start Processing**: Click "Start Processing" to run batch generation on Modal.com
3. **Monitor Progress**: Real-time progress tracking per model
4. **Stop/Resume**: Stop processing at any time, failed tasks can be reset and retried

Modal.com configuration:
- Up to 1000 parallel containers
- Automatic retry for failed tasks
- Progress stored in Supabase

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/scoreboards | List all scoreboards |
| GET | /api/scoreboards/[id] | Get single scoreboard |
| POST | /api/colorpicker/generate-all | Queue all color combinations for a model |
| GET | /api/colorpicker/batch | Get batch processing status |
| POST | /api/colorpicker/batch/start | Start batch processing |
| POST | /api/colorpicker/batch | Stop batch or reset failed tasks |

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

Test coverage targets: 80%+ for branches, functions, lines, and statements.

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── colorpicker/     # Batch generation APIs
│   │   └── scoreboards/     # Scoreboard CRUD
│   ├── batch/               # Batch processing page
│   └── page.tsx             # Main customizer UI
├── components/
│   └── ColorizedScoreboard.tsx  # Canvas color replacement
├── lib/
│   ├── colorpicker.ts       # Color utilities
│   ├── colorpicker.test.ts  # Tests
│   └── supabase.ts          # Database client
modal_functions/
└── colorpicker_batch.py     # Modal batch processor
```

## License

Private - Electro-Mech Scoreboard Customizer
