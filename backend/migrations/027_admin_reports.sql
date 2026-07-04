-- Reports previously had no admin surface — this closes the loop with a minimal
-- is_admin gate + a reviewed_at flag so reports can be marked handled.
ALTER TABLE Users
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE Reports
  ADD COLUMN IF NOT EXISTS reviewed_at DATETIME NULL DEFAULT NULL;
