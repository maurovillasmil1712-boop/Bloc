---
name: bloc-app
description: Use when working on Bloc (myib.app, formerly MyIB), Mauro's study planner for IB students. Covers architecture, data model, API, design system, pet, garden and Bloc City mechanics, local testing and release steps.
---

# Bloc: how the app works

Bloc is a study planner used by about 300 students, most of them in Mauro's IB class at Colegio Madrid (2º BI B, "Sociales 2 IB"). It started as "IB Planner", became "MyIB" with accounts, and was renamed Bloc in v5.0. Live at https://myib.app. Mauro (admin account `mauro`) owns it, decides what ships, and deploys by hand. Never deploy, push to the default branch, or touch production data without his explicit OK.

Read this whole file before changing anything. Then read the file you're changing.

## 1. Stack and files

Cloudflare Pages in advanced mode: static files plus one `_worker.js` that serves `/api/*` and adds security headers to everything else. Data lives in Cloudflare D1 (binding `DB`). No framework and no build step, except Bloc City (`drive.js`), which esbuild bundles from `src/drive/drive.src.js` with three.js.

| File (in `site/`) | What it is |
|---|---|
| `index.html` | Shell. Loads `data.js`, `pet.js`, `app.js` as classic scripts. Preloads the font. |
| `app.js` (~570 KB) | The whole app in one IIFE: state, sync, views, sheets, garden UI. |
| `styles.css` | Every style. Design tokens at the top. |
| `pet.js` | The puppy engine (SVG, no libraries): `window.MyIBPetEngine = { BREEDS, STAGES, ITEMS, svg, itemSVG, mount }`. app.js owns the puppy's stats; this file only draws. |
| `data.js` | Study levels (IB, Bachillerato, ESO, University): subject lists and starting planners (`LEVELS`). |
| `_worker.js` (~310 KB) | The server: routes, D1 schema, auth, sync, chat, gardens, push, Siri, assistant, farm. |
| `drive.js` | Bloc City, an ES module loaded with `import('./drive.js?v=…')` only when someone drives. Built output: edit `src/drive/drive.src.js`. |
| `sw.js` | Service worker, network first. `CACHE` name changes every release (`myib-v6-1`). |
| `fonts/` | Schibsted Grotesk (variable, latin and latin-ext) and its OFL licence. |
| `icons/`, `manifest.webmanifest` | App icons and the PWA manifest. |
| `privacy.html`, `support.html`, `_headers` | Static pages and headers. |

The iPhone app (separate Xcode project, bundle IDs still say MyIB) wraps the web app in a WKWebView and talks to it through a bridge (`openWeb('extra')`, haptics, widget data). Anything that breaks in Safari breaks there.

## 2. Hard constraints

- CSP: `script-src 'self'`, `style-src 'self' 'unsafe-inline'`, `font-src 'self'`, `connect-src 'self'`. No CDNs, no inline scripts, no external fonts. Self-host or bundle everything.
- Every non-GET request needs the header `X-MyIB: 1` and a same-origin `Origin` (CSRF guard). `api()` in app.js adds it. Exceptions: `POST /api/tasks` and `POST /api/siri/talk`, which take a Siri key instead of the cookie.
- Old names stay: storage keys (`myib:*`), the `X-MyIB` header, the session cookie, the iPhone bridge names, bundle IDs and the myib.app domain. Renaming them logs everyone out or breaks the iPhone app.
- `_worker.js` creates its own tables (`makeSchema`, `CREATE TABLE IF NOT EXISTS`) and adds missing columns to old databases. New tables go there. Never write a migration that drops data.
- The planner (`planners.data`) is plain JSON written by the client. Anything worth cheating for (coins, seeds, fuel, rewards) must be decided on the server.
- Workers Paid plan since 22 Nov 2026, but keep requests cheap: use `json_extract` to read only the parts of a planner you need.
- Mauro wants no unnecessary spending. No paid APIs without asking. The assistant stays inside the free Workers AI allowance by default.

## 3. Server (`_worker.js`)

`export default { fetch }` sends `/api/*` to `route()`, which builds `c = { req, env, db, url, now, ip, secure }` and looks up `ROUTES['METHOD /path']`. Handlers are plain functions. Errors: `throw new HttpError(status, code, extra)` becomes `{ error: code, ...extra }` with that status. Helpers you will use: `needUser(c)` (returns the session `s` with `s.user`), `needAdmin(c)`, `readBody(c)` (JSON only, 700 KB max), `json(obj, status)`, `hit(c, key, max, windowMs, code)` (rate limit in the `attempts` table), `nameOf(id, stored)`, `cleanText`, `rudeText`, `person(row)`.

Accounts: class accounts are listed in `USERS` (ids like `mauro`, `luca`); everyone else makes a free account with `/api/join` (`kind: 'free'`, stricter limits). Admin signup needs `env.ADMIN_CODE`. Passwords: PBKDF2-SHA256. Sessions: `sessions` table plus a cookie.

Environment: `DB` (D1), `ASSETS`, `ADMIN_CODE`, `API_KEY_SECRET` (Siri keys are HMAC-SHA256 of a salt with it), `AI` (Workers AI binding), `ASSIST_MODEL`, `SIRI_AI_MODEL`, `ASSIST_VISION_MODEL`, `ASSIST_PROVIDER` and `OPENAI_API_KEY` (optional), `ASSIST_TIMEOUT_MS`, `VAPID_SUB`. VAPID keys generate themselves and live in `config` (key `vapid`). A separate `bloc-cron` Worker calls `/api/push/tick`; app traffic also ticks it.

Tables: `users`, `planners`, `sessions`, `attempts`, `config`, `avatars`, chat (`convs`, `members`, `messages`, `blocks`, `chat_bans`, `reports`), pets (`pet_cards`, `gardens`, `garden_members`), push (`push_subs`, `push_queue`), Siri (`api_keys`), assistant (`assist_usage`, `assist_extra`), garden v6.1 (`farms`, `plotdocs`). `accountWipe(c, id)` deletes a person everywhere: add any new per-user table to it.

Route groups: auth (`/api/signup`, `/api/join`, `/api/login`, `/api/logout`, `/api/me`, `/api/reauth`, `/api/password`, `/api/account/delete`), planner (`GET/PUT /api/state`, `/api/starter`), admin (`/api/admin/*`), avatars, chat (`/api/chat/*`), shared gardens (`/api/garden*`, `/api/pet/card`), push (`/api/push/*`), calendar (`/api/calendar`, `/api/ics`, `/api/cal/<token>`), Siri (`/api/siri*`, `/api/tasks`), assistant (`/api/assist`), farm (`/api/farm*`).

## 4. Client (`app.js`)

- Globals inside the IIFE: `S` (the planner), `ME` (the account), `UI` (view state, saved per account in `myib:ui:<id>`), `SYNC`, `GARDEN` (shared gardens), `PETUI`, `FARM` (garden v6.1), `CHAT`.
- Views: `VIEWS[tab]()` returns an HTML string; `render()` swaps `#view`, then runs mount hooks (`petMounted`, `farmMounted`, `chatMounted`, `tlMounted`). Tabs: `TABS` = Today, Timetable, Calendar, Tasks, Subjects, Pet (six; iOS guidelines prefer five, a known open issue). Chat and the assistant open as sheets.
- Events: one delegated click handler reads `data-act` and calls `ACT[name](el)`. Feature maps merge into it (`PET_ACT`, `FARM_ACT`). Checkboxes and selects use `data-change` in the `change` listener. Never add inline handlers (CSP).
- Sheets: `openDialog({ title, body, wide, onSubmit, back })`, rows with `grp(rows, head, foot)`, `rButton(label, act, attrs, cls)`, `rSwitch(...)`. Set `curSheet = fn` so the sheet can redraw itself after data changes. `closeDialog()`. Confirm destructive taps with `arm(el, 'Press again to …')`.
- `toast(text)`, `celebrate(el, big)` (haptic, no confetti since v6), `save()` (debounced sync), `api(method, path, body, opts)` (returns `{ status, data }`).
- State is validated by `sanitize()` on every load. New planner fields must be added there (settings are whitelisted), or they vanish on the next save.
- Sync: `save()` → `PUT /api/state` with the last `rev`; a 409 triggers a three-way merge (`mergeState`: lists by id, maps by key, this device wins ties). The last good copy lives in `myib:cache:<id>`, so Bloc opens offline.

Planner shape (version 3): `profile`, `settings` (`theme`, `weekend`, `accent`, `guide`, `rem`, `level`, `feeds`, `shareFocus`), `subjects`, `periods`, `slots` (`'periodId|day'` → class), `events` (exams, mocks, deadlines, holidays; `rem`, `at`, `dur`), `tasks` (`due`, `at`, `est`, `rep`, `doneOn`), `sessions` (focus sessions: `{ id, subject, date, minutes }`; timer ones have ids `ss-t<start time in base 36>`), `papers`, `plans` (study blocks on the hourly plan), `timer` (`{ subject, len, startedAt, pausedAt, pausedTotal, up }`), `pet`.

## 5. The puppy (v4.6, v4.7)

- Stages by study hours since adoption: Newborn 0, Puppy 3, Junior 12, Adult 30, Legend 80 (at most 8 hours a day count, `PET_DAY_CAP`).
- Needs (food, water, fun) drop over time and only change its face; they never cost growth. A treat every 20 study minutes.
- Exam season (from `PET_SEASON` days before an exam or mock until it ends): no study for 48 hours turns the puppy into a ghost; 25 minutes of study bring it back.
- Shared gardens (`gardens`, `garden_members`, up to 8 people, 5 gardens each, invites like group chats): each member publishes a puppy card (`PUT /api/pet/card`) and sees the others' puppies.

## 6. The garden and Bloc City (v6.1)

Full design and numbers: `docs/GARDEN.md`. The essentials:

- Study is the only income: each newly logged study minute = 1 sun + 12 s of fuel (`claimStudy`, per day, 8 h cap, each day counted once). Nothing is ever sold for money.
- Server data: `farms` (one JSON per person: coins, sun, fuel, seeds, basket, house, unlocked places, decorations, Index, stars, cars, drive log, visit log) and `plotdocs` (one JSON per garden, key `u:<user>` for your own, `g:<gardenId>` for a shared one: place, plots). Both use optimistic `rev` updates through `farmTx` / `savePlots` and retry on conflict.
- Endpoints: `GET /api/farm` (`?cat=1` adds the catalog: species, houses, places, decorations, cars, trials, rules), `GET /api/farm/plot?g=me|<gardenId>`, `POST /api/farm/act` (`a`: plant, water, harvest, clear, move, buy, sell, house, unlock, deco, place, car, color, star, seen), `POST /api/farm/drive` (`a: 'start'` then `a: 'end'` with notes, crates, jumps, trial, visits, secs), `GET /api/farm/now` (friends with a timer running, unless they turned off `settings.shareFocus`).
- Catalog constants: `SPECIES` (19 plants), `HOUSES` (Tent to Castle), `LOCS` (6 places), `DECOS`, `CARS`, `TRIALS`, `FARM` (tuning knobs). Change numbers there and in `docs/GARDEN.md`.
- Client: the Pet tab has three panes (`UI.petPane`: puppy, garden, city, saved in `myib:petpane:<id>`). Garden code sits in app.js between the `FARM` block and `FARM_ACT`. Plants, houses, places and decorations are drawn as inline SVG (`plantSVG`, `houseSVG`, `placeSVG`, `decoSVG`). Today shows "Studying now" (`cardNow`) and a ripe-plants nudge (`gardenNudge`).
- Bloc City (`src/drive/drive.src.js`): `start({ data, me, onEnd })` builds a fixed-seed city (`bloc-city-1`) of 2.6 × 3 km plus Lotus Island, draws it in about 20 draw calls (instanced buildings with a window shader, instanced trees), runs arcade car physics at 120 Hz with AABB collisions in an 80 m grid, and reports `{ secs, notes, crates, jumps, trial, visits }` to `onEnd`. Controls: WASD or arrows, Space to drift, M for the map, Esc to leave; touch buttons on phones. Sky follows Madrid time (or Sunset/Night). Original city only: never use a real game's names, logos, characters or map.
- Build: `cd src/drive && npm install && npm run build` writes `site/drive.js` (three.js is bundled in; the CSP allows nothing else).

## 7. Design system: "Fosforito" (v6)

Full spec: `docs/DESIGN.md`. White paper, blue-black ink for text and primary buttons (`--accent` is ink), and one highlighter (`--hl`, default #FFE14D) that marks only what's happening now: the class that's on, today, the picked day, the next exam, the current tab, ripe plants. Schibsted Grotesk. Two radii (12 and 6 px). No shadows at rest, no gradients, no glass, no confetti, ease-out motion only. Squared paper only on time grids. Bloc Plus picks the highlighter colour (`ACCENTS`). UI copy: sentence case, plain words, commas instead of middle dots, no exclamation-heavy hype.

## 8. Run it locally

```bash
cd tests && npm install            # wrangler and Playwright helpers
npx wrangler pages dev ../site --d1 DB=bloc-local --binding ADMIN_CODE=LOCALADMIN2026 \
  --port 8789 --ip 127.0.0.1 --persist-to state --compatibility-date 2025-10-01
python3 seed.py http://127.0.0.1:8789      # Mauro (admin) plus classmates, chats, a planner
python3 smoke.py http://127.0.0.1:8789     # 56 browser checks, phone and laptop
python3 farmtest.py                        # garden API end to end
python3 gcap.py http://127.0.0.1:8789 out phone   # garden and city screenshots
python3 dcap2.py http://127.0.0.1:8789 out        # Bloc City from set places (needs WebGL)
```

- Set `WRANGLER_SEND_METRICS=false CI=1`. A 503 from `/api/push/key` is normal locally.
- Playwright: Chromium works; for WebGL launch with `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`. Software GL runs Bloc City at about 3 fps, so judge looks from screenshots, not speed. `localStorage['bloc:city:debug'] = '1'` exposes `window.__blocCity` so a test can move the car.
- Tests log in through `ctx.request.post('/api/login')`. Hash-only navigation doesn't reload the page: click the UI or reload when you need `loadUI` again.

## 9. Ship a version

1. Bump `CACHE` in `site/sw.js` (`myib-v6-1` style) so phones pick up the new files.
2. Run the smoke test: zero failures and zero console errors on phone and laptop.
3. Zip the contents of `site/` (files at the root of the zip, not inside a folder) as `bloc-v<version>-<name>.zip`. Never overwrite an older version's zip or folder.
4. Mauro uploads it to Cloudflare Pages himself (direct upload). Don't upload, and don't push to the default branch: push a branch and let him merge.
5. Add a row to the project doc "MyIB versions" (what changed, the service worker cache name, how many checks passed).

## 10. Gotchas that already cost time

- A new `settings` field disappears unless `sanitize()` keeps it.
- Free accounts have smaller planner limits and write rate limits.
- D1's `json_extract` returns JSON text for arrays and objects: `JSON.parse` it.
- The Siri Shortcut must pass its state token back each turn (see "Bloc Siri setup" in the project).
- Six tabs already fill a phone's tab bar: new features go inside an existing tab or a sheet.
- Bloc City's coordinates: roads sit on multiples of 80 m (x from −1440 to 1120, z from −1440 to 1440), the beach boulevard at x = 1200, the bridge at z = −320. Anything placed on a road (trial checkpoints, ramps, crates) must respect that.
- Bloc City steering: three.js rotation about y turns the car toward screen-left, so pressing right lowers the heading.
