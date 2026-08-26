import { describe, expect, it } from 'vitest';
import { formatMoney, parsePrice } from './money';

describe('formatMoney', () => {
  it('formats minor units with the given symbol', () => {
    expect(formatMoney(1250, '£')).toBe('£12.50');
    expect(formatMoney(0, '£')).toBe('£0.00');
    expect(formatMoney(305, '₱')).toBe('₱3.05');
  });
});

describe('parsePrice', () => {
  it('parses decimal input to integer minor units', () => {
    expect(parsePrice('12.50')).toBe(1250);
    expect(parsePrice('3')).toBe(300);
    expect(parsePrice('0.05')).toBe(5);
  });
  it('rejects invalid or negative input', () => {
    expect(parsePrice('')).toBeNull();
    expect(parsePrice('abc')).toBeNull();
    expect(parsePrice('-2')).toBeNull();
  });
});
