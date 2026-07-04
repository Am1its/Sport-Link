const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();

// GET /api/admin/reports?status=open|reviewed|all (default: open)
router.get('/reports', authMiddleware, requireAdmin, async (req, res) => {
  const status = ['open', 'reviewed', 'all'].includes(req.query.status) ? req.query.status : 'open';
  const statusClause = status === 'open' ? 'WHERE r.reviewed_at IS NULL'
    : status === 'reviewed' ? 'WHERE r.reviewed_at IS NOT NULL'
    : '';
  try {
    const [rows] = await pool.execute(`
      SELECT r.id, r.reason, r.context, r.created_at, r.reviewed_at,
        reporter.id AS reporter_id, reporter.username AS reporter_username,
        reported.id AS reported_id, reported.username AS reported_username
      FROM Reports r
      JOIN Users reporter ON reporter.id = r.reporter_id
      JOIN Users reported ON reported.id = r.reported_id
      ${statusClause}
      ORDER BY r.created_at DESC
    `);
    res.json({ success: true, reports: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/admin/reports/:id/resolve — mark a report as reviewed
router.put('/reports/:id/resolve', authMiddleware, requireAdmin, async (req, res) => {
  const reportId = parseInt(req.params.id);
  if (isNaN(reportId)) return res.status(400).json({ success: false, message: 'Invalid report id' });
  try {
    const [result] = await pool.execute(
      'UPDATE Reports SET reviewed_at = NOW() WHERE id = ?', [reportId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Report not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
