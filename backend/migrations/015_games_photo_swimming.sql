ALTER TABLE Games ADD COLUMN IF NOT EXISTS photo MEDIUMTEXT DEFAULT NULL;

ALTER TABLE Games MODIFY sport_type ENUM(
  'basketball','tennis','volleyball','football',
  'yoga','footvolley','studio','gym','swimming'
) NOT NULL;
