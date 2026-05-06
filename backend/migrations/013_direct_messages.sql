CREATE TABLE IF NOT EXISTS DirectMessages (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  sender_id   INT NOT NULL,
  receiver_id INT NOT NULL,
  content     TEXT,
  type        ENUM('text', 'event') NOT NULL DEFAULT 'text',
  event_id    INT NULL,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id)   REFERENCES Users(id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES Users(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id)    REFERENCES Games(id) ON DELETE SET NULL,
  INDEX idx_dm_sender   (sender_id),
  INDEX idx_dm_receiver (receiver_id)
);
