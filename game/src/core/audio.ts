/**
 * All sound effects are synthesised at runtime with the Web Audio API so the
 * game ships without any binary assets.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private enabled = true;

  /** Must be triggered from a user gesture (the menu play button). */
  resume(): void {
    if (!this.ctx) {
      const Ctor: typeof AudioContext =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
      this.noise = this.createNoiseBuffer(this.ctx, 1.2);
    }
    void this.ctx.resume();
  }

  setEnabled(value: boolean): void {
    this.enabled = value;
  }

  setVolume(value: number): void {
    if (this.master) this.master.gain.value = value;
  }

  private createNoiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  private chain(volume: number, pan: number): GainNode | null {
    if (!this.ctx || !this.master || !this.enabled) return null;
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    if (pan !== 0) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      gain.connect(panner);
      panner.connect(this.master);
    } else {
      gain.connect(this.master);
    }
    return gain;
  }

  private noiseBurst(
    out: GainNode,
    duration: number,
    filterType: BiquadFilterType,
    frequency: number,
    q: number,
    curve: number,
  ): void {
    const ctx = this.ctx;
    if (!ctx || !this.noise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    const env = ctx.createGain();
    const now = ctx.currentTime;
    env.gain.setValueAtTime(1, now);
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration * curve);
    src.connect(filter);
    filter.connect(env);
    env.connect(out);
    src.start(now, Math.random() * 0.5);
    src.stop(now + duration);
  }

  private tone(
    out: GainNode,
    type: OscillatorType,
    from: number,
    to: number,
    duration: number,
    delay = 0,
  ): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    const now = ctx.currentTime + delay;
    osc.frequency.setValueAtTime(from, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), now + duration);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(1, now + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(env);
    env.connect(out);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  gunshot(kind: "rifle" | "pistol" | "sniper" | "smg", volume = 1, pan = 0): void {
    const out = this.chain(volume, pan);
    if (!out) return;
    switch (kind) {
      case "rifle":
        this.noiseBurst(out, 0.28, "bandpass", 1500, 0.7, 0.55);
        this.tone(out, "square", 220, 60, 0.09);
        break;
      case "smg":
        this.noiseBurst(out, 0.2, "bandpass", 2100, 0.9, 0.45);
        this.tone(out, "square", 280, 90, 0.06);
        break;
      case "pistol":
        this.noiseBurst(out, 0.19, "bandpass", 2600, 1.1, 0.4);
        this.tone(out, "triangle", 330, 110, 0.05);
        break;
      case "sniper":
        this.noiseBurst(out, 0.7, "lowpass", 900, 0.5, 0.8);
        this.tone(out, "sawtooth", 140, 40, 0.22);
        break;
    }
  }

  distantShot(volume = 0.35, pan = 0): void {
    const out = this.chain(volume, pan);
    if (!out) return;
    this.noiseBurst(out, 0.4, "lowpass", 620, 0.6, 0.7);
  }

  impact(pan = 0, volume = 0.5): void {
    const out = this.chain(volume, pan);
    if (!out) return;
    this.noiseBurst(out, 0.13, "highpass", 2600, 0.6, 0.35);
  }

  flesh(pan = 0, volume = 0.7): void {
    const out = this.chain(volume, pan);
    if (!out) return;
    this.noiseBurst(out, 0.16, "lowpass", 420, 0.7, 0.4);
    this.tone(out, "sine", 160, 60, 0.1);
  }

  hitmarker(headshot: boolean): void {
    const out = this.chain(headshot ? 0.5 : 0.32, 0);
    if (!out) return;
    this.tone(out, "square", headshot ? 1900 : 1150, headshot ? 1500 : 900, 0.06);
  }

  reload(stage: "out" | "in" | "bolt"): void {
    const out = this.chain(0.45, 0);
    if (!out) return;
    if (stage === "out") {
      this.noiseBurst(out, 0.09, "bandpass", 1800, 3, 0.5);
      this.tone(out, "square", 420, 260, 0.05);
    } else if (stage === "in") {
      this.noiseBurst(out, 0.1, "bandpass", 1200, 3, 0.5);
      this.tone(out, "square", 300, 180, 0.07);
    } else {
      this.noiseBurst(out, 0.13, "bandpass", 2400, 4, 0.5);
      this.tone(out, "square", 620, 380, 0.06);
    }
  }

  dryFire(): void {
    const out = this.chain(0.35, 0);
    if (!out) return;
    this.noiseBurst(out, 0.05, "highpass", 3200, 2, 0.4);
  }

  knifeSwing(): void {
    const out = this.chain(0.4, 0);
    if (!out) return;
    this.noiseBurst(out, 0.16, "bandpass", 900, 1.2, 0.5);
  }

  footstep(volume = 0.18, pan = 0): void {
    const out = this.chain(volume, pan);
    if (!out) return;
    this.noiseBurst(out, 0.1, "lowpass", 900, 0.9, 0.35);
  }

  jump(): void {
    const out = this.chain(0.16, 0);
    if (!out) return;
    this.noiseBurst(out, 0.08, "lowpass", 700, 1, 0.3);
  }

  death(pan = 0): void {
    const out = this.chain(0.5, pan);
    if (!out) return;
    this.tone(out, "sawtooth", 300, 70, 0.4);
    this.noiseBurst(out, 0.3, "lowpass", 500, 0.6, 0.6);
  }

  playerHurt(): void {
    const out = this.chain(0.55, 0);
    if (!out) return;
    this.tone(out, "sine", 220, 90, 0.25);
    this.noiseBurst(out, 0.18, "lowpass", 700, 0.8, 0.5);
  }

  roundStart(): void {
    const out = this.chain(0.5, 0);
    if (!out) return;
    this.tone(out, "square", 520, 520, 0.12, 0);
    this.tone(out, "square", 700, 700, 0.12, 0.16);
    this.tone(out, "square", 980, 980, 0.3, 0.32);
  }

  roundWin(): void {
    const out = this.chain(0.5, 0);
    if (!out) return;
    this.tone(out, "triangle", 520, 520, 0.16, 0);
    this.tone(out, "triangle", 660, 660, 0.16, 0.14);
    this.tone(out, "triangle", 880, 880, 0.45, 0.3);
  }

  gameOver(): void {
    const out = this.chain(0.55, 0);
    if (!out) return;
    this.tone(out, "sawtooth", 400, 100, 0.9);
    this.tone(out, "sawtooth", 300, 70, 1.2, 0.2);
  }

  switchWeapon(): void {
    const out = this.chain(0.3, 0);
    if (!out) return;
    this.noiseBurst(out, 0.09, "bandpass", 2000, 3, 0.5);
  }
}
