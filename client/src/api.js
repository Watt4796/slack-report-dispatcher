const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  getClients: () => request('/api/clients'),
  updateClient: (id, updates) =>
    request(`/api/clients/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),
  getNotifications: (limit = 100) => request(`/api/notifications?limit=${limit}`),
  getNotificationsStream: (onMessage, onError) => {
    const url = `${BASE_URL}/api/notifications/stream`;
    const es = new EventSource(url);
    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage?.(data);
      } catch (err) {
        console.error('[SSE] Failed to parse payload:', err);
      }
    };
    if (onError) {
      es.onerror = onError;
    }
    return es;
  },
  runReportNow: () => request('/api/reports/run-now', { method: 'POST' }),
  clearNotifications: () => request('/api/notifications', { method: 'DELETE' }),
  retryNotification: (id) => request(`/api/notifications/${id}/retry`, { method: 'POST' }),
};
