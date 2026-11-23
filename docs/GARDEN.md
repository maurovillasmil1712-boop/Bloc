# Bloc Garden and Bloc City (v6.1, city v7)

The design document for the garden update. Numbers here match `FARM`, `SPECIES`, `HOUSES`, `LOCS`, `CARS` and `TRIALS` in `site/_worker.js`. If you change one, change both.

## The rule everything follows

Studying is the only income. One study minute gives 1 sun and 12 seconds of fuel. Sun plants seeds; fuel drives the car. Coins come from harvests and from Bloc City, and coins buy everything else. No button anywhere turns money into seeds, coins, crates or fuel.

Three things follow from that rule:

- The game can't replace studying. A student who stops studying runs out of sun and fuel within a day.
- Bloc City is the size of a study break. Five minutes of fuel per 25-minute session matches a Pomodoro break, and the tank holds 20 minutes at most.
- Random rewards (seed crates, Golden harvests) come only from playing, never from paying. Spain's draft law on minors in digital environments bans loot boxes for under-18s, and most Bloc students are under 18.

## Why it's built this way

| Finding | What Bloc does with it |
|---|---|
| Grow a Garden runs on real-time growth, a rotating seed shop, weather everyone shares, and mutations that multiply a crop's price | Same skeleton: plants ripen on the clock, the featured seed rotates every 6 hours, weather is the same for everyone in a place, and Wet, Focused, Golden and Rainbow multiply the price |
| Tangible rewards can undermine intrinsic motivation; game rewards help when they support competence and relatedness | Rewards point back at studying (Focused harvests, Legend stars) and at friends (watering, visits), never at grinding |
| When users fall into flow inside the game, the game stops driving the useful behaviour | Bloc City runs on fuel earned by study, so the flow lasts one break |
| Rewards shown the moment an app opens make people come back more than rewards after long sessions | Today shows "3 plants are ready to pick" the moment Bloc opens |
| Touch controls beat tilt for steering on phones | Big left and right buttons, gas and brake on the right thumb, a drift button |
| On phones, draw calls cost more than triangles | The whole city draws in about 20 calls: one instanced mesh for every building, one per tree part |

Sources: [Grow a Garden weather](https://www.ginx.tv/en/weather-events-grow-a-garden), [gag.gg beginner's guide](https://gag.gg/guides/beginners-guide), [gamification and intrinsic motivation (NTNU)](https://www.ntnu.edu/documents/139799/1279149990/04+Article+Final_camildah_fors%C3%B8k_2017-12-06-13-53-55_TPD4505.Camilla.Dahlstr%C3%B8m.pdf), [Journal of Marketing Research study of 18,952 users](https://marketing.uni-koeln.de/en/research/publications/jens-paschmann), [reward placement (UCL)](https://discovery.ucl.ac.uk/10131140/1/1-s2.0-S1071581921000793-main.pdf), [Spain's draft law on loot boxes (DLA Piper)](https://www.dlapiper.com/en/insights/blogs/mse-today/2024/the-spanish-government-publishes-the-preliminary-regulation-addressing-loot-boxes), [tilt vs touch (York University)](https://yorku.ca/mack/ec2017.html), [three.js instancing numbers](https://skills.sh/opusgamelabs/game-creator/threejs-perf).

## The loop

```
study minutes ──> sun ──> plant ──> wait (real time) ──> pick ──> basket ──> sell ──> coins
      │                     ▲                                                       │
      │                     └── friends water it (15% faster, maybe Wet)            ▼
      └──> fuel ──> Bloc City ──> notes, crates, jumps, trials, visits ──> coins and seeds
                                                                                     │
          bigger house (more plots) <── coins ──> places, decorations, cars <─────────┘
```

## Plants

| Plant | Rarity | Seed | Sun | Grows | Picks | Sells | Native to |
|---|---|---|---|---|---|---|---|
| Basil | Common | 10 | 10 | 20 min | 1 | 22 | Old Town |
| Radish | Common | 15 | 15 | 40 min | 1 | 34 | Pine Hills |
| Daisy | Common | 20 | 20 | 1 h | 1 | 48 | Campus |
| Geranium | Uncommon | 30 | 20 | 75 min | 1 | 70 | Old Town only |
| Strawberry | Uncommon | 40 | 30 | 2 h | 3 | 30 | The Beach |
| Tomato | Uncommon | 50 | 35 | 2 h | 3 | 36 | Old Town |
| Sunflower | Uncommon | 60 | 45 | 3 h | 1 | 150 | The Beach |
| Blueberry | Rare | 140 | 60 | 4 h | 4 | 70 | Pine Hills |
| CAS Cactus | Rare | 150 | 60 | 4 h | 1 | 340 | Campus |
| Lavender | Rare | 160 | 70 | 5 h | 1 | 380 | Pine Hills |
| Coconut Palm | Rare | 200 | 80 | 6 h | 3 | 160 | The Beach only |
| Neon Fern | Rare | 220 | 80 | 6 h | 1 | 520 | Downtown only |
| TOK Tree | Epic | 420 | 150 | 12 h | 5 | 220 | Campus |
| Dragon Fruit | Epic | 480 | 160 | 12 h | 1 | 1150 | Downtown |
| EE Ivy | Epic | 520 | 200 | 16 h | 1 | 1400 | Campus |
| Edelweiss | Epic | 600 | 200 | 15 h | 1 | 1600 | Pine Hills only |
| Moonflower | Legendary | not sold | 300 | 24 h | 1 | 4200 | Lotus Island, picked 21:00 to 08:00 |
| Golden Apple | Legendary | not sold | 350 | 24 h | 3 | 2600 | Lotus Island |
| Lotus 45 | Legendary | not sold | 450 | 48 h | 1 | 12000 | Lotus Island |

- A plant in its native place grows 25% faster. Plants with several picks regrow in half the time.
- Weight varies; price scales with weight between 0.7x and 1.6x.
- Mutations multiply: Wet x2 (rain, or a friend's water), Focused x2 (picked during a study session or within 20 minutes of one), Golden x8 (1%, three times likelier at golden hour), Rainbow x20 (0.2%). Each Legend star adds 0.5% to Golden.
- Weather follows Madrid time. Rain is decided per hour per place (Pine Hills 35%, The Beach never). Golden hour is the 45 minutes before Madrid's sunset (90 on Lotus Island). Weekends sell 25% higher.

## Houses, places, decorations, cars

| House | Plots | Coins | Needs |
|---|---|---|---|
| Tent | 4 | free | |
| Cabin | 6 | 250 | 2 study hours |
| Cottage | 9 | 900 | 6 study hours |
| Townhouse | 12 | 2,500 | 15 study hours |
| Villa | 16 | 6,500 | 30 study hours |
| Mansion | 20 | 15,000 | 80 study hours |
| Castle | 25 | 40,000 | 80 study hours and 2 Legend stars |

Every house level also adds a plot to each shared garden you're in (6 plots plus the sum of everyone's levels, up to 30).

Places: Old Town (free), The Beach (400, Cabin), Campus (800, Cottage), Pine Hills (1,500, Cottage), Downtown (3,000, Townhouse), Lotus Island (10,000, Mansion and a Legend star). Unlocking costs coins once; moving a garden is free but waits 12 hours between moves. Your garden's place is where your house stands in Bloc City.

Decorations: Bench 120, Bloc Flag 150, Street Lamp 200, Gnome 300, Fountain 900, Pond 1,500, Highlighter Statue 5,000. Room for 2 plus your house level.

Cars: Hatchback (free, 119 km/h), Beach Buggy (1,500, Cabin), Garden Van (2,500, Cottage), Sunset GT (6,000, Townhouse, 162 km/h). Eight colours.

## Shared gardens

The puppy gardens from v5 became real gardens. Anyone in one can plant from their own seeds, anyone can water each plant once (the waterer gets 5 coins), and only the planter picks. Anyone who unlocked a place can move the garden there. A plant whose planter left can be pulled out by anyone.

## Bloc City

v7 redesigned the whole city (full plan in `docs/CITY-V7.md`). It's an original coastal city of about 6 km by 5 km with 15 districts: Old Town, Ensanche, Gran Vía, El Paseo, Downtown (towers from 60 to 240 m), The Park with its lake, Campus, The Beach (a palm promenade and beach towers), The Port, El Polígono, Barrio Sur, Pine Hills, The Airport, La Ronda (the ring road) and Lotus Island across an arched bridge. The map comes from a fixed seed (`bloc-city-7`), so every student drives the same streets. No names, logos, characters or map shapes from any real game.

- Sticky notes: 160 on the road edges, 3 coins each, once a day.
- Seed crates: 10 a day, in new places every morning, each a random seed (Legendary 0.5%).
- Stunt jumps: 12 ramps spread over the map. 100 coins the first time, then 10 once a day.
- Time trials: Beach Run, Downtown Dash, Bridge Sprint, Sierra Climb, Runway Rush (ids end in 7; the v6.1 routes are retired). A medal pays 20, 40 or 80 coins once a day; your first gold on each gives a rare seed. Medal times come from the route length (gold at 25 m/s average).
- Friends' houses: drive past one and you both get 10 coins, once a day.
- Sky: the real time in Madrid by default, or a fixed sunset or night.

## Endgame: Legend stars

When the puppy reaches Legend (80 hours), every 10 more hours of study is a Legend star: a random Legendary seed and 500 coins. Stars never run out, so the reason to study never ends with the puppy.

## What the server checks

- Sun and fuel come from the planner's logged sessions (8 hours a day at most, like the puppy). Each day counts once, so deleting and re-logging a session earns nothing.
- A drive starts a run with the fuel you have; the end report can't spend more seconds than really passed. A run that never reported back still uses its fuel.
- At most one sticky note per 1.5 seconds driven, each note once a day; crates once a day; trial times faster than 48 m/s average are rejected.
- Visits only count for people in your shared gardens who haven't blocked you.
- Every farm and garden write uses an optimistic revision check and retries, so two friends planting at once never lose a plant.

## Ideas for later

- Bloc FM: a radio in Bloc City playing Mauro's own beats.
- Seasons: a December snow week with winter plants, an exam-season event.
- The puppy helps in the garden (a Legend puppy waters one plant a day).
- Trading seeds between friends.
