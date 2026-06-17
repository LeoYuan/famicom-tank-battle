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
- `Enter`: start / pause / next stage
- `R`: restart
