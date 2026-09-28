import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') }); // worker -> src -> server -> repo root

import { Worker } from 'bullmq';
import axios from 'axios';
import { connection } from '../queue/connection.js';
import { connectDB } from '../config/db.js';
import NotificationLog from '../models/NotificationLog.js';
import { buildBlockKitPayload } from './blockKit.js';
import { publishNotificationEvent } from '../events/notificationBroadcaster.js';

// During development/testing this points at the local mock endpoint from Section 6 of the
// brief. Unset it (or remove the line from .env) for the real run so the worker posts to
// each client's own slack_webhook_url instead.
const TARGET_URL_OVERRIDE = process.env.SLACK_ENDPOINT_OVERRIDE;

async function processReport(job) {
  const report = job.data;
  const url = TARGET_URL_OVERRIDE || report.slack_webhook_url;
  const payload = buildBlockKitPayload(report);

  let response;
  try {
    response = await axios.post(url, payload, { validateStatus: () => true, timeout: 8000 });
  } catch (networkErr) {
    // DNS/timeout/connection-refused — a genuine failure. Let BullMQ's own attempts/backoff
    // (configured on the queue) handle the retry.
    await NotificationLog.updateOne(
      { client_id: report._id, report_date: report.report_date },
      { $inc: { attempts: 1 }, status: 'failed', last_error: networkErr.message, ...(report.name && { client_name: report.name }) }
    );
    await publishNotificationEvent('report_failed');
    throw networkErr;
  }

  if (response.status === 429) {
    const retryAfterSeconds = Number(response.headers['retry-after'] ?? 3);
    await worker.rateLimit(retryAfterSeconds * 1000);
    // Intentionally NOT touching NotificationLog here, and this throw is intentionally outside
    // any try/catch that would treat it as a generic failure: BullMQ recognizes this exact
    // error internally and re-queues the job without consuming an attempt or firing 'failed'.
    // As far as the log is concerned this job is still just "pending".
    throw Worker.RateLimitError();
  }

  if (response.status >= 400) {
    await NotificationLog.updateOne(
      { client_id: report._id, report_date: report.report_date },
      { $inc: { attempts: 1 }, status: 'failed', last_error: `Slack responded ${response.status}`, ...(report.name && { client_name: report.name }) }
    );
    await publishNotificationEvent('report_failed');
    throw new Error(`Slack responded ${response.status}`);
  }

  await NotificationLog.updateOne(
    { client_id: report._id, report_date: report.report_date },
    { status: 'sent', sent_at: new Date(), slack_response_status: response.status, ...(report.name && { client_name: report.name }) }
  );
  await publishNotificationEvent('report_sent');
}

// Connect before the worker starts pulling jobs, so processReport's NotificationLog writes
// never race an in-progress Mongo connection.
await connectDB();

const worker = new Worker('slack-reports', processReport, {
  connection,
  limiter: { max: 1, duration: 1000 }, // hard ceiling: 1 job/sec baseline
  concurrency: 1, // serialize strictly — see the architecture doc for why
});

worker.on('completed', (job) => console.log(`[worker] sent report for job ${job.id}`));
worker.on('failed', (job, err) => console.error(`[worker] job ${job?.id} failed:`, err.message));

console.log('[worker] listening on queue "slack-reports" (1 job/sec, target:', TARGET_URL_OVERRIDE || '(per-client webhook)', ')');
