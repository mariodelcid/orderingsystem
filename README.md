# Ordering System (Kiosk)

Standalone kiosk ordering app for Elotes Locos. Independent from the POS
(https://texasstores.up.railway.app) — it only READS item names/prices/categories
from the POS `/api/items`. Nothing in the POS is ever modified.

## Pages
- `/` — customer kiosk (Spanish, touch-friendly). Promos on top, tap to order,
  sends the order and shows a big order number. Customer pays at the counter.
- `/dispatch.html` — dispatcher queue (PIN). New orders appear with a beep:
  Cobrado (charged) → Entregado (done), or cancel. Auto-refreshes every 5s.
- `/manage.html` — manager (PIN): create/pause promos (% off or fixed price),
  upload item photos (stored in the database), hide items from the kiosk,
  change the PIN and store name.

Default PIN: **2026** (change it in manage.html → Seguridad).

## Deploy on Railway
1. Push this repo to GitHub (`mariodelcid/orderingsystem`).
2. Railway → New service → GitHub repo → orderingsystem.
3. Add a PostgreSQL database for it, then on the app service set
   `DATABASE_URL = ${{<that Postgres>.DATABASE_URL}}`.
4. Generate a domain (Settings → Networking). App listens on `PORT`.

Orders are NOT sales records: the dispatcher still charges on the POS,
so nothing is double-counted anywhere.
