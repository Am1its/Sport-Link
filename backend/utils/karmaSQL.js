// Reusable karma SQL fragment. Assumes the outer query aliases the Users table as `u`.
const KARMA_SQL = `
  COALESCE((
    SELECT SUM(CASE WHEN attended = 1 THEN 1 ELSE -1 END)
    FROM Ratings WHERE ratee_id = u.id
  ), 0) +
  COALESCE((
    SELECT SUM(
      CASE WHEN sportsmanship = 1 THEN 1 WHEN sportsmanship = 0 THEN -1 ELSE 0 END +
      CASE WHEN punctuality   = 1 THEN 1 WHEN punctuality   = 0 THEN -1 ELSE 0 END +
      CASE WHEN communication = 1 THEN 1 WHEN communication = 0 THEN -1 ELSE 0 END
    )
    FROM PeerRatings WHERE ratee_id = u.id
  ), 0)
`;

module.exports = { KARMA_SQL };
