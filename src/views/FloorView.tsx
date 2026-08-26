import { useLiveQuery } from 'dexie-react-hooks';
import { db, TABLE_NUMBERS } from '../db';
import { tabTotals } from '../ops';
import { formatMoney } from '../money';
import { useCurrency } from '../useCurrency';

interface TableStatus {
  covers: number;
  outstandingMinor: number;
}

export function FloorView({ onSelectTable }: { onSelectTable: (n: number) => void }) {
  const currency = useCurrency();
  const statuses = useLiveQuery(async () => {
    const tabs = await db.tabs.where('status').equals('open').toArray();
    const byTable = new Map<number, TableStatus>();
    for (const tab of tabs) {
      const lines = await db.orderLines.where({ tabId: tab.id! }).toArray();
      byTable.set(tab.tableNumber, {
        covers: tab.covers,
        outstandingMinor: tabTotals(lines, tab.discountPct ?? 0).outstandingMinor,
      });
    }
    return byTable;
  }, []);

  return (
    <div className="floor">
      {TABLE_NUMBERS.map(n => {
        const s = statuses?.get(n);
        const cls = !s ? 'free' : s.outstandingMinor > 0 ? 'unpaid' : 'paid';
        return (
          <button key={n} data-table={n} className={`table-card ${cls}`} onClick={() => onSelectTable(n)}>
            <span className="table-num">Table {n}</span>
            {s && <span className="covers">{s.covers} covers</span>}
            {s && (
              <span className="due">
                {s.outstandingMinor > 0 ? `${formatMoney(s.outstandingMinor, currency)} due` : 'Paid'}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
