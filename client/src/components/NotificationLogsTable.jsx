import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { StatusBadge } from './StatusBadge.jsx';

const POLL_MS = 5000;

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

export function NotificationLogsTable() {
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const data = await api.getNotifications(50);
        if (!cancelled) {
          setLogs(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (error) return <p className="error-text">Couldn't load notification logs: {error}</p>;
  if (!loaded) return <p className="hint-text">Loading…</p>;
  if (logs.length === 0) {
    return <p className="empty-state">No reports dispatched yet. Run one above to see it here.</p>;
  }

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Client</th>
          <th>Report date</th>
          <th>Status</th>
          <th>Attempts</th>
          <th>Last error</th>
          <th>Updated</th>
        </tr>
      </thead>
      <tbody>
        {logs.map((log) => (
          <tr key={log.id}>
            <td>{log.client_name}</td>
            <td className="mono">{log.report_date}</td>
            <td>
              <StatusBadge status={log.status} />
            </td>
            <td className="mono">{log.attempts}</td>
            <td className="error-cell" title={log.last_error ?? ''}>
              {log.last_error ?? '—'}
            </td>
            <td className="mono">{formatTime(log.updated_at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
