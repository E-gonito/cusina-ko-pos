import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';

export function useCurrency(): string {
  // `|| '£'` (not ??) so an empty stored value also falls back to the default
  return useLiveQuery(async () => (await db.settings.get('currency'))?.value, [], undefined) || '£';
}
