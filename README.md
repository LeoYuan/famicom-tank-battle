# Famicom Tank Battle

A Famicom-style tank battle game built with Canvas, Vite, and Electron.

## Run in browser

```bash
npm install
npm run dev
```

Open `http://localhost:5173/`.

## Build web assets

```bash
npm run build
npm run preview -- --port 4173
```

## Run as a macOS app

For local development with the Vite dev server:

```bash
npm run dev
npm run app:dev
```

For a directory build:

```bash
npm run app:pack
open "release/mac-arm64/Famicom Tank Battle.app"
```

## Controls

- Title screen: `↑`/`↓` choose 1P/2P, `←`/`→` or `1`-`0` choose stage 1-10, `Shift`+`1`-`0` choose stage 11-20, `Enter` start
- 1P: `WASD` or arrow keys to move, `Space` to fire
- 2P (local co-op): player 1 uses `WASD` + `Space`, player 2 uses arrow keys + right `Shift`
- `Enter`: start / pause / next stage / retry
- `R`: restart

## Gameplay

- Protect the base eagle while destroying enemy tanks.
- The title screen supports stage selection for stages 1-20.
- Local 2-player co-op is supported: each player has independent lives, score, respawn timing, and power-up effects; the game ends when both players are out or the base falls.
- Enemies come in four kinds: basic (100 pts), fast (200 pts), power bullets (300 pts), and 4-HP armor (400 pts). Later stages field tougher mixes.
- Ice tiles make tanks slide: release the keys and the tank keeps gliding briefly.
- Stage difficulty is designed to ramp across 20 stages through route pressure, destructible cover, steel, water, forest, ice, spawn timing, and enemy count.

## Power-ups

Flashing enemy tanks can drop one temporary power-up:

- Grenade: destroys all visible enemies.
- Helmet: gives the player a temporary shield.
- Shovel: temporarily protects the base wall with steel.
- Star: upgrades player firing power.
- Tank: grants one extra life.
- Timer: temporarily freezes enemies.

## Regression checks

```bash
npm run check:regressions
```

The regression suite covers stage difficulty, enemy movement, spawn safety, brick damage, visual alignment, shooting collision, overlays, base behavior, stage select, power-up behavior, power-up icon readability, and integer screen scaling.
