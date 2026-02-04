-- Generation progress tracking for real-time UI updates
-- Tracks the progress of individual image generation requests

CREATE TABLE IF NOT EXISTS colorpicker_generation_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,  -- Unique ID for this generation request
  model TEXT NOT NULL,
  primary_color TEXT NOT NULL,
  accent_color TEXT NOT NULL,
  led_color TEXT NOT NULL,

  -- Progress tracking
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, running, completed, error
  current_step TEXT,  -- Human-readable current step
  step_number INTEGER DEFAULT 0,  -- 0-7
  total_steps INTEGER DEFAULT 7,
  progress_percent INTEGER DEFAULT 0,

  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Result
  result_url TEXT,
  error_message TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by session_id
CREATE INDEX IF NOT EXISTS idx_progress_session ON colorpicker_generation_progress(session_id);

-- Auto-cleanup old progress records (keep last 24 hours)
CREATE INDEX IF NOT EXISTS idx_progress_created ON colorpicker_generation_progress(created_at);

-- Function to clean up old progress records
CREATE OR REPLACE FUNCTION cleanup_old_progress()
RETURNS void AS $$
BEGIN
  DELETE FROM colorpicker_generation_progress
  WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
ALTER TABLE colorpicker_generation_progress ENABLE ROW LEVEL SECURITY;

-- Allow anonymous reads for progress polling
CREATE POLICY "Allow anonymous progress reads"
  ON colorpicker_generation_progress
  FOR SELECT
  USING (true);

-- Allow service role full access
CREATE POLICY "Service role full access"
  ON colorpicker_generation_progress
  FOR ALL
  USING (true)
  WITH CHECK (true);
