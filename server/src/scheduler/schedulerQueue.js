import { Queue } from 'bullmq';
import { connection } from '../queue/connection.js';

// Deliberately a separate queue from "slack-reports": this one fires once a day and does
// DB/aggregation work, the other is the rate-limited Slack dispatch lane. Keeping them apart
// means the 1 job/sec limiter only ever applies to actual Slack sends, never to this.
export const schedulerQueue = new Queue('daily-aggregation-trigger', { connection });
