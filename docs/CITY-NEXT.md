# Bloc City: what's next (written 24 Nov, 01:30)

Mauro's list for the scheduled sessions tonight. Do them in order, ship a zip after each group (files at the root of `site/`, under 100 MB), log each release in `docs/VERSIONS.md` and the project doc "MyIB versions". Branch `v7.1-visuals` only.

1. ✅ (v7.7) **Minimap zoom.** Start much closer, zoom out a little with speed, closer still on foot, `+` and `-` keys and two small buttons on the map, remember the setting (`drawMini` in `src/city/game/game.js`).
2. ✅ (v7.7) **Drive to.** Click or tap the big map (M) to drop a waypoint. Route along real roads (A* on `plan.nodes` / `plan.edges`) drawn on the minimap and the big map, distance on the HUD, an arrow at the screen edge when it's off screen, cleared on arrival. Mission objectives get the same route; the phone's Map app can set one too.
3. ✅ (v7.7) **UI pass.** Live coin counter on screen, health and armour as bars around the minimap with the wanted stars next to it, a weapon wheel on Tab (like the radio wheel), a legend with filters on the big map.
4. ✅ (v7.7) **Running over and killing NPCs.** A hard car hit or a gunshot kills: they stay down, the body is taken away after a while, killing is two stars, people nearby scream and run. Blood stays gated (16+ confirmation plus admin approval). Website only: in the iPhone app people just get knocked over.
5. ✅ (v7.7) **Staff.** Barista, clerk, mechanic, coach and range officer can be punched or shot down; the police get called; that shop is closed until the next drive.
6. ✅ (v7.9) **Voices.** Finish the Kokoro voices (`tools/city/talk/voice.py`, model and voices in `/home/claude/work/tts`; English then Spanish; it resumes), then add reaction lines for deaths ("He's not moving!").
7. ✅ (v7.8) **Speed.** A pass for Mauro's Intel MacBook Pro 2019 on Safari: crowd, traffic, shadows, rooms.
8. ✅ (v7.8) **More to do.** Five more missions from Rosa, street races against traffic, stunt combos, a "most wanted" survival challenge.

Notes for a fresh session: the repo is the source of truth. Bloc FM songs are not in git (`site/city/radio/blocfm/`, built from `/mnt/user-data/uploads/*.wav` with `/home/claude/work/fm.sh`); if they're missing, ship the zip without them and say so. Test with `wrangler pages dev` on 127.0.0.1:8789 (see the skill) and `tests/smoke.py` (56 checks).
