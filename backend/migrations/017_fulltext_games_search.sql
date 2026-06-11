-- Full-text search index on Games title + location_desc
-- InnoDB FULLTEXT; minimum token size = 3 (innodb_ft_min_token_size default)
ALTER TABLE Games ADD FULLTEXT INDEX ft_games_search (title, location_desc);
