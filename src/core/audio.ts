import { save } from './save';

/**
 * Sonido y música generados con Web Audio API (sin archivos externos).
 * El AudioContext se crea en el primer gesto del usuario.
 */
export type Sfx =
  | 'bounce'
  | 'paddle'
  | 'break'
  | 'hard'
  | 'metal'
  | 'explode'
  | 'power'
  | 'bad'
  | 'bossHit'
  | 'lose'
  | 'win'
  | 'launch'
  | 'laser'
  | 'freeze'
  | 'unlock'
  | 'click'
  | 'warn'
  | 'stun'
  | 'star';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicGain: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
const lastPlayed: Partial<Record<Sfx, number>> = {};

function ensure(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.16;
    musicGain.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch {
    ctx = null;
  }
  return ctx;
}

/** Llamar desde un gesto del usuario para desbloquear el audio. */
export function unlockAudio(): void {
  const c = ensure();
  if (c && c.state === 'suspended') void c.resume();
}

export function suspendAudio(on: boolean): void {
  if (!ctx) return;
  if (on && ctx.state === 'running') void ctx.suspend();
  else if (!on && ctx.state === 'suspended') void ctx.resume();
}

function tone(
  freq: number,
  dur: number,
  type: OscillatorType = 'square',
  vol = 0.2,
  slideTo?: number,
  delay = 0,
  dest?: AudioNode,
): void {
  if (!ctx || !master) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g);
  g.connect(dest ?? master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, vol = 0.2, freq = 1200, delay = 0): void {
  if (!ctx || !master || !noiseBuf) return;
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(freq, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.2), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f);
  f.connect(g);
  g.connect(master);
  s.start(t);
  s.stop(t + dur + 0.02);
}

const MIN_GAP: Partial<Record<Sfx, number>> = { break: 35, bounce: 40, hard: 40, metal: 60, paddle: 40, explode: 70, laser: 60 };

export function sfx(name: Sfx, pitch = 1): void {
  if (!save.settings.sound) return;
  if (!ensure() || !ctx || ctx.state !== 'running') return;
  const now = performance.now();
  const gap = MIN_GAP[name] ?? 0;
  if (gap && now - (lastPlayed[name] ?? 0) < gap) return;
  lastPlayed[name] = now;
  switch (name) {
    case 'bounce':
      tone(300 * pitch, 0.04, 'square', 0.07);
      break;
    case 'paddle':
      tone(220, 0.06, 'square', 0.14, 330);
      break;
    case 'break':
      tone(520 * pitch, 0.05, 'square', 0.09, 780 * pitch);
      break;
    case 'hard':
      tone(180, 0.07, 'triangle', 0.2, 120);
      break;
    case 'metal':
      tone(1400, 0.05, 'square', 0.05, 900);
      break;
    case 'explode':
      noise(0.3, 0.35, 900);
      tone(120, 0.25, 'sawtooth', 0.2, 40);
      break;
    case 'power':
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.09, 'square', 0.13, undefined, i * 0.06));
      break;
    case 'bad':
      tone(300, 0.2, 'sawtooth', 0.14, 110);
      break;
    case 'bossHit':
      noise(0.12, 0.25, 2500);
      tone(160, 0.18, 'square', 0.22, 70);
      break;
    case 'lose':
      [392, 330, 262, 196].forEach((f, i) => tone(f, 0.16, 'triangle', 0.22, undefined, i * 0.13));
      break;
    case 'win':
      [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, 'square', 0.15, undefined, i * 0.11));
      break;
    case 'launch':
      tone(260, 0.1, 'square', 0.12, 620);
      break;
    case 'laser':
      tone(1300, 0.08, 'sawtooth', 0.07, 400);
      break;
    case 'freeze':
      tone(1800, 0.25, 'sine', 0.14, 2600);
      tone(900, 0.25, 'triangle', 0.1, 1300);
      break;
    case 'unlock':
      [392, 523, 659].forEach((f, i) => tone(f, 0.12, 'triangle', 0.2, undefined, i * 0.08));
      break;
    case 'click':
      tone(700, 0.04, 'square', 0.1);
      break;
    case 'warn':
      tone(880, 0.08, 'square', 0.1);
      tone(880, 0.08, 'square', 0.1, undefined, 0.14);
      break;
    case 'stun':
      tone(140, 0.3, 'sawtooth', 0.2, 60);
      noise(0.15, 0.2, 700);
      break;
    case 'star':
      tone(988 * pitch, 0.18, 'square', 0.14, 1319 * pitch);
      break;
  }
}

// ---------------------------------------------------------------- música ---
interface Track {
  bpm: number;
  root: number; // nota MIDI base
  bass: (number | null)[];
  lead: (number | null)[];
  leadType: OscillatorType;
}

const _ = null;
/** 0 = menú, 1..5 = mundos, 6 = jefe. Patrones de 16 pasos (semitonos sobre la raíz). */
const TRACKS: Track[] = [
  { bpm: 104, root: 45, leadType: 'square', bass: [0, _, 0, _, 7, _, 7, _, 5, _, 5, _, 3, _, 7, _], lead: [12, _, 15, 19, _, 15, 12, _, 17, _, 15, 12, _, 10, 12, _] },
  { bpm: 120, root: 48, leadType: 'square', bass: [0, _, 7, _, 0, _, 7, _, 5, _, 12, _, 7, _, 11, _], lead: [12, 16, 19, _, 16, _, 12, _, 17, 21, 24, _, 23, 19, 14, _] },
  { bpm: 108, root: 43, leadType: 'triangle', bass: [0, 0, _, 0, 3, _, 0, _, 5, 5, _, 5, 7, _, 3, _], lead: [12, _, _, 15, _, 17, _, 12, _, 19, _, 17, 15, _, 10, _] },
  { bpm: 116, root: 50, leadType: 'triangle', bass: [0, _, _, 7, _, _, 0, _, 9, _, _, 4, _, _, 7, _], lead: [19, 16, 12, 16, 19, 16, 24, _, 21, 16, 12, 16, 23, 19, 14, _] },
  { bpm: 132, root: 41, leadType: 'sawtooth', bass: [0, 0, 12, 0, 0, 0, 12, 0, 1, 1, 13, 1, 3, 3, 15, 3], lead: [12, _, 13, _, 15, _, 13, 12, _, 8, _, 12, 15, 13, 12, _] },
  { bpm: 96, root: 45, leadType: 'sine', bass: [0, _, _, _, 5, _, _, _, 3, _, _, _, 7, _, _, _], lead: [24, _, 19, _, 15, _, 19, 22, _, 17, _, 12, 15, _, 14, _] },
  { bpm: 150, root: 40, leadType: 'square', bass: [0, 0, _, 0, 0, _, 3, 0, 0, 0, _, 0, 6, 5, 3, _], lead: [12, _, 15, 12, 18, _, 17, _, 12, _, 15, 12, 20, 18, 17, 15] },
];

let musicTimer: number | null = null;
let trackIdx = -1;
let stepIdx = 0;
let nextTime = 0;

const midi = (n: number): number => 440 * Math.pow(2, (n - 69) / 12);

function scheduleMusic(): void {
  if (!ctx || !musicGain || trackIdx < 0) return;
  const tr = TRACKS[trackIdx];
  const stepDur = 60 / tr.bpm / 2;
  if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.05;
  while (nextTime < ctx.currentTime + 0.35) {
    const delay = nextTime - ctx.currentTime;
    const b = tr.bass[stepIdx % 16];
    const l = tr.lead[stepIdx % 16];
    if (b !== null) tone(midi(tr.root + b), stepDur * 0.9, 'triangle', 0.5, undefined, delay, musicGain);
    if (l !== null) tone(midi(tr.root + l + 12), stepDur * 0.8, tr.leadType, 0.22, undefined, delay, musicGain);
    if (stepIdx % 4 === 2 && noiseBuf) {
      // caja suave
      const s = ctx.createBufferSource();
      s.buffer = noiseBuf;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.12, nextTime);
      g.gain.exponentialRampToValueAtTime(0.001, nextTime + 0.06);
      s.connect(g);
      g.connect(musicGain);
      s.start(nextTime);
      s.stop(nextTime + 0.08);
    }
    stepIdx++;
    nextTime += stepDur;
  }
}

/** Reproduce la pista indicada (0 menú, 1-5 mundos, 6 jefe); -1 para parar. */
export function playMusic(track: number): void {
  if (track === trackIdx) return;
  trackIdx = track;
  stepIdx = 0;
  nextTime = 0;
  refreshMusic();
}

/** Aplica el ajuste de música (encender/apagar el secuenciador). */
export function refreshMusic(): void {
  const on = save.settings.music && trackIdx >= 0;
  if (on && musicTimer === null) {
    musicTimer = window.setInterval(() => {
      if (ctx && ctx.state === 'running' && save.settings.music) scheduleMusic();
    }, 100);
  } else if (!on && musicTimer !== null) {
    clearInterval(musicTimer);
    musicTimer = null;
  }
}
