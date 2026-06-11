-- Migration 021: Waitlist, check-in, boost, post-game photo

ALTER TABLE GameParticipants
  ADD COLUMN IF NOT EXISTS status ENUM('joined','waitlist') NOT NULL DEFAULT 'joined',
  ADD COLUMN IF NOT EXISTS waitlist_position INT NULL,
  ADD COLUMN IF NOT EXISTS checked_in_at DATETIME NULL;

ALTER TABLE Games
  ADD COLUMN IF NOT EXISTS boosted_at DATETIME NULL,
  ADD COLUMN IF NOT EXISTS post_game_photo MEDIUMTEXT NULL;
