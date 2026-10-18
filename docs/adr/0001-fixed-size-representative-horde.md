# ADR-0001: Fixed-size representative hordes

## Status

Accepted.

## Decision

Keep the exact public calendar and frame-zero renderer independent of selection.
All invaders retain a 12-unit sprite. Search for a certified readable full set
first, including the compatibility placement strategy. Return a valid full-set
incumbent immediately; an unresolved readable route must withhold thinning.
Only genuinely overfull scenes may use a topology-preserving representative
subset, with explicit count and sampling metadata.

Placement, motion and validation share `motion-geometry.mjs`: x=116–842,
y=−27.5–155.5, sprite/stroke guards and independent directional envelopes.
Continuous deployment paths and disjoint swept envelopes reject collisions.
Sampling preserves clusters, outliers, contribution levels and major gaps.
Representative coverage is capped at 16%; the full set is exempt.

## Randomness and boundaries

Generation-time layout/starfield/meteor randomness uses a SHA-256-seeded stream.
Individual invader motion retains its distinct FNV-seeded stream. Both algorithms
belong to the lightweight `random.mjs` utility; extracting their identical PRNG
step must preserve both seed hashes and every draw. Geometry owns no network,
build, scene-selection or rendering dependency. Internal placement helpers are
private; only the renderer/planner and validation interfaces are exported.

## Consequences and validation

The public calendar is exact even when the final horde is representative. The
bounded search is a safety/readability certificate, not a mathematical maximum.
Tests protect a real 39-day full set, recovery of an outlier full set and the
approved 144-of-370 readable configuration. The golden dense fixture is test data,
not a production count rule. Same inputs/configurations must render identical
SVG bytes across maintenance refactors.
