import { slackReportsQueue } from '../queue/slackReportsQueue.js';
import NotificationLog from '../models/NotificationLog.js';
import { buildDailyReports, getPreviousDayRange } from './aggregateDailyReports.js';

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
    await slackReportsQueue.add(
      'send-report',
      { ...report, report_date: reportDate },
      { jobId: `${report._id}-${reportDate}` } // idempotent: re-running for the same day won't double-enqueue
    );

    await NotificationLog.updateOne(
      { client_id: report._id, report_date: reportDate },
      { $setOnInsert: { status: 'pending' } },
      { upsert: true }
    );
  }

  return { reportDate, count: reports.length };
}
