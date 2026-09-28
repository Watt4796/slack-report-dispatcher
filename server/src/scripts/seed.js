import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') }); // scripts -> src -> server -> repo root

import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import Client from '../models/Client.js';
import DailyStat from '../models/DailyStat.js';
import NotificationLog from '../models/NotificationLog.js';

const CHANNELS = ['meta_ads', 'google_ads'];
const DAYS_BACK = 3;

function readWebhookUrls() {
  // Set SEED_SLACK_WEBHOOK_URLS in .env to your 5 real hooks.slack.com URLs
  // (Section 3 of the brief) — kept out of source so nothing secret gets committed.
  const raw = process.env.SEED_SLACK_WEBHOOK_URLS;
  if (!raw) {
    throw new Error(
      'Set SEED_SLACK_WEBHOOK_URLS in .env to 5 comma-separated Slack webhook URLs before seeding.'
    );
  }
  const urls = raw.split(',').map((u) => u.trim()).filter(Boolean);
  if (urls.length !== 5) {
    throw new Error(`Expected 5 webhook URLs in SEED_SLACK_WEBHOOK_URLS, got ${urls.length}.`);
  }
  return urls;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function seed() {
  await connectDB();

  const webhookUrls = readWebhookUrls();

  await Promise.all([
    Client.deleteMany({}),
    DailyStat.deleteMany({}),
    NotificationLog.deleteMany({}),
  ]);

  const clients = await Client.insertMany(
    webhookUrls.map((url, i) => ({
      name: `Brand ${String.fromCharCode(65 + i)}`, // Brand A..E
      slack_notifications_enabled: true,
      slack_webhook_url: url,
    }))
  );

  const rows = [];
  for (const client of clients) {
    for (let daysAgo = 1; daysAgo <= DAYS_BACK; daysAgo++) {
      const date = new Date();
      date.setUTCDate(date.getUTCDate() - daysAgo);
      date.setUTCHours(0, 0, 0, 0);

      for (const channel of CHANNELS) {
        rows.push({
          client_id: client._id,
          date,
          channel,
          spend_cents: randomInt(20000, 80000), // $200–$800
          revenue_cents: randomInt(40000, 250000), // $400–$2500
        });
      }
    }
  }
  await DailyStat.insertMany(rows);

  console.log(`Seeded ${clients.length} clients and ${rows.length} daily_stats rows.`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
