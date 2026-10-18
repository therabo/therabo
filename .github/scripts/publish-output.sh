#!/usr/bin/env bash
set -euo pipefail

# This script is for the hosted workflow only. Never commit from local preview tools.
[[ "${GITHUB_ACTIONS:-}" == true ]] || { echo 'Run publication through GitHub Actions.' >&2; exit 1; }
: "${RUNNER_TEMP:?Runner temporary directory required}"
output_tree="$RUNNER_TEMP/therabo-profile-output"
files=(
  stats/activity-card.svg stats/activity-card-light.svg
  stats/activity-card-mobile.svg stats/activity-card-mobile-light.svg stats/activity.json
  contributions/calendar.json
  contributions/contribution-invaders-dark.svg contributions/contribution-invaders-light.svg
  contributions/contribution-invaders-mobile-dark.svg contributions/contribution-invaders-mobile-light.svg
  contributions/contribution-invaders-static-dark.svg contributions/contribution-invaders-static-light.svg
  contributions/contribution-invaders-mobile-static-dark.svg contributions/contribution-invaders-mobile-static-light.svg
)

case "${1:-}" in
  prepare)
    # An empty remote branch and an unavailable remote are different conditions.
    if git ls-remote --exit-code --heads origin output > "$RUNNER_TEMP/therabo-output-ref"; then
      git fetch --no-tags --depth=1 origin output
      git worktree add --detach "$output_tree" FETCH_HEAD
    else
      status=$?
      [[ "$status" == 2 ]] || exit "$status"
      git worktree add --detach "$output_tree" HEAD
      git -C "$output_tree" switch --orphan generated-profile-output
    fi
    mkdir -p dist/stats dist/contributions
    for file in "${files[@]}"; do
      baseline="assets/$file"
      # Versioned public snapshots also make a first run resilient to a temporary API failure.
      if [[ -f "$output_tree/$file" ]]; then
        mkdir -p "dist/$(dirname "$file")"
        cp "$output_tree/$file" "dist/$file"
      elif [[ -f "$baseline" ]]; then
        mkdir -p "dist/$(dirname "$file")"
        cp "$baseline" "dist/$file"
      fi
    done
    ;;
  publish)
    # Require a complete set. Generation failure cannot publish half a profile.
    for file in "${files[@]}"; do
      [[ -s "dist/$file" ]] || { echo "Missing generated file: $file" >&2; exit 1; }
    done
    for file in "${files[@]}"; do
      mkdir -p "$output_tree/$(dirname "$file")"
      cp "dist/$file" "$output_tree/$file"
    done
    git -C "$output_tree" add -- "${files[@]}"
    if git -C "$output_tree" diff --cached --quiet; then
      echo 'Graphics unchanged; no commit required.'
      exit 0
    fi
    git -C "$output_tree" -c user.name='github-actions[bot]' -c user.email='41898282+github-actions[bot]@users.noreply.github.com' commit -m 'Update generated profile graphics'
    # Fast-forward only. Concurrency serializes this workflow; unrelated output files survive.
    git -C "$output_tree" push origin HEAD:refs/heads/output
    ;;
  *) echo 'Expected prepare or publish.' >&2; exit 1 ;;
esac
