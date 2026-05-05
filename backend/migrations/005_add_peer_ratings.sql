CREATE TABLE IF NOT EXISTS PeerRatings (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  game_id       INT NOT NULL,
  rater_id      INT NOT NULL,
  ratee_id      INT NOT NULL,
  sportsmanship TINYINT DEFAULT NULL,  -- 1 = thumbs up, 0 = thumbs down
  punctuality   TINYINT DEFAULT NULL,
  communication TINYINT DEFAULT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_peer_rating (game_id, rater_id, ratee_id),
  FOREIGN KEY (game_id)   REFERENCES Games(id) ON DELETE CASCADE,
  FOREIGN KEY (rater_id)  REFERENCES Users(id) ON DELETE CASCADE,
  FOREIGN KEY (ratee_id)  REFERENCES Users(id) ON DELETE CASCADE
);
