ALTER TABLE Games MODIFY sport_type ENUM(
  'basketball','tennis','volleyball','football',
  'yoga','footvolley','studio','gym','swimming',
  'padel','hiking','walking'
) NOT NULL;
