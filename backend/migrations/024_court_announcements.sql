-- Migration 024: Court announcements (manager-only pinned notices)

CREATE TABLE IF NOT EXISTS CourtAnnouncements (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  place_id   VARCHAR(200) NOT NULL,
  user_id    INT NOT NULL,
  message    VARCHAR(500) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ann_place (place_id),
  CONSTRAINT fk_ann_user FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
);
