---
name: swarm-protocol
description: How many agents share one brain in a video production swarm (blackboard keys, claims, handoffs, barriers, repair routing, freezing); read at the start of any multi-agent run.
stage: any
tags: [swarm, multi-agent, blackboard, orchestration, memory]
version: 1
---

# Swarm Protocol

Many hands, one brain. Agents never talk to each other directly: they read a versioned blackboard
snapshot, claim work, write results with provenance, and emit events. The conductor owns the DAG,
the barriers and the retry budget. This protocol is what makes 10 parallel scene animators produce
one film instead of 10 demos.

## When to use / not use
- Use: any run with more than one agent role, any resume after a crash, any human edit mid-run.
- Not needed: a single-scene quick edit by one agent (still follow the write rules).

## Core rules
1. Read a snapshot, write deltas. Every write carries `{key, version, base_version, author, reason}`.
   A write whose `base_version` is stale is rejected; re-read and merge.
2. Keys (canonical):
   `brief`, `research`, `facts/<id>`, `bible`, `outline`, `beats`, `cues`, `scene:<n>` (plan + code),
   `qa:<n>`, `render:<n>`, `edit` (assembly plan), `audio`, `decisions` (append-only), `skills/active`.
3. Claims: before working on `scene:<n>` an agent writes `claim:scene:<n> = {agent, until}` with a
   lease (default 180 s, renewed on progress). Expired claims are re-assignable. One claim per scene.
4. Barriers: OutlineBarrier = `outline` + `bible` + `cues` locked. No animator starts before it.
   AssemblyBarrier = every `render:<n>` done or frozen-with-fallback. Barriers are explicit events.
5. Pipelining: after OutlineBarrier each scene flows independently: animator -> lint -> probe ->
   critic -> repair -> render. Never wait for all scenes to finish a stage (parallel scenes cut
   wall-clock 5-6x in Code2Video and Paper2Video).
6. Locked keys are read-only: `bible`, `outline`, `cues` after OutlineBarrier. A change requires a
   `decisions` entry and the conductor re-queues every dependent scene.
7. Facts: screenwriter and animators may only show numbers that exist in `facts/<id>`; scene code
   references the id in `data` (`"stat": {"value": 4000, "fact": "f12"}`).
8. Handoffs between adjacent scenes are written, not assumed: `scene:<n>.handoff_out` =
   {carried object, last-frame position/scale/colour/velocity, transition kind, duration};
   scene n+1 must read it and write `handoff_in` that matches.
9. Repair routing: QA writes failures with a `route` field: layout/motion -> animator; wrong fact ->
   research; pacing/too much text -> screenwriter; palette/type drift -> art director; caption timing
   -> subtitle sync. The conductor dispatches by route.
10. Retry budget: 3 repair rounds per scene (most gains come in rounds 1-3). Pass threshold for the
    critic: >= 4/5 on both "reads clearly" and "on-bible". Passing scenes are FROZEN (read-only);
    later repairs must not touch them. After 3 failed rounds: fall back to the house archetype for that
    beat and log it.
11. Escalating repair scope: patch the failing lines -> rewrite the failing block (one beat/layer
    group) -> regenerate the scene from its plan. Never regenerate a whole scene for a 1-line fix.
12. Critique-correct-verify: the critic that raised a note verifies that note was addressed before the
    scene passes; a fresh critic (one that did not build the scene) does the final pass.
13. Decision log is append-only: `{t, agent, category, subject, choice, options_considered, reason}`.
    Changing a choice appends a new entry with the same (category, subject).
14. Human edits win: a user edit writes `scene:<n>` with `author: "user"`; agents must merge on top
    of it and never revert it. Read the history since your last turn before writing.
15. Events (for the UI): `agent.status`, `agent.think`, `agent.cursor {scene, layer, x, y}`,
    `memory.write`, `scene.update`, `qa.report`, `render.progress`, `run.done`. Emit `agent.cursor`
    whenever you touch a layer so the user can see who is working where.
16. Budgets: each role has a token and wall-clock budget; announce any paid or slow step before it.
    No role may silently swap a provider, runtime or model.

## Do / Don't
| Do | Don't |
|---|---|
| write small deltas with base_version | overwrite a whole key from memory |
| put reasons in writes | leave unexplained changes |
| freeze what passed | let a later fix regress a passed scene |
| route a failure to the role that owns it | have the animator invent a new fact |
| renew your claim while working | hold a claim while idle |

## Recipe: message shapes
```json
{"op": "claim", "key": "scene:7", "agent": "animator-3", "lease_s": 180}
{"op": "write", "key": "scene:7", "base_version": 4, "author": "animator-3",
 "reason": "built beat 7 from plan; hero=counter", "value": {"code": "<div class=\"scene\">...", "layers": ["title","stat"]}}
{"op": "write", "key": "qa:7", "author": "critic-1", "value": {"pass": false, "scores": {"reads": 3, "on_bible": 5},
 "notes": [{"t": 2.1, "layer": "title", "predicate": "inside_safe(title)", "observed": "right edge 1862 > 1805",
            "fix": "max-width: calc(100% - 2*var(--safe-x)); data-fit", "route": "animator"}]}}
{"op": "event", "type": "agent.cursor", "scene": 7, "layer": "title", "x": 0.42, "y": 0.38}
```

## In AuteurFrame
- `memory.py` implements the blackboard; `swarm.py` the conductor (DAG, leases, barriers, retries,
  freeze); `qa.py` writes `qa:<n>` with routes; `bus.py` fans events to the UI over SSE.
- Scene agents receive: bible tokens, their beat (with cues), neighbouring handoffs, relevant facts,
  and the skills chosen for the beat. They return only the fragment plus `handoff_out` and a list of
  layers. The runtime contract is in composition-contract.
- With no LLM key every role has a deterministic house implementation; the protocol is identical, so
  a human or house agent can take over any claim.
```js
AU.scene(({ tl, data, $ }) => {
  $('.n').textContent = data.stat.value.toLocaleString('en-US');
  $('.n').setAttribute('data-fact', data.stat.fact);
  tl.fromTo($('.n'), { scale: 1.6 }, { scale: 1, duration: 0.45, ease: 'au.snapSettle' }, 0.1);
});
```

## QA checklist
- [ ] Every write has author, base_version and reason.
- [ ] No animator wrote before OutlineBarrier.
- [ ] Every on-screen number carries a fact id that exists.
- [ ] Handoff_out of scene n matches handoff_in of scene n+1.
- [ ] No frozen scene modified after freezing; <= 3 repair rounds per scene.

## Sources
- AuteurFrame PLAN.md section 4 (blackboard keys, OutlineBarrier, pipelining, events).
- Code2Video arxiv.org/abs/2510.01174 (planner-coder-critic, ScopeRefine, parallel sections 5.6x).
- Auto-Director arxiv.org/html/2610.28346 (critic threshold >= 4 on two axes, freeze passing scenes, 3 cycles, route to responsible agent).
- FilmAgent arxiv.org/abs/2501.12909 (critique-correct-verify, debate-judge, max 3 iterations).
- Preacher arxiv.org/abs/2508.09632 (freeze approved components).
- OpenMontage AGENT_GUIDE.md (append-only decision log, checkpoints, no silent runtime swaps, max 2 review rounds).
- HyperFrames work loop (read history since your last turn; build on the person's edits).
