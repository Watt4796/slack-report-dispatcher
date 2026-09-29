import { slackReportsQueue } from '../queue/slackReportsQueue.js';
import NotificationLog from '../models/NotificationLog.js';
import { buildDailyReports, getPreviousDayRange } from './aggregateDailyReports.js';
import { publishNotificationEvent } from '../events/notificationBroadcaster.js';

function toISODate(date) {
  return date.toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

/**
 * Runs the aggregation, then pushes one job per client onto the slack-reports queue and
 * writes a "pending" NotificationLog row for each — before any Slack POST happens, so the
 * dashboard always has something to show. Phase 3's scheduler and manual-trigger endpoint
 * both just call this.
 */
export async function dispatchDailyReports(referenceDate = new Date()) {
  const reports = await buildDailyReports(referenceDate);
  const { start } = getPreviousDayRange(referenceDate);
  const reportDate = toISODate(start);

  for (const report of reports) {
    const jobId = `${report._id}-${reportDate}`;

    // If this job was previously completed or failed, remove it so a manual/re-triggered run can be processed again
    const existingJob = await slackReportsQueue.getJob(jobId);
    if (existingJob) {
      const state = await existingJob.getState();
      if (state === 'completed' || state === 'failed') {
        await existingJob.remove();
      }
    }

    await NotificationLog.updateOne(
      { client_id: report._id, report_date: reportDate },
      {
        $set: {
          status: 'pending',
          client_name: report.name,
          last_error: null,
          attempts: 0,
        },
      },
      { upsert: true }
    );

    await slackReportsQueue.add(
      'send-report',
      { ...report, report_date: reportDate },
      { jobId }
    );
  }

  if (reports.length > 0) {
    await publishNotificationEvent('reports_dispatched');
  }

  return { reportDate, count: reports.length };
}
