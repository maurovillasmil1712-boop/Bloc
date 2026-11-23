# Tests

Everything runs against a local copy of the site with its own D1 database. Nothing here touches myib.app.

```bash
npm install
pip install playwright requests && python3 -m playwright install chromium
WRANGLER_SEND_METRICS=false CI=1 npx wrangler pages dev ../site --d1 DB=bloc-local \
  --binding ADMIN_CODE=LOCALADMIN2026 --port 8789 --ip 127.0.0.1 --persist-to state --compatibility-date 2025-10-01
```

In a second terminal:

| Script | What it does |
|---|---|
| `python3 seed.py http://127.0.0.1:8789` | Creates Mauro (admin), classmates, chats and a full planner. Run it once on a fresh `state/`. |
| `python3 smoke.py http://127.0.0.1:8789` | 56 checks on a phone and a laptop viewport, including the garden and Bloc City panes. Must end with 0 failures and 0 errors. |
| `python3 farmtest.py` | The garden API end to end: plant, water, harvest rules, shared gardens, drives and visits. Wants a freshly seeded server. |
| `python3 cap.py http://127.0.0.1:8789 out` | Screenshots of every main screen. |
| `python3 gcap.py http://127.0.0.1:8789 out phone` | Garden, shop, places, Index and City screens. |
| `python3 dcap2.py http://127.0.0.1:8789 out` | Bloc City from the beach, downtown, the bridge and old town (needs WebGL; uses SwiftShader). |

The password in these scripts (`Bloc-local-2026!`) and the admin code (`LOCALADMIN2026`) only exist on the local test server.
