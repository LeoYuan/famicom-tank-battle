# Regression Contracts

This document records issues and constraints raised during playtesting so future changes do not reintroduce the same problems.

## Startup and Browser Rendering

- The game must not render a blank page at `http://localhost:5173/`.
- The canvas must mount at 256x240 internal resolution and scale responsively in the browser.
- Battlefield drawing must be clipped to the 208x208 playfield so tank shields, bullets, explosions, and effects cannot bleed into the HUD or outside border.
- Tank body drawing must stay aligned with its physical grid position. Spawn-shield outlines must be drawn inside the tank bounds, and the battlefield edge must not be drawn over tracks or shield outlines.
- The canvas content area must use an integer CSS scale. Non-integer scaling makes 1px pixel-art gaps render at uneven visual widths, which can make symmetric tank tracks look off-center.
- The right edge of the battlefield must not draw a black internal separator before the HUD. Right-edge terrain should meet the HUD cleanly without a visible gap.
- Before handing off UI changes, run `npm run build` and perform a browser smoke test: reload the page, press Enter, move, shoot, and check for console errors.
- If dependencies are missing, install project dependencies before debugging rendering code. A blank page caused by missing modules is not a game-logic bug.

## Pause

- `Enter` starts the selected stage from the title screen.
- While playing, `Enter` pauses the game and shows the pause overlay.
- While paused, `Enter` resumes play.
- Pause behavior is covered by `node scripts/check-overlay-and-base.mjs`.

## Enemy Movement and AI

- Enemies must not sit in place turning when a valid route is available.
- Direction choices must be filtered through actual movement feasibility, not only random weighting.
- 1P respawn must stay on the primary left spawn tile. If an active enemy overlaps that spawn tile, clear the overlapping enemy instead of moving 1P to the right-side/2P spawn.
- All three enemy spawn points must have a route into the battlefield on every shipped stage.
- Stage 1 should use reduced spawn pressure for solo play: at most two spawn positions, at most two enemies on field, at least a 2s initial spawn delay, and at least a 2.6s spawn interval.
- Stages 1-4 should not enable enemy spawn positions that can attack the base from spawn, including breakable straight firing lanes.
- No shipped stage may let an active enemy spawn shoot the base before leaving spawn. Water, forest, and ice are bullet-passable and must not be counted as blockers for this check.
- Spawn pressure should increase through per-stage tuning, not a single global spawn interval.
- The enemy movement regression is covered by `node scripts/check-enemy-ai.mjs`, which simulates all 8 stages and all three spawn points.

## Stage Difficulty and Base Pressure

- Stage 1 is an entry stage, not a pressure test.
- Stage 1 must not allow side-lane or center-lane direct approaches to the base front.
- Stage 1 must not allow repeated shots through destructible brick to open a straight center-lane firing path to the base front.
- It is acceptable for Stage 1 to use a minimal steel stopper if that is needed to prevent a breakable direct base lane.
- Stages 1-4 must not allow active enemy spawns to attack the base from spawn through direct or breakable straight lanes.
- Stage 1 must keep a full brick ring around the base and must not require immediate base camping.
- Later stages may increase pressure through shorter routes, more exposed base approaches, mixed terrain, and more tactical choices.
- Difficulty must be checked with `npm run check:stages` after every map change.
- The stage checker must report, at minimum, spawn reachability, route cost to the base perimeter, base-ring exposure, protected base-ring tiles, terrain counts, non-decreasing difficulty score, direct base approach status, and breakable direct base approach status.
- Do not rely only on the checker. Playtest Stage 1 plus at least one middle and one late stage after map edits.

## Terrain Rules

- Brick (`B`) blocks tanks and is destructible.
- Steel (`S`) blocks tanks and blocks normal bullets.
- Water (`W`) blocks tanks but allows bullets to pass.
- Forest (`F`) allows tanks and bullets through, and draws over tanks as visual cover.
- Ice (`I`) allows tanks and bullets through. It currently affects the player tank speed only, so do not use it as a major difficulty source until enemy ice behavior is designed and tested.
- Base/eagle (`E`) blocks tanks and causes game over when hit.
- Forest and steel should not be placed directly adjacent in shipped maps. Their high-contrast textures read as overlapping when they touch edge-to-edge, especially near the battlefield border.

## Brick Damage

- Brick damage should follow the Battle City-style directional half-brick-line behavior:
  - Vertical shots clear the horizontal half-brick line they hit.
  - Horizontal shots clear the vertical half-brick line they hit.
- Bullet collision must be swept in small movement steps so a fast frame cannot tunnel past the near brick row/column and destroy a farther brick first.
- Space keydown should only request shooting. The actual player shot must be emitted during `updatePlayer` after movement input has applied the current direction, so moving shots cannot use a stale direction.
- This behavior is covered by `node scripts/check-brick-damage.mjs`.
- Player shooting input ordering is covered by `node scripts/check-player-shooting.mjs`.
- Do not change brick damage to remove a whole 16x16 brick tile unless the design explicitly changes.
- Brick visuals should align as one 16x16 wall-tile texture even though collision and damage use 8x8 cells. Adjacent 8x8 brick cells must not create an unintended extra seam through the staggered brick course.
- This visual contract is covered by `node scripts/check-brick-visuals.mjs`.

## Base Visual

- The base should read as a gold eagle-like icon, not as a generic block or flag.
- The base should render once per 16x16 base tile area, not repeated four times over the underlying 8x8 map cells.
- When any part of the 16x16 base is hit, the whole base tile must disappear before the Game Over overlay is shown.
- This visual contract is covered by `node scripts/check-overlay-and-base.mjs`.

## Game Over Overlay

- `GAME OVER` and `ENTER RETRY` must be centered inside the overlay independently.
- The overlay width must be large enough for the longer retry text.
- This is covered by `node scripts/check-overlay-and-base.mjs`.

## HUD Alignment

- HUD icon/value pairs should read as aligned rows. The stage number should be vertically centered beside the flag icon, matching the life icon/value row.
- The stage flag icon should stay visually close to the life tank icon size; it should not dominate the HUD row.
- This is covered by `node scripts/check-overlay-and-base.mjs`.

## Title Screen and 2 Players

- Title screen groups should be visually centered by measured content width, not hardcoded by eyeballed x positions.
- The high-score text, logo lines, menu group, copyright line, and all-rights line should stay centered after font or copy changes.
- The title screen supports stage selection. Left/right changes the selected stage, number keys `1` through `8` jump to a stage, and Enter starts the selected stage.
- Stage intro must show the complete selected stage label, for example `STAGE 01`, centered as one text group so the player can tell which stage is loading.
- The title screen currently displays `2 PLAYERS`, but two-player mode is not implemented.
- Future work should either implement a real selectable two-player mode with controls, or remove/disable the option so the title screen does not imply a supported mode.
- Do not treat the visual menu text as proof that 2P gameplay exists.

## Power-Ups

- Bonus enemies must visibly flash and drop one power-up when destroyed by the player.
- Supported power-ups:
  - `grenade`: destroys all visible enemies.
  - `helmet`: grants a temporary player shield.
  - `shovel`: temporarily turns the base wall into steel, then restores it.
  - `star`: upgrades player firing power.
  - `tank`: grants one extra life.
  - `timer`: temporarily freezes enemies.
- The six 16x16 power-up icons should be semantically readable and original-inspired: grenade, helmet, shovel, star, tank, and timer/clock must not collapse into generic boxes or crosses.
- Power-ups should expire if not collected.
- Power-up and stage-select behavior is covered by `node scripts/check-powerups-and-stage-select.mjs`.
- Power-up icon semantics are covered by `node scripts/check-powerup-visuals.mjs`.

## Verification Commands

Run these before claiming a gameplay or map iteration is ready:

```bash
npm run check:regressions
npm run build
```

For browser-facing changes, also perform an in-browser smoke test at `http://localhost:5173/`.
