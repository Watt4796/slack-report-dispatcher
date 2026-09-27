const LABELS = {
  sent: 'Sent',
  pending: 'Pending',
  failed: 'Failed',
};

export function StatusBadge({ status }) {
  return (
    <span className={`status-badge status-${status}`}>
      <span className="status-dot" />
      {LABELS[status] ?? status}
    </span>
  );
}
