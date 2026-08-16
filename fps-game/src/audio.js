import * as THREE from "three";

/**
 * 全部音效用 WebAudio 实时合成，无需任何外部资源。
 */
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuf = null;
    this.camera = null;
    this._v = new THREE.Vector3();
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  resume() {
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
  }

  setCamera(camera) {
    this.camera = camera;
  }

  /** 根据世界坐标计算音量衰减和左右声道 */
  _spatial(worldPos, baseVol, maxDist = 80) {
    if (!worldPos || !this.camera) return { vol: baseVol, pan: 0 };
    const camPos = this.camera.getWorldPosition(this._v.clone());
    const dist = camPos.distanceTo(worldPos);
    const vol = baseVol * Math.max(0.04, 1 - dist / maxDist);
    const dir = worldPos.clone().sub(camPos);
    dir.y = 0;
    if (dir.lengthSq() < 0.001) return { vol, pan: 0 };
    dir.normalize();
    const right = new THREE.Vector3();
    this.camera.getWorldDirection(right);
    right.y = 0;
    right.normalize();
    right.set(-right.z, 0, right.x); // 相机右方向
    const pan = Math.max(-0.8, Math.min(0.8, dir.dot(right)));
    return { vol, pan };
  }

  _out(vol, pan) {
    const g = this.ctx.createGain();
    g.gain.value = vol;
    if (Math.abs(pan) > 0.01 && this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = pan;
      g.connect(p);
      p.connect(this.master);
    } else {
      g.connect(this.master);
    }
    return g;
  }

  _noise(out, { dur = 0.1, filterType = "lowpass", freq = 1000, q = 1, attack = 0.001, decay = 0.08, peak = 1 }) {
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = this.ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    f.Q.value = q;
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(peak, t + attack);
    env.gain.exponentialRampToValueAtTime(0.001, t + attack + decay);
    src.connect(f);
    f.connect(env);
    env.connect(out);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  _tone(out, { type = "sine", from = 440, to = 440, dur = 0.1, attack = 0.002, peak = 0.5, delay = 0 }) {
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(peak, t + attack);
    env.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(env);
    env.connect(out);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  /** 开枪声。worldPos 为空表示玩家自己开枪 */
  shot(weaponId, worldPos = null) {
    if (!this.ctx) return;
    this.resume();
    const params = {
      usp: { vol: 0.5, crack: 2400, body: 700, decay: 0.07, thump: 0.25 },
      mp5: { vol: 0.5, crack: 2000, body: 800, decay: 0.06, thump: 0.28 },
      ak47: { vol: 0.72, crack: 1500, body: 500, decay: 0.11, thump: 0.5 },
      m4: { vol: 0.62, crack: 1800, body: 600, decay: 0.09, thump: 0.4 },
      awp: { vol: 0.95, crack: 900, body: 260, decay: 0.28, thump: 0.9 },
      shotgun: { vol: 0.85, crack: 1100, body: 320, decay: 0.2, thump: 0.8 },
    }[weaponId] || { vol: 0.5, crack: 1800, body: 600, decay: 0.08, thump: 0.3 };

    const { vol, pan } = this._spatial(worldPos, params.vol);
    const out = this._out(vol, pan);
    this._noise(out, { filterType: "bandpass", freq: params.crack, q: 0.7, decay: params.decay, peak: 1 });
    this._noise(out, { filterType: "lowpass", freq: params.body, decay: params.decay * 1.6, peak: 0.9 });
    this._tone(out, { type: "triangle", from: 160, to: 40, dur: 0.1, peak: params.thump });
  }

  knifeSwing() {
    if (!this.ctx) return;
    const out = this._out(0.3, 0);
    this._noise(out, { filterType: "bandpass", freq: 900, q: 2, attack: 0.02, decay: 0.12, peak: 0.7 });
  }

  knifeHit() {
    if (!this.ctx) return;
    const out = this._out(0.5, 0);
    this._noise(out, { filterType: "lowpass", freq: 500, decay: 0.08, peak: 1 });
    this._tone(out, { type: "square", from: 220, to: 90, dur: 0.08, peak: 0.4 });
  }

  dryFire() {
    if (!this.ctx) return;
    const out = this._out(0.35, 0);
    this._tone(out, { type: "square", from: 2200, to: 1600, dur: 0.03, peak: 0.4 });
  }

  reload(stage) {
    if (!this.ctx) return;
    const out = this._out(0.4, 0);
    if (stage === 0) {
      this._noise(out, { filterType: "highpass", freq: 1200, decay: 0.05, peak: 0.7 });
      this._tone(out, { type: "square", from: 500, to: 300, dur: 0.05, peak: 0.25 });
    } else if (stage === 1) {
      this._noise(out, { filterType: "highpass", freq: 900, decay: 0.06, peak: 0.8 });
      this._tone(out, { type: "square", from: 700, to: 420, dur: 0.06, peak: 0.3 });
    } else {
      this._tone(out, { type: "square", from: 1400, to: 900, dur: 0.05, peak: 0.4 });
      this._noise(out, { filterType: "highpass", freq: 2000, decay: 0.04, peak: 0.5 });
    }
  }

  hitmarker(isHead) {
    if (!this.ctx) return;
    const out = this._out(0.4, 0);
    if (isHead) {
      this._tone(out, { type: "sine", from: 1300, to: 1750, dur: 0.1, peak: 0.6 });
      this._tone(out, { type: "sine", from: 2600, to: 3500, dur: 0.08, peak: 0.25 });
    } else {
      this._tone(out, { type: "sine", from: 2100, to: 1900, dur: 0.045, peak: 0.5 });
    }
  }

  kill() {
    if (!this.ctx) return;
    const out = this._out(0.4, 0);
    this._tone(out, { type: "sine", from: 880, to: 880, dur: 0.07, peak: 0.4 });
    this._tone(out, { type: "sine", from: 1320, to: 1320, dur: 0.1, peak: 0.4, delay: 0.06 });
  }

  hurt() {
    if (!this.ctx) return;
    const out = this._out(0.55, 0);
    this._noise(out, { filterType: "lowpass", freq: 350, decay: 0.12, peak: 1 });
    this._tone(out, { type: "sawtooth", from: 180, to: 70, dur: 0.14, peak: 0.4 });
  }

  footstep(vol = 0.12) {
    if (!this.ctx) return;
    const out = this._out(vol, 0);
    this._noise(out, {
      filterType: "lowpass",
      freq: 280 + Math.random() * 120,
      decay: 0.05,
      peak: 1,
    });
  }

  buy() {
    if (!this.ctx) return;
    const out = this._out(0.4, 0);
    this._tone(out, { type: "sine", from: 1050, to: 1050, dur: 0.06, peak: 0.5 });
    this._tone(out, { type: "sine", from: 1580, to: 1580, dur: 0.09, peak: 0.5, delay: 0.07 });
  }

  denied() {
    if (!this.ctx) return;
    const out = this._out(0.35, 0);
    this._tone(out, { type: "square", from: 220, to: 180, dur: 0.12, peak: 0.4 });
  }

  roundStart() {
    if (!this.ctx) return;
    const out = this._out(0.45, 0);
    this._tone(out, { type: "sine", from: 523, to: 523, dur: 0.12, peak: 0.5 });
    this._tone(out, { type: "sine", from: 784, to: 784, dur: 0.2, peak: 0.5, delay: 0.13 });
  }

  win() {
    if (!this.ctx) return;
    const out = this._out(0.5, 0);
    this._tone(out, { type: "sine", from: 523, to: 523, dur: 0.14, peak: 0.5 });
    this._tone(out, { type: "sine", from: 659, to: 659, dur: 0.14, peak: 0.5, delay: 0.13 });
    this._tone(out, { type: "sine", from: 784, to: 784, dur: 0.16, peak: 0.5, delay: 0.26 });
    this._tone(out, { type: "sine", from: 1046, to: 1046, dur: 0.3, peak: 0.55, delay: 0.4 });
  }

  lose() {
    if (!this.ctx) return;
    const out = this._out(0.5, 0);
    this._tone(out, { type: "sawtooth", from: 392, to: 392, dur: 0.2, peak: 0.35 });
    this._tone(out, { type: "sawtooth", from: 330, to: 330, dur: 0.2, peak: 0.35, delay: 0.2 });
    this._tone(out, { type: "sawtooth", from: 262, to: 250, dur: 0.5, peak: 0.4, delay: 0.4 });
  }
}
