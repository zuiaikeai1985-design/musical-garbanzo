# 红色警报 · RED ALERT

A playable, browser-based real-time-strategy game in the style of **Command & Conquer: Red Alert
(1996)**, played from the Soviet side. Bilingual interface (English / 简体中文), original synthesized
soundtrack, and 100 % procedurally generated pixel art.

> This is a non-commercial fan tribute. **No original game assets are used.** Every sprite is drawn by
> code in `src/render/sprites/`, and every sound is synthesized by `scripts/gen-audio.py`.

## Quick start

```bash
npm install
npm run dev      # http://127.0.0.1:5173
```

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Type-check and produce a static bundle in `dist/` |
| `npm run preview` | Serve the production build |
| `npm run lint` | `tsc -b` + ESLint |
| `npm test` | Vitest unit + headless-simulation tests |
| `npm run test:e2e` | Playwright end-to-end tests |
| `npm run audio` | Regenerate `public/audio/*` from `scripts/gen-audio.py` |

## Architecture

Layers depend strictly one way: `engine → (render, ui, input, audio)`.

| Directory | Responsibility |
| --- | --- |
| `src/engine/` | The simulation. **Pure TypeScript — no DOM, no React, no canvas.** Runs headless in Node, which is what makes whole matches testable in CI. |
| `src/render/` | Reads engine state and draws to a canvas. Never mutates the world. |
| `src/input/` | Translates DOM events into typed engine `Command`s. |
| `src/ui/` | React shell and HUD. Reads a throttled snapshot; dispatches commands. |
| `src/audio/` | Subscribes to the engine event bus and plays cues. |
| `src/i18n/` | `en.ts` is the source of truth; `zh.ts` is typed against it, so a missing translation is a compile error. |
| `src/maps/` | Mission definitions (terrain, starting bases, AI configuration). |

The simulation runs at a fixed **30 ticks/second** with an accumulator, while rendering happens every
animation frame and interpolates positions, so movement stays smooth on high-refresh displays.

## Status

Under active development — see the phase tracker in the project plan.
