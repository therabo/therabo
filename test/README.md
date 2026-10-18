# Regression tests

Run `node --test test/*.test.mjs` with Node.js 24. The suite is offline and uses
Node's built-in test runner. Temporary output is created under the OS temporary
directory and removed by each test. No browser installation or package install is
required for the normal hosted build.

Tests protect public-data privacy/failure handling, exact calendar geometry,
fixed-size full-set/representative safety, moving-target prediction and lifecycle,
ship/trails, scene timing, ending/replay and perpetual Meteor collision safety.

Fixtures are reusable regression inputs:

- `gameplay-small.mjs`: minimal controlled target-order/concurrent-shot case.
- `dense-calendar.json`: synthetic 370-active-day high-density calendar.
- `dense-layout.json`: approved 144-sprite route certificate; protects readability
  and reference revalidation, not a production hard-coded count.
- `outliers-calendar.json`: full-set incumbent regression that exercises the
  fallback placement strategy.

Iteration-only comparison harnesses, artifact exporters, old timing expectations,
random stress loops and unused scenario fixtures were removed after the original
suite was executed. Structural coverage was retained here and aligned with the
approved final behavior. Pixel comparisons and native two-cycle playback belong
to final release validation outside the repository, rather than generated test
artifacts checked into source control.
