import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') }); // scripts -> src -> server -> repo root

import mongoose from 'mongoose';
import axios from 'axios';
import { connectDB } from '../config/db.js';
import { slackReportsQueue } from '../queue/slackReportsQueue.js';
import NotificationLog from '../models/NotificationLog.js';
import { publishNotificationEvent } from '../events/notificationBroadcaster.js';

// Phase 4: prove the 429 path end-to-end. This enqueues N synthetic jobs (not tied to the
// 5 seeded clients — you only have 5, and this wants ~20) straight onto slack-reports, then
// polls notification_logs until every one of them resolves to sent/failed. Run the worker
// in another terminal first: `npm run worker -w server`.
//
// Usage: npm run verify:429 -w server -- 20

const JOB_COUNT = Number(process.argv[2] ?? 20);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function randomAmount(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function assertPointingAtMock() {
  const override = process.env.SLACK_ENDPOINT_OVERRIDE;
  if (!override) {
    throw new Error(
      'SLACK_ENDPOINT_OVERRIDE is not set. Point it at the mock endpoint before running this ' +
        '(e.g. http://localhost:4000/api/mock-slack-webhook) — never load-test a real Slack URL.'
    );
  }
  if (!override.includes('mock-slack-webhook')) {
    throw new Error(
      `Refusing to run: SLACK_ENDPOINT_OVERRIDE ("${override}") doesn't look like the mock ` +
        'endpoint. This script fires a burst of jobs — only ever point it at /api/mock-slack-webhook.'
    );
  }
}

async function main() {
  assertPointingAtMock();
  await connectDB();

  const reportDate = `load-test-${Date.now()}`; // synthetic — never collides with a real day
  const jobs = Array.from({ length: JOB_COUNT }, (_, i) => {
    const spend = randomAmount(200, 800);
    const revenue = randomAmount(400, 2500);
    return {
      _id: new mongoose.Types.ObjectId(),
      name: `Synthetic Client ${i + 1}`,
      slack_webhook_url: process.env.SLACK_ENDPOINT_OVERRIDE, // unused while the override is set, kept realistic
      total_spend: spend,
      total_revenue: revenue,
      roas: Math.round((revenue / spend) * 100) / 100,
      report_date: reportDate,
    };
  });

  // Preflight check: verify API server is online and a worker is listening
  try {
    await axios.post(process.env.SLACK_ENDPOINT_OVERRIDE, {}, { timeout: 2000, validateStatus: () => true });
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      console.warn(`\n⚠️  WARNING: Could not connect to API server at ${process.env.SLACK_ENDPOINT_OVERRIDE}`);
      console.warn('   The mock Slack endpoint is offline. Please make sure "npm run dev" is running!\n');
    }
  }

  const workers = await slackReportsQueue.getWorkers().catch(() => []);
  if (workers.length === 0) {
    console.warn('\n⚠️  WARNING: No active worker detected on queue "slack-reports"!');
    console.warn('   Jobs will stay pending until you start the worker in another terminal:');
    console.warn('   👉 Run "npm run dev" (starts server + worker) or "npm run worker -w server"\n');
  }

  // Handle Ctrl+C gracefully: clean up any pending records for this run so nothing is orphaned
  process.on('SIGINT', async () => {
    console.log('\n\nCancelled by user. Cleaning up pending load-test jobs...');
    await NotificationLog.deleteMany({ report_date: reportDate, status: 'pending' }).catch(() => {});
    await mongoose.disconnect().catch(() => {});
    process.exit(130);
  });

  console.log(`Enqueuing ${JOB_COUNT} synthetic jobs against the mock endpoint...`);
  const start = Date.now();

  for (const report of jobs) {
    await NotificationLog.updateOne(
      { client_id: report._id, report_date: reportDate },
      { $setOnInsert: { status: 'pending' }, $set: { client_name: report.name } },
      { upsert: true }
    );
    await slackReportsQueue.add('send-report', report, { jobId: `${report._id}-${reportDate}` });
  }

  await publishNotificationEvent('load_test_started');

  console.log('Enqueued. Waiting for the worker to drain the queue (Ctrl+C to stop watching)...\n');

  const deadline = Date.now() + 5 * 60 * 1000; // 5 min safety timeout
  let finished = false;
  let dropped = 0;

  while (Date.now() < deadline) {
    const rows = await NotificationLog.find({ report_date: reportDate }).lean();
    const pending = rows.filter((r) => r.status === 'pending').length;
    const sent = rows.filter((r) => r.status === 'sent').length;
    const failed = rows.filter((r) => r.status === 'failed').length;

    process.stdout.write(`\r  [Progress] Pending (processing / 429 cooldown): ${pending} | Sent: ${sent} | Failed: ${failed}   `);

    if (pending === 0) {
      const elapsedSec = ((Date.now() - start) / 1000).toFixed(1);
      dropped = JOB_COUNT - sent - failed;

      console.log(`\n\nDone in ${elapsedSec}s for ${JOB_COUNT} jobs.`);
      console.log(`  baseline at 1 job/sec: ~${JOB_COUNT}s, plus time spent paused on any Retry-After hits`);
      console.log(`  sent: ${sent}  failed: ${failed}  dropped: ${dropped}`);
      console.log(dropped === 0 ? '  PASS — no jobs were dropped' : `  FAIL — ${dropped} job(s) unaccounted for`);
      finished = true;
      break;
    }
    await sleep(1000);
  }

  if (!finished) {
    console.log('\n\nTimed out waiting for completion — is the worker running? `npm run worker -w server`');
  }

  await slackReportsQueue.close().catch(() => {});
  await mongoose.disconnect();
  process.exit(finished && dropped === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('[load-test-429] failed:', err);
  process.exit(1);
});
