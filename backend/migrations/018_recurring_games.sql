-- Add recurrence support to Games
ALTER TABLE Games
  ADD COLUMN recurrence ENUM('none', 'weekly', 'biweekly') NOT NULL DEFAULT 'none',
  ADD COLUMN parent_game_id INT NULL DEFAULT NULL,
  ADD CONSTRAINT fk_parent_game FOREIGN KEY (parent_game_id) REFERENCES Games(id) ON DELETE SET NULL;
