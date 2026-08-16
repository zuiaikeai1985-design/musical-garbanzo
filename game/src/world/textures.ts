import * as THREE from "three";

type Painter = (ctx: CanvasRenderingContext2D, size: number) => void;

const cache = new Map<string, THREE.Texture>();

function makeTexture(
  key: string,
  size: number,
  paint: Painter,
  repeat: THREE.Vector2,
): THREE.Texture {
  const cached = cache.get(key);
  if (cached) {
    const clone = cached.clone();
    clone.needsUpdate = true;
    clone.repeat.copy(repeat);
    return clone;
  }
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d canvas context unavailable");
  paint(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  texture.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, texture);
  const clone = texture.clone();
  clone.needsUpdate = true;
  clone.repeat.copy(repeat);
  return clone;
}

function noise(
  ctx: CanvasRenderingContext2D,
  size: number,
  amount: number,
  alpha: number,
): void {
  for (let i = 0; i < amount; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.random() * 2.5 + 0.4;
    const shade = Math.random() * 255;
    ctx.fillStyle = `rgba(${shade},${shade},${shade},${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function sandTexture(repeat = 32): THREE.Texture {
  return makeTexture(
    "sand",
    256,
    (ctx, size) => {
      ctx.fillStyle = "#c2a878";
      ctx.fillRect(0, 0, size, size);
      noise(ctx, size, 2400, 0.06);
      ctx.strokeStyle = "rgba(120,100,70,0.16)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 26; i++) {
        ctx.beginPath();
        const y = Math.random() * size;
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(size * 0.3, y + 12, size * 0.6, y - 12, size, y);
        ctx.stroke();
      }
    },
    new THREE.Vector2(repeat, repeat),
  );
}

export function concreteTexture(rx = 4, ry = 2): THREE.Texture {
  return makeTexture(
    "concrete",
    256,
    (ctx, size) => {
      ctx.fillStyle = "#b9ae99";
      ctx.fillRect(0, 0, size, size);
      noise(ctx, size, 1800, 0.07);
      ctx.strokeStyle = "rgba(90,84,72,0.35)";
      ctx.lineWidth = 2;
      const brick = size / 4;
      for (let row = 0; row <= 4; row++) {
        const y = row * brick;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(size, y);
        ctx.stroke();
        const offset = row % 2 === 0 ? 0 : brick / 2;
        for (let col = 0; col <= 4; col++) {
          const x = col * brick + offset;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + brick);
          ctx.stroke();
        }
      }
    },
    new THREE.Vector2(rx, ry),
  );
}

export function plasterTexture(rx = 2, ry = 2): THREE.Texture {
  return makeTexture(
    "plaster",
    256,
    (ctx, size) => {
      ctx.fillStyle = "#d8cdb4";
      ctx.fillRect(0, 0, size, size);
      noise(ctx, size, 2600, 0.05);
      ctx.fillStyle = "rgba(150,135,110,0.16)";
      for (let i = 0; i < 20; i++) {
        ctx.fillRect(
          Math.random() * size,
          Math.random() * size,
          Math.random() * 40 + 8,
          Math.random() * 18 + 4,
        );
      }
    },
    new THREE.Vector2(rx, ry),
  );
}

export function crateTexture(): THREE.Texture {
  return makeTexture(
    "crate",
    256,
    (ctx, size) => {
      ctx.fillStyle = "#a8763f";
      ctx.fillRect(0, 0, size, size);
      noise(ctx, size, 1200, 0.06);
      ctx.strokeStyle = "rgba(70,45,20,0.8)";
      ctx.lineWidth = 10;
      ctx.strokeRect(6, 6, size - 12, size - 12);
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(10, 10);
      ctx.lineTo(size - 10, size - 10);
      ctx.moveTo(size - 10, 10);
      ctx.lineTo(10, size - 10);
      ctx.stroke();
      ctx.fillStyle = "rgba(40,30,15,0.65)";
      ctx.font = "bold 34px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("AMMO", size / 2, size / 2 - 44);
    },
    new THREE.Vector2(1, 1),
  );
}

export function metalTexture(rx = 2, ry = 1): THREE.Texture {
  return makeTexture(
    "metal",
    256,
    (ctx, size) => {
      ctx.fillStyle = "#6d7378";
      ctx.fillRect(0, 0, size, size);
      noise(ctx, size, 1600, 0.05);
      ctx.strokeStyle = "rgba(35,40,45,0.5)";
      ctx.lineWidth = 3;
      for (let x = 0; x <= size; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, size);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(20,24,28,0.55)";
      for (let x = 16; x < size; x += 32) {
        for (let y = 16; y < size; y += 64) {
          ctx.beginPath();
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
    new THREE.Vector2(rx, ry),
  );
}

export function decalTexture(): THREE.Texture {
  return makeTexture(
    "decal",
    64,
    (ctx, size) => {
      const c = size / 2;
      const gradient = ctx.createRadialGradient(c, c, 1, c, c, c);
      gradient.addColorStop(0, "rgba(20,18,16,0.95)");
      gradient.addColorStop(0.45, "rgba(30,26,22,0.55)");
      gradient.addColorStop(1, "rgba(30,26,22,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "rgba(10,9,8,0.95)";
      ctx.beginPath();
      ctx.arc(c, c, size * 0.12, 0, Math.PI * 2);
      ctx.fill();
    },
    new THREE.Vector2(1, 1),
  );
}

export function sparkTexture(): THREE.Texture {
  return makeTexture(
    "spark",
    64,
    (ctx, size) => {
      const c = size / 2;
      const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
      gradient.addColorStop(0, "rgba(255,255,255,1)");
      gradient.addColorStop(0.3, "rgba(255,220,140,0.85)");
      gradient.addColorStop(1, "rgba(255,160,40,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
    },
    new THREE.Vector2(1, 1),
  );
}

export function skyTexture(): THREE.Texture {
  return makeTexture(
    "sky",
    256,
    (ctx, size) => {
      const gradient = ctx.createLinearGradient(0, 0, 0, size);
      gradient.addColorStop(0, "#2a4a7a");
      gradient.addColorStop(0.45, "#7fa6cc");
      gradient.addColorStop(0.72, "#d9c9a5");
      gradient.addColorStop(1, "#e8d6ad");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = "rgba(255,255,255,0.14)";
      for (let i = 0; i < 40; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size * 0.5;
        ctx.beginPath();
        ctx.ellipse(x, y, Math.random() * 30 + 10, Math.random() * 6 + 3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    new THREE.Vector2(1, 1),
  );
}
