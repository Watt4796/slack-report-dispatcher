import Client from '../models/Client.js';

/**
 * The UTC start/end of "yesterday" relative to referenceDate.
 * Kept as its own export so the 429/seed/verification scripts can all agree on the same window.
 */
export function getPreviousDayRange(referenceDate = new Date()) {
  const start = new Date(referenceDate);
  start.setUTCDate(start.getUTCDate() - 1);
  start.setUTCHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setUTCHours(23, 59, 59, 999);

  return { start, end };
}

/**
 * Every number here — the per-client sum, the currency conversion, the ROAS division,
 * the rounding — is computed inside MongoDB. Nothing is pulled into memory and mapped over.
 */
export async function buildDailyReports(referenceDate = new Date()) {
  const { start, end } = getPreviousDayRange(referenceDate);

  return Client.aggregate([
    // filter to opted-in clients FIRST, so the $lookup below only does date-range work
    // for clients we're actually about to notify
    { $match: { slack_notifications_enabled: true, slack_webhook_url: { $exists: true, $ne: '' } } },
    {
      $lookup: {
        from: 'dailystats',
        let: { clientId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$client_id', '$$clientId'] }, date: { $gte: start, $lte: end } } },
          {
            $group: {
              _id: '$client_id',
              total_spend_cents: { $sum: '$spend_cents' },
              total_revenue_cents: { $sum: '$revenue_cents' },
            },
          },
        ],
        as: 'stats',
      },
    },
    { $unwind: '$stats' }, // drops clients with zero rows for the day — nothing to report
    { $match: { 'stats.total_spend_cents': { $gt: 0 } } }, // guards the division below
    {
      $project: {
        _id: 1,
        name: 1,
        slack_webhook_url: 1,
        total_spend: { $divide: ['$stats.total_spend_cents', 100] },
        total_revenue: { $divide: ['$stats.total_revenue_cents', 100] },
        roas: { $round: [{ $divide: ['$stats.total_revenue_cents', '$stats.total_spend_cents'] }, 2] },
      },
    },
  ]);
}
