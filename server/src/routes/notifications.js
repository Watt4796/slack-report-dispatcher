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

// DELETE /api/notifications — delete all notification logs from MongoDB and clean Redis queue
router.delete('/', async (req, res) => {
  try {
    const NotificationLog = (await import('../models/NotificationLog.js')).default;
    const { publishNotificationEvent } = await import('../events/notificationBroadcaster.js');
    const { slackReportsQueue } = await import('../queue/slackReportsQueue.js');
    const result = await NotificationLog.deleteMany({});
    await slackReportsQueue.obliterate({ force: true }).catch(() => {});
    await publishNotificationEvent('clear');
    res.json({ message: 'All notification logs cleared', deletedCount: result.deletedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/:id/retry — retry a notification up to 3 times
router.post('/:id/retry', async (req, res) => {
  try {
    const NotificationLog = (await import('../models/NotificationLog.js')).default;
    const Client = (await import('../models/Client.js')).default;
    const DailyStat = (await import('../models/DailyStat.js')).default;
    const { slackReportsQueue } = await import('../queue/slackReportsQueue.js');
    const { publishNotificationEvent } = await import('../events/notificationBroadcaster.js');

    const log = await NotificationLog.findById(req.params.id);
    if (!log) {
      return res.status(404).json({ error: 'Notification log not found' });
    }

    if (log.attempts >= 3) {
      return res.status(400).json({ error: 'Maximum 3 retries reached for this report' });
    }

    const client = await Client.findById(log.client_id);
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    if (!client.slack_notifications_enabled) {
      return res.status(400).json({ error: 'Slack notifications are disabled for this client' });
    }

    if (!client.slack_webhook_url) {
      return res.status(400).json({ error: 'Client has no Slack webhook configured' });
    }

    // Re-aggregate daily stats for this client on report_date
    const [year, month, day] = log.report_date.split('-').map(Number);
    const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

    const stats = await DailyStat.aggregate([
      { $match: { client_id: client._id, date: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: '$client_id',
          total_spend_cents: { $sum: '$spend_cents' },
          total_revenue_cents: { $sum: '$revenue_cents' },
        },
      },
    ]);

    const spendCents = stats[0]?.total_spend_cents ?? 0;
    const revCents = stats[0]?.total_revenue_cents ?? 0;
    const total_spend = spendCents / 100;
    const total_revenue = revCents / 100;
    const roas = spendCents > 0 ? Math.round((revCents / spendCents) * 100) / 100 : 0;

    const jobId = `${client._id}-${log.report_date}`;
    const existingJob = await slackReportsQueue.getJob(jobId);
    if (existingJob) {
      await existingJob.remove();
    }

    log.status = 'pending';
    log.last_error = null;
    await log.save();

    await slackReportsQueue.add(
      'send-report',
      {
        _id: client._id,
        name: client.name,
        slack_webhook_url: client.slack_webhook_url,
        total_spend,
        total_revenue,
        roas,
        report_date: log.report_date,
      },
      { jobId }
    );

    await publishNotificationEvent('report_retried');
    res.json({ ok: true, message: 'Report queued for retry', attempts: log.attempts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
