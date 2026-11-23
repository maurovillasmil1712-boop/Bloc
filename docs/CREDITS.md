# Credits: Bloc City v7

Everything in Bloc City is either made by us in code or comes from a source that allows commercial use with no royalties. This file lists every third-party piece. Nothing is copied from any game.

## Textures (CC0, public domain)

From [Poly Haven](https://polyhaven.com) (CC0). Packed by `tools/city/textures.py` into KTX2 arrays under `site/city/tex/`.

- **ground**: [asphalt_02](https://polyhaven.com/a/asphalt_02), [worn_asphalt](https://polyhaven.com/a/worn_asphalt), [clean_asphalt](https://polyhaven.com/a/clean_asphalt), [cobblestone_floor_04](https://polyhaven.com/a/cobblestone_floor_04), [cobblestone_square](https://polyhaven.com/a/cobblestone_square), [concrete_pavement](https://polyhaven.com/a/concrete_pavement), [herringbone_pavement](https://polyhaven.com/a/herringbone_pavement), [hexagonal_concrete_paving](https://polyhaven.com/a/hexagonal_concrete_paving), [coast_sand_01](https://polyhaven.com/a/coast_sand_01), [leafy_grass](https://polyhaven.com/a/leafy_grass), [forest_ground_04](https://polyhaven.com/a/forest_ground_04), [park_dirt](https://polyhaven.com/a/park_dirt), [concrete_floor_worn_001](https://polyhaven.com/a/concrete_floor_worn_001), [gravel_ground_01](https://polyhaven.com/a/gravel_ground_01)
- **wall**: [painted_plaster_wall](https://polyhaven.com/a/painted_plaster_wall), [white_plaster_02](https://polyhaven.com/a/white_plaster_02), [clay_plaster](https://polyhaven.com/a/clay_plaster), [damaged_plaster](https://polyhaven.com/a/damaged_plaster), [blue_plaster_weathered](https://polyhaven.com/a/blue_plaster_weathered), [painted_brick](https://polyhaven.com/a/painted_brick), [brick_wall_10](https://polyhaven.com/a/brick_wall_10), [concrete_wall_006](https://polyhaven.com/a/concrete_wall_006), [concrete_tile_facade](https://polyhaven.com/a/concrete_tile_facade), [rectangular_facade_tiles](https://polyhaven.com/a/rectangular_facade_tiles), [large_sandstone_blocks](https://polyhaven.com/a/large_sandstone_blocks), [granite_tile](https://polyhaven.com/a/granite_tile), [corrugated_iron_02](https://polyhaven.com/a/corrugated_iron_02), [rusty_metal_02](https://polyhaven.com/a/rusty_metal_02), [painted_metal_shutter](https://polyhaven.com/a/painted_metal_shutter), [brown_planks_05](https://polyhaven.com/a/brown_planks_05)
- **roof**: [clay_roof_tiles](https://polyhaven.com/a/clay_roof_tiles), [clay_roof_tiles_02](https://polyhaven.com/a/clay_roof_tiles_02), [grey_roof_tiles](https://polyhaven.com/a/grey_roof_tiles), [roof_tiles](https://polyhaven.com/a/roof_tiles), [gravel_concrete](https://polyhaven.com/a/gravel_concrete), [corrugated_iron](https://polyhaven.com/a/corrugated_iron)
- **bark**: [bark_platanus](https://polyhaven.com/a/bark_platanus), [palm_tree_bark](https://polyhaven.com/a/palm_tree_bark), [pine_bark](https://polyhaven.com/a/pine_bark)

From [ambientCG](https://ambientcg.com) (CC0): [LeafSet009](https://ambientcg.com/view?id=LeafSet009), [LeafSet010](https://ambientcg.com/view?id=LeafSet010), [LeafSet026](https://ambientcg.com/view?id=LeafSet026), [Foliage003](https://ambientcg.com/view?id=Foliage003), [PineNeedles001](https://ambientcg.com/view?id=PineNeedles001), [GraffitiSet001](https://ambientcg.com/view?id=GraffitiSet001), [RoadLines006](https://ambientcg.com/view?id=RoadLines006), [RoadLines008](https://ambientcg.com/view?id=RoadLines008). The leaf cards in `site/city/tex/leaf-*.ktx2` mix these with leaves drawn in code.

## Models (CC0, public domain)

From [Poly Haven](https://polyhaven.com/models) (CC0), simplified to two levels of detail by `tools/city/models.mjs`: [street_lamp_01](https://polyhaven.com/a/street_lamp_01), [street_lamp_02](https://polyhaven.com/a/street_lamp_02), [fire_hydrant](https://polyhaven.com/a/fire_hydrant), [metal_trash_can](https://polyhaven.com/a/metal_trash_can), [utility_box_01](https://polyhaven.com/a/utility_box_01), [exterior_aircon_unit](https://polyhaven.com/a/exterior_aircon_unit), [concrete_road_barrier](https://polyhaven.com/a/concrete_road_barrier), [modular_street_seating](https://polyhaven.com/a/modular_street_seating), [painted_wooden_bench](https://polyhaven.com/a/painted_wooden_bench), [planter_box_01](https://polyhaven.com/a/planter_box_01), [potted_plant_01](https://polyhaven.com/a/potted_plant_01), [outdoor_table_chair_set_01](https://polyhaven.com/a/outdoor_table_chair_set_01), [covered_car](https://polyhaven.com/a/covered_car), [modular_electricity_poles](https://polyhaven.com/a/modular_electricity_poles), [security_camera_01](https://polyhaven.com/a/security_camera_01), [rollershutter_door](https://polyhaven.com/a/rollershutter_door), [water_manhole_cover](https://polyhaven.com/a/water_manhole_cover), [shrub_01](https://polyhaven.com/a/shrub_01), [grass_medium_01](https://polyhaven.com/a/grass_medium_01), [grass_bermuda_01](https://polyhaven.com/a/grass_bermuda_01).

Made in code, no outside source: every building, road, bridge, tree, car, the sky, clouds, water and the whole map.

## Sound

Stage 1 makes every sound in code with the Web Audio API (engine, tyres, wind, impacts, chimes, sirens, and since v7.3 gunshots, reloads and ricochets). No recordings from anyone else.

Bloc FM plays songs by Mauro Villasmil, used with his permission on the website only. They are not in this repository.

## Code

| Library | Licence | Use |
|---|---|---|
| [three.js](https://threejs.org) r187 | MIT | Rendering (WebGPU and WebGL2), loaders, post-processing |
| [Basis Universal](https://github.com/BinomialLLC/basis_universal) transcoder | Apache 2.0 | Decodes KTX2 textures (`site/city/lib/basis/`) |
| [meshoptimizer](https://github.com/zeux/meshoptimizer) decoder | MIT | Decodes compressed models |
| [esbuild](https://esbuild.github.io) | MIT | Bundles `src/city/` (build only) |
| [glTF Transform](https://gltf-transform.dev) | MIT | Simplifies and compresses models (build only) |

## Font

[Schibsted Grotesk](https://github.com/schibsted/schibsted-grotesk), SIL Open Font License 1.1 (`site/fonts/`).

