---
name: model-spec-3d
description: Generate real 3D models from code with a ModelSpec (JSON parts, anchors, templates, mirroring, joints, materials) - creatures, vehicles, buildings, furniture, plants and props - instead of a lone sphere or box. Use with the model-spec component, or as cast members and props inside world3d, whenever a scene needs a 3D object or animal that is not in the library.
stage: animate
tags: [3d, model, modelspec, procedural, character, animal, vehicle, furniture, building, prop, three.js, generate, sculpt]
version: 1
---

# ModelSpec: 3D models written as code

A model is a list of named parts. Every part sits on its parent through anchors, so nothing floats and nothing needs
hand-computed coordinates. The library already has: dog, cat, bird, car, tree, house, chair, table, desk-lamp, sofa.
Use a library model by name first; write a spec when the scene needs something else.

```js
component('model-spec', { model: 'dog', x: 20, y: 12, w: 60, h: 72, actions: [{ do: 'walk', at: 0, duration: 3 }, { do: 'wag', at: 3, duration: 2 }] });
component('world3d', { set: 'suburb', props: [{ model: 'tree', x: -3, z: -2 }], cast: [{ id: 'rex', model: 'dog', x: 0, z: 1, actions: [{ do: 'run', at: 0.5, duration: 2, to: [3, 1] }] }] });
```

## Authoring rules (adapted from sand3d, Apache-2.0)

1. Start from the category: biped, quadruped, bird, fish, vehicle, building, furniture, plant or prop. Validation knows
   each one: creatures need a head part and their limbs (quadruped four legs, biped two legs and two arms, bird two wings),
   vehicles at least 8 parts, buildings 6, furniture 4.
2. Name each dimension once in `dims` and derive the rest with expressions ("leg*0.5", "W-0.2"). Aim for under 15 numbers per part.
3. One part per distinct piece; use templates for anatomy and repeated structures:
   head { w, h, d, snout, ears: floppy|pointy|round|long }, torso { len, chest, hip, belly, axis: z|y }, limb { len, thick, segs, foot: paw|hoof|shoe|hand, bend },
   tail { len, d, curl }, wheel { d, w }, roof { type: gable|hip|flat, w, d, h, overhang }, canopy { r, clumps }, eye { d }.
4. Place each part once, in its parent's frame: `parent`, `self` (the anchor on this part) and `at` (the anchor on the parent).
   Anchors are "center", side strings like "+Y", "-Y-Z", "+X+Y", or fractions [u, v, w] of the bounding box (0 to 1 on x, y, z).
   `offset` nudges in metres, `rot` turns in degrees around the attachment point.
   Joints must overlap, never touch at a corner: sink a head, limb or tail a quarter of its size into its parent
   (for a head use `self: [0.5, 0.25, 0.25]` rather than `"-Y-Z"`), otherwise it floats when the model moves.
5. Model the left side only and add `mirror: "x"`; the right side, its children and its joints are created for you.
6. Say each shape with the primitive that names it: box (rounded), cylinder, cone (`d2` top width, 0 for a point), sphere,
   capsule, torus (rings, tyres, collars), lathe (vases, lamp shades: profile [[r, y], ...]), loft (bodies and hulls:
   stations [[z, width, height, roundness 2 to 4, dy], ...]), tube (tails, cables, handles: path [[x, y, z], ...]), gable (roofs).
7. Dress the parts: a `palette` of named materials with presets (skin, fur, fabric, wood, paint, metal, chrome, plastic,
   glossy, rubber, glass, emissive) and colours; at least two colours per model.
8. One joint per moving part: `joint: { name, type: hinge|ball|spin|slide, axis: "+X", range: [min, max] }`. Names drive
   the built-in actions: shoulder_/hip_/leg for walking, tail/wag for wagging, neck/nod for nodding, wing for flapping,
   spin joints for wheels. Positive rotation about +X tips +Y toward +Z (forward).

Units are metres, Y is up and the model faces +Z. The builder snaps the lowest point to the ground.

## Example: a quadruped from templates

```json
{"name": "fox", "category": "quadruped", "dims": {"L": 0.5, "leg": 0.24, "t": 0.055},
 "palette": {"coat": {"preset": "fur", "color": "#e07a2e"}, "white": {"preset": "fur", "color": "#fff4e6"}},
 "parts": [
  {"id": "torso", "use": "torso", "with": {"len": "L", "chest": 0.2, "hip": 0.17}, "offset": [0, "leg", 0], "mat": "coat"},
  {"id": "head", "use": "head", "with": {"w": 0.17, "h": 0.15, "d": 0.16, "snout": 0.1, "ears": "pointy"}, "parent": "torso", "self": [0.5, 0.25, 0.25], "at": [0.5, 0.82, 0.94], "mat": "coat"},
  {"id": "leg_front_l", "use": "limb", "with": {"len": "leg+0.03", "thick": "t", "segs": 2, "foot": "paw"}, "parent": "torso", "at": [0.76, 0.25, 0.85], "mirror": "x", "mat": "coat", "joint": {"name": "shoulder_l", "type": "hinge", "axis": "+X", "range": [-45, 45]}},
  {"id": "leg_back_l", "use": "limb", "with": {"len": "leg+0.03", "thick": "t", "segs": 2, "foot": "paw", "bend": "fwd"}, "parent": "torso", "at": [0.76, 0.25, 0.12], "mirror": "x", "mat": "coat", "joint": {"name": "hip_l", "type": "hinge", "axis": "+X", "range": [-45, 45]}},
  {"id": "tail", "use": "tail", "with": {"len": 0.34, "d": 0.08, "curl": 0.4}, "parent": "torso", "self": "center", "at": [0.5, 0.75, 0.02], "mat": "white", "joint": {"name": "tail_wag", "type": "hinge", "axis": "+Y", "range": [-35, 35]}}
 ]}
```

## Checking your model

Preview the scene: validation errors (missing head or limbs, a single blob, unknown parents, bad expressions) arrive as
runtime errors with the fix to apply; floating parts and single-colour models arrive as console warnings. Look at the
contact sheet as a stranger would: name every part you see. If a part needs explaining, fix it before finishing.
