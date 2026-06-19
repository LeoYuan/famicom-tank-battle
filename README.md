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

- `WASD` or arrow keys: move
- `Space`: fire
- `Enter`: start / pause / next stage / retry
- `R`: restart

## Gameplay

- Protect the base eagle while destroying enemy tanks.
- The title screen supports stage selection for stages 1-8.
- 1 player mode is implemented. The 2 players menu item is displayed for original-style presentation, but cooperative 2P gameplay is not implemented yet.
- Stage difficulty is designed to ramp across the first 8 stages through route pressure, destructible cover, steel, water, forest, ice, spawn timing, and enemy count.

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
