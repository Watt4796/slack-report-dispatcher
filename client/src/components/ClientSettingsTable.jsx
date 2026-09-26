import { useState } from 'react';
import { api } from '../api.js';

export function ClientSettingsTable({ clients, onUpdated }) {
  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState(null);

  function draftFor(client) {
    return drafts[client._id] ?? client.slack_webhook_url ?? '';
  }

  function handleChange(id, value) {
    setDrafts((prev) => ({ ...prev, [id]: value }));
  }

  async function handleSaveUrl(client) {
    setSavingId(client._id);
    setError(null);
    try {
      await api.updateClient(client._id, { slack_webhook_url: draftFor(client) });
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[client._id];
        return next;
      });
      onUpdated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingId(null);
    }
  }

  async function handleToggle(client) {
    setError(null);
    try {
      await api.updateClient(client._id, {
        slack_notifications_enabled: !client.slack_notifications_enabled,
      });
      onUpdated();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      {error && <p className="error-text">{error}</p>}
      <table className="data-table">
        <thead>
          <tr>
            <th>Client</th>
            <th>Slack webhook URL</th>
            <th>Notifications</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {clients.map((client) => {
            const dirty = draftFor(client) !== (client.slack_webhook_url ?? '');
            return (
              <tr key={client._id}>
                <td>{client.name}</td>
                <td>
                  <input
                    className="webhook-input"
                    type="text"
                    value={draftFor(client)}
                    onChange={(e) => handleChange(client._id, e.target.value)}
                    placeholder="https://hooks.slack.com/services/..."
                  />
                </td>
                <td>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={client.slack_notifications_enabled}
                      onChange={() => handleToggle(client)}
                    />
                    <span className="toggle-track" />
                  </label>
                </td>
                <td>
                  <button
                    className="btn-secondary"
                    disabled={!dirty || savingId === client._id}
                    onClick={() => handleSaveUrl(client)}
                  >
                    {savingId === client._id ? 'Saving…' : 'Save'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
