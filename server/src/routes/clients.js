import { Router } from 'express';
import Client from '../models/Client.js';

const router = Router();

// GET /api/clients — list all clients for the settings dashboard
router.get('/', async (_req, res) => {
  try {
    const clients = await Client.find().sort({ name: 1 }).lean();
    res.json(clients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/clients/:id — update the webhook URL and/or the enabled toggle.
// runValidators is required here — Mongoose does not run schema validators
// (including the hooks.slack.com URL check) on findByIdAndUpdate by default.
router.patch('/:id', async (req, res) => {
  try {
    const updates = {};
    if (typeof req.body.slack_webhook_url === 'string') {
      updates.slack_webhook_url = req.body.slack_webhook_url.trim();
    }
    if (typeof req.body.slack_notifications_enabled === 'boolean') {
      updates.slack_notifications_enabled = req.body.slack_notifications_enabled;
    }

    const client = await Client.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!client) return res.status(404).json({ error: 'Client not found' });
    res.json(client);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
