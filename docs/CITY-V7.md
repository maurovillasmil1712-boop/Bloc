# Bloc City v7: the plan

Status: waiting for Mauro's OK. Nothing is built yet.

Written 23 Nov 2026 from the v7 prompt (`Bloc_City_v7_prompt_for_Claude.pdf`), `.claude/skills/bloc-app/SKILL.md`, `docs/GARDEN.md`, `docs/DESIGN.md` and the v6.1 `src/drive/drive.src.js` (1,070 lines: flat-shaded boxes on an 80 m grid, one draw call for all buildings, arcade car physics at 120 Hz).

## 1. Decisions

| Question | Answer |
|---|---|
| Map | Redesign the whole map |
| Combat | Website only. Inside the iPhone app the city has no weapons, gangs or blood, so the app keeps a low App Store age rating (Apple rates realistic violence 13+ or higher). |
| Check-ins | You approve Ultra screenshots of stage 1. The other seven stages then run without stopping. |
| Code | `maurovillasmil1712-boop/bloc`, branched from `v6.1-garden`. Every stage gets its own branch. Nothing goes to `main`. |

Defaults I picked. Say the word and I change any of them:

- **Fuel runs on every second in the city:** on foot, in a car, in a plane. The tank still holds 20 minutes, so the city stays a study break.
- **Busted or wasted costs no coins.** You respawn at the police station or the hospital, lose the mission you were on, and keep playing.
- **Multiplayer uses light polling** (one request every 2 seconds while you're in the city) on your current Workers plan. No Durable Objects: they need a second Worker, and I'd ask first.
- **NPC voices are real voices** made offline with Kokoro, an open voice model under the Apache 2.0 licence, in English and Spanish. No paid service.
- **Presets:** Low, Medium, High, Ultra, picked by auto-detect, with dynamic resolution to hold the frame rate. Ultra is the default on desktop GPUs.
- **The city gets its own page** (`/city/`) shown in a full-screen frame over the app. Its security policy adds one permission the planner never gets: WebAssembly, which the compressed textures and models need. The planner's policy stays exactly as it is.

## 2. What "looks like GTA 6" means in a browser

- **Within reach:** photo-scanned CC0 materials on every surface, a physical sky on Madrid time, image-based lighting, soft cascaded shadows, GTAO, screen-space reflections on wet roads and glass, volumetric fog, bloom, AgX tone mapping, a warm Madrid colour grade and TAA. On a desktop GPU, street-level screenshots can stand next to a current console game.
- **Weaker:** people. No free licence covers AAA humans with facial capture. MakeHuman bodies (CC0) with Quaternius animations (CC0) will look like a good 2015 game, not a 2026 one. Cars are modelled from scratch for Bloc, so they carry no real brands, and they will look clean rather than photogrammetry-perfect.
- **Phones** get the same city with simpler light (Low and Medium), because 30 fps on a mid-range phone is a hard limit.

## 3. The new map

An original Spanish coastal city with a Madrid core. Compass: north is −z, east is +x. The sea lies to the west, so the sun sets over the water like it does in Cádiz. The land covers about 4.2 by 4.6 km (v6.1: 2.6 by 3 km).

| District | Character | Garden place |
|---|---|---|
| Old Town (Casco Viejo) | Crooked lanes 5 to 9 m wide, many closed to cars, an arcaded main square, a basilica, terraces, cobbles. Three to six floors, ochre and terracotta plaster, iron balconies, wooden shutters, clay roof tiles. | Old Town |
| Ensanche | The grid around Old Town: 110 m blocks with courtyards, plane trees, shops at street level, six to eight floors | |
| Gran Vía | A diagonal avenue of 1900s buildings with domes, cinemas, theatres and neon, ending at the main roundabout | |
| El Paseo | A north to south boulevard with side lanes and tree-lined medians, from the main roundabout to Downtown | |
| Downtown | Glass and stone towers from 60 to 240 m, plazas, a sunken square | Downtown |
| The Park | A big park east of Old Town: a lake with rowing boats, a glass pavilion, fountains, sports courts | |
| Campus | Brick faculties, lawns, a library, a small stadium | Campus |
| The Beach | Wide sand, a palm promenade, beach bars, lifeguard towers, a pier | The Beach |
| The Port | Container cranes, warehouses, a ferry terminal, a marina, a lighthouse on the breakwater | |
| El Polígono | Warehouses, factories and a rail yard. Gang territory on the website. | |
| Barrio Sur | 1960s and 70s housing blocks with balconies and washing lines, a market hall, basketball courts | |
| Pine Hills | Winding roads up to about 140 m, pine forest, villas, a lookout over the city, a radio mast | Pine Hills |
| Lotus Island | Villas and palm groves, reached by a cable-stayed bridge | Lotus Island |
| The Airport | A 1.6 km runway, taxiways, a terminal, a control tower, hangars and small planes | |
| La Ronda | A ring road, three lanes each way, with four interchanges, a tunnel under the Park and a raised stretch past the Port | |

- **Roads** come from a road graph (nodes, lanes, widths, speed limits) that drives the meshes, traffic, pedestrians, the minimap and police routes. Kerbs, sidewalks, zebra crossings, traffic lights on the big junctions, five roundabouts with fountains.
- **Terrain:** a height map, flat at the coast, rolling in the city, steep in Pine Hills. Roads and buildings sit on it.
- **Landmarks** are original designs. Nothing copies a real building or a real game's map.
- **Gameplay spots move to the new streets:** 160 sticky notes, 10 daily seed crates, 12 stunt ramps (6 more than now), 5 time trials, friends' houses in their garden place.

## 4. Stages

Each stage is playable, committed on its own branch (`v7.1-visuals` to `v7.8-sound`, each built on the one before) and checked with screenshots, the budget test and the smoke test.

| # | Branch | What it adds | Done when |
|---|---|---|---|
| 1 | `v7.1-visuals` | New renderer and presets, the new map and terrain, roads, buildings, street furniture, trees and grass, sea, beach, port and airport (static), sky, weather and wet roads, streaming and the loading bar, the `/city/` page. Today's game moves over: driving, notes, crates, ramps, trials, friends' houses, fuel, the maps. | Ultra screenshots from 12 viewpoints (day, golden hour, night, rain) look clearly more real than v6.1, every preset stays inside its budget, smoke test passes, **you approve** |
| 2 | `v7.2-onfoot` | Third-person character (walk, run, jump, smooth camera), getting in and out of cars (F or a touch button), character customisation saved on the server (body, skin tone, hair, clothes, colours), interiors: café, clothing shop, garage, gym, your flat | You can walk into the café, buy a jacket, wear it, drive away, and see it next time |
| 3 | `v7.3-npcs` | Pedestrians with daily routines (walk, shop, sit, chat, cross at crossings), reactions (step aside, run, call the police), voiced dialogue in English and Spanish (at least 600 lines in each language) with no repeats per NPC per session, NPC missions (deliveries, races, finding things) paid by the server | 140 pedestrians on High within budget; a mission pays only through the server |
| 4 | `v7.4-vehicles` | Detailed cars with working lights and damage, better handling, motorbikes, a bus you can drive, traffic with traffic lights, the airport with small planes (throttle, pitch, roll, take-off, landing) | Take off, fly over the city, land back on the runway |
| 5 | `v7.5-police` | Wanted level from 1 to 5 stars (speeding near police, crashes, and on the website combat), chases, roadblocks from 3 stars, a helicopter at 4 and 5, arrests, losing them | A full chase ends both ways: you escape, or you get busted |
| 6 | `v7.6-combat` | Website only: weapons from a shop and pickups, mouse aiming, aim assist on phones, gangs in El Polígono with cover-and-shoot AI, health and armour, gang jobs paid by the server, the blood-effects gate | The iPhone app shows no weapons; blood stays off until the 16+ check and your approval |
| 7 | `v7.7-multiplayer` | Friends from shared gardens who are in the city at the same time: their cars and characters, wave, race, quick phrases | Two test accounts see each other and race |
| 8 | `v7.8-sound` | Engines per car with pitch by speed, tyres, crashes, horns, footsteps by surface, city sound by district and time of day, weapons, sirens, planes, a radio with royalty-free tracks plus Bloc FM with your beats, a pause menu with volume sliders | Every listed sound plays; volumes save |

Release after stage 8: service worker cache `myib-v7-0`, the skill file, `docs/GARDEN.md`, the versions doc, and `bloc-v7.0-city.zip` of `site/`.

## 5. Rendering

three.js r187 (the current release), `WebGPURenderer`: WebGPU where the browser has it (Chrome, Edge, Safari 26 on Mac, iPhone and iPad), the same renderer's WebGL2 backend everywhere else. Every effect below is a TSL node that runs on both.

| Feature | How |
|---|---|
| Materials | `MeshPhysicalNodeMaterial`: albedo, normal, roughness, metalness and AO maps on every surface, packed in KTX2 texture arrays so many materials share one draw call |
| Sky and sun | `SkyMesh` (physical sky) with the real solar position for Madrid (40.42° N, 3.70° W) at the current time; moon and stars at night; Sunset and Night modes stay |
| Image-based light | The Qwantani "pure sky" HDRIs from Poly Haven (dawn to night, one location, same light) blended by time and weather, plus a PMREM of the live sky |
| Shadows | `CSMShadowNode` cascades, contact shadows near the camera on High and Ultra |
| Ambient occlusion | `GTAONode`, plus AO baked into models |
| Reflections | `SSRNode` on wet roads, glass, water and car paint; environment maps as the fallback |
| Fog and light | Height fog everywhere; volumetric fog and light shafts on Ultra; `GodraysNode` on Medium and High |
| Night | Emissive neon and shop signs, lit windows, `ClusteredLightsNode` for hundreds of street lamps, bloom |
| Wet roads | The garden's weather drives the city: when `weatherAt()` says it rains in Pine Hills, it rains in Pine Hills. Wetness builds and dries over minutes. A puddle mask darkens asphalt, drops roughness and turns on SSR. Rain streaks, splashes and wet windscreens. |
| Car paint | Clearcoat with metallic flakes (a TSL noise in the clearcoat normal) |
| Glass | Physical glass with reflections; parallax interiors behind building windows (an atlas of 32 rooms rendered offline) |
| Decals | Road markings, cracks, stains, manholes, graffiti |
| Post | AgX tone mapping, a `Lut3DNode` grade per time of day and weather (warm Madrid afternoons, blue nights), bloom, `TRAANode` or SMAA or FXAA by preset, `TAAUNode` upscaling for dynamic resolution, depth of field in cutscenes, motion blur at speed |
| Geometry | Hero assets (cars, people, shopfronts, trees) with 4 LOD levels from meshoptimizer, octahedral impostors far away, instancing for everything that repeats |
| Trees | Poly Haven scanned trees plus EZ-Tree (MIT) for plane trees, acacias and palms, with real leaf cards and wind in the vertex shader |
| Grass and props | GPU-instanced grass with wind; small props scattered by Poisson sampling |

## 6. Performance budget

Frame budgets, checked by `tests/city7/budget.py` at fixed viewpoints:

| | Low | Medium | High | Ultra |
|---|---|---|---|---|
| Target | 30 fps, mid-range phone | 30 to 60 fps, recent phone, iPad, integrated GPU | 60 fps, laptop with a GPU | 60 fps, desktop GPU (default there) |
| Render scale (dynamic) | 0.7 to 0.85 | 0.8 to 1.0 | 0.85 to 1.0 | 0.75 to 1.0 with TAA upscaling |
| Draw calls per frame | 250 | 400 | 700 | 1,000 |
| Triangles per frame | 0.8 M | 1.5 M | 3 M | 6 M |
| GPU texture memory | 160 MB | 320 MB | 640 MB | 1.2 GB |
| Texture size | 512 px | 1K | 2K | 2K, 4K on hero assets |
| Shadows | 1 cascade, 1024 px, 80 m | 2 cascades, 2048 px, 200 m | 3 cascades, 2048 px, 400 m, contact shadows | 4 cascades, 4096 px, 800 m, contact shadows |
| Ambient occlusion | baked | GTAO, half resolution | GTAO | GTAO |
| Reflections | environment map | environment map | SSR, half resolution | SSR |
| Fog and light | height fog | height fog, god rays | god rays, light volumetrics | volumetric fog and light shafts |
| Anti-aliasing | FXAA | SMAA | TRAA | TRAA |
| Motion blur, depth of field | off | off | on | on |
| Full detail, then impostors | 400 m, then 1.5 km | 700 m, then 2.5 km | 1.2 km, then the whole map | 2 km, then the whole map |
| Pedestrians, traffic cars | 40, 16 | 80, 24 | 140, 36 | 220, 50 |
| Street lamps that light the road | 16 | 48 | 128 | 256 |
| CPU (physics, AI, streaming) | 8 ms | 8 ms | 6 ms | 6 ms |

Downloads:

- **First drive:** at most 12 MB on every preset (the engine, the WebAssembly decoders, the district you start in at 512 px or 1K, your car, your character, the sky). About 7 seconds on a 15 Mbit/s 4G link, with a progress bar. High and Ultra start with the same files and sharpen to 2K and 4K while you drive.
- **Streaming:** the map splits into about 20 chunks of 2 to 8 MB each, loaded ahead of you by distance and direction.
- **Hosted total:** about 300 MB across all texture sizes, at most 400 files under `site/city/` (the dashboard upload takes 1,000 files at most, 25 MiB each). Voices and sound effects ship as a few audio banks, not one file per line.
- **The planner stays fast:** nothing under `/city/` loads before you tap Drive, and `sw.js` stops caching `/city/` files. Today the service worker caches every file it fetches, which would put 300 MB on phones. City files get long-lived HTTP caching with hashed names instead.

## 7. Assets and licences

Rule: CC0, or a clear royalty-free licence that allows commercial use. Every file goes into `docs/CREDITS.md` with its source URL and licence. Anything unclear stays out. Raw downloads stay out of git; the processed files ship in `site/city/`.

**Textures and skies (CC0)**

| Source | Assets |
|---|---|
| [Poly Haven](https://polyhaven.com/license) HDRIs | `qwantani_dawn_puresky`, `qwantani_sunrise_puresky`, `qwantani_morning_puresky`, `qwantani_mid_morning_puresky`, `qwantani_noon_puresky`, `qwantani_afternoon_puresky`, `qwantani_late_afternoon_puresky`, `qwantani_sunset_puresky`, `qwantani_dusk_1_puresky`, `qwantani_dusk_2_puresky`, `qwantani_moonrise_puresky`, `qwantani_night_puresky`, `kloofendal_overcast_puresky` (rain) |
| Poly Haven textures | Roads: `asphalt_02`, `asphalt_04`, `worn_asphalt`, `road_damaged`, `clean_asphalt`. Old Town: `cobblestone_floor_04`, `cobblestone_square`, `patterned_cobblestone`. Sidewalks: `concrete_pavement`, `pavement_02`, `herringbone_pavement`, `hexagonal_concrete_paving`. Walls: `beige_wall_001`, `clay_plaster`, `blue_plaster_weathered`, `damaged_plaster`, `painted_brick`, `brick_wall_10`, `concrete_wall_006`, `concrete_tile_facade`, `rectangular_facade_tiles`. Roofs: `clay_roof_tiles`, `clay_roof_tiles_02`, `roof_tiles`, `grey_roof_tiles`. Metal: `corrugated_iron_02`, `rusty_metal_02`, `painted_metal_shutter`, `rusty_metal_shutter`. Nature: `bark_platanus`, `palm_tree_bark`, `pine_bark`, `coast_sand_01`, `damp_beach_sand`, `leafy_grass`, `forest_ground_04`, `park_dirt`. Interiors: `plank_flooring`, `wood_floor`, `marble_tiles`, `terrazzo_tiles`, `interior_tiles` |
| [ambientCG](https://docs.ambientcg.com/license/) | `Facade001` to `Facade020` (selected) for far facades and impostors, `Road007`, `Road012A`, `RoadLines006` to `RoadLines011` (markings), `LeafSet009`, `LeafSet010`, `LeafSet026`, `LeafSet030`, `Foliage001` to `Foliage008`, `PineNeedles001` (leaf cards), `GraffitiSet001`, `Grass004`, `Grass005`, `PaintedPlaster006`, `Asphalt025C`, `Asphalt031` |

**Models (CC0 unless marked)**

| Source | Assets |
|---|---|
| Poly Haven street props | `street_lamp_01`, `street_lamp_02`, `fire_hydrant`, `metal_trash_can`, `utility_box_01`, `utility_box_02`, `exterior_aircon_unit`, `modular_fire_escape`, `modular_electricity_poles`, `water_manhole_cover`, `concrete_road_barrier`, `concrete_road_barrier_02`, `modular_street_seating`, `painted_wooden_bench`, `security_camera_01`, `rollershutter_door`, `rollershutter_window_01` to `03`, `modular_chainlink_fence`, `outdoor_table_chair_set_01`, `planter_box_01` to `03`, `potted_plant_01`, `02`, `04`, `covered_car`, `baseball_bat` |
| Poly Haven nature | `jacaranda_tree`, `island_tree_01` to `03`, `pine_tree_01`, `fir_tree_01`, `tree_small_02`, `shrub_01`, `grass_medium_01`, `grass_medium_02`, `grass_bermuda_01` |
| Poly Haven interiors | Café: `CoffeeCart_01`, `CashRegister_01`, `bar_chair_round_01`, `round_wooden_table_01`, `round_wooden_table_02`. Shop: `wooden_display_shelves_01`, `steel_frame_shelves_01` to `03`, `Shelf_01`. Garage: `metal_tool_chest`, `tool_cart`, `bench_vice_01`, `drill_press_01`, `mounted_fluorescent_lights`. Flat: `Sofa_01`, `sofa_02`, `ArmChair_01`, `dining_table`, `dining_chair_02`, `electric_stove`, `vintage_microwave`, `gaming_console`, `wall_clock`, `modern_ceiling_lamp_01` |
| Poly Haven weapons (website only) | `service_pistol`, `bolt_action_rifle_7_62` |
| [MakeHuman](https://static.makehumancommunity.org/about/license.html) system assets | Base body, CC0 skin packs (natural female, natural male), eyes, eyebrows, hair, base clothes. Characters built in Blender with the MPFB add-on. The CC-BY material packs stay out. |
| [Quaternius](https://quaternius.com/packs/universalanimationlibrary.html) | Universal Animation Library 1 and 2 (250+ clips: locomotion, sitting, talking, combat, swimming), Universal Base Characters (fallback bodies) |
| Made for Bloc (original, no brands) | All vehicles (hatchback, sedan, SUV, van, coupé, supercar, taxi, police car, bus, scooter, sport bike, delivery truck, two small planes, a police helicopter), the SMG, shotgun and carbine, gym equipment, landmarks, the facade kit, the room atlas, sign textures. Modelled by script in Blender. |

**Sound and music**

| Source | Assets |
|---|---|
| [Kenney](https://opengameart.org/users/kenney) (CC0, through OpenGameArt) | RPG Audio (footsteps on stone, wood, grass, gravel), Impact Sounds, Interface Sounds and UI Audio for menus |
| [Freesound](https://freesound.org), CC0 filter only | Engine loops, tyre squeal, crashes, horns, sirens, prop planes, gunshots and impacts (website), rain, sea, wind, gulls, crowds, traffic hum, night crickets. Each file's ID goes in the credits. |
| [OpenGameArt](https://opengameart.org), CC0 filter only | Radio tracks for two or three stations (pop, electronic, lo-fi). FreePD closed down, so it's out. |
| Your beats | Bloc FM. Send the files and I'll add them. |
| Kokoro-82M (Apache 2.0) | NPC voices and radio DJ lines, generated offline in English and Spanish. Only the audio ships. |

**Code and tools**

| What | Licence | Ships in the site? |
|---|---|---|
| three.js r187 | MIT | yes |
| meshoptimizer decoder | MIT | yes |
| Basis Universal transcoder (KTX2) | Apache 2.0 | yes |
| EZ-Tree | MIT | yes |
| esbuild, gltf-transform, KTX-Software | MIT, MIT, Apache 2.0 | no, build tools |
| Blender (via the `bpy` package), MPFB, ffmpeg | GPL, GPL, LGPL | no, they only make assets |
| Open-licence fonts (OFL) for shop signs | OFL | no, only drawn into textures |

## 8. Server changes (`_worker.js`)

**New tables** (created by `makeSchema`, added to `accountWipe`):

| Table | Columns | Why |
|---|---|---|
| `presence` | `user` (key), `data` (JSON: position, heading, on foot or vehicle, look, last quick phrase), `at` | Friends see each other in the city. Rows older than 30 s count as gone. |
| `city_flags` | `user` (key), `age16_at`, `gore_ok`, `gore_by`, `gore_at` | The student's 16+ confirmation and your approval for blood effects |

**New fields in a student's farm** (the existing `farms` JSON, nothing dropped):

| Field | Holds |
|---|---|
| `avatar` | Body, skin tone, face, hair, hair colour, facial hair |
| `outfit`, `wardrobe` | What you wear, and the clothes you own |
| `arms` | Weapons you own and your armour (website only) |
| `flat` | Furniture placed in your flat |
| `missions` | Today's finished missions and gang jobs |
| `planes` | Planes you own |
| `stats` | Distance, highest wanted level, arrests. For fun, never a reward. |

**Endpoints:**

| Endpoint | Change |
|---|---|
| `GET /api/farm?cat=1` | The catalog adds outfits, new cars, planes, weapons, missions, the five v7 trials and the 12 ramps |
| `POST /api/farm/act` | New actions: `avatar`, `wear`, `buyOutfit`, `buyWeapon`, `buyArmour`, `buyPlane`, `flat` |
| `POST /api/farm/drive` | `start` also returns today's missions and the blood-effects flag. `end` also takes finished missions and gang jobs. |
| `GET`, `POST /api/farm/presence` | New: send your position every 2 s, get friends' positions |
| `POST /api/city/age` | New: a student confirms they're 16 or older, or takes it back |
| `POST /api/admin/gore` | New: you approve or revoke blood effects for one student |
| Admin accounts list | Adds the 16+ date and the approval switch to Manage Accounts |

**What the server checks** (on top of today's rules):

- A mission counts only if it was in that drive's list, wasn't done today, took at least its route length divided by a top speed (40 m/s by car, 9 m/s on foot), and fits inside the run's real time. Mission coins stop at 450 a day.
- A gang job counts once a day and only after its minimum time. Enemies never pay per hit.
- Blood effects reach the city only when all three hold: the student confirmed 16+, you approved them, and they switched it on.
- Positions go only to friends in a shared garden who haven't blocked you, and only while both of you are in the city. A setting turns it off.

**Economy (please approve these numbers):**

| Source | Now | v7 |
|---|---|---|
| Sticky notes | 160 a day, 3 coins each | same |
| Seed crates | 10 a day | same |
| Stunt jumps | 6 ramps: 100 the first time, then 10 a day | 12 ramps, same pay |
| Time trials | 3 routes: 20, 40 or 80 once a day, a rare seed for the first gold | 5 routes on the new map with new IDs (old best times stay in the data, unused), same pay |
| Friends' houses | 10 coins each, once a day | same |
| Missions (new) | | Deliveries 40 to 80, races 50 to 120 by medal, finds 30 to 60. Each once a day, 450 a day at most. |
| Gang jobs (new, website) | | Two jobs: 120 and 80 coins, once a day each |
| Busted or wasted | | no coin loss |

Fuel still limits the day: a full tank is 20 minutes, so nobody collects all of it.

New things to buy: outfits 40 to 1,500 coins (about 60 items), new cars from 800 (scooter) to 25,000 (supercar, needs a Villa), a trainer plane free to rent at the airport, your own plane 30,000 (needs a Mansion), weapons 400 to 4,500 (website), armour 1,200 once (it refills every drive), flat furniture 100 to 2,000.

## 9. App changes (`app.js`, `sw.js`)

- **City pane:** Drive opens the `/city/` frame. Garage, trials and today's progress stay.
- **Settings, Bloc City:** quality (Auto, Low, Medium, High, Ultra, saved per device), "Show me to friends in Bloc City", "I'm 16 or older" (one confirmation), "Blood effects" (locked, with "Waiting for approval", until you approve).
- **Admin, Manage Accounts:** a blood-effects switch per student, with a filter for students waiting.
- **iPhone app:** the app tells the city it runs inside `NATIVE`, and the city removes the weapon shop, pickups, gangs and police gunfire. Chases and arrests for speeding stay.
- `sanitize()` keeps the new settings fields. `sw.js` skips `/city/`. `_worker.js` sends the `/city/` security policy (adds `'wasm-unsafe-eval'` and `frame-ancestors 'self'`) and long cache headers for hashed city files.

## 10. Code layout

| Folder | What |
|---|---|
| `src/city/` | The engine, as ES modules: `render/`, `world/`, `actors/`, `game/`, `ui/`, `audio/`, `net/`. `npm run build` bundles it into `site/city/city.js`. |
| `tools/city/` | The offline pipeline: download sources with their licence records, bake textures to KTX2, make LODs and impostors, build people, cars and rooms in Blender, make voices with Kokoro, pack audio, build the map. Run only when assets change. |
| `site/city/` | What ships: `index.html`, `city.js`, decoders, `data/` (map, dialogue, missions), `chunks/`, `tex/`, `models/`, `sky/`, `audio/` |
| `tests/city7/` | Screenshots, the budget test, the server tests, the benchmark |

`src/drive/` and `site/drive.js` go away once stage 1 ships, since v7 covers every device v6.1 did.

## 11. Testing

- After every stage: `smoke.py` (0 failures, 0 console errors), `farmtest.py`, and the new city tests.
- `tests/city7/cap.py`: 12 fixed viewpoints at day, golden hour, night and rain, on Ultra and Low, through WebGPU (software here) and the WebGL2 fallback, plus a side-by-side sheet against the previous stage.
- `tests/city7/budget.py`: draw calls, triangles and texture memory at each viewpoint and preset. Over budget means the stage isn't done.
- `tests/city7/citytest.py`: missions, gang jobs, purchases, presence, the 16+ check and the approval gate, end to end on the local server.
- `/city/?bench`: a 60-second flight through the city that reports the frame rate per preset, for real phones and laptops.

## 12. Risks

- **No GPU here.** The workspace renders WebGPU in software at a few frames a second. I judge looks from screenshots; real frame rates need your devices (the benchmark page, or I run it on your MacBook through the desktop app's browser if you allow it).
- **MakeHuman's Blender add-on** may not run on the Blender version available here. Fallback: Quaternius Universal Base Characters (CC0, a bit more stylised).
- **Repo size:** the processed assets add about 300 MB to the repo, so `site/` stays a complete zip. Large pushes may need to go up in parts.
- **Older phones** without WebGL2 can't run v7 or v6.1. Phones without WebGPU get WebGL2 on Low.
- **Size of the job:** v7 is several times bigger than all of v6.1's city. Each stage takes one or more long sessions.

## 13. What I need from you

1. **GitHub pushes:** install the Claude GitHub App on the `bloc` repo (github.com/apps/claude/installations/select_target). Right now pushes get refused, so I commit locally and hand you zips.
2. **Your beats** for Bloc FM (MP3 or WAV), and the station name if it isn't "Bloc FM".
3. **The economy table** in section 8: OK, or the numbers you want.
4. **The new account data:** the 16+ confirmation, your approval switch, and positions shared with garden friends while both of you drive.
5. Optional: permission to run the benchmark on your MacBook through the desktop app's browser.

## Rules this plan keeps

- No GTA names, logos, characters, music or map. The city, its people, cars, brands and signs are original.
- Study stays the only income. Fuel and play time come from study minutes. Every reward is decided in `/api/farm/drive` or `/api/farm/act`, never trusted from the client.
- Same-origin only: every model, texture, sound and decoder lives under `site/city/`. No CDNs.
- Bloc City loads only after Drive. The planner doesn't get slower.
- No paid service, no change to how coins or fuel are earned, and nothing touching students' accounts without your OK. This document is that request.
