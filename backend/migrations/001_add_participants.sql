USE sportlink;

CREATE TABLE IF NOT EXISTS GameParticipants (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  game_id   INT NOT NULL,
  user_id   INT NOT NULL,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (game_id) REFERENCES Games(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES Users(id)  ON DELETE CASCADE,
  UNIQUE KEY unique_participation (game_id, user_id)
);
