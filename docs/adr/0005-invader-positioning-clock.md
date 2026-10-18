# ADR-0005: Scene timing ownership

## Status

Accepted.

## Decision

Keep canonical geometry/planning time independent of rendered playback. The
Invader adapter derives the actual staggered morph interval and halves it; the
starfield fade follows the existing morph mapping. Retain 40% of the intentional
gap from morph completion to deployment. Divide positioning durations and the
ship's relative entry offset by 1.60. Translate later events by the total saved
time rather than changing gameplay or individual-motion speed.

Deployment and ship entry finish together; gameplay starts immediately. The same
adapter supplies individual-motion delays, shifted intercept events, ship/trail
playback and reset replay. Ending derives from the final real explosion, and
reset derives from ending. No ending/cycle timestamps are hardcoded.

The real 39-day snapshot therefore uses morph 2.6308–6.7154 s, star fade
3.5154–7.1154 s, gap 0.88 s, deployment 7.5954–10.3454 s and ship entry
7.7204–10.3454 s. These are derived results, not independent production constants.
Meteor owns its fixed unified intro and perpetual schedule independently.

## Consequences and validation

Sampled deployment/ship/trail keyframes stay on their canonical clock; CSS timing
parameters change playback only. Shared generators retain default timing inputs
for Meteor compatibility. Tests protect phase boundaries, same-progress geometry,
prediction phase alignment, ending/reset durations and repeated clean gameplay.
