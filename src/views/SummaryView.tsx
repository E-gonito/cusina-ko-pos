import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { daySummary } from '../ops';
import { formatMoney } from '../money';
import { useCurrency } from '../useCurrency';

function toDateInputValue(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function SummaryView() {
  const currency = useCurrency();
  const [day, setDay] = useState(() => toDateInputValue(new Date()));
  const summary = useLiveQuery(() => {
    const start = new Date(`${day}T00:00:00`).getTime();
    return daySummary(start, start + 24 * 60 * 60 * 1000);
  }, [day]);

  return (
    <div className="summary">
      <input type="date" aria-label="Summary date" value={day} onChange={e => setDay(e.target.value)} />
      {summary && (
        <>
          <div className="stat-row">
            <div className="stat"><strong>{formatMoney(summary.takingsMinor, currency)}</strong><span>takings</span></div>
            <div className="stat"><strong>{summary.tabCount}</strong><span>tables</span></div>
            <div className="stat"><strong>{summary.coverCount}</strong><span>covers</span></div>
          </div>
          <h2>Items sold</h2>
          {summary.items.length === 0 ? (
            <p className="empty">Nothing sold this day.</p>
          ) : (
            <table>
              <thead>
                <tr><th>Item</th><th>Qty</th><th>Amount</th></tr>
              </thead>
              <tbody>
                {summary.items.map(i => (
                  <tr key={i.name}>
                    <td>{i.name}</td>
                    <td>{i.qty}</td>
                    <td>{formatMoney(i.amountMinor, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
