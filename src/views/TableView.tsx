import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import {
  addItem, closeTab, getOpenTab, openTab, payAll, payLine, unpayLine,
  setCovers, setLineQty, tabTotals,
} from '../ops';
import { formatMoney } from '../money';
import { useCurrency } from '../useCurrency';
import { MenuPicker } from './MenuPicker';

export function TableView({ tableNumber, onBack }: { tableNumber: number; onBack: () => void }) {
  const currency = useCurrency();
  const [showMenu, setShowMenu] = useState(false);
  const tab = useLiveQuery(() => getOpenTab(tableNumber), [tableNumber]);
  const lines =
    useLiveQuery(
      () => (tab?.id ? db.orderLines.where({ tabId: tab.id }).sortBy('addedAt') : Promise.resolve([])),
      [tab?.id],
    ) ?? [];
  const totals = tabTotals(lines);

  async function handleClose() {
    if (!tab?.id) return;
    await closeTab(tab.id);
    onBack();
  }

  return (
    <div className="table-view">
      <header>
        <button onClick={onBack}>← Tables</button>
        <h1>Table {tableNumber}</h1>
      </header>

      {!tab ? (
        <button className="big" onClick={() => openTab(tableNumber)}>Open table</button>
      ) : (
        <>
          <div className="covers-row">
            Covers:
            <button aria-label="decrease covers" onClick={() => setCovers(tab.id!, tab.covers - 1)}>−</button>
            <span>{tab.covers}</span>
            <button aria-label="increase covers" onClick={() => setCovers(tab.id!, tab.covers + 1)}>+</button>
          </div>

          <ul className="lines">
            {lines.map(l => {
              const paid = l.qty > 0 && l.paidQty >= l.qty;
              return (
                <li key={l.id} className={paid ? 'line paid' : 'line'}>
                  <span className="line-name">{l.name}</span>
                  <span className="qty-controls">
                    <button aria-label={`decrease ${l.name}`} onClick={() => setLineQty(l.id!, l.qty - 1)}>−</button>
                    <span>{l.qty}</span>
                    <button aria-label={`increase ${l.name}`} onClick={() => setLineQty(l.id!, l.qty + 1)}>+</button>
                  </span>
                  <span>{formatMoney(l.priceMinor * l.qty, currency)}</span>
                  {paid ? (
                    <button onClick={() => unpayLine(l.id!)}>Paid ✓</button>
                  ) : (
                    <button onClick={() => payLine(l.id!)}>Pay</button>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="totals">
            <span>Total {formatMoney(totals.totalMinor, currency)}</span>
            <span>Paid {formatMoney(totals.paidMinor, currency)}</span>
            <strong>Due {formatMoney(totals.outstandingMinor, currency)}</strong>
          </div>

          <div className="actions">
            <button className="big" onClick={() => setShowMenu(s => !s)}>
              {showMenu ? 'Hide menu' : 'Add items'}
            </button>
            <button className="big" disabled={totals.outstandingMinor === 0} onClick={() => payAll(tab.id!)}>
              Pay all
            </button>
            <button className="big" disabled={totals.outstandingMinor !== 0} onClick={handleClose}>
              Close table
            </button>
          </div>

          {showMenu && <MenuPicker onPick={item => addItem(tab.id!, item)} />}
        </>
      )}
    </div>
  );
}
