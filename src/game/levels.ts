import w1 from '../data/levels/world1.json';
import w2 from '../data/levels/world2.json';
import w3 from '../data/levels/world3.json';
import w4 from '../data/levels/world4.json';
import w5 from '../data/levels/world5.json';

/**
 * Carga de niveles desde archivos de datos (src/data/levels/worldN.json).
 * Para añadir un mundo nuevo: crea el JSON e impórtalo en la lista de abajo.
 */
export type GravityDir = 'down' | 'up' | 'left' | 'right';
export type BossId = 'worm' | 'golem' | 'queen' | 'dragon' | 'core';

export interface Theme {
  bg: string;
  bg2: string;
  cells: string[];
  hard: string[];
  accent: string;
  ambient: 'pollen' | 'dust' | 'snow' | 'ember' | 'stars';
}

export interface Modifiers {
  /** Hielo: la pala patina y la bola conserva inercia lateral. */
  slippery?: boolean;
  /** Segundos que tardan en regenerarse las celdas "R". */
  regenDelay?: number;
  /** Gravedad variable: fuerza, segundos entre cambios y direcciones del ciclo. */
  gravity?: { strength: number; period: number; dirs: GravityDir[] };
}

interface RawLevel {
  name: string;
  speed?: number;
  target?: number;
  par?: number;
  drops?: number;
  boss?: string;
  modifiers?: Modifiers;
  map: string[];
}

interface RawWorld {
  id: number;
  name: string;
  music: number;
  theme: Theme;
  modifiers?: Modifiers;
  levels: RawLevel[];
}

export interface WorldDef {
  id: number;
  name: string;
  music: number;
  theme: Theme;
  levels: LevelDef[];
}

export interface LevelDef {
  /** Índice global (0..N-1). */
  index: number;
  /** Identificador "mundo-nivel", p. ej. "3-2". Clave del guardado. */
  id: string;
  world: WorldDef;
  num: number;
  name: string;
  /** Multiplicador de velocidad de la bola. */
  speed: number;
  /** Fracción de celdas a romper para ganar (0..1). */
  target: number;
  /** Tiempo objetivo en segundos para la estrella de tiempo. */
  par: number;
  /** Probabilidad de que una celda rota suelte un power-up. */
  drops: number;
  boss: BossId | null;
  mods: Modifiers;
  map: string[];
}

const RAW = [w1, w2, w3, w4, w5] as unknown as RawWorld[];

export const WORLDS: WorldDef[] = [];
export const LEVELS: LevelDef[] = [];

for (const rw of RAW) {
  const world: WorldDef = { id: rw.id, name: rw.name, music: rw.music, theme: rw.theme, levels: [] };
  rw.levels.forEach((rl, i) => {
    const def: LevelDef = {
      index: LEVELS.length,
      id: `${rw.id}-${i + 1}`,
      world,
      num: i + 1,
      name: rl.name,
      speed: rl.speed ?? 1,
      target: rl.target ?? 0.85,
      par: rl.par ?? 120,
      drops: rl.drops ?? 0.012,
      boss: (rl.boss as BossId | undefined) ?? null,
      mods: { ...(rw.modifiers ?? {}), ...(rl.modifiers ?? {}) },
      map: rl.map,
    };
    world.levels.push(def);
    LEVELS.push(def);
  });
  WORLDS.push(world);
}
