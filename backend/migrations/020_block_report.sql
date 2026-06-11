-- Migration 020: Block/Report system
CREATE TABLE IF NOT EXISTS BlockedUsers (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  blocker_id INT NOT NULL,
  blocked_id INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_block (blocker_id, blocked_id),
  CONSTRAINT fk_block_blocker FOREIGN KEY (blocker_id) REFERENCES Users(id) ON DELETE CASCADE,
  CONSTRAINT fk_block_blocked FOREIGN KEY (blocked_id) REFERENCES Users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Reports (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  reporter_id INT NOT NULL,
  reported_id INT NOT NULL,
  reason      ENUM('spam','harassment','inappropriate','other') NOT NULL,
  context     VARCHAR(500) NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_report_reporter FOREIGN KEY (reporter_id) REFERENCES Users(id) ON DELETE CASCADE,
  CONSTRAINT fk_report_reported FOREIGN KEY (reported_id) REFERENCES Users(id) ON DELETE CASCADE
);
