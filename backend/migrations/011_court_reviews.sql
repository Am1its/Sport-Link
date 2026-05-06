CREATE TABLE IF NOT EXISTS CourtReviews (
  id         INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  place_id   VARCHAR(200) NOT NULL,
  user_id    INT          NOT NULL,
  rating     TINYINT      NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    VARCHAR(500) NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_court_user (place_id, user_id),
  FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
);

ALTER TABLE CourtReviews ADD INDEX idx_court_reviews_place (place_id);
