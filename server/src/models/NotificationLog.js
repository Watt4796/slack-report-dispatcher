import mongoose from 'mongoose';

const NotificationLogSchema = new mongoose.Schema(
  {
    client_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    report_date: { type: String, required: true }, // 'YYYY-MM-DD' — a string, not a Date, to sidestep TZ drift in the key
    status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending', index: true },
    attempts: { type: Number, default: 0 },
    last_error: { type: String },
    slack_response_status: { type: Number },
    sent_at: { type: Date },
  },
  { timestamps: true }
);

// one row per client per day — also what the worker upserts against
NotificationLogSchema.index({ client_id: 1, report_date: 1 }, { unique: true });

export default mongoose.model('NotificationLog', NotificationLogSchema);
