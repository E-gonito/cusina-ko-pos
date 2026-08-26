import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { formatMoney, parsePrice } from '../money';
import { useCurrency } from '../useCurrency';

interface Draft {
  name: string;
  price: string;
  category: string;
}

const emptyDraft: Draft = { name: '', price: '', category: 'Food' };

export function MenuSettings() {
  const currency = useCurrency();
  // Raw stored value (may be '') drives the input so clearing it doesn't
  // immediately re-inject the '£' fallback into the controlled field.
  const rawCurrency =
    useLiveQuery(async () => (await db.settings.get('currency'))?.value ?? '', [], '') ?? '';
  const items = useLiveQuery(() => db.menuItems.orderBy('sortOrder').toArray(), []) ?? [];
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<number | null>(null);

  async function saveDraft(id?: number) {
    const priceMinor = parsePrice(draft.price);
    const name = draft.name.trim();
    const category = draft.category.trim() || 'Food';
    if (!name || priceMinor === null) return;
    if (id !== undefined) {
      await db.menuItems.update(id, { name, priceMinor, category });
    } else {
      await db.menuItems.add({ name, priceMinor, category, active: 1, sortOrder: items.length });
    }
    setDraft(emptyDraft);
    setEditingId(null);
  }

  const form = (id?: number) => (
    <div className="item-form">
      <input placeholder="Name" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
      <input placeholder="Price" inputMode="decimal" value={draft.price} onChange={e => setDraft({ ...draft, price: e.target.value })} />
      <input placeholder="Category" value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })} />
      <button onClick={() => saveDraft(id)}>Save</button>
      {id !== undefined && <button onClick={() => { setEditingId(null); setDraft(emptyDraft); }}>Cancel</button>}
    </div>
  );

  return (
    <div className="menu-settings">
      <label className="currency-row">
        Currency symbol
        <input
          value={rawCurrency}
          onChange={e => db.settings.put({ key: 'currency', value: e.target.value })}
        />
      </label>

      <h2>Add item</h2>
      {editingId === null && form()}

      <h2>Items</h2>
      <ul>
        {items.map(i =>
          editingId === i.id ? (
            <li key={i.id}>{form(i.id)}</li>
          ) : (
            <li key={i.id} className={i.active ? '' : 'inactive'}>
              <span>{i.name} — {formatMoney(i.priceMinor, currency)} ({i.category})</span>
              <button
                onClick={() => {
                  setEditingId(i.id!);
                  setDraft({ name: i.name, price: (i.priceMinor / 100).toFixed(2), category: i.category });
                }}
              >
                Edit
              </button>
              <button onClick={() => db.menuItems.update(i.id!, { active: i.active ? 0 : 1 })}>
                {i.active ? 'Hide' : 'Show'}
              </button>
              <button onClick={() => { if (confirm(`Delete ${i.name}?`)) db.menuItems.delete(i.id!); }}>
                Delete
              </button>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
