-- Migration 023: User streaks and badges

ALTER TABLE Users
  ADD COLUMN IF NOT EXISTS current_streak INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS longest_streak INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_game_date DATE NULL;

CREATE TABLE IF NOT EXISTS Badges (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  badge_key  VARCHAR(50) NOT NULL,
  earned_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_badge (user_id, badge_key),
  CONSTRAINT fk_badge_user FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
);
