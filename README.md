# 红色警报 · RED ALERT

A playable, browser-based real-time-strategy game in the style of **Command & Conquer: Red
Alert (1996)**, played from the Soviet side. Bilingual interface (English / 简体中文), an original
synthesized soundtrack, and 100 % procedurally generated pixel art.

一款在浏览器里运行、以**《命令与征服：红色警戒》(1996)** 为蓝本的即时战略游戏，玩家扮演苏联一方。
中英双语界面，全部音乐音效由代码合成，全部像素美术由代码绘制。

> **Fan tribute — no original assets are used.** Every sprite is drawn by code in
> `src/render/sprites/`, and every sound is synthesized by `scripts/gen-audio.py`.
>
> **这是一个非商业同人作品，未使用任何原版素材。** 所有贴图由 `src/render/sprites/` 中的代码绘制，
> 所有声音由 `scripts/gen-audio.py` 合成。

---

## Quick start · 快速开始

```bash
npm install
npm run dev      # http://127.0.0.1:5173
```

Press `L` in game (or the button on the menu) to switch between English and 中文.
游戏中按 `L` 键，或在主菜单点击按钮，即可切换中英文。

## Commands · 命令

| Command | What it does · 说明 |
| --- | --- |
| `npm run dev` | Vite dev server with HMR · 开发服务器 |
| `npm run build` | Type-check and produce a static bundle in `dist/` · 类型检查并打包 |
| `npm run preview` | Serve the production build · 预览生产构建 |
| `npm run lint` | `tsc -b` + ESLint |
| `npm test` | Vitest unit + headless-simulation tests · 单元与无头模拟测试 |
| `npm run test:e2e` | Playwright end-to-end tests · 端到端测试 |
| `npm run audio` | Regenerate `public/audio/*` from the synthesis script · 重新生成音频 |

Open `http://127.0.0.1:5173/?sprites` for the developer sprite sheet — every unit and structure
rendered at 3x, which is the only practical way to review 16-pixel artwork.

---

## How to play · 玩法

You start with a Construction Yard, two Power Plants, an Ore Refinery and one Ore Truck.
Destroy every Allied structure to win; lose everything of your own and the mission is over.

开局拥有建造场、两座发电厂、矿石精炼厂和一辆矿车。摧毁盟军全部建筑即可获胜；己方被全歼则任务失败。

**The loop · 核心循环**

1. **Ore · 矿石** — Ore Trucks mine the gold and gem fields and haul it to a Refinery. Ore regrows
   and spreads over time, so a field is depleted, not destroyed. Gems are worth double.
2. **Power · 电力** — every building draws power. In a brownout, defences and radar shut down first
   and production slows to a crawl. Bombing an enemy's generators is always worthwhile.
3. **Tech · 科技树** — Power Plant → Refinery → Barracks / War Factory → Radar Dome → Tesla Coil →
   Missile Silo. Locked items stay visible in the sidebar, greyed out, so the tree is discoverable.
4. **War · 战争** — the Allied AI runs its own economy, rebuilds what it loses, and sends attack
   waves that grow with the match clock. It pulls defenders back when you raid its base.

### Controls · 操作

| Input | Action · 动作 |
| --- | --- |
| Left click / drag | Select · 选择、框选 |
| Double click | Select all of that type on screen · 选择屏幕内同类单位 |
| Shift + click | Add to / remove from selection · 追加或取消选择 |
| Right click | Contextual order: move / attack / harvest / deliver · 移动、攻击、采矿、卸载 |
| Right click (building selected) | Set rally point · 设置集结点 |
| Ctrl + 1–9 / 1–9 | Assign / recall control group · 设定与呼叫编队 |
| `S` / `G` / `X` | Stop / guard / scatter · 停止、警戒、散开 |
| `H` | Jump to base · 回到基地 |
| `Tab` | Cycle sidebar tab · 切换侧栏页签 |
| `L` | Toggle language · 切换语言 |
| `+` / `−`, wheel | Zoom · 缩放 |
| `P` / `Esc` | Pause menu · 暂停菜单 |
| `F1` | Field manual · 作战手册 |
| WASD / arrows / screen edge / middle-drag | Scroll the map · 滚动地图 |

### Soviet arsenal · 苏军装备

**Structures · 建筑** — Construction Yard 建造场, Power Plant 发电厂, Ore Refinery 矿石精炼厂,
Ore Silo 矿石仓库, Soviet Barracks 兵营, Kennel 军犬训练所, War Factory 战车工厂, Radar Dome 雷达站,
Service Depot 维修厂, Flame Tower 火焰塔, Tesla Coil 磁暴线圈, Concrete Wall 混凝土墙,
Missile Silo 核弹发射井.

**Units · 单位** — Rifle Infantry 步兵, Grenadier 掷弹兵, Rocket Soldier 火箭兵, Engineer 工程师,
Attack Dog 军犬, Ore Truck 矿车, Heavy Tank 重型坦克, Mammoth Tank 猛犸坦克,
V2 Rocket Launcher V2火箭发射车, Mobile Construction Vehicle 移动建造车.

Rifles shred infantry and bounce off armour; attack dogs literally cannot hurt a vehicle; V2s
out-range every direct-fire weapon in the game but die to a stiff breeze. The full damage matrix
lives in `WEAPONS` in `src/engine/rules.ts`.

### The nuclear option · 核打击

A Missile Silo charges over five minutes **while powered**, then arms a targeting cursor. Launch
starts a ten-second countdown with a full-screen alert; the warhead flattens a six-tile radius,
leaves a crater ringed with fires, and the flash permanently burns away the fog of war around the
impact. The AI builds one too, and fires it at the densest cluster of your buildings.

---

## Architecture · 架构

Layers depend strictly one way: `engine → (render, ui, input, audio)`.

| Directory | Responsibility |
| --- | --- |
| `src/engine/` | The simulation. **Pure TypeScript — no DOM, no React, no canvas.** ESLint enforces this. |
| `src/render/` | Reads engine state and draws to a canvas. Never mutates the world. |
| `src/input/` | Translates DOM events into typed engine `Command`s. |
| `src/ui/` | React shell and HUD. Reads a throttled snapshot; dispatches commands. |
| `src/audio/` | Subscribes to the engine event queue and plays cues. |
| `src/i18n/` | `en.ts` is the source of truth; `zh.ts` is typed against it, so a missing translation is a compile error. |
| `src/maps/` | Mission definitions (terrain, starting bases, AI configuration). |
| `scripts/` | The audio synthesis script. |

### Design decisions worth knowing

**The engine is DOM-free on purpose.** That is what allows `tests/sim/` to run entire 30-minute
matches headless in Node in a couple of seconds. Three of the nastiest bugs in this project —
an AI whose first attack wave silently dropped its orders, a wave that froze escalation forever,
and tank shells that missed almost every shot — were found by instrumenting a headless match, not
by reading code or staring at screenshots.

**Fixed 30 Hz simulation, interpolated rendering.** `Game.tick()` advances the world at a fixed
rate from an accumulator; the renderer runs every animation frame and interpolates unit positions
with the leftover alpha, so movement is smooth at any refresh rate while the simulation stays
deterministic. All world mutation happens inside `tick()`; the UI and input layers only push typed
commands onto a queue.

**No `Math.random()` in the engine.** A seeded `mulberry32` generator lives in the world (ESLint
blocks the global), so a seed plus a command stream reproduces a match exactly. Visual jitter that
must be stable across frames uses a stateless hash instead.

**Top-down, not isometric.** *Red Alert 1* is a top-down game, and it buys a lot: a unit needs one
sprite that `ctx.rotate()` spins to any facing, where isometric would need eight hand-drawn facings
per unit *per turret*.

**Everything is baked once.** Sprites are drawn into offscreen canvases during the loading screen
and terrain into 16×16-tile chunk canvases; the frame loop only ever calls `drawImage`. A 200-unit
battle holds 60 fps under software rasterisation.

**Fog of war is one 72×72 mask.** It is painted at one pixel per tile and upscaled with smoothing
*on* — the one place in the renderer where bilinear filtering is wanted, because it turns the tile
grid into soft darkness instead of a checkerboard of black squares.

### Art & audio

All artwork is generated by code with a locked VGA-ish palette, light from the north-west and a
one-pixel outline on every silhouette. Team colour carries the hull and roof, so faction is legible
on a 24-pixel unit.

All audio is synthesized with numpy in `scripts/gen-audio.py` and encoded to Ogg Vorbis: 32 effects
built from oscillators and filtered noise, plus four original music tracks — a 16-bar industrial
march in E minor at 138 bpm arranged to loop seamlessly, an ambient menu drone, and victory/defeat
stingers. The whole soundtrack is about 1 MB. Regenerate with `npm run audio` (requires `ffmpeg`).

---

## Testing · 测试

```bash
npm run lint       # tsc -b + eslint
npm test           # 107 unit + headless simulation tests
npm run test:e2e   # 26 Playwright tests against a real browser
```

- **Unit tests** cover pathfinding (optimality, corner-cutting, partial paths, node budget), the
  damage matrix, build-queue economics, power and brownout behaviour, harvesting, fog of war and
  the superweapon.
- **Simulation tests** run whole matches headless: a 30-minute stability soak with NaN and
  entity-count guards, AI base expansion and attack waves, difficulty separation, and a tick-budget
  check with 120 units in a battle.
- **End-to-end tests** drive a real browser: building a base through the sidebar, a live firefight,
  the harvester economy, fog of war, the nuclear strike, pause/resume, both languages, and a
  frame-rate regression guard.

## Status

Mission 01 *Operation Iron Curtain* is complete and playable start to finish on three difficulties.
