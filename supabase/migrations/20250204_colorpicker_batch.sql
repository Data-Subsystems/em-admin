-- Enum for task status
CREATE TYPE colorpicker_task_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- Main tracking table for individual image generation tasks
CREATE TABLE colorpicker_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Task identification (unique combination)
  model VARCHAR(50) NOT NULL,
  primary_color VARCHAR(50) NOT NULL,
  accent_color VARCHAR(50) NOT NULL,
  led_color VARCHAR(20) NOT NULL,
  width INT NOT NULL DEFAULT 720,

  -- Status tracking
  status colorpicker_task_status NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,

  -- Results
  s3_key VARCHAR(500),
  file_size_bytes INT,
  error_message TEXT,

  -- Timing
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Processing metadata
  container_id VARCHAR(100),
  batch_id UUID,

  -- Unique constraint for combination
  CONSTRAINT unique_color_combination UNIQUE (model, primary_color, accent_color, led_color, width)
);

-- Batch tracking table
CREATE TABLE colorpicker_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Batch info
  total_tasks INT NOT NULL DEFAULT 0,
  completed_tasks INT NOT NULL DEFAULT 0,
  failed_tasks INT NOT NULL DEFAULT 0,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'running',

  -- Timing
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Stats
  images_per_second FLOAT,
  total_duration_seconds INT
);

-- Model tracking table
CREATE TABLE colorpicker_models (
  model VARCHAR(50) PRIMARY KEY,

  -- Model config
  has_face_layer BOOLEAN DEFAULT TRUE,
  has_accent_layer BOOLEAN DEFAULT TRUE,
  has_led_layer BOOLEAN DEFAULT TRUE,
  has_caption_layer BOOLEAN DEFAULT TRUE,
  is_multicolor_led BOOLEAN DEFAULT FALSE,

  -- Defaults
  default_primary VARCHAR(50),
  default_accent VARCHAR(50),
  default_caption VARCHAR(50),
  default_led VARCHAR(20),

  -- Processing stats
  total_combinations INT,
  completed_combinations INT DEFAULT 0,

  -- Status
  masks_verified BOOLEAN DEFAULT FALSE,
  last_processed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX idx_tasks_status ON colorpicker_tasks(status);
CREATE INDEX idx_tasks_model ON colorpicker_tasks(model);
CREATE INDEX idx_tasks_batch ON colorpicker_tasks(batch_id);
CREATE INDEX idx_tasks_pending ON colorpicker_tasks(status, attempts) WHERE status IN ('pending', 'failed');

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_colorpicker_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER update_colorpicker_tasks_updated_at
  BEFORE UPDATE ON colorpicker_tasks
  FOR EACH ROW EXECUTE FUNCTION update_colorpicker_updated_at();

CREATE TRIGGER update_colorpicker_batches_updated_at
  BEFORE UPDATE ON colorpicker_batches
  FOR EACH ROW EXECUTE FUNCTION update_colorpicker_updated_at();

CREATE TRIGGER update_colorpicker_models_updated_at
  BEFORE UPDATE ON colorpicker_models
  FOR EACH ROW EXECUTE FUNCTION update_colorpicker_updated_at();

-- View for progress monitoring
CREATE VIEW colorpicker_progress AS
SELECT
  model,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  COUNT(*) FILTER (WHERE status = 'pending') as pending,
  COUNT(*) FILTER (WHERE status = 'processing') as processing,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'completed') / NULLIF(COUNT(*), 0), 2) as percent_complete
FROM colorpicker_tasks
GROUP BY model
ORDER BY model;

-- View for overall stats
CREATE VIEW colorpicker_stats AS
SELECT
  COUNT(*) as total_tasks,
  COUNT(*) FILTER (WHERE status = 'completed') as completed,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  COUNT(*) FILTER (WHERE status = 'pending') as pending,
  COUNT(*) FILTER (WHERE status = 'processing') as processing,
  COUNT(DISTINCT model) as total_models,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'completed') / NULLIF(COUNT(*), 0), 2) as percent_complete,
  SUM(file_size_bytes) FILTER (WHERE status = 'completed') as total_bytes_generated
FROM colorpicker_tasks;
