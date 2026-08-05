# Full Game QA Report

Date: 2026-07-16

## Scope

- 8 shipped stages.
- 10 deterministic completion attempts per stage, 80 total.
- Continuous Stage 1 through Stage 8 campaign with score and lives carried forward.
- Real browser Canvas recording using normal keyboard input.

## Final 8x10 Results

| Stage | Wins | Game overs | Timeouts | Enemy base-hit runs | Average | Maximum | Player deaths | Power-ups collected/spawned |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 10/10 | 0 | 0 | 0 | 67.7s | 75.8s | 3 | 26/30 |
| 2 | 10/10 | 0 | 0 | 0 | 62.0s | 73.7s | 4 | 22/28 |
| 3 | 10/10 | 0 | 0 | 0 | 58.2s | 68.8s | 2 | 20/29 |
| 4 | 10/10 | 0 | 0 | 0 | 67.6s | 123.0s | 5 | 24/28 |
| 5 | 10/10 | 0 | 0 | 0 | 51.0s | 63.2s | 3 | 16/29 |
| 6 | 10/10 | 0 | 0 | 0 | 56.6s | 82.0s | 4 | 19/30 |
| 7 | 10/10 | 0 | 0 | 0 | 58.0s | 76.7s | 10 | 13/30 |
| 8 | 10/10 | 0 | 0 | 0 | 61.6s | 88.2s | 13 | 12/28 |

Required result: 80 wins, 0 game overs, 0 timeouts, 0 enemy base-hit runs.

## Corrections Made

- Replaced fixed-time survival QA with win/game-over/timeout outcomes.
- Added first-cause diagnostics for base hits, player hits, overlaps, bounds, spawn tiles, stuck enemies, and pickup reachability.
- Fixed lane snapping so turning cannot move a tank into terrain or another tank.
- Added stage-specific spawn pressure, fire rate, bullet speed, downward pressure, and direct-base-shot grace.
- Kept Stages 1-6 at no more than three simultaneous enemies; Stages 7-8 use four.
- Increased player spawn protection, base firing speed, and power-up pickup lifetime.
- Improved input-only QA movement with physical-space projectile dodging and safe base-aware shooting.
- Added the original-style one-time extra life at 20,000 points for continuous campaigns.

## Browser Completion Recording

- Seed: `70000`.
- Result: Stages 1-8 completed in order with normal score/life carry-over.
- Browser elapsed time: 520.1063 seconds.
- Resolution: 768x720 at 30 fps capture.
- Final size: 27,183,001 bytes.
- Stage times: 93.94s, 69.94s, 58.77s, 59.20s, 54.87s, 66.75s, 47.00s, 61.55s.
- Opening frame verified as the title screen.
- Ending frame verified at 8:39 with Stage 8 `STAGE CLEAR` visible.
- Final artifact: `artifacts/famicom-tank-battle-stages-1-8.webm`.

## Verification Commands

```bash
npm run check:regressions
npm run build
node scripts/check-qa-playthroughs.mjs
QA_CAMPAIGN_RUNS=3 node scripts/check-qa-playthroughs.mjs
node scripts/check-browser-qa-bridge.mjs
```
