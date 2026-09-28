import { Router } from 'express';
import { dispatchDailyReports } from '../services/dispatchDailyReports.js';

const router = Router();

// Manual stand-in for the 9 AM cron — trigger a run on demand instead of waiting for the
// actual scheduled time. This is the endpoint you'll hit before recording the Loom video.
router.post('/reports/run-now', async (_req, res) => {
  try {
    const NotificationLog = (await import('../models/NotificationLog.js')).default;
    const pendingCount = await NotificationLog.countDocuments({ status: 'pending' });
    if (pendingCount > 0) {
      return res.status(409).json({
        ok: false,
        error: `A dispatch run is already in progress (${pendingCount} report(s) still sending). Please wait until delivery completes.`,
      });
    }

    const { reportDate, count } = await dispatchDailyReports();
    res.json({ ok: true, reportDate, enqueued: count });
  } catch (err) {
    console.error('[reports] run-now failed:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
