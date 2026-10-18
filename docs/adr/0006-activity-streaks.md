# ADR-0006: Public contribution streaks inside Activity

## Status

Accepted for the local implementation; publication awaits profile review.

## Decision

Keep the five existing REST/search metrics and their meanings. Add a separate
Activity-owned streak collector using GitHub's anonymous public calendar and the
existing `fromPublicHTML` validator. Request each calendar year from account
creation through the current UTC day, validate complete daily coverage, then
join the days before calculating streaks. This preserves runs across year
boundaries and avoids calling an annual maximum an account-history record.

The current streak ends today or yesterday: an unfinished zero-contribution day
does not break yesterday's run. Zero on an earlier day does. Longest-streak ties
use the most recent run. Dates and scope are persisted with the counts; rendering
does not consult the clock. Calendar counts have GitHub's public-profile scope,
including anonymized private counts only if the owner has made them public.
No private repository details or authenticated calendar payloads are requested.

Render both areas inside the existing frame and palette. Desktop uses a vertical
divider; mobile stacks the same areas with a horizontal divider. Use small local
vector paths and the existing orbital instrument vocabulary, without runtime
packages, fonts or third-party cards. Preserve SVG primitives shared by the game.
Keep history scope and as-of date in the snapshot and accessible description;
omit the visible footer and its divider. Size the frame to the remaining content,
allowing extra height only when streak date ranges wrap.

## Consequences and validation

One public calendar request per account year is added to the Activity build.
There is no persistent history cache to become stale after contribution edits.
Reject missing years, gaps, malformed dates/counts and failed requests before
writing any output. The existing staged publisher retains last-good Activity
independently of Contribution Invaders. Its workflow and file contract stay intact.

Offline tests cover coverage failure, zero/current/yesterday runs, leap days,
year boundaries, ties, transport retry and last-good preservation. Browser review
uses the real SVG-as-image in desktop/mobile and light/dark, with no page scripts.

Sources: [GitHub profile contributions](https://docs.github.com/en/account-and-profile/concepts/contributions-on-your-profile),
[public contribution visibility](https://docs.github.com/en/account-and-profile/reference/profile-contributions-reference).
