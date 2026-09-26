import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { buildDailyReports } from '../services/aggregateDailyReports.js';

// Quick sanity check for Phase 1: run the real pipeline against seeded data
// and eyeball that spend/revenue/ROAS line up before anything touches Slack.
async function main() {
  await connectDB();
  const reports = await buildDailyReports();

  if (reports.length === 0) {
    console.log('No reports — did you run `npm run seed -w server` yet?');
  } else {
    console.table(
      reports.map((r) => ({
        client: r.name,
        spend: `$${r.total_spend.toFixed(2)}`,
        revenue: `$${r.total_revenue.toFixed(2)}`,
        roas: `${r.roas.toFixed(2)}x`,
      }))
    );
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[check-aggregation] failed:', err);
  process.exit(1);
});
