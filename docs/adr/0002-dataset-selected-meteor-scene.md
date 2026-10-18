# ADR-0002: Dataset-selected Meteor Dodge scene

## Status

Accepted: Meteor Dodge v2.

## Decision

Choose INVADERS or METEOR_DODGE once from the initial calendar at the build/render
boundary. Completing Invader gameplay cannot select Meteor Mode. Static variants
always show the original calendar. Modes share only calendar geometry, starfield,
ship/trail primitives, palette and seeded randomness.

Meteor Dodge owns spawning, threat projection, escape planning and continuous
safety certification. Its fixed unified intro is independent of the Invader
positioning optimizations. One generated field is shared by all variants:
300-second irregular schedule, 108 independently recycled meteors, nine silhouettes,
3–6 typically visible, cap 7 and at most two large. Spawns do not depend on ship
altitude. Harmless crossings remain visible. The ship stays at x=424 and chooses
safe upper/lower corridors only for predicted threats, with a 5-unit safety guard.

Traffic and ship motion repeat through a certified seam without global emptying,
a terminal state or simultaneous restart. The generated SVG contains the entire
schedule and CSS motion; there is no runtime generator or JavaScript dependency.

## Consequences and validation

Circumscribed meteor envelopes and the real ship/trail geometry provide a
conservative collision certificate. Tests cover mode dispatch, harmless and paired
threats, continuous safety, population caps, seam/trail continuity, distant periods
and reduced motion. Shared primitives must preserve Invader output byte for byte.
