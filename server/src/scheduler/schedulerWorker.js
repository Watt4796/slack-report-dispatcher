import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') }); // scheduler -> src -> server -> repo root

import { Worker } from 'bullmq';
import { connection } from '../queue/connection.js';
import { connectDB } from '../config/db.js';
import { dispatchDailyReports } from '../services/dispatchDailyReports.js';

// This is a separate long-running process from the API server and from the slack-reports
// worker. It only ever does DB/aggregation work + enqueueing — it never talks to Slack itself.
await connectDB();

const worker = new Worker(
  'daily-aggregation-trigger',
  async (job) => {
    const { reportDate, count } = await dispatchDailyReports();
    console.log(`[scheduler] job ${job.id} enqueued ${count} report(s) for ${reportDate}`);
  },
  { connection }
);

worker.on('failed', (job, err) => console.error(`[scheduler] job ${job?.id} failed:`, err.message));

console.log('[scheduler] listening on queue "daily-aggregation-trigger"');
