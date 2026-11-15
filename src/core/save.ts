import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

/**
 * Guardado: localStorage en web, @capacitor/preferences en Android.
 * Se carga una vez al arrancar y se mantiene en memoria.
 */
export interface LevelRecord {
  stars: number;
  best: number;
}

export interface Settings {
  sound: boolean;
  music: boolean;
  haptics: boolean;
  shake: boolean;
}

export interface SaveData {
  /** Número de niveles desbloqueados (índice global del último jugable + 1). */
  unlocked: number;
  levels: Record<string, LevelRecord>;
  settings: Settings;
  lastSeenVersion: string | null;
  updateSnooze: { version: string; until: number } | null;
}

const KEY = 'gridbreaker.save.v1';

const defaults = (): SaveData => ({
  unlocked: 1,
  levels: {},
  settings: { sound: true, music: true, haptics: true, shake: true },
  lastSeenVersion: null,
  updateSnooze: null,
});

export const save: SaveData = defaults();

const native = Capacitor.isNativePlatform();

export async function loadSave(): Promise<void> {
  let raw: string | null = null;
  try {
    if (native) raw = (await Preferences.get({ key: KEY })).value;
    else raw = localStorage.getItem(KEY);
  } catch {
    raw = null;
  }
  if (!raw) return;
  try {
    const d = JSON.parse(raw) as Partial<SaveData>;
    const base = defaults();
    Object.assign(save, base, d, { settings: { ...base.settings, ...(d.settings ?? {}) } });
  } catch {
    /* guardado corrupto: se ignora */
  }
}

export function persist(): void {
  const raw = JSON.stringify(save);
  try {
    if (native) void Preferences.set({ key: KEY, value: raw });
    else localStorage.setItem(KEY, raw);
  } catch {
    /* sin almacenamiento disponible */
  }
}

export function resetProgress(): void {
  save.unlocked = 1;
  save.levels = {};
  persist();
}

export function totalStars(): number {
  let n = 0;
  for (const k in save.levels) n += save.levels[k].stars;
  return n;
}
