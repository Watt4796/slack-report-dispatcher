import { Queue } from 'bullmq';
import { connection } from './connection.js';

export const slackReportsQueue = new Queue('slack-reports', {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { age: 86400 },
    // keep failed jobs around — Mongo's notification_logs is the real source of truth
    // for the dashboard, but it's useful to still see them in Redis/Bull Board while debugging
    removeOnFail: false,
  },
});
