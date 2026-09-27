import { useState } from 'react';
import { api } from '../api.js';

export function RunReportButton() {
  const [status, setStatus] = useState('idle'); // idle | running | done | error
  const [message, setMessage] = useState('');

  async function handleClick() {
    setStatus('running');
    setMessage('');
    try {
      const result = await api.runReportNow();
      setStatus('done');
      setMessage(`Enqueued ${result.enqueued} report(s) for ${result.reportDate}.`);
    } catch (err) {
      setStatus('error');
      setMessage(err.message);
    }
  }

  return (
    <div className="run-report-container">
      <button
        className="btn-primary run-report-btn"
        onClick={handleClick}
        disabled={status === 'running'}
      >
        {status === 'running' ? (
          <>
            <span className="spinner-icon" />
            <span>Dispatching…</span>
          </>
        ) : (
          <>
            <svg
              className="btn-icon"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
            <span>Run report now</span>
          </>
        )}
      </button>
      {message && (
        <span className={`status-feedback ${status === 'error' ? 'feedback-error' : 'feedback-success'}`}>
          {status === 'done' && <span className="feedback-check">✓</span>}
          {status === 'error' && <span className="feedback-x">✕</span>}
          {message}
        </span>
      )}
    </div>
  );
}
