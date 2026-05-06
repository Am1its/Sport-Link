ALTER TABLE Users ADD COLUMN google_id VARCHAR(100) NULL AFTER email;
ALTER TABLE Users ADD UNIQUE INDEX idx_users_google_id (google_id);
ALTER TABLE Users MODIFY COLUMN password_hash VARCHAR(255) NULL;
