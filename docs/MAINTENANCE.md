# Maintaining the profile

The repository contains dependency-free Node.js 24 generators, their structural
regression tests, and the final SVG assets used by the README. SVG playback needs
no JavaScript, remote fonts, filters or embedded HTML.

## Build and test

```sh
node --test test/*.test.mjs
node .github/scripts/build-profile.mjs
CALENDAR_FILE=assets/contributions/calendar.json CONTRIBUTIONS_OUT_DIR=dist/contributions node .github/scripts/build-contribution-invaders.mjs
OUT_DIR=dist/stats node .github/scripts/build-activity-card.mjs
```

The profile build regenerates the header/section assets and README. The activity
build reads public GitHub data. The contribution build uses `CALENDAR_FILE` when
set, otherwise the public contribution calendar API. `GITHUB_TOKEN` is optional
for local collection and supplied through the hosted workflow's environment.
Never put credentials in source or generated assets.

Each contribution generation creates fresh layout and starfield seeds. One
configuration is shared by all eight theme/mobile/static variants. `HORDE_SEED`
replays the placement search; a complete configuration and starfield seed/data
are needed to reproduce an entire SVG exactly. Tests pass explicit configurations
when checking deterministic geometry or an approved reference.

## Sources and outputs

- `.github/scripts/`: production generators, scene/domain modules and publisher.
- `.github/workflows/profile-graphics.yml`: tests and scheduled publication.
- `test/`: reusable offline regression tests and documented fixtures.
- `assets/`: versioned profile SVGs and last-good public activity/calendar snapshots.
- `dist/`, staging directories, logs, caches and local review outputs: ignored.

The README loads dynamic stats/contribution SVGs from the `output` branch and
keeps local versioned fallbacks. The hosted workflow tests first, preserves the
last successful output, stages each generator independently and publishes only a
complete asset set. API failure retains last-good files rather than zeroing data.
Publication is a fast-forward-only output-branch update; local builds never push.
The first hosted run can seed its output from the versioned assets.

## Approved scenes

The initial calendar is exact: viewBox `-16 -32 880 192`, 12×12 squares, 16-unit
pitch and original contribution colors. Desktop/mobile share the same full grid.
The final horde reserves the left 15%, uses x=116–842 and y=−27.5–155.5, and
keeps fixed-size invaders. Readable full sets take priority over representative
sampling. Selection never changes the initial calendar or public activity counts.

For the versioned real 39-day calendar:

| Phase | Start | End |
|---|---:|---:|
| Block-to-invader morph | 2.6308 s | 6.7154 s |
| Starfield fade | 3.5154 s | 7.1154 s |
| Pre-positioning gap | 6.7154 s | 7.5954 s |
| Invader deployment | 7.5954 s | 10.3454 s |
| Ship entry | 7.7204 s | 10.3454 s |
| Gameplay | 10.3454 s | last explosion |

Timing is derived by the Invader clock; different calendars can have different
morph/ending boundaries. Positioning remains 1.60× its canonical speed. Individual
motion retains its approved periods and envelopes. Two randomized star layers
move continuously right-to-left at 31.2 and 52 units/s, with seamless wrap.

Targeting selects the leftmost available invader, locks on firing and predicts
its moving horizontal intercept. White 14.4×3.6 artwork travels at 200 units/s;
logical hit dimensions remain separate from artwork. Hits have a 380 ms burst.
After the final burst, GITHUB SAVED! appears after 120 ms with a 320 ms fade.
It holds fully visible for 1 s; the whole scene fades out for 0.5 s, resets under
0.15 s invisibility and fades the original graph in for 0.5 s. Native SMIL class
signals restart the existing CSS timeline; no runtime script is used.

Only an initially empty calendar selects Meteor Dodge. Its separate clock keeps
the unified intro and gameplay start at 13.3154 s. The ship remains at x=424;
nine silhouettes use an irregular 300 s pre-generated schedule with individual
recycling, typical population 3–6, cap 7, at most two large meteors and a 5-unit
safety guard. Spawn is independent of ship altitude. Harmless crossings remain
visible, and only predicted threats cause evasions. The scene has no ending.

The README uses dedicated static calendar assets for reduced motion. The animated
SVGs also contain their own reduced-motion rules. Light/dark use the same scene
geometry and the existing theme palette.

## Metrics and privacy

All activity searches explicitly require public data. Repository/stars totals
cover owned public repositories; commit search counts indexed public commits,
not every lifetime commit; pull requests/issues are public authored items. The
contribution calendar is a separate GitHub metric and is not interchangeable with
search totals. Incomplete or malformed API results are rejected. Versioned data
may be stale during an outage and is not described as live.

The README's identity, degree and LinkedIn link are intentional public profile
content. Do not add private repository payloads, environment files, machine paths,
local review artifacts or authentication/session data.

See [architecture](ARCHITECTURE.md), [test policy](../test/README.md) and the
[active architectural decisions](adr/README.md) before changing timing or geometry.
