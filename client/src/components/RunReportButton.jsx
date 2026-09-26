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
    <div className="run-report">
      <button className="btn-primary" onClick={handleClick} disabled={status === 'running'}>
        {status === 'running' ? 'Running…' : 'Run report now'}
      </button>
      {message && <span className={status === 'error' ? 'error-text' : 'hint-text'}>{message}</span>}
    </div>
  );
}
