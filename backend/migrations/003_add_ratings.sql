CREATE TABLE IF NOT EXISTS Ratings (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  game_id    INT NOT NULL,
  rater_id   INT NOT NULL,
  ratee_id   INT NOT NULL,
  attended   TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_rating (game_id, rater_id, ratee_id),
  FOREIGN KEY (game_id)  REFERENCES Games(id) ON DELETE CASCADE,
  FOREIGN KEY (rater_id) REFERENCES Users(id) ON DELETE CASCADE,
  FOREIGN KEY (ratee_id) REFERENCES Users(id) ON DELETE CASCADE
);
