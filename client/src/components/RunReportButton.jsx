import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';

export function RunReportButton({ pendingCount = 0 }) {
  const [isStarting, setIsStarting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const prevPendingRef = useRef(pendingCount);

  const isDispatching = isStarting || pendingCount > 0;

  useEffect(() => {
    // When pending count drops from >0 down to 0, all reports have finished sending to Slack
    if (prevPendingRef.current > 0 && pendingCount === 0 && !isStarting) {
      setFeedback({ type: 'success', text: 'All reports delivered to Slack!' });
      const timer = setTimeout(() => setFeedback(null), 4000);
      return () => clearTimeout(timer);
    }
    prevPendingRef.current = pendingCount;
  }, [pendingCount, isStarting]);

  async function handleClick() {
    setIsStarting(true);
    setFeedback(null);
    try {
      const result = await api.runReportNow();
      setFeedback({
        type: 'success',
        text: `Enqueued ${result.enqueued} report(s). Delivering 1/sec…`,
      });
    } catch (err) {
      setFeedback({ type: 'error', text: err.message });
      const timer = setTimeout(() => setFeedback(null), 5000);
      return () => clearTimeout(timer);
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <div className="run-report-container">
      <button
        className="btn-primary run-report-btn"
        onClick={handleClick}
        disabled={isDispatching}
        title={isDispatching ? 'Reports are currently being delivered to Slack' : 'Trigger a report dispatch run now'}
      >
        {isDispatching ? (
          <>
            <span className="spinner-icon" />
            <span>
              {pendingCount > 0 ? `Delivering (${pendingCount} left)…` : 'Dispatching…'}
            </span>
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
      {feedback && (
        <span className={`status-feedback feedback-${feedback.type}`}>
          {feedback.type === 'success' && <span className="feedback-check">✓</span>}
          {feedback.type === 'error' && <span className="feedback-x">✕</span>}
          {feedback.text}
        </span>
      )}
    </div>
  );
}
