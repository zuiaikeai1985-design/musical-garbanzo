/**
 * The animated Soviet emblem banner on the main menu.
 *
 * Drawn at a low logical resolution (320x96) and upscaled by CSS with `image-rendering: pixelated`
 * so it reads as chunky VGA-era pixel art rather than smooth vector graphics.
 */

const W = 320;
const H = 96;

export function drawTitleBanner(canvas: HTMLCanvasElement, time: number): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, W, H);

  drawBackdrop(ctx, time);
  drawSweep(ctx, time);
  drawStar(ctx, W / 2, H / 2 + 2, 34, time);
  drawFrame(ctx);
}

function drawBackdrop(ctx: CanvasRenderingContext2D, time: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#160c0a");
  g.addColorStop(0.55, "#0b0605");
  g.addColorStop(1, "#050303");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Pulsing red bloom behind the emblem.
  const pulse = 0.5 + 0.5 * Math.sin(time * 2.1);
  const r = ctx.createRadialGradient(W / 2, H / 2, 4, W / 2, H / 2, 66 + pulse * 10);
  r.addColorStop(0, `rgba(255,60,40,${0.34 + pulse * 0.2})`);
  r.addColorStop(1, "rgba(255,60,40,0)");
  ctx.fillStyle = r;
  ctx.fillRect(0, 0, W, H);
}

/** A rotating searchlight wedge, like a radar sweep behind the emblem. */
function drawSweep(ctx: CanvasRenderingContext2D, time: number): void {
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(time * 0.6);
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2);
    const grad = ctx.createLinearGradient(0, 0, 150, 0);
    grad.addColorStop(0, "rgba(255,120,60,0.16)");
    grad.addColorStop(1, "rgba(255,120,60,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 150, -0.18, 0.18);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  time: number,
): void {
  const pulse = 0.5 + 0.5 * Math.sin(time * 2.1);

  // Outer glow ring.
  ctx.strokeStyle = `rgba(255,90,60,${0.25 + pulse * 0.35})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 6 + pulse * 2, 0, Math.PI * 2);
  ctx.stroke();

  // Five-pointed star: dark outline, then the red body, then a highlight facet.
  starPath(ctx, cx, cy, radius + 2, -Math.PI / 2);
  ctx.fillStyle = "#3d0a0c";
  ctx.fill();

  starPath(ctx, cx, cy, radius, -Math.PI / 2);
  const body = ctx.createLinearGradient(cx, cy - radius, cx, cy + radius);
  body.addColorStop(0, "#ff5142");
  body.addColorStop(0.5, "#c0242a");
  body.addColorStop(1, "#7d1418");
  ctx.fillStyle = body;
  ctx.fill();

  // Facet highlight on the upper-left of every point (fake bevel).
  ctx.save();
  ctx.clip();
  ctx.fillStyle = "rgba(255,160,120,0.22)";
  ctx.beginPath();
  ctx.moveTo(cx - radius, cy - radius);
  ctx.lineTo(cx + radius, cy - radius);
  ctx.lineTo(cx - radius, cy + radius);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  drawHammerSickle(ctx, cx, cy + 1, 0.82);
}

function starPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  rot: number,
): void {
  const inner = r * 0.382;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : inner;
    const a = rot + (i * Math.PI) / 5;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** Simplified gold hammer-and-sickle, sized to sit inside the star. */
function drawHammerSickle(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);

  const gold = "#f2c14a";
  const goldDark = "#a87c1c";

  // Sickle: a crescent arc with a handle.
  ctx.strokeStyle = goldDark;
  ctx.lineWidth = 5;
  ctx.lineCap = "butt";
  ctx.beginPath();
  ctx.arc(1, 1, 9, Math.PI * 0.85, Math.PI * 1.95);
  ctx.stroke();
  ctx.strokeStyle = gold;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(1, 1, 9, Math.PI * 0.85, Math.PI * 1.95);
  ctx.stroke();

  // Sickle handle.
  ctx.fillStyle = goldDark;
  ctx.fillRect(-11, -1, 5, 10);
  ctx.fillStyle = gold;
  ctx.fillRect(-10, 0, 3, 8);

  // Hammer: head + shaft, rotated.
  ctx.save();
  ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = goldDark;
  ctx.fillRect(-2, -11, 4, 20);
  ctx.fillRect(-8, -13, 16, 6);
  ctx.fillStyle = gold;
  ctx.fillRect(-1, -10, 2, 18);
  ctx.fillRect(-7, -12, 14, 4);
  ctx.restore();

  ctx.restore();
}

/** Riveted steel frame around the banner. */
function drawFrame(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#0c0806";
  ctx.fillRect(0, 0, W, 2);
  ctx.fillRect(0, H - 2, W, 2);
  ctx.fillStyle = "#6b5744";
  ctx.fillRect(0, 2, W, 1);
  ctx.fillRect(0, H - 3, W, 1);

  ctx.fillStyle = "#8d7c68";
  for (let x = 6; x < W; x += 16) {
    ctx.fillRect(x, 5, 2, 2);
    ctx.fillRect(x, H - 7, 2, 2);
  }
}
