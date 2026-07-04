-- Court claims are currently honor-system (first-come, auto-approved). Add a manual
-- approval gate: new claims land as 'pending' and only unlock manager powers
-- (owner review responses, announcements) once flipped to 'approved'.
ALTER TABLE CourtClaims
  ADD COLUMN IF NOT EXISTS status ENUM('pending','approved') NOT NULL DEFAULT 'pending';
