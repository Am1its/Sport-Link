-- Performance indexes for high-frequency queries

-- GameParticipants: used in every game query (count, join check, mine list)
CREATE INDEX idx_gp_game_id ON GameParticipants (game_id);
CREATE INDEX idx_gp_user_id ON GameParticipants (user_id);

-- Messages: used in chat fetches and chat-list last-message lookup
CREATE INDEX idx_msg_game_id ON Messages (game_id);
CREATE INDEX idx_msg_game_created ON Messages (game_id, created_at);

-- Ratings / PeerRatings: scanned per user for karma computation
CREATE INDEX idx_ratings_ratee ON Ratings (ratee_id);
CREATE INDEX idx_peer_ratee ON PeerRatings (ratee_id);

-- Games: filtered by status + host_id on most queries
CREATE INDEX idx_games_status ON Games (status);
CREATE INDEX idx_games_host ON Games (host_id);

-- Friends: incoming requests lookup (addressee_id + status)
CREATE INDEX idx_friends_addressee_status ON Friends (addressee_id, status);
