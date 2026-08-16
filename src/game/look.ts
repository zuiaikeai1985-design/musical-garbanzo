import * as THREE from "three";

function canvas(size: number): { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2d context");
  return { c, ctx };
}

function hash(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function noise(x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash(x0, y0);
  const b = hash(x0 + 1, y0);
  const c = hash(x0, y0 + 1);
  const d = hash(x0 + 1, y0 + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x: number, y: number, oct = 5): number {
  let v = 0;
  let a = 0.5;
  let f = 1;
  for (let i = 0; i < oct; i++) {
    v += noise(x * f, y * f) * a;
    a *= 0.5;
    f *= 2;
  }
  return v;
}

function tex(c: HTMLCanvasElement, repeat = 1): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

function bumpFrom(c: HTMLCanvasElement, repeat = 1): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

export function sandMaps(): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const { c, ctx } = canvas(512);
  const img = ctx.createImageData(512, 512);
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const n = fbm(x / 70, y / 70);
      const peb = noise(x / 6, y / 6);
      const r = 168 + n * 52 + (peb > 0.82 ? 18 : 0);
      const g = 132 + n * 38 + (peb > 0.82 ? 10 : 0);
      const b = 78 + n * 22;
      const i = (y * 512 + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { map: tex(c, 14), bump: bumpFrom(c, 14) };
}

export function sandstoneMaps(): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const { c, ctx } = canvas(512);
  const img = ctx.createImageData(512, 512);
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const band = 0.5 + 0.5 * Math.sin(y / 18 + noise(x / 40, y / 40) * 3);
      const brickX = Math.floor(x / 46 + (Math.floor(y / 22) % 2) * 0.5);
      const brickY = Math.floor(y / 22);
      const mortar = x % 46 < 2 || y % 22 < 2 ? 0.72 : 1;
      const n = fbm(x / 36 + brickX, y / 36 + brickY, 4);
      const r = (150 + band * 40 + n * 28) * mortar;
      const g = (118 + band * 28 + n * 18) * mortar;
      const b = (72 + band * 14 + n * 10) * mortar;
      const i = (y * 512 + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { map: tex(c, 2.2), bump: bumpFrom(c, 2.2) };
}

export function woodMaps(): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const { c, ctx } = canvas(256);
  const img = ctx.createImageData(256, 256);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const plank = Math.floor(x / 42);
      const grain = 0.55 + 0.45 * Math.sin(y / 7 + noise(plank * 3, y / 20) * 6);
      const gap = x % 42 < 2 ? 0.45 : 1;
      const n = noise(x / 8, y / 40);
      const r = (92 + grain * 50 + n * 16) * gap;
      const g = (58 + grain * 28 + n * 10) * gap;
      const b = (32 + grain * 12) * gap;
      const i = (y * 256 + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  ctx.fillStyle = "rgba(30,22,14,0.55)";
  for (let i = 0; i < 18; i++) {
    ctx.fillRect(20 + (i % 6) * 42, 18 + Math.floor(i / 6) * 80, 4, 4);
  }
  return { map: tex(c, 1), bump: bumpFrom(c, 1) };
}

export function metalMaps(): { map: THREE.CanvasTexture; bump: THREE.CanvasTexture } {
  const { c, ctx } = canvas(256);
  const img = ctx.createImageData(256, 256);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const streak = 0.75 + 0.25 * noise(x / 90, y / 3);
      const spec = noise(x / 5, y / 5) > 0.92 ? 40 : 0;
      const v = 70 * streak + spec;
      const i = (y * 256 + x) * 4;
      img.data[i] = v + 8;
      img.data[i + 1] = v + 6;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { map: tex(c, 1), bump: bumpFrom(c, 1) };
}

export function woodGrainGun(): THREE.CanvasTexture {
  const { c, ctx } = canvas(256);
  const img = ctx.createImageData(256, 256);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const g = 0.45 + 0.55 * Math.sin(x / 5 + noise(x / 20, y / 8) * 4);
      const r = 86 + g * 70;
      const gv = 48 + g * 32;
      const b = 24 + g * 12;
      const i = (y * 256 + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = gv;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return tex(c, 1);
}

export function brushedSteel(): THREE.CanvasTexture {
  const { c, ctx } = canvas(256);
  const img = ctx.createImageData(256, 256);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const s = 0.7 + 0.3 * noise(x / 80, y / 2.2);
      const v = 118 * s;
      const i = (y * 256 + x) * 4;
      img.data[i] = v + 10;
      img.data[i + 1] = v + 8;
      img.data[i + 2] = v + 4;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return tex(c, 1);
}

export function polymerTex(hex: string): THREE.CanvasTexture {
  const { c, ctx } = canvas(128);
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.02 + Math.random() * 0.05})`;
    ctx.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  return tex(c, 1);
}

export function muzzleFlashTex(): THREE.CanvasTexture {
  const { c, ctx } = canvas(128);
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, "rgba(255,255,230,1)");
  g.addColorStop(0.2, "rgba(255,200,70,0.95)");
  g.addColorStop(0.55, "rgba(255,110,20,0.45)");
  g.addColorStop(1, "rgba(255,60,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function mat(
  color: number,
  opts: {
    map?: THREE.Texture;
    bump?: THREE.Texture;
    metal?: number;
    rough?: number;
    bumpScale?: number;
    emissive?: number;
  } = {},
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    map: opts.map,
    bumpMap: opts.bump,
    bumpScale: opts.bumpScale ?? 0.12,
    metalness: opts.metal ?? 0.08,
    roughness: opts.rough ?? 0.72,
    emissive: opts.emissive ?? 0x000000,
  });
}

export function createSky(): THREE.Mesh {
  const geo = new THREE.SphereGeometry(110, 48, 24);
  const uniforms = {
    top: { value: new THREE.Color(0x4d8ec4) },
    mid: { value: new THREE.Color(0xb7d0e4) },
    horizon: { value: new THREE.Color(0xecd2a0) },
    sun: { value: new THREE.Vector3(-0.45, 0.62, 0.28).normalize() },
  };
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 top;
      uniform vec3 mid;
      uniform vec3 horizon;
      uniform vec3 sun;
      void main() {
        float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 col = mix(horizon, mid, smoothstep(0.42, 0.58, h));
        col = mix(col, top, smoothstep(0.58, 0.95, h));
        float sunDisk = pow(max(dot(normalize(vDir), sun), 0.0), 220.0);
        float glow = pow(max(dot(normalize(vDir), sun), 0.0), 8.0);
        col += vec3(1.0, 0.92, 0.7) * sunDisk * 2.2;
        col += vec3(1.0, 0.78, 0.4) * glow * 0.28;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -10;
  return mesh;
}
