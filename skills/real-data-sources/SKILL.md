---
name: real-data-sources
description: Pull real, citable numbers and facts with wikidata, sparql, owid (Our World in Data), worldbank and data_search, save them as data assets and chart them honestly with the chart components or d3. Use when a scene states a number, a ranking, a trend, a date or a comparison.
stage: animate
tags: [data, statistics, facts, wikidata, our world in data, world bank, charts, sources, numbers]
version: 1
---

# Real data sources

Never invent a number. Fetch it, show it, cite it.

## Tools

- `wikidata Bangladesh` returns structured facts: population, area, capital, heads of state, founding dates, official images
  (collect them with `collect_image <commons url>`). Works for people, companies, cities, rivers, events.
- `sparql` with a Wikidata query body for lists and rankings, for example the ten most populous cities of a country:
```
SELECT ?cityLabel ?pop WHERE { ?city wdt:P31/wdt:P279* wd:Q515; wdt:P17 wd:Q902; wdt:P1082 ?pop.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } ORDER BY DESC(?pop) LIMIT 10
```
- `data_search child mortality` finds Our World in Data chart slugs; `owid child-mortality Bangladesh,India,World` returns the series
  (year, value) and saves a data asset. OWID covers health, energy, CO2, economy, education, population, conflict, technology.
- `worldbank gdp per capita BGD,IND` for World Bank indicators (names or codes); if the World Bank API is down, use owid.

Each data tool prints a compact table and saves a JSON asset `{title, unit, source, page, series: {country: [[year, value], ...]}}`.

## From data to screen

- Pick the one comparison that proves the narration's point; three to six bars or two to four lines at most.
- Copy the values into the chart components (`bar-chart`, `line-chart`, `donut`, `stat`) or load the asset inside the scene:
```
AU.scene((ctx) => {
  ctx.defer(fetch(ctx.asset('as_data01')).then((r) => r.json()).then((d) => { const pts = d.series['Bangladesh']; ...build the chart... }));
});
```
- Round sensibly (74.7 years, 171 million), label units, start bars at zero, and put a source line on screen:
  `Source: Our World in Data` in small text at the lower left.
- Numbers count up with the counter helper; the final value lands on the spoken word.
