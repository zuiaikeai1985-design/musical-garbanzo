import type { SoundCue } from "../engine/events";
import { allAudioFiles, CUES, MUSIC_FILES, type MusicTrack } from "./cues";

const STORAGE_KEY = "ra.audio";
/** Beyond this distance from the camera centre a sound is inaudible. */
const MAX_AUDIBLE_DISTANCE = 1400;

export interface AudioSettings {
  musicVolume: number;
  sfxVolume: number;
}

const DEFAULT_SETTINGS: AudioSettings = { musicVolume: 0.55, sfxVolume: 0.7 };

interface ActiveVoice {
  source: AudioBufferSourceNode;
  cue: SoundCue;
}

/**
 * Web Audio playback for the whole game.
 *
 * Two things matter here beyond "play a file": voice management, because an RTS fires dozens of
 * overlapping sounds a second and unlimited voices turn a firefight into clipped noise; and
 * positional attenuation, so a battle happening off-screen is quieter than the one you are
 * looking at.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;

  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly lastPlayed = new Map<SoundCue, number>();
  private readonly voices: ActiveVoice[] = [];

  private currentMusic: { source: AudioBufferSourceNode; gain: GainNode; track: MusicTrack } | null =
    null;

  private settings: AudioSettings = loadSettings();
  private loaded = false;
  private loading: Promise<void> | null = null;
  /** Diagnostics for the end-to-end tests; audio is otherwise impossible to assert on. */
  private playCount = 0;

  /** Listener position in world coordinates, updated from the camera each frame. */
  private listenerX = 0;
  private listenerY = 0;
  private listenerScale = 1;

  get isLoaded(): boolean {
    return this.loaded;
  }

  getSettings(): AudioSettings {
    return { ...this.settings };
  }

  setSettings(next: Partial<AudioSettings>): void {
    this.settings = { ...this.settings, ...next };
    saveSettings(this.settings);
    if (this.musicGain) this.musicGain.gain.value = this.settings.musicVolume;
    if (this.sfxGain) this.sfxGain.gain.value = this.settings.sfxVolume;
  }

  /**
   * Creates the AudioContext. Must be called from a user gesture — browsers refuse to start
   * audio otherwise, and a context created too early stays permanently suspended.
   */
  unlock(): void {
    if (!this.ctx) {
      const Ctor: typeof AudioContext =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.settings.musicVolume;
      this.musicGain.connect(this.masterGain);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.settings.sfxVolume;
      this.sfxGain.connect(this.masterGain);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  /** Fetches and decodes every clip. Safe to call repeatedly; the work happens once. */
  async load(base = "/audio"): Promise<void> {
    if (this.loaded) return;
    if (this.loading) return this.loading;
    this.unlock();
    const ctx = this.ctx;
    if (!ctx) return;

    this.loading = (async () => {
      await Promise.all(
        allAudioFiles().map(async (file) => {
          try {
            const response = await fetch(`${base}/${file}.ogg`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const bytes = await response.arrayBuffer();
            this.buffers.set(file, await ctx.decodeAudioData(bytes));
          } catch (error) {
            // A missing clip must never break the game; it just goes silent.
            console.warn(`audio: failed to load ${file}`, error);
          }
        }),
      );
      this.loaded = true;
    })();

    return this.loading;
  }

  setListener(x: number, y: number, zoom: number): void {
    this.listenerX = x;
    this.listenerY = y;
    this.listenerScale = zoom;
  }

  /** Plays a one-shot cue, optionally positioned in the world. */
  play(cue: SoundCue, x?: number, y?: number): void {
    const ctx = this.ctx;
    const bus = this.sfxGain;
    if (!ctx || !bus || ctx.state !== "running") return;

    const def = CUES[cue];
    const buffer = this.buffers.get(def.file);
    if (!buffer) return;

    const now = performance.now();
    const last = this.lastPlayed.get(cue) ?? -Infinity;
    if (now - last < def.cooldownMs) return;

    this.pruneVoices();
    const active = this.voices.filter((v) => v.cue === cue).length;
    if (active >= def.maxVoices) return;

    let gain = def.volume;
    let pan = 0;
    if (!def.global && x !== undefined && y !== undefined) {
      const dx = x - this.listenerX;
      const dy = y - this.listenerY;
      const distance = Math.hypot(dx, dy);
      if (distance > MAX_AUDIBLE_DISTANCE) return;
      gain *= 1 - distance / MAX_AUDIBLE_DISTANCE;
      if (gain < 0.02) return;
      // Pan by horizontal offset, scaled so the whole viewport maps roughly to full width.
      pan = Math.max(-1, Math.min(1, dx / (600 / this.listenerScale)));
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    if (def.detune > 0) {
      source.playbackRate.value = 1 + (Math.random() * 2 - 1) * def.detune;
    }

    const voiceGain = ctx.createGain();
    voiceGain.gain.value = gain;

    if (pan !== 0 && typeof ctx.createStereoPanner === "function") {
      const panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      source.connect(voiceGain).connect(panner).connect(bus);
    } else {
      source.connect(voiceGain).connect(bus);
    }

    source.start();
    const voice: ActiveVoice = { source, cue };
    this.voices.push(voice);
    source.onended = () => {
      const index = this.voices.indexOf(voice);
      if (index >= 0) this.voices.splice(index, 1);
    };

    this.lastPlayed.set(cue, now);
    this.playCount++;
  }

  /**
   * Snapshot for tests and debugging.
   *
   * Sound cannot be observed from a headless browser, so the e2e suite asserts on this instead:
   * that the context is running, every clip decoded, music is playing and cues actually fired.
   */
  debugState() {
    return {
      contextState: this.ctx?.state ?? "none",
      loaded: this.loaded,
      buffersDecoded: this.buffers.size,
      expectedBuffers: allAudioFiles().length,
      musicTrack: this.currentMusic?.track ?? null,
      activeVoices: this.voices.length,
      playCount: this.playCount,
      settings: this.getSettings(),
    };
  }

  /** Starts (or crossfades to) a looping music track. */
  playMusic(track: MusicTrack, fadeSeconds = 1.2): void {
    const ctx = this.ctx;
    const bus = this.musicGain;
    if (!ctx || !bus || ctx.state !== "running") return;
    if (this.currentMusic?.track === track) return;

    const buffer = this.buffers.get(MUSIC_FILES[track]);
    if (!buffer) return;

    this.stopMusic(fadeSeconds);

    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(1, ctx.currentTime + fadeSeconds);
    gain.connect(bus);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    source.start();

    this.currentMusic = { source, gain, track };
  }

  stopMusic(fadeSeconds = 0.8): void {
    const ctx = this.ctx;
    const playing = this.currentMusic;
    if (!ctx || !playing) return;
    this.currentMusic = null;
    const stopAt = ctx.currentTime + fadeSeconds;
    playing.gain.gain.cancelScheduledValues(ctx.currentTime);
    playing.gain.gain.setValueAtTime(playing.gain.gain.value, ctx.currentTime);
    playing.gain.gain.linearRampToValueAtTime(0, stopAt);
    try {
      playing.source.stop(stopAt + 0.05);
    } catch {
      // Already stopped — nothing to do.
    }
  }

  /** Temporarily dips the music, used under the klaxon and the nuke. */
  duckMusic(toGain: number, seconds: number): void {
    const ctx = this.ctx;
    const bus = this.musicGain;
    if (!ctx || !bus) return;
    const now = ctx.currentTime;
    bus.gain.cancelScheduledValues(now);
    bus.gain.setValueAtTime(bus.gain.value, now);
    bus.gain.linearRampToValueAtTime(this.settings.musicVolume * toGain, now + 0.25);
    bus.gain.linearRampToValueAtTime(this.settings.musicVolume, now + seconds);
  }

  dispose(): void {
    this.stopMusic(0.05);
    for (const voice of this.voices) {
      try {
        voice.source.stop();
      } catch {
        // Already finished.
      }
    }
    this.voices.length = 0;
  }

  private pruneVoices(): void {
    // onended handles the common case; this is a safety net for suspended contexts.
    if (this.voices.length > 48) this.voices.splice(0, this.voices.length - 48);
  }
}

function loadSettings(): AudioSettings {
  if (typeof localStorage === "undefined") return { ...DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AudioSettings>;
    return {
      musicVolume: clamp01(parsed.musicVolume ?? DEFAULT_SETTINGS.musicVolume),
      sfxVolume: clamp01(parsed.sfxVolume ?? DEFAULT_SETTINGS.sfxVolume),
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings: AudioSettings): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage can be unavailable in private mode; volume just will not persist.
  }
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** Single shared instance — the game only ever needs one audio graph. */
export const audio = new AudioManager();
