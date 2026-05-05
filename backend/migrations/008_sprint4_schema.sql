-- Onboarding flag (backfill existing users as already onboarded)
ALTER TABLE Users ADD COLUMN onboarding_complete BOOLEAN DEFAULT FALSE;
UPDATE Users SET onboarding_complete = TRUE;

-- Game title
ALTER TABLE Games ADD COLUMN title VARCHAR(100) DEFAULT NULL;

-- Expand sport_type ENUM with new sports
ALTER TABLE Games MODIFY sport_type ENUM(
  'basketball','tennis','volleyball','football',
  'yoga','footvolley','studio','gym'
) NOT NULL;
