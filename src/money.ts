export function formatMoney(minor: number, symbol: string): string {
  return `${symbol}${(minor / 100).toFixed(2)}`;
}

export function parsePrice(input: string): number | null {
  if (input.trim() === '') return null;
  const n = Number(input);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}
