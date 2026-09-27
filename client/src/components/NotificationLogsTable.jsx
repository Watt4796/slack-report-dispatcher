import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { StatusBadge } from './StatusBadge.jsx';

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function getLogDateStrings(iso) {
  if (!iso) return { local: '', utc: '' };
  try {
    const d = new Date(iso);
    const local = d.toLocaleDateString('en-CA'); // 'YYYY-MM-DD' in local timezone
    const utc = iso.slice(0, 10); // 'YYYY-MM-DD' in UTC
    return { local, utc };
  } catch {
    return { local: '', utc: '' };
  }
}

export function NotificationLogsTable() {
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState(null);
  const [loaded, setLoaded] = useState(false);

  // Filter States
  const [clientFilter, setClientFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    let cancelled = false;

    // Load initial snapshot immediately
    api
      .getNotifications(100)
      .then((data) => {
        if (!cancelled) {
          setLogs(data);
          setError(null);
          setLoaded(true);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoaded(true);
        }
      });

    // Real-time push updates via Server-Sent Events (SSE)
    const es = api.getNotificationsStream(
      (data) => {
        if (!cancelled) {
          setLogs(data);
          setError(null);
          setLoaded(true);
        }
      },
      (err) => {
        if (es.readyState === EventSource.CLOSED && !cancelled) {
          console.warn('[SSE] EventSource closed');
        }
      }
    );

    return () => {
      cancelled = true;
      es.close();
    };
  }, []);

  // Compute unique clients for dropdown options
  const uniqueClients = useMemo(() => {
    const names = new Set(logs.map((l) => l.client_name).filter(Boolean));
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [logs]);

  // Compute filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // 1. Client filter
      if (clientFilter && log.client_name !== clientFilter) {
        return false;
      }

      // 2. Status filter
      if (statusFilter && log.status !== statusFilter) {
        return false;
      }

      // 3. Updated Date filter (checks local and UTC YYYY-MM-DD match)
      if (dateFilter) {
        const { local, utc } = getLogDateStrings(log.updated_at);
        if (local !== dateFilter && utc !== dateFilter) {
          return false;
        }
      }

      return true;
    });
  }, [logs, clientFilter, statusFilter, dateFilter]);

  // Active filter check
  const hasActiveFilters = Boolean(clientFilter || statusFilter || dateFilter);

  const handleClearFilters = () => {
    setClientFilter('');
    setStatusFilter('');
    setDateFilter('');
    setCurrentPage(1);
  };

  // Pagination Math
  const totalItems = filteredLogs.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const startIndex = (safePage - 1) * pageSize;
  const paginatedLogs = filteredLogs.slice(startIndex, startIndex + pageSize);

  // Generate pagination page numbers
  const pageNumbers = useMemo(() => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (safePage <= 3) {
      return [1, 2, 3, 4, '...', totalPages];
    }
    if (safePage >= totalPages - 2) {
      return [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', safePage - 1, safePage, safePage + 1, '...', totalPages];
  }, [totalPages, safePage]);

  if (error) {
    return (
      <div className="state-card error-card">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>Couldn't load notification logs: {error}</span>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="skeleton-container">
        <div className="skeleton-row" />
        <div className="skeleton-row" />
        <div className="skeleton-row" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon-wrap">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <h3>No reports dispatched yet</h3>
        <p>Click "Run report now" above to trigger a dispatch run and watch live delivery logs appear here.</p>
      </div>
    );
  }

  return (
    <div className="logs-container">
      {/* Filters Toolbar */}
      <div className="table-controls-bar">
        <div className="filter-group">
          {/* Client Filter */}
          <div className="filter-item">
            <label htmlFor="filter-client">Client</label>
            <select
              id="filter-client"
              value={clientFilter}
              onChange={(e) => {
                setClientFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="filter-select"
            >
              <option value="">All Clients ({logs.length})</option>
              {uniqueClients.map((client) => (
                <option key={client} value={client}>
                  {client}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="filter-item">
            <label htmlFor="filter-status">Status</label>
            <select
              id="filter-status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="filter-select"
            >
              <option value="">All Statuses</option>
              <option value="sent">Sent</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          {/* Updated Date Filter */}
          <div className="filter-item">
            <label htmlFor="filter-date">Updated Date</label>
            <div className="date-input-wrap">
              <input
                id="filter-date"
                type="date"
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="filter-date-input"
              />
              {dateFilter && (
                <button
                  type="button"
                  className="filter-clear-icon-btn"
                  onClick={() => {
                    setDateFilter('');
                    setCurrentPage(1);
                  }}
                  title="Clear date filter"
                  aria-label="Clear date filter"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Reset Filters Button */}
          {hasActiveFilters && (
            <button
              type="button"
              className="btn-reset-filters"
              onClick={handleClearFilters}
              title="Reset all filters"
            >
              ✕ Reset filters
            </button>
          )}
        </div>

        {/* Results Count Badge */}
        <div className="filter-results-summary">
          <span className="results-count-badge">
            {filteredLogs.length} {filteredLogs.length === 1 ? 'result' : 'results'}
            {hasActiveFilters && <span className="filtered-parenthetical"> (of {logs.length})</span>}
          </span>
        </div>
      </div>

      {/* Table or Filter Empty State */}
      {filteredLogs.length === 0 ? (
        <div className="filter-empty-state">
          <div className="empty-icon-wrap">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <h3>No matching logs found</h3>
          <p>None of the logs match your current filter criteria.</p>
          <button type="button" className="btn-secondary filter-clear-action" onClick={handleClearFilters}>
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="table-wrapper">
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
              {paginatedLogs.map((log) => (
                <tr key={log.id}>
                  <td className="client-cell-name">{log.client_name}</td>
                  <td className="mono date-chip">{log.report_date}</td>
                  <td>
                    <StatusBadge status={log.status} />
                  </td>
                  <td>
                    <span className="attempts-pill">{log.attempts}</span>
                  </td>
                  <td className="error-cell" title={log.last_error ?? ''}>
                    {log.last_error ? (
                      <span className="error-text-truncate">{log.last_error}</span>
                    ) : (
                      <span className="dash-text">—</span>
                    )}
                  </td>
                  <td className="mono date-cell">{formatTime(log.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Bar */}
      {filteredLogs.length > 0 && (
        <div className="pagination-bar">
          <div className="pagination-info">
            Showing <strong>{startIndex + 1}</strong>–<strong>{Math.min(startIndex + pageSize, totalItems)}</strong> of{' '}
            <strong>{totalItems}</strong> logs
          </div>

          <div className="pagination-actions">
            {/* Page Size Selector */}
            <div className="page-size-selector">
              <label htmlFor="page-size-select">Per page:</label>
              <select
                id="page-size-select"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="page-size-select"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>

            {/* Prev / Next & Numbers */}
            <div className="page-nav">
              <button
                type="button"
                className="page-btn page-btn-prev"
                disabled={safePage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
              >
                ‹ Prev
              </button>

              <div className="page-num-group">
                {pageNumbers.map((p, idx) =>
                  p === '...' ? (
                    <span key={`ellipsis-${idx}`} className="page-ellipsis">
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      className={`page-num-btn ${safePage === p ? 'active' : ''}`}
                      onClick={() => setCurrentPage(p)}
                      aria-current={safePage === p ? 'page' : undefined}
                    >
                      {p}
                    </button>
                  )
                )}
              </div>

              <button
                type="button"
                className="page-btn page-btn-next"
                disabled={safePage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Next page"
              >
                Next ›
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
