import { Router } from 'express';
import { registerSSEClient, fetchRecentNotifications } from '../events/notificationBroadcaster.js';

const router = Router();

// GET /api/notifications/stream — Server-Sent Events stream for live real-time dashboard updates
router.get('/stream', (req, res) => {
  registerSSEClient(req, res);
});

// GET /api/notifications?limit=100 — snapshot query for the dashboard's log table
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 200);
    const logs = await fetchRecentNotifications(limit);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
