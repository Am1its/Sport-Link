const jwt = require('jsonwebtoken');
const pool = require('../db');

module.exports = async function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) return res.status(401).json({ success: false, message: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Tokens issued before token_version existed carry no claim — treat as version 0,
    // matching the column's default, so pre-existing sessions aren't force-logged-out.
    const [[row]] = await pool.execute('SELECT token_version FROM Users WHERE id = ?', [decoded.id]);
    if (!row || row.token_version !== (decoded.token_version ?? 0)) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};
