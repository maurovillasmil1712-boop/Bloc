# Bloc

Read `.claude/skills/bloc-app/SKILL.md` before changing anything. It explains the stack, the data model, the API, the design system, the garden and Bloc City, how to test, and how a version ships.

Rules that matter most:

- The deployable site is `site/`. Its files go at the root of the zip Mauro uploads to Cloudflare Pages.
- Never deploy, never push to `main`, never touch production data. Push a branch; Mauro merges and deploys.
- No CDNs or inline scripts (CSP). Self-host or bundle.
- Coins, seeds, fuel and rewards are decided on the server, never trusted from the client.
- Bump `CACHE` in `site/sw.js` every release and log it in "MyIB versions".
