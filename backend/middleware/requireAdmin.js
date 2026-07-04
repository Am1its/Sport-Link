const pool = require('../db');

// Runs after authMiddleware (needs req.user.id). Checks the DB fresh on every request
// rather than trusting a JWT claim, so revoking admin access takes effect immediately.
module.exports = async function requireAdmin(req, res, next) {
  try {
    const [[row]] = await pool.execute('SELECT is_admin FROM Users WHERE id = ?', [req.user.id]);
    if (!row?.is_admin) return res.status(403).json({ success: false, message: 'Admin only' });
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
