# CLAUDE.md

## Project Overview

This is a **Remotion + Code Hike** template (`template-code-hike`) for generating animated code transition videos. It renders syntax-highlighted code snippets as sequential video frames with smooth token-level transitions, annotations, and a progress bar. The output is a rendered video file (e.g., MP4).

## Tech Stack

- **Remotion** v4 — programmatic video rendering in React
- **Code Hike** v1 + `@code-hike/lighter` — syntax highlighting and code annotations
- **React** 19 / **TypeScript** 5.9 — component-based composition
- **Zod** — runtime schema validation for composition inputs
- **twoslash-cdn** — TypeScript-aware code hover info
- **polished** — CSS-in-JS color utilities
- ES Modules (`"type": "module"` in package.json)

## Commands

```bash
npm run dev          # Start Remotion Studio (interactive preview)
npm run build        # Bundle the video composition
npm run lint         # Type-check (tsc) then lint (eslint src)
npx remotion render  # Render the video to a file
```

There is no test suite configured. Validation relies on `tsc` type-checking and ESLint.

## Project Structure

```
src/
├── index.ts                    # Remotion entry point (registers Root)
├── Root.tsx                    # Composition definition (fps, dimensions, schema)
├── Main.tsx                    # Main video component (Series of code steps)
├── CodeTransition.tsx          # Animates transitions between code steps
├── ProgressBar.tsx             # Visual progress indicator
├── ReloadOnCodeChange.tsx      # HMR: watches public/ for changes in studio
├── utils.ts                    # Animation utility (applyStyle)
├── font.ts                     # Font config (Roboto Mono, 40px, padding)
├── annotations/                # Code Hike annotation handlers
│   ├── Callout.tsx             # Callout annotation (block-level)
│   ├── Error.tsx               # Error annotation (red underline + message)
│   └── InlineToken.tsx         # Token-level transition animation
└── calculate-metadata/         # Pre-render metadata computation
    ├── calculate-metadata.tsx  # Computes duration, width, highlighted steps
    ├── schema.ts               # Zod schema (theme + width config)
    ├── get-files.ts            # Fetches code files from public/
    ├── process-snippet.ts      # Highlights code via Code Hike + twoslash
    └── theme.tsx               # Theme enum, context, and provider

public/                         # Code sample files rendered in the video
├── code1.tsx                   # Step 1
├── code2.tsx                   # Step 2
├── code3.tsx                   # Step 3
└── code4.swift                 # Step 4
```

## Architecture & Key Patterns

### Composition Flow

1. `Root.tsx` defines a single Remotion `<Composition>` named `"Main"` with `calculateMetadata` for dynamic props.
2. `calculateMetadata` reads code files from `public/`, highlights them via Code Hike, and computes video duration (90 frames per step at 30fps).
3. `Main.tsx` renders steps as a `<Series>` of `<CodeTransition>` components with 30-frame transitions.

### Theme System

- Themes are defined as a Zod enum in `src/calculate-metadata/theme.tsx` (22 built-in themes from `@code-hike/lighter`).
- Theme colors are passed via React Context (`ThemeColorsContext` / `useThemeColors` hook).
- Default theme: `"github-dark"`.

### Annotations

Code Hike annotations are handled by custom components in `src/annotations/`:
- `callout` — block-level callout boxes
- `error` — red wavy underline with error message
- `tokenTransitions` — per-token enter/exit animations

### Width Modes

Configured via the `width` Zod schema (discriminated union):
- `"auto"` — width is calculated from the longest code line
- `"fixed"` — explicit pixel width

### Font Configuration (`src/font.ts`)

- Font: Roboto Mono (Google Fonts, weights 400 + 700)
- Font size: 40px
- Tab size: 3 spaces
- Horizontal padding: 60px, vertical padding: 84px

## Code Conventions

- **Strict TypeScript**: `strict: true`, `noUnusedLocals: true` in tsconfig
- **ESM only**: all source uses ES module imports
- **Formatting**: Prettier with 2-space indentation, no tabs, bracket spacing enabled
- **Linting**: Remotion's flat ESLint config (`@remotion/eslint-config-flat`)
- **React patterns**: functional components only, `useMemo` for style objects, React Context for cross-cutting concerns
- **Readonly props**: component prop types use `readonly` modifier (e.g., `readonly children: React.ReactNode`)

## Adding New Code Steps

1. Add a new code file to `public/` (e.g., `code5.tsx`). Files are sorted alphabetically to determine step order.
2. The `getFiles()` function in `src/calculate-metadata/get-files.ts` auto-discovers files from `public/`.
3. Restart Remotion Studio or save to trigger `RefreshOnCodeChange`.

## Adding New Annotations

1. Create a new annotation handler component in `src/annotations/`.
2. Register it in the `handlers` array passed to `<Pre>` in `CodeTransition.tsx`.
3. Use Code Hike annotation syntax in code files (e.g., `// !annotationName` comments).

## Configuration

- **Remotion config** (`remotion.config.ts`): output format is JPEG frames, overwrite enabled.
- **Video defaults**: 30 fps, 1920x1080 resolution, 90 frames per code step.
- **Theme**: change `defaultProps.theme` in `Root.tsx` or pass via Remotion Studio input props.
