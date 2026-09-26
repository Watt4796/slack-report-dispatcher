import mongoose from 'mongoose';

const ClientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slack_notifications_enabled: { type: Boolean, default: false, index: true },
    slack_webhook_url: {
      type: String,
      trim: true,
      validate: {
        // restrict to real Slack webhook URLs — the worker will only ever POST here
        validator: (v) => !v || /^https:\/\/hooks\.slack\.com\/services\//.test(v),
        message: 'Must be a valid Slack incoming webhook URL',
      },
    },
    timezone: { type: String, default: 'Asia/Kolkata' },
  },
  { timestamps: true }
);

export default mongoose.model('Client', ClientSchema);
