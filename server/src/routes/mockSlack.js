import { Router } from 'express';

const router = Router();

// Required by Section 6 of the brief: simulate Slack's rate limiting locally so the
// queue/worker's 429 + Retry-After handling can be proven without risking a real token ban.
router.post('/mock-slack-webhook', (req, res) => {
  if (Math.random() < 0.2) {
    return res.set('Retry-After', '3').status(429).json({ error: 'rate_limited' });
  }
  return res.status(200).json({ ok: true });
});

export default router;
