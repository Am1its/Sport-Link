-- JWTs live 90 days with no revocation — logout is client-side only, so a leaked token
-- keeps working for up to 3 months. token_version lets us invalidate all outstanding
-- tokens for a user on demand (checked in authMiddleware on every request).
ALTER TABLE Users
  ADD COLUMN IF NOT EXISTS token_version INT NOT NULL DEFAULT 0;
