-- Scoreboard models table
CREATE TABLE IF NOT EXISTS scoreboard_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name TEXT NOT NULL UNIQUE,  -- e.g., "lx1020"
    image_filename TEXT NOT NULL,      -- e.g., "lx1020.png"
    image_url TEXT,                    -- URL to the image

    -- Analysis results from Nova Lite
    sport_type TEXT,                   -- baseball, basketball, hockey, etc.
    dimensions TEXT,                   -- wide, standard, tall
    layout_type TEXT,                  -- basic_score, baseball_full, hockey_penalty, etc.
    zones JSONB,                       -- Array of zone definitions
    customizable_areas JSONB,          -- Array of customizable areas
    features TEXT[],                   -- Array of feature flags

    -- Raw analysis JSON
    analysis_raw JSONB,
    analysis_status TEXT DEFAULT 'pending',  -- pending, processing, completed, error
    analysis_error TEXT,

    -- Color configuration (from scoreboard-colors.txt)
    color_config JSONB,                -- Original color config from source file

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    analyzed_at TIMESTAMPTZ
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_scoreboard_models_model_name ON scoreboard_models(model_name);
CREATE INDEX IF NOT EXISTS idx_scoreboard_models_sport_type ON scoreboard_models(sport_type);
CREATE INDEX IF NOT EXISTS idx_scoreboard_models_layout_type ON scoreboard_models(layout_type);
CREATE INDEX IF NOT EXISTS idx_scoreboard_models_analysis_status ON scoreboard_models(analysis_status);

-- Analysis jobs table for tracking batch processing
CREATE TABLE IF NOT EXISTS analysis_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status TEXT DEFAULT 'pending',     -- pending, running, completed, failed
    total_images INTEGER DEFAULT 0,
    processed_images INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Custom scoreboard configurations (user-created)
CREATE TABLE IF NOT EXISTS custom_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    base_model_id UUID REFERENCES scoreboard_models(id),

    -- Custom color selections
    face_color TEXT,                   -- Color key (e.g., "navy_blue")
    accent_color TEXT,                 -- Color key for striping
    led_color TEXT,                    -- "red" or "amber"

    -- Full color values (RGB)
    face_color_rgb TEXT,
    accent_color_rgb TEXT,
    led_color_rgb TEXT,

    -- Custom text/labels
    custom_labels JSONB,               -- Override default labels

    -- Preview image (generated)
    preview_image_url TEXT,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_scoreboard_models_updated_at ON scoreboard_models;
CREATE TRIGGER update_scoreboard_models_updated_at
    BEFORE UPDATE ON scoreboard_models
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_custom_configurations_updated_at ON custom_configurations;
CREATE TRIGGER update_custom_configurations_updated_at
    BEFORE UPDATE ON custom_configurations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
