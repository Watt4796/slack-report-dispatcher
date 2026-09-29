import { Router } from 'express';

const router = Router();

// Required by Section 6 of the brief: simulate Slack's rate limiting locally so the
// queue/worker's 429 + Retry-After handling can be proven without risking a real token ban.
router.post('/mock-slack-webhook', (req, res) => {
  if (Math.random() < 0.2) {
    console.log('[mock-slack] ⚠️  Simulating Slack 429 Too Many Requests -> Header "Retry-After: 3"');
    return res.set('Retry-After', '3').status(429).json({ error: 'rate_limited' });
  }
  console.log('[mock-slack] ✅ 200 OK (Message delivered to mock Slack)');
  return res.status(200).json({ ok: true });
});

export default router;
