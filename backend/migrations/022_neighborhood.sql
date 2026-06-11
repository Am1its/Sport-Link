-- Migration 022: Neighborhood tags on games

ALTER TABLE Games ADD COLUMN IF NOT EXISTS neighborhood VARCHAR(100) NULL;
CREATE INDEX IF NOT EXISTS idx_games_neighborhood ON Games(neighborhood);
