---
name: svg-architecture-and-props
description: Build the world around the characters - animated environments with toon-set (city night or day, burning city, street, suburb, rooftop, forest, desert, beach, mountains, farm, interior, office, bridge, checkpoint, campsite; weather, parallax pan) and about 50 living objects and buildings with toon-prop (houses, apartments, towers, shops, pharmacy, hospital, school, church, factory, bridge, gate, vehicles that drive, trees, lamps, furniture, fires, beehives, radio towers) - or draw custom architecture and objects in SVG when the story needs something new.
stage: animate
tags: [environment, set, background, architecture, building, props, objects, vehicles, city, interior, weather, parallax, svg, world]
version: 1
---

# Architecture, sets and props

A story scene is a place. Build the place first, then put the characters in it.

## Environments

```
AU.component('toon-set', { preset: 'burning-city', weather: 'ash', pan: 10 });
```
Presets: city-night, city-day, burning-city, street, suburb, rooftop, forest, desert, beach, mountains, farm, interior, office, bridge,
checkpoint, campsite. `time` (dawn, day, sunset, dusk, night) overrides the light; `weather` rain, snow, fog or ash; `burning: true`
sets the skyline smoking; `pan` is a slow camera drift in px per second (far layer moves at a third of it: parallax).
`props` replaces the preset objects and `extra` adds to them: `[['pharmacy', 70, 30, { night: true }], ['car', 20, 12, { burning: true }]]`
(name, x %, height %, options; `lift` raises an object in % of the frame, for a computer on a desk or a window on a wall).

## Objects and buildings

```
AU.component('toon-prop', { name: 'police-car', x: 10, y: 92, h: 18, night: true, drive: { to: 60, at: 0.4, duration: 2.2 } });
AU.component('toon-prop', { name: 'gate', x: 50, y: 90, h: 34, open: 2.5 });
```
Buildings: house, apartment, tower, shop (label), pharmacy, hospital, school, church, factory, cabin, tent, bridge, gate, fence, barricade,
wall, water-tower, radio-tower, windmill, well. Vehicles: car, police-car, bus, truck, bicycle, boat, helicopter, plane. Nature: tree, pine,
palm, bush, rock, mountain, cloud, sun, moon. Street: lamp, traffic-light, billboard, sign, bench, mailbox, hydrant, trash-can.
Interior: table, chair, bed, sofa, tv, computer, desk, door, window, radio. Story objects: beehive, campfire, fire, barrel, crate, satellite-dish.
They live on their own: chimney and fire smoke, flickering lit windows (`night: true`), blinking antennas, spinning windmills and rotors,
swaying trees, police lights, traffic lights cycling, bees orbiting hives. `burning: true` and `ruined: true` turn any object into wreckage;
`depth` pushes it back with haze; `color` and `label` customise it; `parts` adds your own SVG on top.

## Drawing your own architecture

When the story needs a place or object the library lacks (a lighthouse, a castle, a spaceship, a market stall, a specific landmark), draw it:
- Same style: flat fills, thick ink outline `#221c22` (6 px main shapes, 4 px details), round joins, one or two colours plus a darker shade.
- Build from simple primitives: rects for walls, paths for roofs, repeated rects for windows (vary which ones are lit at night), circles for
  wheels and lamps. Draw in its own viewBox with the ground line at the bottom so it sits on the set's ground.
- Give it life: one moving part (smoke, flag, light, wheel, water) animated from t in onFrame.
- Depth: far objects smaller, bluer and less saturated, near objects larger with full colour; overlap layers; cast a soft ground shadow.
- Silhouettes for the far distance: one flat dark shape with a few lit windows reads as a whole city.
- Landmarks: capture the 2 or 3 features people recognise (dome and minarets, a clock tower, the bridge cables) and simplify the rest.

## Composition

Ground line around 78 to 90 percent of the height; characters stand on it; the hero object of the scene (the pharmacy in a pharmacy scene)
sits on a third line and is the largest or brightest thing; keep the caption band clear of important objects.
