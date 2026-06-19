# Stage Difficulty Design

## Scope

The current game ships the first 8 stages with a clear difficulty curve, then uses the same rules to extend toward a larger Battle City-style set later.

Original Battle City is a useful reference point, but not a strict content target for this pass: it uses a 13x13 battlefield layout and has 35 stages, with a repeated objective of protecting the base while destroying enemy tanks. This project should first make 8 stages that are readable, fair, and mechanically varied before expanding the stage count.

## Design Goals

- Stage 1 must teach movement, shooting, brick damage, base defense, and enemy entry without creating early base-rush failures.
- Difficulty should increase through route pressure, base exposure, terrain complexity, enemy pressure, and recovery cost.
- Every stage must let enemies leave spawn and enter the field, but early stages must not give enemies a direct, short route to the base.
- The base should remain strategically important without requiring the player to camp it from the first seconds.
- Each stage should have a distinct tactical idea, not just more walls.

## Difficulty Metrics

The automated stage checker should compute these values from each 13x13 coarse map:

- `spawnReachable`: every enemy spawn can reach the main battlefield.
- `baseReachable`: every enemy spawn has at least one path to a tile adjacent to the base.
- `minSpawnToBasePath`: shortest passable-tile path from any enemy spawn to a base-adjacent tile.
- `baseAdjacentOpenCount`: number of open or passable coarse tiles adjacent to the base enclosure.
- `baseProtectionCount`: number of brick or steel coarse tiles in the expected base-defense ring.
- `rightLaneDirectness` and `leftLaneDirectness`: whether a side lane can reach the base area with few or no forced turns.
- `spawnBulletLineToBase`: whether an active enemy spawn can shoot the base before leaving spawn. Water, forest, and ice are bullet-passable for this metric; only brick, steel, or another blocking tile may stop the shot.
- `forestSteelAdjacency`: forest and steel should not touch edge-to-edge, because their textures are visually noisy enough to read as overlap.
- `terrainComplexity`: count and distribution of steel, water, forest, and ice.
- `openAreaRatio`: passable map tiles divided by total battlefield tiles.

Suggested thresholds for the first 8 stages:

| Stage | Min spawn-to-base path | Base adjacent open tiles | Base protection | Side-lane directness |
| --- | ---: | ---: | ---: | --- |
| 1 | High | 0-1 | Full brick ring | No direct side lane |
| 2 | High | 1 | Full or nearly full brick ring | No direct side lane |
| 3 | Medium-high | 1-2 | Full ring with one weak side | One delayed side lane |
| 4 | Medium-high | 2 | Partial ring | One delayed side lane |
| 5 | Medium | 2 | Partial ring with steel/terrain pressure | One faster side lane |
| 6 | Medium | 2-3 | Mixed protection | Two side lanes, both interrupted |
| 7 | Medium-low | 3 | Weaker protection | One near-direct side lane |
| 8 | Medium-low | 3-4 | Weak but readable protection | High pressure, still not instant base rush |

The checker now uses calibrated numeric values for this 13x13 board. Path values are coarse-tile route costs to the base perimeter. Brick tiles count as high-cost destructible route tiles, while steel, water, and the base are blocked.

| Stage | Minimum route cost | Max open base-ring tiles | Minimum protected base-ring tiles |
| --- | ---: | ---: | ---: |
| 1 | 14 | 0 | 5 |
| 2 | 13 | 1 | 5 |
| 3 | 13 | 1 | 4 |
| 4 | 13 | 2 | 4 |
| 5 | 13 | 2 | 4 |
| 6 | 13 | 3 | 3 |
| 7 | 13 | 3 | 3 |
| 8 | 13 | 4 | 3 |

The checker also computes a composite difficulty score:

`terrainComplexity + baseAdjacentOpenCount * 4 + max(0, 18 - minSpawnToBasePath)`

The score must not decrease from one stage to the next. This allows Stage 4 to keep stronger base protection while still getting harder through steel placement, and allows later stages to get harder through exposure and terrain rather than only shorter paths.

## Terrain Rules

The stage data uses these terrain symbols:

| Symbol | Terrain | Tank movement | Bullet behavior | Difficulty role |
| --- | --- | --- | --- | --- |
| `B` | Brick | Blocks tanks until destroyed | Destroyed in directional half-brick lines | Main readable, repairable pressure tool |
| `S` | Steel | Blocks tanks | Blocks normal bullets | Permanent route control |
| `W` | Water | Blocks tanks | Bullets pass over it | Movement denial and firing lanes |
| `F` | Forest | Tanks can pass | Bullets pass; forest draws over tanks | Vision and tracking pressure |
| `I` | Ice | Tanks can pass | Bullets pass | Movement-control pressure |
| `E` | Base/eagle | Blocks tanks | Hit causes game over | Defense objective |

Terrain appears in a controlled order:

- Stages 1-3 primarily use brick routes and base exposure changes.
- Stage 1 may use a minimal steel stopper in the center lane to prevent repeated shots from opening a straight base-fire lane.
- Stage 4 introduces steel as permanent route control.
- Stage 5 introduces water as movement denial.
- Stage 6 introduces forest as visibility pressure.
- Stage 7 introduces ice.
- Stage 8 combines steel, water, forest, and ice.

Ice currently affects the player tank speed only. Do not lean on ice as a major difficulty source until enemy ice behavior is explicitly designed and tested.

## Enemy Pressure Rules

For the first 8 stages, keep the enemy mechanics predictable while maps carry most of the difficulty curve:

- Stage 1: two enemy spawn positions, 2.4s initial delay, 3.0s spawn interval, 2 enemies max on field.
- Stage 2: two enemy spawn positions, 1.8s initial delay, 2.6s spawn interval, 3 enemies max on field.
- Stage 3: two enemy spawn positions, 1.5s initial delay, 2.3s spawn interval, 3 enemies max on field.
- Stage 4: two enemy spawn positions, 1.3s initial delay, 2.1s spawn interval, 4 enemies max on field.
- Stage 5: three enemy spawn positions, 1.1s initial delay, 1.9s spawn interval, 4 enemies max on field.
- Stage 6: three enemy spawn positions, 1.0s initial delay, 1.8s spawn interval, 4 enemies max on field.
- Stage 7: three enemy spawn positions, 0.8s initial delay, 1.65s spawn interval, 4 enemies max on field.
- Stage 8: three enemy spawn positions, 0.8s initial delay, 1.55s spawn interval, 4 enemies max on field.

These values control spawn pressure, not enemy movement speed. Do not increase enemy movement speed or fire rate before it is explicitly designed and covered by checks. Without metrics, faster enemies can mask bad map design.

Stages 1-4 do not enable the center enemy spawn. This avoids enemies attacking the base from spawn by firing down the center lane. Stage 5 is the first stage that may enable all three enemy spawn positions.

## Stage Plan

### Stage 1: Training Fortress

Purpose: first playable stage, teaches core controls and base defense.

Map goals:
- Enemies can leave all three spawn points.
- No side lane should connect straight to the base.
- The base has a full brick enclosure.
- The player has enough room near the base to recover from an enemy breach.
- The center lane is the main conflict area, but it must include a forced turn before the base front.

Acceptance:
- `minSpawnToBasePath` is in the highest band for the 8-stage set.
- `baseAdjacentOpenCount` is 0.
- No center spawn route can drive straight to the base front without turning.
- No direct right-side path reaches the base pocket.
- No center spawn route can shoot open a straight breakable lane to the base front.
- Terrain is brick-first, with at most minimal steel used as a permanent center-lane stopper.

### Stage 2: Split Approach

Purpose: introduces choice between defending center and clearing side bricks.

Map goals:
- Two viable enemy routes, neither direct.
- Some brick walls near midfield can be opened by either side.
- Base is still fully protected or almost fully protected.
- No water or ice yet.

Acceptance:
- Base path remains long.
- Side pressure appears after enemies pass a forced turn or destructible delay.
- Active enemy spawns cannot shoot open a straight lane to the base front.
- Terrain is brick only.

### Stage 3: First Side Threat

Purpose: introduces a delayed side lane.

Map goals:
- One side has a longer route that eventually threatens the base.
- The opposite side is safer, giving the player a fallback side.
- Midfield has more open firing lanes.

Acceptance:
- Exactly one side lane is classified as delayed pressure.
- Base has one weak brick side, but no immediate opening.
- Active enemy spawns cannot shoot open a straight lane to the base front.
- Terrain is brick only.

### Stage 4: Steel Anchor

Purpose: introduces stronger fixed obstacles and route commitment.

Map goals:
- Steel blocks prevent easy straight-line cleanup.
- Enemies must route around at least one steel anchor.
- Base protection is still mostly brick, not steel-only.

Acceptance:
- Terrain complexity increases from Stage 3.
- `minSpawnToBasePath` does not drop below medium-high.
- Active enemy spawns cannot shoot open a straight lane to the base front.
- Terrain includes steel and excludes water, forest, and ice.

### Stage 5: Water Gate

Purpose: introduces water as movement restriction and firing-lane pressure.

Map goals:
- Water creates one narrow crossing or fire lane.
- The player can use the water lane defensively.
- One side lane is faster than prior stages but still has an interruption.

Acceptance:
- Terrain includes water.
- At least one alternate enemy route remains available so enemies do not clog.
- Ice is still excluded.

### Stage 6: Forest Ambush

Purpose: introduces obscured tank movement and more ambiguous threats.

Map goals:
- Forest hides parts of one approach.
- Base has partial protection, not a full ring.
- Both side lanes exist but include forced turns or destructible gates.

Acceptance:
- Terrain includes forest.
- Base adjacent exposure increases, but no direct route starts open.
- Ice is still excluded.

### Stage 7: Base Pressure

Purpose: high-pressure defensive stage.

Map goals:
- One route can become a near-direct base route after some brick destruction.
- The player must decide between pushing forward and guarding base.
- Base protection is weaker but still visible and understandable.

Acceptance:
- `baseAdjacentOpenCount` is higher than Stage 6.
- At least one route reaches the base in the medium-low path band.
- Terrain includes ice.

### Stage 8: Final 8-Stage Test

Purpose: capstone for the first stage set.

Map goals:
- Multiple live routes, one fast and one indirect.
- More terrain variety than any earlier stage.
- Base can be pressured from more than one direction, but not instantly from spawn.
- The stage should be hard because the player must prioritize, not because enemies spawn next to the base.

Acceptance:
- Highest terrain complexity in the first 8 stages.
- Base exposure is high but still avoids instant side-lane rush.
- No active spawn has a direct bullet line to the base.
- All spawns remain reachable and do not trap enemies.
- Terrain includes steel, water, forest, and ice.

## Expansion Rules Beyond 8 Stages

When expanding beyond the first 8 stages, add stages in blocks of 4:

- Block A: introduce a new terrain pattern or route pattern.
- Block B: combine that pattern with higher base exposure.
- Block C: add enemy pressure or faster route timing.
- Block D: remix the pattern into a harder but still readable challenge.

Every new stage must pass the same path and base-exposure checker. Difficulty should be monotonic within a block, but occasional easier "breather" stages are acceptable after a difficult capstone.

## Implementation Notes

The stage analysis script is `scripts/check-stage-difficulty.mjs`, exposed through `npm run check:stages`. It parses `LEVELS_13_DRAFT`, validates all 8 maps, computes route metrics, and fails CI-style when a stage traps enemies at spawn, gives an active spawn a direct bullet line to the base, exposes the base too early, introduces terrain too early, or breaks the non-decreasing difficulty score.

General playtest and regression constraints outside stage design are recorded in `docs/regression-contracts.md`.

When changing maps:

1. Run `npm run check:stages`.
2. Inspect the printed per-stage metrics, not just the exit code.
3. Playtest Stage 1, one mid-set stage, and the latest high-pressure stage in the browser.
4. If adding new stages, extend the checker thresholds at the same time as the map data.

## References

- Battle City reference behavior: 13x13 battlefield, protect the base, destroy enemy tanks.
- Original scale target: 35 stages. This project starts with 8 stages to establish quality and validation before expanding.
- Original-style bonus behavior: flashing enemy tanks can drop power-ups such as grenade, helmet, shovel, star, tank, and timer. This project implements those effects in a simplified form and covers them with `scripts/check-powerups-and-stage-select.mjs`.
