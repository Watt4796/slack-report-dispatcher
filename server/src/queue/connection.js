import { Redis } from 'ioredis';

// BullMQ issues blocking Redis commands and requires this to be null — omit it and
// the worker just hangs with no obvious error, which is a very common first bug report.
export const connection = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
});
