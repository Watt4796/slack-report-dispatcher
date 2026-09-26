export function buildBlockKitPayload({ name, total_spend, total_revenue, roas, report_date }) {
  const fmt = (n) =>
    `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return {
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:bar_chart: *Daily Attribution Report - BooleanMaths*\n${name} — Date: ${report_date}`,
        },
      },
      { type: 'divider' },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*:moneybag: Total Ad Spend:*\n${fmt(total_spend)}` },
          { type: 'mrkdwn', text: `*:chart_with_upwards_trend: Total Revenue:*\n${fmt(total_revenue)}` },
          { type: 'mrkdwn', text: `*:bar_chart: ROAS:*\n${roas.toFixed(2)}x` },
        ],
      },
      { type: 'divider' },
      { type: 'context', elements: [{ type: 'mrkdwn', text: '_Generated automatically by BooleanMaths_' }] },
    ],
  };
}
