export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;

  unlock(): void {
    if (!this.ctx) {
      const ctx = new AudioContext();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = 0.28;
      this.master.connect(ctx.destination);
    }
    void this.ctx.resume();
  }

  shoot(weaponId: string): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const now = ctx.currentTime;

    if (weaponId === "knife") {
      this.tone(180, 0.08, "square", 0.12, now);
      return;
    }

    const noise = ctx.createBufferSource();
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.12, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = weaponId === "awp" ? 280 : weaponId === "deagle" ? 420 : 900;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(weaponId === "awp" ? 0.9 : 0.55, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (weaponId === "awp" ? 0.28 : 0.12));
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    noise.start(now);

    const body = weaponId === "awp" ? 70 : weaponId === "ak47" ? 110 : 140;
    this.tone(body, weaponId === "awp" ? 0.2 : 0.07, "sine", 0.35, now);
  }

  reload(): void {
    this.tone(320, 0.05, "square", 0.08);
    this.tone(220, 0.08, "square", 0.06, this.now() + 0.15);
  }

  hit(headshot: boolean): void {
    this.tone(headshot ? 880 : 420, 0.05, "square", headshot ? 0.16 : 0.1);
  }

  hurt(): void {
    this.tone(90, 0.12, "sawtooth", 0.18);
  }

  footstep(walk: boolean): void {
    this.tone(walk ? 90 : 120, 0.03, "triangle", walk ? 0.04 : 0.07);
  }

  buy(): void {
    this.tone(520, 0.06, "sine", 0.1);
    this.tone(740, 0.08, "sine", 0.08, this.now() + 0.05);
  }

  death(): void {
    this.tone(140, 0.25, "sawtooth", 0.2);
  }

  win(): void {
    this.tone(440, 0.12, "sine", 0.12);
    this.tone(554, 0.14, "sine", 0.12, this.now() + 0.12);
    this.tone(659, 0.2, "sine", 0.14, this.now() + 0.24);
  }

  private now(): number {
    return this.ctx?.currentTime ?? 0;
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    when = this.now(),
  ): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  }
}
