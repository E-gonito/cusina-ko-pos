import { TABLE_NUMBERS } from '../db';

export function FloorView({ onSelectTable }: { onSelectTable: (n: number) => void }) {
  return (
    <div className="floor">
      {TABLE_NUMBERS.map(n => (
        <button key={n} className="table-card free" onClick={() => onSelectTable(n)}>
          <span className="table-num">Table {n}</span>
        </button>
      ))}
    </div>
  );
}
