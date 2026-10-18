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

## Syncbase identifier compatibility (2026-10-18)

Use underscore-only signal IDs (`invader_scene_fade`, `invader_scene_reset`).
Firefox 153 loses the future `.end` syncbase intervals with the former unescaped
hyphenated IDs: cycle 2 can start from the explicit first signal, but cycle 3
retains the previous victory. A rectangle-only SVG reproduces this difference;
underscore IDs replay four periods in Chromium, Firefox and WebKit. Escaping the
hyphens works in Firefox but breaks later periods in WebKit, so it is unsuitable.

This changes only identifiers and their references. The opacity envelope, class
pulse, CSS adapter, timings and original scene remain identical. It fixes the
reproduced Gecko failure; the separately reported native Safari graph freeze
still requires its own diagnosis and must not be inferred fixed from this test.

The parsing ambiguity is described in the
[SMIL timing specification](https://www.w3.org/TR/SMIL2/smil-timing.html)
and [Mozilla issue 1572208](https://bugzilla.mozilla.org/show_bug.cgi?id=1572208).
