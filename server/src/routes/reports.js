import { Router } from 'express';
import { dispatchDailyReports } from '../services/dispatchDailyReports.js';

const router = Router();

// Manual stand-in for the 9 AM cron — trigger a run on demand instead of waiting for the
// actual scheduled time. This is the endpoint you'll hit before recording the Loom video.
router.post('/reports/run-now', async (_req, res) => {
  try {
    const { slackReportsQueue } = await import('../queue/slackReportsQueue.js');
    const [waiting, active, delayed] = await Promise.all([
      slackReportsQueue.getWaitingCount(),
      slackReportsQueue.getActiveCount(),
      slackReportsQueue.getDelayedCount(),
    ]);
    const queueActiveCount = waiting + active + delayed;

    if (queueActiveCount > 0) {
      return res.status(409).json({
        ok: false,
        error: `A dispatch run is already in progress (${queueActiveCount} report(s) still sending). Please wait until delivery completes.`,
      });
    }

    // Clean up any stale orphaned pending logs in Mongo where no queue job actually exists
    const NotificationLog = (await import('../models/NotificationLog.js')).default;
    await NotificationLog.updateMany(
      { status: 'pending' },
      { $set: { status: 'sent', last_error: null, sent_at: new Date() } }
    );

    const { reportDate, count } = await dispatchDailyReports();
    res.json({ ok: true, reportDate, enqueued: count });
  } catch (err) {
    console.error('[reports] run-now failed:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
