import mongoose from 'mongoose';

const DailyStatSchema = new mongoose.Schema(
  {
    client_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    date: { type: Date, required: true },
    channel: { type: String, required: true }, // e.g. meta_ads, google_ads
    spend_cents: { type: Number, required: true, min: 0 },
    revenue_cents: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

// the exact shape the aggregation pipeline queries on
DailyStatSchema.index({ client_id: 1, date: 1 });

// NOTE: this model name pluralizes/lowercases to the "dailystats" collection,
// which is what the $lookup "from" in aggregateDailyReports.js targets.
export default mongoose.model('DailyStat', DailyStatSchema);
