import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// ESM has no __dirname — rebuild it from import.meta.url
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { createApp } from './app.js';
import { connectDB } from './config/db.js';
import { registerDailyTrigger } from './scheduler/registerDailyTrigger.js';

const PORT = process.env.PORT || 4000;

async function main() {
  await connectDB();
  await registerDailyTrigger();

  const app = createApp();
  app.listen(PORT, () => {
    console.log(`[server] listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('[server] failed to start:', err);
  process.exit(1);
});
