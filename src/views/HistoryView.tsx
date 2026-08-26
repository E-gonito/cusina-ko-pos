import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Tab } from '../db';
import { tabTotals } from '../ops';
import { formatMoney } from '../money';
import { useCurrency } from '../useCurrency';

function ClosedTab({ tab, currency }: { tab: Tab; currency: string }) {
  const lines = useLiveQuery(() => db.orderLines.where({ tabId: tab.id! }).toArray(), [tab.id]) ?? [];
  const totals = tabTotals(lines);
  const time = new Date(tab.closedAt!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <details className="closed-tab">
      <summary>
        {time} — Table {tab.tableNumber}, {tab.covers} covers — {formatMoney(totals.totalMinor, currency)}
      </summary>
      <ul>
        {lines.map(l => (
          <li key={l.id}>
            {l.qty}× {l.name} — {formatMoney(l.priceMinor * l.qty, currency)}
          </li>
        ))}
      </ul>
    </details>
  );
}

export function HistoryView() {
  const currency = useCurrency();
  const tabs =
    useLiveQuery(async () => (await db.tabs.where('status').equals('closed').sortBy('closedAt')).reverse(), []) ?? [];

  if (tabs.length === 0) return <p className="empty">No closed tabs yet.</p>;

  const byDay = new Map<string, Tab[]>();
  for (const t of tabs) {
    const day = new Date(t.closedAt!).toLocaleDateString(undefined, {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    });
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(t);
  }

  return (
    <div className="history">
      {[...byDay.entries()].map(([day, dayTabs]) => (
        <section key={day}>
          <h2>{day}</h2>
          {dayTabs.map(t => (
            <ClosedTab key={t.id} tab={t} currency={currency} />
          ))}
        </section>
      ))}
    </div>
  );
}
