# Cusina Ko POS

Offline, single-device table & order tracker for Cusina Ko (14 tables).

- **Run in dev:** `npm install && npm run dev`
- **Tests:** `npm test`
- **Production build:** `npm run build`, then serve `dist/` from any static host
  (or `npm run preview` locally). Installable as a PWA; works fully offline.

All data lives in the browser's IndexedDB (database `cusina-pos`) on the device
where the app is used — there is no server. Clearing browser site data erases
menu, tabs, and history.

## Screens

- **Tables** — live floor view of tables 1–14 with covers and amount due.
- **Table** — open a tab, set covers, tap-to-add items, pay per item / pay all, close.
- **History** — closed tabs grouped by day.
- **Summary** — daily takings, table count, covers, items sold.
- **Menu** — add/edit/hide/delete items, set currency symbol.
