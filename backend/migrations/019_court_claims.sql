-- Court claims: one manager per court (first-come, auto-approved)
CREATE TABLE IF NOT EXISTS CourtClaims (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  place_id   VARCHAR(200) NOT NULL,
  user_id    INT NOT NULL,
  claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_court_claim (place_id),
  CONSTRAINT fk_court_claim_user FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
);

-- Owner responses on reviews
ALTER TABLE CourtReviews
  ADD COLUMN owner_response VARCHAR(500) NULL DEFAULT NULL,
  ADD COLUMN owner_response_at DATETIME NULL DEFAULT NULL;
