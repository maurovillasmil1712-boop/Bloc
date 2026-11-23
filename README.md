# Bloc

A study planner for IB students, at [myib.app](https://myib.app). Timetable, calendar, tasks, a focus timer, a study puppy, a garden that grows when you study, and Bloc City to drive in between sessions. Built and run by Mauro Villasmil for his class and about 300 students.

## What's in here

| Folder | What it holds |
|---|---|
| `site/` | The whole website as deployed: static files plus `_worker.js` (Cloudflare Pages advanced mode, D1 database). |
| `src/drive/` | Source of Bloc City. `npm install && npm run build` writes `site/drive.js`. |
| `docs/` | `DESIGN.md` (the Fosforito design system), `GARDEN.md` (the garden and Bloc City design and numbers), `VERSIONS.md` (every version so far). |
| `tests/` | A local server and Playwright checks. See `tests/README.md`. |
| `.claude/skills/bloc-app/` | A skill that explains the app to AI coding assistants. |

## Deploy

1. Bump `CACHE` in `site/sw.js`.
2. Run the tests in `tests/`.
3. Zip the contents of `site/` and upload it to the Cloudflare Pages project (direct upload). The project needs a D1 binding called `DB`; the other bindings are listed in the skill.

## Licences

Bloc's code is private to Mauro. Bundled third-party code: three.js (MIT, inside `site/drive.js`), Schibsted Grotesk (SIL Open Font License, `site/fonts/OFL.txt`).
