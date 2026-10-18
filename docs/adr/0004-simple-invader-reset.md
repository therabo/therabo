# ADR-0004: Simple Invader fade and native replay

## Status

Accepted.

## Decision

Keep one original scene inside an outer opacity group. Derive reset times from
actual ending metadata: 1 s fully visible hold, 0.5 s ease-in-out fade-out, 0.15 s
fully hidden, 0.5 s ease-in-out fade-in. The transparent SVG exposes the existing
theme background. The native SMIL opacity envelope repeats on its generated cycle.

Inside the hidden window, an 80 ms SMIL class signal applies `animation-name:none`
to the inner scene. Removing the signal restarts its existing CSS animations.
A permanent replay class offsets their delays by a generated wait so that local
time zero coincides with fade-in completion. Original keyframes, durations,
iteration counts and generated gameplay remain unchanged. The opacity envelope
is outside the cancelled scene and cannot be interrupted by the reset.

Only Invader composition uses this adapter. Meteor and static assets remain
independent. Reduced motion uses the same simple opacity transition, with the
existing movement suppression. No extra geometry, color, filter, mask, copied
scene or runtime script is needed.

## Consequences and validation

The delay adapter must include every scene animation, including ship/trails,
individual motion, projectiles, explosions, cleanup and victory. It receives the
composed scene clock. Validate a uniform hidden background, reset only during
invisibility, exact initial restoration and two complete cycles using the real
SVG-as-image with JavaScript disabled, plus light/dark/mobile/reduced variants.
