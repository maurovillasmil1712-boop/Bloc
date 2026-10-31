# Bloc

Bloc is a school planner for IB, Bachillerato, ESO, and university. It brings a timetable, calendar, deadlines, tasks, study sessions, and reminders together in an installable web app that can work offline.

## Features

- Daily timetable and upcoming classes
- Calendar for exams, deadlines, holidays, and other events
- Tasks, study sessions, and a focus timer
- Accounts and planner sync across devices
- Installable progressive web app with offline support
- Help and privacy pages at `/support` and `/privacy`

## How it works

Bloc is built with plain HTML, CSS, and JavaScript; it has no frontend build step or package dependencies. Cloudflare Pages serves the static files and runs `_worker.js` for the `/api/*` routes. The worker stores accounts and planner data in a Cloudflare D1 database bound as `DB`.

`data.js` defines the starter planners and supported school levels. `app.js` contains the planner interface and client logic, while `pet.js` implements the study pet. `sw.js` provides offline behavior.

## Run locally

Install Node.js, then start the Cloudflare Pages development server from this directory:

```sh
npx wrangler pages dev . --d1 DB
```

Open [http://localhost:8788](http://localhost:8788). The worker creates its database tables on first use. Local development uses Wrangler's local D1 database; it does not connect to production data.

## Deploy to Cloudflare Pages

1. Create a Pages project using this repository, with the repository root as the project directory, no build command, and `.` as the output directory.
2. Create a D1 database in Cloudflare.
3. In the Pages project settings, add that database as a binding named `DB`.
4. Deploy the project. The worker initializes its tables when the API is first used.
5. Add a custom domain in Cloudflare Pages if needed.

## Project files

| File | Purpose |
|---|---|
| `index.html` | App shell and metadata |
| `app.js` | Planner interface, account flow, and client logic |
| `styles.css` | Responsive light and dark themes |
| `data.js` | Starter planners and school-level settings |
| `pet.js` | Study pet behavior and UI |
| `_worker.js` | Cloudflare Pages API worker |
| `_headers` | Static response security headers |
| `sw.js` | Offline app behavior |
| `manifest.webmanifest` | Installable app metadata |
| `privacy.html`, `support.html` | Privacy and help pages |
| `icons/` | App icons |
