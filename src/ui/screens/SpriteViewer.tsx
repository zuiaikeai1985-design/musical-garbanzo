import { useEffect, useRef } from "react";
import { STRUCTURES, UNITS } from "../../engine/rules";
import type { Side } from "../../engine/types";
import { SpriteAtlas } from "../../render/sprites/atlas";
import { buildTileSet } from "../../render/sprites/terrain";
import { frameForAngle } from "../../render/sprites/canvas";

const SCALE = 3;

const LABEL_H = 16;

/**
 * Developer-only sprite sheet (open the app with `?sprites`).
 *
 * Art iteration is impossible from gameplay screenshots alone — units are 10 pixels across and
 * half-hidden behind terrain. This lays every baked sprite out on a neutral background at 3x so
 * silhouettes, palettes and facings can actually be judged.
 */
export function SpriteViewer() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const atlas = await SpriteAtlas.build();
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;

      ctx.fillStyle = "#2a2a30";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = "11px monospace";
      ctx.textBaseline = "top";

      let x = 12;
      let y = 12;
      let rowHeight = 0;
      /** Flow layout: advance right, wrap on overflow, and track the tallest cell in the row. */
      const nextCell = (width: number, height: number) => {
        rowHeight = Math.max(rowHeight, height);
        x += width + 14;
        if (x > canvas.width - 260) {
          x = 12;
          y += rowHeight + LABEL_H + 16;
          rowHeight = 0;
        }
      };
      const newSection = (title: string) => {
        if (x > 12) {
          y += rowHeight + LABEL_H + 16;
          x = 12;
          rowHeight = 0;
        }
        ctx.fillStyle = "#ffd27f";
        ctx.fillText(title, 12, y);
        y += LABEL_H + 4;
      };

      const sides: Side[] = ["soviet", "allied"];

      // Terrain tiles across the top.
      const tiles = buildTileSet();
      newSection("terrain");
      for (const row of tiles.terrain) {
        if (!row) continue;
        for (const tile of row) {
          ctx.drawImage(tile, x, y, tile.width * SCALE, tile.height * SCALE);
          x += tile.width * SCALE + 4;
        }
      }
      for (const stage of tiles.ore[0]) {
        ctx.drawImage(tiles.terrain[1][0], x, y, 24 * SCALE, 24 * SCALE);
        ctx.drawImage(stage[0], x, y, 24 * SCALE, 24 * SCALE);
        x += 24 * SCALE + 4;
      }
      for (const stage of tiles.ore[1]) {
        ctx.drawImage(tiles.terrain[0][0], x, y, 24 * SCALE, 24 * SCALE);
        ctx.drawImage(stage[0], x, y, 24 * SCALE, 24 * SCALE);
        x += 24 * SCALE + 4;
      }
      x = 12;
      y += 24 * SCALE + 8;
      newSection("units");

      // Units: four facings each, body + turret composited.
      for (const def of Object.values(UNITS)) {
        for (const side of sides) {
          if (def.side !== side && def.side !== "both") continue;
          const sprite = atlas.unit(def.id, side);
          ctx.fillStyle = "#c8c8d0";
          ctx.fillText(`${def.id} ${side}`, x, y);
          const top = y + LABEL_H;
          const angles = [0, Math.PI / 4, Math.PI / 2, Math.PI];
          let ax = x;
          let cellH = 0;
          for (const angle of angles) {
            const body = frameForAngle(sprite.frames[0], angle);
            const bw = body.width * SCALE;
            const bh = body.height * SCALE;
            cellH = Math.max(cellH, bh);
            ctx.fillStyle = "#3a3a44";
            ctx.fillRect(ax, top, bw, bh);
            ctx.drawImage(body, ax, top, bw, bh);
            if (sprite.turret) {
              const turret = frameForAngle(sprite.turret, angle);
              ctx.drawImage(
                turret,
                ax + (bw - turret.width * SCALE) / 2,
                top + (bh - turret.height * SCALE) / 2,
                turret.width * SCALE,
                turret.height * SCALE,
              );
            }
            ax += bw + 4;
          }
          nextCell(ax - x, cellH);
        }
      }

      newSection("structures");

      // Structures: healthy and damaged.
      for (const def of Object.values(STRUCTURES)) {
        for (const side of sides) {
          if (def.side !== side && def.side !== "both") continue;
          const sprite = atlas.structure(def.id, side);
          ctx.fillStyle = "#c8c8d0";
          ctx.fillText(`${def.id} ${side}`, x, y);
          const top = y + LABEL_H;
          const w = sprite.body.width * SCALE;
          const h = sprite.body.height * SCALE;
          ctx.fillStyle = "#3a3a44";
          ctx.fillRect(x, top, w * 2 + 6, h);
          ctx.drawImage(sprite.body, x, top, w, h);
          ctx.drawImage(sprite.damaged, x + w + 6, top, w, h);
          if (sprite.turret) {
            const turret = frameForAngle(sprite.turret, 0);
            ctx.drawImage(
              turret,
              x + (w - turret.width * SCALE) / 2,
              top + (h - turret.height * SCALE) / 2,
              turret.width * SCALE,
              turret.height * SCALE,
            );
          }
          if (sprite.overlay) {
            ctx.drawImage(sprite.overlay[0], x, top, w, h);
          }
          nextCell(w * 2 + 6, h);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "auto", background: "#17171c" }}>
      <canvas
        ref={canvasRef}
        width={1760}
        height={2400}
        data-testid="sprite-sheet"
        style={{ imageRendering: "pixelated", display: "block" }}
      />
    </div>
  );
}
