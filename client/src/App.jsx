import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import { ClientSettingsTable } from './components/ClientSettingsTable.jsx';
import { NotificationLogsTable } from './components/NotificationLogsTable.jsx';
import { RunReportButton } from './components/RunReportButton.jsx';
import './styles.css';

function App() {
  const [clients, setClients] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const loadClients = useCallback(async () => {
    try {
      const data = await api.getClients();
      setClients(data);
      setLoadError(null);
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Slack report dispatcher</h1>
          <p className="subtitle">Attribution &amp; ROAS reports, dispatched once a day at 9:00 AM.</p>
        </div>
        <RunReportButton />
      </header>

      <section>
        <h2>Clients</h2>
        {loadError && <p className="error-text">Couldn't load clients: {loadError}</p>}
        {loaded && !loadError && clients.length === 0 && (
          <p className="empty-state">No clients yet — run `npm run seed -w server`.</p>
        )}
        {clients.length > 0 && <ClientSettingsTable clients={clients} onUpdated={loadClients} />}
      </section>

      <section>
        <h2>Notification logs</h2>
        <NotificationLogsTable />
      </section>
    </div>
  );
}

export default App;
