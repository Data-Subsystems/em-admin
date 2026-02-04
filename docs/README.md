# EM Admin - Scoreboard Customizer

## Overview

EM Admin is a web application for customizing Electro-Mech scoreboard colors. Users can browse 429 scoreboard models, select custom colors for the face, accent stripes, and LED displays, and see real-time previews using canvas-based color replacement technology.

## Features

### Scoreboard Library
- Browse all 429 Electro-Mech scoreboard models
- Visual grid layout with model names
- Click any scoreboard to select it for customization

### Color Customizer
- **Face Color**: 18 color options for the main scoreboard body
- **Accent Color**: 18 color options for accent stripes (or none)
- **LED Color**: Red or amber for digit displays
- Real-time preview updates as colors are selected
- Canvas-based pixel manipulation preserves scoreboard details

### AI Analysis (Optional)
- AWS Bedrock Nova Lite vision model
- Detects scoreboard zones and layout types
- Identifies sport type and features
- Batch processing support

## Color Palette

### Face Colors (18 options)
| Color | Hex Code |
|-------|----------|
| Navy Blue | #003366 |
| Egyptian Blue | #1034A6 |
| Royal Blue | #4169E1 |
| Icy Blue | #71A6D2 |
| Shamrock Green | #009E60 |
| Jolly Green | #228B22 |
| Hunter Green | #355E3B |
| Silver Gray | #C0C0C0 |
| Matte Black | #28282B |
| White | #FFFFFF |
| Indigo Purple | #4B0082 |
| Power Purple | #7B68EE |
| Merchant Maroon | #800000 |
| Cardinal Red | #C41E3A |
| Racing Red | #D40000 |
| Tiger Orange | #FF6A00 |
| Golden Yellow | #FFD700 |
| Metallic Gold | #D4AF37 |

### LED Colors
| Color | Hex Code |
|-------|----------|
| Red | #FF0000 |
| Amber | #FFBF00 |

## Technical Architecture

### Frontend
- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS
- **State**: React useState with localStorage persistence
- **Image Processing**: HTML5 Canvas API

### Backend
- **Database**: Supabase (PostgreSQL)
- **Image Storage**: AWS S3 (em-admin-assets bucket)
- **AI Analysis**: AWS Bedrock Nova Lite
- **Deployment**: Vercel

### Key Components

#### ColorizedScoreboard
Canvas-based component that applies custom colors to scoreboard images in real-time:

1. Loads the original scoreboard image
2. Analyzes each pixel using HSL color space
3. Identifies pixel types:
   - Face pixels (dark/medium lightness)
   - LED pixels (bright red/amber)
   - Accent pixels (gray/silver)
4. Replaces colors while preserving brightness and detail

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/scoreboards | List all scoreboard models |
| GET | /api/scoreboards/[id] | Get single scoreboard details |
| POST | /api/scoreboards/import | Import scoreboards from data files |
| POST | /api/scoreboards/[id]/analyze | Analyze image with AI |
| GET | /api/analyze/batch | Get batch analysis status |
| POST | /api/analyze/batch | Start batch analysis |

## Environment Variables

```env
# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# AWS
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
```

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run linter
npm run lint
```

## Data Sources

- **Images**: 429 PNG files from Electro-Mech, stored in S3
- **Colors**: JSON configuration defining available color options
- **URL**: `https://em-admin-assets.s3.us-east-1.amazonaws.com/images/`

## Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

Requires HTML5 Canvas support for color customization features.
