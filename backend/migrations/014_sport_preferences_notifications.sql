CREATE TABLE IF NOT EXISTS Notifications (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  title      VARCHAR(200),
  body       TEXT,
  data       JSON,
  is_read    BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
  INDEX idx_notifications_user (user_id)
);

CREATE TABLE IF NOT EXISTS SportPreferences (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  sport_type  VARCHAR(50) NOT NULL,
  skill_level TINYINT DEFAULT 3,
  is_favorite BOOLEAN DEFAULT FALSE,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_sport (user_id, sport_type),
  FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
);
