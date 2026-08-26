export function TableView({ tableNumber, onBack }: { tableNumber: number; onBack: () => void }) {
  return (
    <div className="table-view">
      <header>
        <button onClick={onBack}>← Tables</button>
        <h1>Table {tableNumber}</h1>
      </header>
    </div>
  );
}
