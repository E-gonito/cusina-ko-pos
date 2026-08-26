import { useState } from 'react';
import { FloorView } from './views/FloorView';
import { TableView } from './views/TableView';
import { HistoryView } from './views/HistoryView';
import { SummaryView } from './views/SummaryView';
import { MenuSettings } from './views/MenuSettings';

export type View =
  | { name: 'floor' }
  | { name: 'table'; tableNumber: number }
  | { name: 'history' }
  | { name: 'summary' }
  | { name: 'menu' };

const NAV = [
  { name: 'floor', label: 'Tables' },
  { name: 'history', label: 'History' },
  { name: 'summary', label: 'Summary' },
  { name: 'menu', label: 'Menu' },
] as const;

export function App() {
  const [view, setView] = useState<View>({ name: 'floor' });
  return (
    <div className="app">
      <nav className="topnav">
        {NAV.map(n => (
          <button
            key={n.name}
            className={view.name === n.name ? 'active' : ''}
            onClick={() => setView({ name: n.name } as View)}
          >
            {n.label}
          </button>
        ))}
      </nav>
      <main>
        {view.name === 'floor' && (
          <FloorView onSelectTable={t => setView({ name: 'table', tableNumber: t })} />
        )}
        {view.name === 'table' && (
          <TableView tableNumber={view.tableNumber} onBack={() => setView({ name: 'floor' })} />
        )}
        {view.name === 'history' && <HistoryView />}
        {view.name === 'summary' && <SummaryView />}
        {view.name === 'menu' && <MenuSettings />}
      </main>
    </div>
  );
}
