export function buildBlockKitPayload({ name, total_spend, total_revenue, roas, report_date }) {
  const fmt = (n) =>
    `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return {
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:bar_chart: *Daily Attribution Report - BooleanMaths*\nDate: ${report_date}`,
        },
      },
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: [
            `*:moneybag: Total Ad Spend:* ${fmt(total_spend)}`,
            `*🛒 Total Revenue:* ${fmt(total_revenue)}`,
            `*:chart_with_upwards_trend: ROAS:* ${roas.toFixed(2)}x`,
          ].join('\n'),
        },
      },
      { type: 'divider' },
      { type: 'context', elements: [{ type: 'mrkdwn', text: '_Generated automatically by BooleanMaths_' }] },
    ],
  };
}
