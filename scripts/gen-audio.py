#!/usr/bin/env python3
"""
Procedural audio generator for 红色警报 / RED ALERT.

Every sound in the game is synthesised here from first principles with numpy and encoded to Ogg
Vorbis with ffmpeg. Nothing is sampled, ripped or borrowed: the music is an original composition
and the effects are built from oscillators and filtered noise. That keeps the project entirely
self-contained and free of any asset licensing question.

Usage:
    python3 scripts/gen-audio.py            # regenerate everything into public/audio
    python3 scripts/gen-audio.py --wav-only # skip the ogg encode (useful when debugging)

The output is deterministic: a fixed RNG seed means re-running produces byte-identical audio.
"""

from __future__ import annotations

import argparse
import math
import os
import shutil
import subprocess
import sys
import wave

import numpy as np

SR = 44100
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "audio")
WAV_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".audio-wav")

RNG = np.random.default_rng(0xC0FFEE)


# ── Primitives ──────────────────────────────────────────────────────────────


def t_axis(dur: float) -> np.ndarray:
    return np.arange(int(SR * dur), dtype=np.float64) / SR


def sine(freq, dur: float, phase: float = 0.0) -> np.ndarray:
    t = t_axis(dur)
    f = freq(t) if callable(freq) else np.full_like(t, float(freq))
    # Integrate frequency so sweeps stay phase-continuous.
    return np.sin(2 * np.pi * np.cumsum(f) / SR + phase)


def saw(freq, dur: float) -> np.ndarray:
    t = t_axis(dur)
    f = freq(t) if callable(freq) else np.full_like(t, float(freq))
    ph = np.cumsum(f) / SR
    return 2.0 * (ph - np.floor(ph + 0.5))


def square(freq, dur: float, duty: float = 0.5) -> np.ndarray:
    t = t_axis(dur)
    f = freq(t) if callable(freq) else np.full_like(t, float(freq))
    ph = np.cumsum(f) / SR
    return np.where((ph - np.floor(ph)) < duty, 1.0, -1.0)


def noise(dur: float) -> np.ndarray:
    return RNG.uniform(-1.0, 1.0, int(SR * dur))


def env_ad(dur: float, attack: float, decay: float, power: float = 2.0) -> np.ndarray:
    """Attack/decay envelope; `power` shapes the decay curve."""
    n = int(SR * dur)
    a = max(1, int(SR * attack))
    d = max(1, n - a)
    out = np.empty(n)
    out[:a] = np.linspace(0.0, 1.0, a)
    tail = np.linspace(0.0, 1.0, d)
    out[a:] = (1.0 - tail) ** power
    if decay < dur - attack:
        # Hard-stop after the requested decay so short blips stay short.
        cutoff = a + int(SR * decay)
        if cutoff < n:
            out[cutoff:] = 0.0
    return out


def env_adsr(dur: float, a: float, d: float, s: float, r: float) -> np.ndarray:
    n = int(SR * dur)
    na, nd, nr = int(SR * a), int(SR * d), int(SR * r)
    ns = max(0, n - na - nd - nr)
    parts = [
        np.linspace(0, 1, max(1, na)),
        np.linspace(1, s, max(1, nd)),
        np.full(ns, s),
        np.linspace(s, 0, max(1, nr)),
    ]
    out = np.concatenate(parts)
    return out[:n] if len(out) >= n else np.pad(out, (0, n - len(out)))


def lowpass(x: np.ndarray, cutoff) -> np.ndarray:
    """One-pole low-pass; `cutoff` may be a scalar or a per-sample array (for filter sweeps)."""
    c = np.full(len(x), float(cutoff)) if np.isscalar(cutoff) else np.asarray(cutoff, dtype=float)
    alpha = 1.0 - np.exp(-2.0 * np.pi * np.clip(c, 20, SR / 2 - 100) / SR)
    out = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc += alpha[i] * (x[i] - acc)
        out[i] = acc
    return out


def lowpass_fast(x: np.ndarray, cutoff: float) -> np.ndarray:
    """Vectorised fixed-cutoff low-pass (an IIR run via lfilter-style recursion in numpy)."""
    alpha = 1.0 - math.exp(-2.0 * math.pi * min(cutoff, SR / 2 - 100) / SR)
    # y[n] = y[n-1] + a*(x[n]-y[n-1]) == a * sum(x[k] * (1-a)^(n-k))
    b = 1.0 - alpha
    # Iterative but in chunks; length here is short enough that plain Python is fine.
    out = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = acc * b + alpha * x[i]
        out[i] = acc
    return out


def highpass(x: np.ndarray, cutoff: float) -> np.ndarray:
    return x - lowpass_fast(x, cutoff)


def distort(x: np.ndarray, drive: float = 4.0) -> np.ndarray:
    return np.tanh(x * drive) / np.tanh(drive)


def normalize(x: np.ndarray, peak: float = 0.92) -> np.ndarray:
    m = float(np.max(np.abs(x))) if len(x) else 0.0
    return x if m < 1e-9 else x * (peak / m)


def fit(x: np.ndarray, n: int) -> np.ndarray:
    return x[:n] if len(x) >= n else np.pad(x, (0, n - len(x)))


def add_at(buf: np.ndarray, x: np.ndarray, start: int, gain: float = 1.0) -> None:
    end = min(len(buf), start + len(x))
    if end <= start:
        return
    buf[start:end] += x[: end - start] * gain


def fade_edges(x: np.ndarray, ms: float = 4.0) -> np.ndarray:
    n = int(SR * ms / 1000)
    if n * 2 >= len(x) or n <= 0:
        return x
    out = x.copy()
    out[:n] *= np.linspace(0, 1, n)
    out[-n:] *= np.linspace(1, 0, n)
    return out



def mix(*layers: np.ndarray) -> np.ndarray:
    """Sums layers of differing lengths, padding each to the longest."""
    n = max(len(x) for x in layers)
    out = np.zeros(n)
    for x in layers:
        out[: len(x)] += x
    return out

def note_hz(semitones_from_a4: float) -> float:
    return 440.0 * (2.0 ** (semitones_from_a4 / 12.0))


# ── Sound effects ───────────────────────────────────────────────────────────


def sfx_ui_click() -> np.ndarray:
    x = mix(
        square(1400, 0.045, 0.35) * env_ad(0.045, 0.001, 0.045, 3),
        noise(0.045) * env_ad(0.045, 0.0005, 0.012, 4) * 0.4,
    )
    return fade_edges(normalize(x, 0.5))


def sfx_ui_error() -> np.ndarray:
    x = mix(
        square(180, 0.22, 0.5) * env_adsr(0.22, 0.005, 0.03, 0.7, 0.1),
        square(120, 0.22, 0.5) * env_adsr(0.22, 0.005, 0.03, 0.5, 0.1) * 0.7,
    )
    return fade_edges(normalize(distort(x, 2.0), 0.55))


def sfx_select() -> np.ndarray:
    x = mix(
        sine(lambda t: 800 + 900 * t / max(t[-1], 1e-6), 0.09) * env_ad(0.09, 0.002, 0.09, 2),
        square(1600, 0.05, 0.25) * env_ad(0.05, 0.001, 0.05, 3) * 0.25,
    )
    return fade_edges(normalize(x, 0.45))


def sfx_move_ack() -> np.ndarray:
    x = mix(
        square(520, 0.07, 0.4) * env_ad(0.07, 0.002, 0.07, 2.5),
        square(780, 0.05, 0.4) * env_ad(0.05, 0.002, 0.05, 2.5) * 0.5,
    )
    return fade_edges(normalize(x, 0.4))


def sfx_attack_ack() -> np.ndarray:
    x = mix(
        square(320, 0.11, 0.3) * env_ad(0.11, 0.002, 0.11, 2),
        square(240, 0.11, 0.3) * env_ad(0.11, 0.002, 0.11, 2) * 0.6,
    )
    return fade_edges(normalize(distort(x, 1.6), 0.45))


def sfx_credit_tick() -> np.ndarray:
    x = sine(1250, 0.035) * env_ad(0.035, 0.001, 0.035, 4)
    return fade_edges(normalize(x, 0.32))


def sfx_build_start() -> np.ndarray:
    x = saw(lambda t: 140 + 260 * t / max(t[-1], 1e-6), 0.35) * env_adsr(0.35, 0.02, 0.1, 0.5, 0.15)
    x = mix(lowpass_fast(x, 1800), noise(0.35) * env_ad(0.35, 0.01, 0.35, 2) * 0.12)
    return fade_edges(normalize(x, 0.5))


def sfx_build_complete() -> np.ndarray:
    dur = 0.55
    out = np.zeros(int(SR * dur))
    for i, semi in enumerate([-9, -5, -2, 3]):  # rising minor-ish arpeggio
        seg = sine(note_hz(semi), 0.22) * env_ad(0.22, 0.004, 0.22, 2.5)
        seg += sine(note_hz(semi + 12), 0.22) * env_ad(0.22, 0.004, 0.22, 3) * 0.4
        add_at(out, seg, int(SR * 0.075 * i), 0.7)
    return fade_edges(normalize(out, 0.6))


def sfx_place_building() -> np.ndarray:
    thud = sine(lambda t: 90 * np.exp(-3 * t), 0.4) * env_ad(0.4, 0.002, 0.4, 2.2)
    dust = lowpass_fast(noise(0.4), 900) * env_ad(0.4, 0.005, 0.4, 2.5) * 0.5
    metal = square(430, 0.12, 0.3) * env_ad(0.12, 0.001, 0.12, 4) * 0.25
    return fade_edges(normalize(mix(thud, dust, metal), 0.75))


def sfx_sell() -> np.ndarray:
    x = saw(lambda t: 500 - 380 * t / max(t[-1], 1e-6), 0.4) * env_ad(0.4, 0.01, 0.4, 2)
    x = lowpass_fast(x, 2200)
    return fade_edges(normalize(x, 0.5))


def sfx_repair() -> np.ndarray:
    out = np.zeros(int(SR * 0.4))
    for i in range(3):
        clang = mix(
            highpass(noise(0.12), 2000) * env_ad(0.12, 0.0005, 0.12, 5),
            square(900 + i * 120, 0.12, 0.2) * env_ad(0.12, 0.001, 0.12, 4) * 0.5,
        )
        add_at(out, clang, int(SR * 0.11 * i), 0.7)
    return fade_edges(normalize(out, 0.5))


def gun_report(dur: float, body_hz: float, bright: float, drive: float) -> np.ndarray:
    crack = highpass(noise(dur), bright) * env_ad(dur, 0.0004, dur, 3.5)
    body = sine(lambda t: body_hz * np.exp(-9 * t), dur) * env_ad(dur, 0.001, dur, 2.5)
    return distort(mix(crack * 0.8, body * 0.9), drive)


def sfx_rifle() -> np.ndarray:
    return fade_edges(normalize(gun_report(0.13, 150, 1800, 2.0), 0.55))


def sfx_mg() -> np.ndarray:
    return fade_edges(normalize(gun_report(0.1, 190, 2200, 2.4), 0.5))


def sfx_cannon() -> np.ndarray:
    x = mix(
        gun_report(0.45, 85, 700, 3.2),
        lowpass_fast(noise(0.45), 300) * env_ad(0.45, 0.002, 0.45, 2) * 0.6,
    )
    return fade_edges(normalize(x, 0.85))


def sfx_cannon_heavy() -> np.ndarray:
    x = mix(
        gun_report(0.7, 62, 500, 4.0),
        sine(lambda t: 45 * np.exp(-2.2 * t), 0.7) * env_ad(0.7, 0.003, 0.7, 1.6) * 0.9,
    )
    return fade_edges(normalize(x, 0.95))


def sfx_rocket_launch() -> np.ndarray:
    dur = 0.9
    hiss = highpass(noise(dur), 700) * env_adsr(dur, 0.02, 0.12, 0.55, 0.5)
    whoosh = lowpass(noise(dur), np.linspace(3000, 500, int(SR * dur))) * env_adsr(
        dur, 0.03, 0.2, 0.45, 0.5
    )
    thump = sine(lambda t: 70 * np.exp(-5 * t), 0.3) * env_ad(0.3, 0.001, 0.3, 2)
    return fade_edges(normalize(mix(hiss * 0.6, whoosh * 0.8, fit(thump, int(SR * dur)) * 0.8), 0.8))


def sfx_grenade() -> np.ndarray:
    x = mix(
        square(lambda t: 300 * np.exp(-6 * t), 0.18, 0.3) * env_ad(0.18, 0.002, 0.18, 3),
        highpass(noise(0.18), 1200) * env_ad(0.18, 0.001, 0.18, 4) * 0.4,
    )
    return fade_edges(normalize(x, 0.5))


def sfx_flame() -> np.ndarray:
    dur = 0.55
    body = lowpass(noise(dur), np.linspace(2400, 600, int(SR * dur)))
    x = body * env_adsr(dur, 0.03, 0.1, 0.7, 0.3)
    x = mix(x, sine(lambda t: 60 + 25 * np.sin(2 * np.pi * 7 * t), dur) * 0.15)
    return fade_edges(normalize(distort(x, 1.8), 0.6))


def sfx_tesla() -> np.ndarray:
    dur = 0.7
    t = t_axis(dur)
    # Ring-modulated noise gives the electric crackle; the sweep is the discharge.
    carrier = np.sin(2 * np.pi * 90 * t) * np.sin(2 * np.pi * 430 * t)
    crackle = highpass(noise(dur), 2500) * (0.4 + 0.6 * RNG.random(len(t)))
    x = mix(carrier * 0.6, crackle * 0.8) * env_adsr(dur, 0.006, 0.09, 0.35, 0.4)
    zap = sine(lambda tt: 1800 * np.exp(-14 * tt), 0.25) * env_ad(0.25, 0.001, 0.25, 3)
    return fade_edges(normalize(mix(x, fit(zap, len(x)) * 0.7), 0.85))


def sfx_dog_bark() -> np.ndarray:
    dur = 0.28
    growl = saw(lambda t: 240 * np.exp(-4 * t) + 90, dur) * env_adsr(dur, 0.004, 0.05, 0.4, 0.14)
    body = mix(
        lowpass_fast(growl, 1400), highpass(noise(dur), 900) * env_ad(dur, 0.002, 0.1, 3) * 0.3
    )
    return fade_edges(normalize(distort(body, 2.2), 0.7))


def explosion(dur: float, sub_hz: float, drive: float) -> np.ndarray:
    n = int(SR * dur)
    blast = lowpass(noise(dur), np.linspace(5200, 180, n)) * env_ad(dur, 0.001, dur, 1.7)
    sub = sine(lambda t: sub_hz * np.exp(-3.0 * t), dur) * env_ad(dur, 0.002, dur, 1.4)
    crack = highpass(noise(dur), 3000) * env_ad(dur, 0.0005, 0.05, 5) * 0.7
    return distort(mix(blast * 1.0, sub * 0.95, crack), drive)


def sfx_explosion_small() -> np.ndarray:
    return fade_edges(normalize(explosion(0.5, 110, 2.0), 0.7))


def sfx_explosion_medium() -> np.ndarray:
    return fade_edges(normalize(explosion(0.9, 75, 2.6), 0.85))


def sfx_explosion_large() -> np.ndarray:
    return fade_edges(normalize(explosion(1.5, 48, 3.2), 0.95))


def sfx_structure_explode() -> np.ndarray:
    dur = 2.4
    out = np.zeros(int(SR * dur))
    add_at(out, explosion(1.8, 42, 3.4), 0, 1.0)
    # Secondary detonations and falling debris.
    for i, delay in enumerate([0.18, 0.36, 0.62, 0.95]):
        add_at(out, explosion(0.7, 90 - i * 10, 2.2), int(SR * delay), 0.5)
    debris = highpass(noise(1.4), 1500) * env_ad(1.4, 0.05, 1.4, 2.5) * 0.25
    add_at(out, debris, int(SR * 0.5), 1.0)
    return fade_edges(normalize(out, 0.98))


def sfx_infantry_die() -> np.ndarray:
    dur = 0.5
    cry = saw(lambda t: 300 * np.exp(-2.5 * t) + 110, dur) * env_adsr(dur, 0.01, 0.08, 0.35, 0.3)
    cry = lowpass_fast(cry, 1600)
    return fade_edges(normalize(distort(cry, 1.5), 0.45))


def sfx_harvest() -> np.ndarray:
    dur = 0.55
    grind = lowpass(noise(dur), np.linspace(900, 350, int(SR * dur)))
    grind *= 0.6 + 0.4 * np.sin(2 * np.pi * 18 * t_axis(dur))
    x = grind * env_adsr(dur, 0.04, 0.1, 0.6, 0.25)
    return fade_edges(normalize(x, 0.35))


def sfx_unload() -> np.ndarray:
    dur = 0.8
    pour = lowpass(noise(dur), np.linspace(2600, 700, int(SR * dur)))
    x = pour * env_adsr(dur, 0.03, 0.12, 0.55, 0.35)
    clunk = sine(lambda t: 120 * np.exp(-6 * t), 0.25) * env_ad(0.25, 0.002, 0.25, 2)
    return fade_edges(normalize(mix(x * 0.7, fit(clunk, len(x)) * 0.6), 0.5))


def sfx_radar_on() -> np.ndarray:
    dur = 0.7
    x = mix(
        sine(lambda t: 300 + 900 * t / max(t[-1], 1e-6), dur) * env_adsr(dur, 0.02, 0.1, 0.6, 0.3),
        sine(lambda t: 600 + 1800 * t / max(t[-1], 1e-6), dur)
        * 0.3
        * env_adsr(dur, 0.02, 0.1, 0.5, 0.3),
    )
    return fade_edges(normalize(x, 0.45))


def sfx_radar_off() -> np.ndarray:
    dur = 0.8
    x = mix(
        sine(lambda t: 1100 - 900 * t / max(t[-1], 1e-6), dur) * env_adsr(dur, 0.01, 0.1, 0.5, 0.4),
        lowpass_fast(noise(dur), 800) * env_ad(dur, 0.01, dur, 2) * 0.2,
    )
    return fade_edges(normalize(x, 0.45))


def sfx_klaxon() -> np.ndarray:
    """Two-tone air-raid siren, two cycles."""
    dur = 2.6
    t = t_axis(dur)
    wobble = 0.5 + 0.5 * np.sin(2 * np.pi * 0.8 * t - np.pi / 2)
    freq = 420 + 260 * wobble
    x = mix(saw(lambda _t: freq, dur) * 0.5, square(lambda _t: freq * 0.5, dur, 0.4) * 0.4)
    x = lowpass_fast(x, 2600) * env_adsr(dur, 0.08, 0.2, 0.85, 0.5)
    return fade_edges(normalize(distort(x, 1.6), 0.8), 30)


def sfx_nuke_launch() -> np.ndarray:
    dur = 3.2
    n = int(SR * dur)
    rumble = lowpass(noise(dur), np.linspace(120, 400, n)) * env_adsr(dur, 0.3, 0.4, 0.8, 1.0)
    rise = sine(lambda t: 60 * np.exp(1.1 * t), dur) * env_adsr(dur, 0.4, 0.5, 0.8, 0.9)
    hiss = highpass(noise(dur), 1200) * env_adsr(dur, 0.6, 0.5, 0.5, 1.0) * 0.4
    return fade_edges(normalize(mix(rumble * 0.8, rise * 0.7, hiss), 0.9), 40)


def sfx_nuke_impact() -> np.ndarray:
    dur = 5.0
    n = int(SR * dur)
    out = np.zeros(n)
    # Crack, then a long low roar with a slow decay.
    add_at(out, explosion(2.5, 34, 4.0), 0, 1.0)
    roar = lowpass(noise(4.6), np.linspace(700, 60, int(SR * 4.6))) * env_adsr(
        4.6, 0.05, 0.6, 0.5, 3.5
    )
    add_at(out, roar, int(SR * 0.15), 0.85)
    sub = sine(lambda t: 28 + 6 * np.sin(2 * np.pi * 0.7 * t), 4.0) * env_adsr(
        4.0, 0.02, 0.5, 0.6, 3.0
    )
    add_at(out, sub, 0, 0.9)
    return fade_edges(normalize(out, 0.99), 40)


# ── Music ───────────────────────────────────────────────────────────────────

BPM = 138
BEAT = 60.0 / BPM
STEP = BEAT / 4  # sixteenth notes


def drum_kick() -> np.ndarray:
    dur = 0.28
    x = mix(
        sine(lambda t: 130 * np.exp(-22 * t) + 42, dur) * env_ad(dur, 0.0008, dur, 2.2),
        lowpass_fast(noise(0.04), 1200) * env_ad(0.04, 0.0005, 0.04, 4) * 0.35,
    )
    return distort(x, 1.6)


def drum_snare() -> np.ndarray:
    dur = 0.22
    body = sine(190, dur) * env_ad(dur, 0.001, dur, 3) * 0.5
    rattle = highpass(noise(dur), 1400) * env_ad(dur, 0.0008, dur, 2.6)
    return distort(mix(body, rattle * 0.9), 1.4)


def drum_hat(open_hat: bool = False) -> np.ndarray:
    dur = 0.16 if open_hat else 0.055
    x = highpass(noise(dur), 6500) * env_ad(dur, 0.0004, dur, 3.5)
    return x * (0.5 if open_hat else 0.36)


def bass_note(semi: float, dur: float) -> np.ndarray:
    f = note_hz(semi)
    x = mix(saw(f, dur) * 0.7, square(f * 0.5, dur, 0.45) * 0.5)
    n = len(x)
    x = lowpass(x, np.linspace(2600, 420, n))
    x = distort(x, 3.2)
    return x * env_adsr(dur, 0.004, 0.06, 0.72, min(0.09, dur * 0.4))


def stab_chord(root: float, dur: float) -> np.ndarray:
    """Short minor-chord brass stab."""
    x = np.zeros(int(SR * dur))
    for semi in (0, 3, 7, 12):
        f = note_hz(root + semi)
        v = mix(saw(f, dur) * 0.5, square(f, dur, 0.3) * 0.3)
        x += fit(v, len(x))
    x = lowpass(x, np.linspace(4200, 1100, len(x)))
    return distort(x * 0.35, 2.0) * env_adsr(dur, 0.006, 0.09, 0.28, 0.12)


def lead_note(semi: float, dur: float) -> np.ndarray:
    f = note_hz(semi)
    x = mix(square(f, dur, 0.32) * 0.5, saw(f * 2, dur) * 0.15)
    x = lowpass(x, np.linspace(5200, 1600, len(x)))
    return distort(x, 1.8) * env_adsr(dur, 0.01, 0.08, 0.5, 0.2)


def siren_pad(dur: float) -> np.ndarray:
    t = t_axis(dur)
    sweep = 240 + 180 * np.sin(2 * np.pi * 0.11 * t)
    x = mix(saw(lambda _t: sweep, dur) * 0.18, sine(lambda _t: sweep * 0.5, dur) * 0.12)
    return lowpass(x, 900 + 500 * (0.5 + 0.5 * np.sin(2 * np.pi * 0.07 * t)))


def build_theme() -> np.ndarray:
    """
    Original industrial march in E minor.

    Sixteen bars of 4/4 at 138bpm, arranged so the last bar leads straight back into the first —
    the loop point falls on a downbeat with no reverb tail crossing it.
    """
    bars = 16
    steps_per_bar = 16
    total_steps = bars * steps_per_bar
    dur = total_steps * STEP
    n = int(SR * dur)
    out = np.zeros(n + SR)  # headroom for tails, trimmed at the end

    def at(step: int) -> int:
        return int(step * STEP * SR)

    # E minor: E=-17 (E2), G=-14, A=-12, B=-10, D=-7, C=-9
    E, G, A, B, D, C = -17.0, -14.0, -12.0, -10.0, -7.0, -9.0
    riff_a = [E, E, E + 12, E, G, E, D, E, E, E, E + 12, E, A, G, E, E]
    riff_b = [E, E, E + 12, E, G, E, D, E, C, C, C + 12, C, D, D, B, B]

    for bar in range(bars):
        base = bar * steps_per_bar
        riff = riff_a if (bar % 4) < 3 else riff_b
        intensity = 0.55 if bar < 2 else 1.0
        drums_on = bar >= 1
        lead_on = 4 <= bar < 8 or bar >= 12

        # Bass riff on every sixteenth.
        for i, semi in enumerate(riff):
            add_at(out, bass_note(semi, STEP * 1.05), at(base + i), 0.42 * intensity)

        if drums_on:
            for i in range(steps_per_bar):
                step = base + i
                if i % 4 == 0:
                    add_at(out, drum_kick(), at(step), 0.85)
                if i % 8 == 4:
                    add_at(out, drum_snare(), at(step), 0.6)
                if i % 2 == 0:
                    add_at(out, drum_hat(i % 8 == 6), at(step), 0.5)
            # Fill at the end of every fourth bar.
            if bar % 4 == 3:
                for i, step in enumerate([12, 13, 14, 15]):
                    add_at(out, drum_snare(), at(base + step), 0.35 + i * 0.12)

        # Chord stabs on the off-beats.
        if bar >= 2:
            chord_root = E + 12 if (bar % 4) < 3 else C + 12
            for i in (2, 6, 10, 14):
                add_at(out, stab_chord(chord_root, STEP * 2), at(base + i), 0.3)

        # Lead motif.
        if lead_on:
            motif = [(0, B + 12, 2), (2, D + 12, 2), (4, E + 12, 4), (10, G + 12, 2), (12, D + 12, 4)]
            for step, semi, length in motif:
                add_at(out, lead_note(semi, STEP * length * 0.95), at(base + step), 0.26)

    # Siren pad underneath the whole thing.
    add_at(out, siren_pad(dur), 0, 0.5)

    # Wrap the tail back over the start so the loop is seamless.
    tail = out[n:]
    out = out[:n]
    out[: len(tail)] += tail
    return normalize(out, 0.85)


def build_menu() -> np.ndarray:
    """Slow, ominous ambient loop for the main menu: drone, pulse and a distant siren."""
    dur = 32.0
    n = int(SR * dur)
    t = t_axis(dur)
    out = np.zeros(n)

    # Detuned low drone.
    for detune in (-0.12, 0.0, 0.13):
        out += fit(saw(note_hz(-29) + detune, dur), n) * 0.12
    out = lowpass(out, 260 + 120 * (0.5 + 0.5 * np.sin(2 * np.pi * 0.04 * t)))

    # Slow heartbeat pulse every two seconds.
    for i in range(int(dur / 2.0)):
        add_at(out, drum_kick(), int(SR * 2.0 * i), 0.35)

    # Distant siren wash.
    add_at(out, siren_pad(dur), 0, 0.28)

    # Sparse minor-chord swells.
    for i, bar in enumerate([0, 8, 16, 24]):
        root = [-17, -14, -19, -12][i]
        swell = np.zeros(int(SR * 6.0))
        for semi in (0, 3, 7):
            swell += fit(sine(note_hz(root + semi), 6.0), len(swell)) * 0.2
        swell *= env_adsr(6.0, 1.6, 1.2, 0.5, 3.0)
        add_at(out, swell, int(SR * bar), 0.5)

    return normalize(out, 0.6)


def build_victory() -> np.ndarray:
    dur = 4.5
    out = np.zeros(int(SR * dur))
    # Rising major-flavoured fanfare over a march beat.
    for i, semi in enumerate([-17, -13, -10, -5, -1, 2]):
        add_at(out, stab_chord(semi + 12, 0.5), int(SR * 0.22 * i), 0.55)
        add_at(out, drum_kick(), int(SR * 0.22 * i), 0.5)
    hold = np.zeros(int(SR * 2.6))
    for semi in (-5, -1, 2, 7):
        hold += fit(saw(note_hz(semi), 2.6), len(hold)) * 0.18
    hold = lowpass(hold, np.linspace(4000, 1400, len(hold))) * env_adsr(2.6, 0.05, 0.4, 0.6, 1.6)
    add_at(out, distort(hold, 1.6), int(SR * 1.4), 0.8)
    for i in range(6):
        add_at(out, drum_snare(), int(SR * (1.4 + 0.14 * i)), 0.3)
    return fade_edges(normalize(out, 0.85), 30)


def build_defeat() -> np.ndarray:
    dur = 5.0
    out = np.zeros(int(SR * dur))
    # Falling minor progression, filtered down to nothing.
    for i, semi in enumerate([-10, -12, -14, -17]):
        chord = np.zeros(int(SR * 2.2))
        for off in (0, 3, 7):
            chord += fit(saw(note_hz(semi + off), 2.2), len(chord)) * 0.16
        chord = lowpass(chord, np.linspace(1800 - i * 350, 300, len(chord)))
        chord *= env_adsr(2.2, 0.08, 0.5, 0.5, 1.4)
        add_at(out, chord, int(SR * 1.0 * i), 0.75)
    add_at(out, lowpass_fast(noise(4.0), 220) * env_adsr(4.0, 0.5, 1.0, 0.4, 2.4), 0, 0.3)
    return fade_edges(normalize(out, 0.75), 30)


# ── Output ──────────────────────────────────────────────────────────────────

SFX = {
    "uiClick": sfx_ui_click,
    "uiError": sfx_ui_error,
    "select": sfx_select,
    "moveAck": sfx_move_ack,
    "attackAck": sfx_attack_ack,
    "creditTick": sfx_credit_tick,
    "buildStart": sfx_build_start,
    "buildComplete": sfx_build_complete,
    "placeBuilding": sfx_place_building,
    "sell": sfx_sell,
    "repair": sfx_repair,
    "rifle": sfx_rifle,
    "mg": sfx_mg,
    "cannon": sfx_cannon,
    "cannonHeavy": sfx_cannon_heavy,
    "rocketLaunch": sfx_rocket_launch,
    "grenade": sfx_grenade,
    "flame": sfx_flame,
    "tesla": sfx_tesla,
    "dogBark": sfx_dog_bark,
    "explosionSmall": sfx_explosion_small,
    "explosionMedium": sfx_explosion_medium,
    "explosionLarge": sfx_explosion_large,
    "structureExplode": sfx_structure_explode,
    "infantryDie": sfx_infantry_die,
    "harvest": sfx_harvest,
    "unload": sfx_unload,
    "radarOn": sfx_radar_on,
    "radarOff": sfx_radar_off,
    "klaxon": sfx_klaxon,
    "nukeLaunch": sfx_nuke_launch,
    "nukeImpact": sfx_nuke_impact,
}

MUSIC = {
    "theme": build_theme,
    "menu": build_menu,
    "victory": build_victory,
    "defeat": build_defeat,
}


def write_wav(path: str, mono: np.ndarray) -> None:
    data = np.clip(mono, -1.0, 1.0)
    pcm = (data * 32767.0).astype("<i2")
    with wave.open(path, "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(SR)
        f.writeframes(pcm.tobytes())


def encode_ogg(wav_path: str, ogg_path: str, quality: str) -> None:
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-i",
            wav_path,
            "-c:a",
            "libvorbis",
            "-q:a",
            quality,
            ogg_path,
        ],
        check=True,
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--wav-only", action="store_true", help="skip the ogg encode")
    args = parser.parse_args()

    if not args.wav_only and shutil.which("ffmpeg") is None:
        print("ffmpeg not found on PATH; re-run with --wav-only", file=sys.stderr)
        return 1

    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(WAV_DIR, exist_ok=True)

    manifest = []
    for name, build in list(SFX.items()) + list(MUSIC.items()):
        is_music = name in MUSIC
        audio = build()
        wav_path = os.path.join(WAV_DIR, f"{name}.wav")
        write_wav(wav_path, audio)
        size = len(audio) / SR
        if args.wav_only:
            manifest.append((name, size, os.path.getsize(wav_path)))
            print(f"  {name:20s} {size:6.2f}s  (wav only)")
            continue
        ogg_path = os.path.join(OUT_DIR, f"{name}.ogg")
        encode_ogg(wav_path, ogg_path, "5" if is_music else "3")
        manifest.append((name, size, os.path.getsize(ogg_path)))
        print(f"  {name:20s} {size:6.2f}s  {os.path.getsize(ogg_path) / 1024:8.1f} KiB")

    total = sum(m[2] for m in manifest)
    print(f"\n{len(manifest)} files, {total / 1024:.1f} KiB total -> {OUT_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())


