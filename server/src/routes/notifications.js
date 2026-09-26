import { Router } from 'express';
import NotificationLog from '../models/NotificationLog.js';

const router = Router();

// GET /api/notifications?limit=50 — recent rows for the dashboard's log table
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const logs = await NotificationLog.find()
      .sort({ updatedAt: -1 })
      .limit(limit)
      .populate('client_id', 'name')
      .lean();

    res.json(
      logs.map((log) => ({
        id: log._id,
        client_name: log.client_id?.name ?? 'Unknown client',
        report_date: log.report_date,
        status: log.status,
        attempts: log.attempts,
        last_error: log.last_error ?? null,
        sent_at: log.sent_at ?? null,
        updated_at: log.updatedAt,
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
