import { Router } from 'express';
import { dispatchDailyReports } from '../services/dispatchDailyReports.js';

const router = Router();

// Manual stand-in for the 9 AM cron — trigger a run on demand instead of waiting for the
// actual scheduled time. This is the endpoint you'll hit before recording the Loom video.
router.post('/reports/run-now', async (_req, res) => {
  try {
    const { reportDate, count } = await dispatchDailyReports();
    res.json({ ok: true, reportDate, enqueued: count });
  } catch (err) {
    console.error('[reports] run-now failed:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
