import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { dispatchDailyReports } from '../services/dispatchDailyReports.js';

// Manual stand-in for Phase 3's scheduler/trigger endpoint, so the queue + worker can be
// tested end-to-end right now without waiting on a cron.
async function main() {
  await connectDB();
  const { reportDate, count } = await dispatchDailyReports();
  console.log(`Enqueued ${count} report(s) for ${reportDate}.`);
  console.log('Start the worker in another terminal to process them: npm run worker -w server');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[enqueue] failed:', err);
  process.exit(1);
});
