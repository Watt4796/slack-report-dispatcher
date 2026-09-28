import { connection } from '../queue/connection.js';
import NotificationLog from '../models/NotificationLog.js';

const CHANNEL = 'notifications:events';
const activeClients = new Set();

let subscriber = null;
let broadcastTimeout = null;
let heartbeatInterval = null;

export function formatNotificationLog(log) {
  return {
    id: log._id,
    client_name: log.client_id?.name || log.client_name || 'Unknown client',
    report_date: log.report_date,
    status: log.status,
    attempts: log.attempts,
    last_error: log.last_error ?? null,
    sent_at: log.sent_at ?? null,
    updated_at: log.updatedAt,
  };
}

export async function fetchRecentNotifications(limit = 100) {
  const logs = await NotificationLog.find()
    .sort({ updatedAt: -1 })
    .limit(limit)
    .populate('client_id', 'name')
    .lean();

  return logs.map(formatNotificationLog);
}

/**
 * Register a client response for Server-Sent Events (SSE).
 */
export async function registerSSEClient(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  activeClients.add(res);

  // Send initial snapshot immediately to the connecting client
  try {
    const data = await fetchRecentNotifications(100);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  } catch (err) {
    console.error('[sse] Failed to send initial snapshot:', err.message);
  }

  req.on('close', () => {
    activeClients.delete(res);
  });
}

/**
 * Broadcast current logs to all connected SSE clients (debounced by 100ms).
 */
export function broadcastNotifications() {
  if (broadcastTimeout) return;

  broadcastTimeout = setTimeout(async () => {
    broadcastTimeout = null;
    if (activeClients.size === 0) return;

    try {
      const data = await fetchRecentNotifications(100);
      const payload = `data: ${JSON.stringify(data)}\n\n`;

      for (const client of activeClients) {
        try {
          client.write(payload);
        } catch {
          activeClients.delete(client);
        }
      }
    } catch (err) {
      console.error('[sse] Broadcast error:', err.message);
    }
  }, 100);
}

/**
 * Initialize Redis subscriber on the Express server process.
 */
export async function initNotificationSubscriber() {
  if (subscriber) return;

  try {
    subscriber = connection.duplicate();
    subscriber.on('error', (err) => {
      console.error('[events] Redis subscriber error:', err.message);
    });

    await subscriber.subscribe(CHANNEL);
    console.log(`[events] subscribed to Redis channel "${CHANNEL}" for SSE live updates`);

    subscriber.on('message', (channel) => {
      if (channel === CHANNEL) {
        broadcastNotifications();
      }
    });

    if (!heartbeatInterval) {
      heartbeatInterval = setInterval(() => {
        for (const client of activeClients) {
          try {
            client.write(': keepalive\n\n');
          } catch {
            activeClients.delete(client);
          }
        }
      }, 25000);
      heartbeatInterval?.unref?.();
    }
  } catch (err) {
    console.error('[events] Failed to initialize notification subscriber:', err.message);
  }
}

/**
 * Publish a notification update event via Redis.
 * Can be called by any worker, scheduler, or route.
 */
export async function publishNotificationEvent(event = 'change') {
  try {
    await connection.publish(CHANNEL, JSON.stringify({ event, timestamp: Date.now() }));
  } catch (err) {
    console.error('[events] Failed to publish event:', err.message);
  }
}
