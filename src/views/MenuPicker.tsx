import { useLiveQuery } from 'dexie-react-hooks';
import { db, type MenuItem } from '../db';
import { formatMoney } from '../money';
import { useCurrency } from '../useCurrency';

export function MenuPicker({ onPick }: { onPick: (item: MenuItem) => void }) {
  const currency = useCurrency();
  const items =
    useLiveQuery(
      () => db.menuItems.orderBy('sortOrder').filter(i => i.active === 1).toArray(),
      [],
    ) ?? [];
  const categories = [...new Set(items.map(i => i.category))];

  return (
    <div className="menu-picker">
      {categories.map(cat => (
        <section key={cat}>
          <h2>{cat}</h2>
          <div className="menu-grid">
            {items
              .filter(i => i.category === cat)
              .map(i => (
                <button key={i.id} onClick={() => onPick(i)}>
                  {i.name}
                  <span>{formatMoney(i.priceMinor, currency)}</span>
                </button>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
