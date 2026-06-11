-- Persist reminder sent state in DB so server restarts don't cause double notifications
ALTER TABLE Games
  ADD COLUMN reminder_sent_at DATETIME NULL DEFAULT NULL;
