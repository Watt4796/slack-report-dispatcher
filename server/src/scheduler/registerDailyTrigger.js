import { schedulerQueue } from './schedulerQueue.js';

const TZ = process.env.REPORT_TIMEZONE || 'Asia/Kolkata';

/**
 * Registers the 9 AM repeatable job. Safe to call on every server boot: BullMQ keys a
 * repeatable job's registration off its name + repeat options (pattern/tz here), so calling
 * this again with the same values does not create a duplicate schedule.
 */
export async function registerDailyTrigger() {
  await schedulerQueue.add(
    'trigger-daily-reports',
    {},
    {
      repeat: { pattern: '0 9 * * *', tz: TZ },
      jobId: 'daily-reports-9am',
    }
  );
  console.log(`[scheduler] daily trigger registered for 09:00 (${TZ})`);
}
