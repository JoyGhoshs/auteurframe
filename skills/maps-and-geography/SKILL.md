---
name: maps-and-geography
description: Animated maps from OpenStreetMap with make_map and the map component - camera flights between places, zoom from world to street, flight arcs and road routes drawn on, pins and labels, highlighted countries and regions with spotlight, styles (light, dark, streets, topo, natgeo, relief, satellite, terrain, OSM, Natural Earth vector). Use for anything where geography matters - travel, history, wars, migration, trade, weather, news locations.
stage: animate
tags: [map, maps, openstreetmap, osm, geography, location, route, flight, travel, country, region, satellite, documentary, vox]
version: 1
---

# Maps and geography

Maps answer "where" in one glance. A good map shot has one idea: fly to the place, draw the journey, light up
the region. Build it with `make_map` (downloads the real map and bakes the camera) and place it with the
`map` component; layer your own titles, captions and annotations above it.

## make_map spec

```
```tool make_map
{"style": "light",
 "camera": [
   {"place": "Bangladesh", "at": 0},
   {"place": "Dhaka", "zoom": 10.5, "at": 1.5, "duration": 2.5},
   {"fit": ["Dhaka", "Chittagong"], "at": 5.5, "duration": 2}
 ],
 "markers": [{"place": "Dhaka", "label": "Dhaka", "at": 3.6, "style": "pin"},
             {"place": "Chittagong", "label": "Chattogram", "at": 6.2, "style": "pulse"}],
 "routes": [{"from": "Dhaka", "to": "Chittagong", "kind": "road", "at": 6.0, "duration": 2.2}],
 "regions": [{"name": "Bangladesh", "at": 0.4, "fill": "--accent", "opacity": 0.25, "label": "Bangladesh"}],
 "tint": "none"}
```
```

- Places are names (geocoded with OpenStreetMap Nominatim) or `[lat, lon]` pairs. Use full names when ambiguous
  ("Paris, France"). `geocode <place>` checks one first.
- camera: the first entry is where the shot starts (at 0). Each later entry is a flight that starts at `at` and
  lasts `duration`. Give `zoom` for an exact level, otherwise the place's own extent is fitted; `fit` frames several
  places at once; `bbox: [south, west, north, east]` frames an area. Long flights automatically zoom out and back in.
  Between flights the camera keeps a slow push (`"drift": 0.04` zoom per second; 0 to stop it).
- Zoom guide (zoom 0 = whole world 512 px wide): world 1.5 to 2, continent 3, country 4 to 6, region 7 to 8, city 10 to 12,
  district 13 to 14, streets 15 to 17.
- markers: `style` pin, dot, pulse (expanding rings for events) or label (text only); `label`, `at`, optional `duration`, `color`.
- routes: `from`, `to`, optional `via` list, or `path` of [lat, lon]. `kind`: straight, arc (great-circle, for flights),
  road (real driving route from OSRM). `style`: solid, dashed, flight (dashed with a plane at the head). `at`, `duration`, `color`, `width`.
- regions: `name` of a country (Natural Earth, works offline once cached) or any area OpenStreetMap knows (a state, district,
  city, lake, park). `fill`, `opacity`, `label`, `at`, `spotlight: true` darkens everything else, `duration` fades it out.
- `x, y, w, h` in % of the frame when the map is not full-bleed (for example a map panel beside text).
- `duration` defaults to the scene length.

## Styles

| style | look | use |
|---|---|---|
| light, dark | quiet grey cartography with place labels | most explainers; dark for dramatic or night stories |
| light-nolabels, dark-nolabels | same without text | when you add your own labels (cleanest Vox look) |
| streets | full colour street map | cities, neighbourhoods, local news |
| topo | colour topographic map | regions, landscapes, rivers |
| natgeo | National Geographic style atlas | history and documentary at country or region scale (zoom 15 max) |
| relief | shaded relief without labels (zoom 12 max) | ancient history, empires, wars; pair with tint paper |
| ocean | bathymetry and seas (zoom 12 max) | voyages, trade routes, ocean stories |
| satellite, hybrid | Esri world imagery; hybrid adds borders and place names | real terrain, cities from above, disasters, deforestation |
| terrain | OpenTopoMap relief with contour lines | mountains, battles, expeditions |
| osm, humanitarian | the standard OpenStreetMap look and the HOT variant | when the audience should recognise "a map" |
| vector | Natural Earth countries drawn in the film's own colours (CSS variables), instant and unlimited | world and continent scale, flags-and-borders stories, very stylised films |
| liberty, bright, positron, midnight, fiord | live vector maps (MapLibre + OpenFreeMap): razor sharp at every zoom, 3D buildings from zoom 14, tilt and rotate | city dives, street-level stories, 3D flyovers, modern explainers |
| satellite-3d, topo-3d | satellite or topographic imagery draped on real 3D terrain (AWS elevation tiles) | mountains, valleys, rivers, disasters, expeditions; dramatic establishing shots |

### 3D camera (vector and 3D styles only)

Every camera entry also takes `pitch` (0 looks straight down, 60 to 75 is a dramatic oblique view) and `bearing` (degrees, compass
direction at the top). `"orbit": 6` on the spec slowly rotates the camera 6 degrees per second. `"terrain": 1.5` exaggerates
the relief, `"buildings": false` flattens the city, `"labels": false` removes the base map text, `"palette": "film"` recolours the
map with the film's CSS variables. Pattern: start flat at city zoom 11, then fly to the landmark at zoom 16 with pitch 60 and
bearing 30, drop the pin as the camera settles. These styles stream tiles live, so the renderer needs internet; no tile limit applies.
A 3D terrain shot renders slowly (about 20 seconds per second of video); keep it short.

`tint` (on the spec or the component): paper, mono, night, warm, cool, muted. relief or light-nolabels plus tint paper is a
strong documentary base; dark-nolabels plus accent routes looks like a news graphic. City-scale close-ups need many tiles;
the vector style needs none.

`"borders": true` adds the Natural Earth country outlines on top of tiles.

## Choreography that works

- Establish, then dive: start at country or world level, fly into the city on the narration word, then drop the pin.
- Draw the journey: route `at` slightly before the spoken verb ("sailed", "marched", "flew"); the head of the line leads the eye.
- Light up then explain: region fill fades in, the spotlight dims the rest, then a label or callout names it.
- Sequence of events: several `pulse` markers with staggered `at` times matching the narration list.
- Keep a title or date stamp above the map with your own GSAP (for example a typed year in the top left that counts up).
- Keep the caption band free: put labels away from the bottom 14% of the frame, or use `y`/`h` to lift the map.

## Rules

- Maps must keep their attribution visible (the component shows it; leave `credit: true`).
- Tile downloads are limited per map (1400 tiles). Very long close-up pans fail; fly out instead, or use the vector style.
- A flight longer than about 4 s feels slow; 1.8 to 3 s is typical. Hold at least 1 s after arriving before the next move.
- Re-run make_map to change timings; tiles are cached so it is fast.
