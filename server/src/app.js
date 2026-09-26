import express from 'express';
import cors from 'cors';
import mockSlackRouter from './routes/mockSlack.js';
import reportsRouter from './routes/reports.js';
import clientsRouter from './routes/clients.js';
import notificationsRouter from './routes/notifications.js';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // simple request log — swap for morgan/pino later if you want
  app.use((req, _res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, uptime: process.uptime() });
  });

  // POST /api/mock-slack-webhook — local stand-in for Slack, ~20% chance of a 429
  app.use('/api', mockSlackRouter);

  // POST /api/reports/run-now — manual trigger for the daily aggregation + dispatch
  app.use('/api', reportsRouter);

  // GET/PATCH /api/clients — settings dashboard: webhook URL + notifications toggle
  app.use('/api/clients', clientsRouter);

  // GET /api/notifications — settings dashboard: notification log table
  app.use('/api/notifications', notificationsRouter);

  app.use((req, res) => {
    res.status(404).json({ error: `No route for ${req.method} ${req.path}` });
  });

  return app;
}
