-- Add is_template flag to boards table
-- Template boards are real boards used as starting points for new boards
ALTER TABLE boards ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT false;

-- Index for filtering template boards
CREATE INDEX IF NOT EXISTS idx_boards_is_template ON boards(is_template) WHERE is_template = true;
