import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import { ClientSettingsTable } from './components/ClientSettingsTable.jsx';
import { NotificationLogsTable } from './components/NotificationLogsTable.jsx';
import { RunReportButton } from './components/RunReportButton.jsx';
import { ThemeToggle } from './components/ThemeToggle.jsx';
import './styles.css';

function App() {
  const [clients, setClients] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('theme');
      if (saved === 'light' || saved === 'dark') return saved;
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
    document.documentElement.style.backgroundColor = theme === 'dark' ? '#090d16' : '#f8fafc';
    document.documentElement.style.color = theme === 'dark' ? '#f8fafc' : '#0f172a';
    try {
      localStorage.setItem('theme', theme);
    } catch {}
  }, [theme]);

  const toggleTheme = () => {
    document.documentElement.classList.add('theme-transition');
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transition');
    }, 350);
  };

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

  const [pendingLogsCount, setPendingLogsCount] = useState(0);

  const activeClientsCount = clients.filter((c) => c.slack_notifications_enabled).length;

  return (
    <div className="page-shell">
      <div className="page-background-glow" />
      <div className="page">
        <header className="page-header">
          <div className="brand-header">
            <div className="brand-logo" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </div>
            <div>
              <div className="brand-title-wrap">
                <h1>Slack Report Dispatcher</h1>
              </div>
              <p className="subtitle">Daily marketing attribution &amp; ROAS reports dispatched automatically at 9:00 AM.</p>
            </div>
          </div>

          <div className="header-actions">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <RunReportButton pendingCount={pendingLogsCount} />
          </div>
        </header>

        <main className="content-stack">
          {/* Section: Clients */}
          <section className="section-card">
            <div className="section-card-header">
              <div className="section-header-title">
                <h2>Clients &amp; Webhooks</h2>
                <p className="section-desc">Manage destination webhooks and toggle dispatch delivery per client.</p>
              </div>
              {loaded && clients.length > 0 && (
                <div className="section-meta-pills">
                  <span className="counter-pill">
                    <span className="counter-dot" />
                    {activeClientsCount} of {clients.length} active
                  </span>
                </div>
              )}
            </div>

            {loadError && (
              <div className="state-card error-card">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>Couldn't load clients: {loadError}</span>
              </div>
            )}

            {loaded && !loadError && clients.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon-wrap">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <h3>No clients configured</h3>
                <p>Run <code>npm run seed -w server</code> in your terminal to initialize default client data.</p>
              </div>
            )}

            {clients.length > 0 && <ClientSettingsTable clients={clients} onUpdated={loadClients} />}
          </section>

          {/* Section: Notification Logs */}
          <section className="section-card">
            <div className="section-card-header">
              <div className="section-header-title">
                <h2>Live Dispatch Logs</h2>
                <p className="section-desc">Real-time status updates received directly via Server-Sent Events.</p>
              </div>
              <span className="live-pill" title="Live push updates connected via Server-Sent Events (SSE)">
                <span className="live-dot" /> Live (SSE)
              </span>
            </div>

            <NotificationLogsTable onPendingCountChange={setPendingLogsCount} />
          </section>
        </main>
      </div>
    </div>
  );
}

export default App;
