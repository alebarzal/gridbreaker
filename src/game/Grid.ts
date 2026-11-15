import { CELL, COLS, GRID_H, GRID_Y, ROWS, W } from '../config';
import { shade } from '../core/ui';
import type { LevelDef, Theme } from './levels';

export enum Cell {
  Empty = 0,
  Normal,
  Hard,
  Metal,
  Explosive,
  Power,
  Key,
  Door,
  Regen,
  Ice,
  Shield,
}

export type Cause = 'ball' | 'laser' | 'explosion' | 'boss' | 'system';

/** Lo que la cuadrícula necesita del juego (partículas, puntos, sonido...). */
export interface GridHost {
  onCellDestroyed(type: Cell, x: number, y: number, counted: boolean, cause: Cause): void;
  onCellHit(type: Cell, x: number, y: number): void;
  onExplosion(x: number, y: number): void;
  onDoorsOpen(): void;
  /** ¿Hay alguna bola dentro de la celda? (para no regenerar encima). */
  cellBlocked(c: number, r: number): boolean;
}

const SOLID_NO_DAMAGE = new Set<Cell>([Cell.Metal, Cell.Door, Cell.Shield]);

/**
 * Cuadrícula densa de celdas. Guarda el estado en arrays tipados y se pinta en
 * un canvas fuera de pantalla que solo se actualiza en las celdas modificadas.
 */
export class Grid {
  type = new Uint8Array(COLS * ROWS);
  hp = new Uint8Array(COLS * ROWS);
  private tint = new Uint8Array(COLS * ROWS);
  private counted = new Uint8Array(COLS * ROWS);
  private regenAs = new Uint8Array(COLS * ROWS);
  private regen: { i: number; t: number }[] = [];
  private explosions: { c: number; r: number; t: number }[] = [];
  private dirty: number[] = [];
  private canvas: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private theme!: Theme;
  total = 0;
  destroyed = 0;
  keysLeft = 0;
  hasDoors = false;
  regenDelay = 6;

  constructor(private host: GridHost) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = GRID_H;
    this.g = this.canvas.getContext('2d')!;
  }

  get pct(): number {
    return this.total ? this.destroyed / this.total : 1;
  }

  /** Construye la cuadrícula a partir del mapa ASCII del nivel. */
  load(def: LevelDef): void {
    this.theme = def.world.theme;
    this.regenDelay = def.mods.regenDelay ?? 6;
    this.type.fill(0);
    this.hp.fill(0);
    this.counted.fill(0);
    this.regenAs.fill(0);
    this.regen.length = 0;
    this.explosions.length = 0;
    this.total = 0;
    this.destroyed = 0;
    this.keysLeft = 0;
    this.hasDoors = false;
    for (let i = 0; i < this.tint.length; i++) this.tint[i] = (Math.random() * 251) | 0;

    const maxLen = def.map.reduce((m, row) => Math.max(m, row.length), 1);
    const scale = Math.max(1, Math.floor(COLS / maxLen));
    const offC = Math.floor((COLS - maxLen * scale) / 2);
    def.map.forEach((row, mr) => {
      for (let mc = 0; mc < row.length; mc++) {
        const ch = row[mc];
        let t = Cell.Empty;
        let hp = 1;
        switch (ch) {
          case '#': t = Cell.Normal; break;
          case '2': t = Cell.Hard; hp = 2; break;
          case '3': t = Cell.Hard; hp = 3; break;
          case 'I': t = Cell.Ice; hp = 2; break;
          case 'M': t = Cell.Metal; break;
          case 'X': t = Cell.Explosive; break;
          case 'P': t = Cell.Power; break;
          case 'K': t = Cell.Key; break;
          case 'D': t = Cell.Door; break;
          case 'R': t = Cell.Regen; break;
          default: t = Cell.Empty;
        }
        if (t === Cell.Empty) continue;
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const c = offC + mc * scale + dx;
            const r = mr * scale + dy;
            if (c < 0 || c >= COLS || r >= ROWS) continue;
            // Un solo power-up garantizado por bloque del mapa.
            const tt = t === Cell.Power && (dx || dy) ? Cell.Normal : t;
            this.put(c, r, tt, hp, true);
          }
        }
      }
    });
    this.redrawAll();
  }

  private put(c: number, r: number, t: Cell, hp: number, count: boolean): void {
    const i = r * COLS + c;
    this.type[i] = t;
    this.hp[i] = hp;
    const destructible = !SOLID_NO_DAMAGE.has(t) && t !== Cell.Empty;
    if (count && destructible) {
      this.counted[i] = 1;
      this.total++;
    }
    if (t === Cell.Key) this.keysLeft++;
    if (t === Cell.Door) this.hasDoors = true;
  }

  inBounds(c: number, r: number): boolean {
    return c >= 0 && c < COLS && r >= 0 && r < ROWS;
  }

  get(c: number, r: number): Cell {
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return Cell.Empty;
    return this.type[r * COLS + c];
  }

  solid(c: number, r: number): boolean {
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return false;
    return this.type[r * COLS + c] !== Cell.Empty;
  }

  /**
   * Golpea una celda. Devuelve true si el proyectil debe rebotar.
   * Con `fire`, las celdas destructibles se rompen sin provocar rebote.
   */
  hit(c: number, r: number, fire: boolean, cause: Cause): boolean {
    const i = r * COLS + c;
    const t = this.type[i] as Cell;
    if (t === Cell.Empty) return false;
    const x = c * CELL + CELL / 2;
    const y = GRID_Y + r * CELL + CELL / 2;
    if (SOLID_NO_DAMAGE.has(t)) {
      this.host.onCellHit(t, x, y);
      return true;
    }
    if ((t === Cell.Hard || t === Cell.Ice) && !fire && this.hp[i] > 1) {
      this.hp[i]--;
      this.dirty.push(i);
      this.host.onCellHit(t, x, y);
      return true;
    }
    this.destroy(i, cause);
    return !fire;
  }

  /** Rompe la celda i (si es destructible). */
  destroy(i: number, cause: Cause): void {
    const t = this.type[i] as Cell;
    if (t === Cell.Empty || t === Cell.Metal) return;
    const c = i % COLS;
    const r = (i / COLS) | 0;
    this.type[i] = Cell.Empty;
    this.hp[i] = 0;
    this.dirty.push(i);
    const counted = this.counted[i] === 1;
    if (counted) this.destroyed++;
    if (t === Cell.Regen && cause !== 'system') {
      this.regenAs[i] = Cell.Regen;
      this.regen.push({ i, t: this.regenDelay });
    }
    if (t === Cell.Explosive) this.explosions.push({ c, r, t: cause === 'explosion' ? 0.07 : 0 });
    this.host.onCellDestroyed(t, c * CELL + CELL / 2, GRID_Y + r * CELL + CELL / 2, counted, cause);
    if (t === Cell.Key) {
      this.keysLeft--;
      // Una llave ocupa un bloque: al romper una celda cae el bloque entero
      for (const n of [i - 1, i + 1, i - COLS, i + COLS]) {
        if (n >= 0 && n < this.type.length && this.type[n] === Cell.Key) this.destroy(n, cause);
      }
      if (this.keysLeft <= 0 && this.hasDoors) this.openDoors();
    }
  }

  private openDoors(): void {
    for (let i = 0; i < this.type.length; i++) {
      if (this.type[i] === Cell.Door) this.destroy(i, 'system');
    }
    this.hasDoors = false;
    this.host.onDoorsOpen();
  }

  /** Coloca una celda dinámica (jefes). No cuenta para el % de destrucción. */
  place(c: number, r: number, t: Cell, hp = 1): boolean {
    if (!this.inBounds(c, r)) return false;
    const i = r * COLS + c;
    if (this.type[i] !== Cell.Empty && t !== Cell.Regen) return false;
    if (this.type[i] === Cell.Metal || this.type[i] === Cell.Shield || this.type[i] === Cell.Door) return false;
    if (this.type[i] === Cell.Empty && this.host.cellBlocked(c, r)) return false;
    // Si era una celda contada ya rota, vuelve a estar "sin romper".
    if (this.counted[i] && this.type[i] === Cell.Empty) this.destroyed--;
    this.type[i] = t;
    this.hp[i] = hp;
    this.dirty.push(i);
    return true;
  }

  /** Programa que una celda vacía renazca como lava regenerable. */
  ember(c: number, r: number, delay: number): void {
    if (!this.inBounds(c, r)) return;
    const i = r * COLS + c;
    if (this.type[i] !== Cell.Empty) return;
    if (this.regen.length > 400) return;
    this.regenAs[i] = Cell.Regen;
    this.regen.push({ i, t: delay });
  }

  /** Elimina una celda sin efectos de juego (excavación de jefes, escudos). */
  clear(c: number, r: number, cause: Cause = 'boss'): void {
    if (!this.inBounds(c, r)) return;
    const i = r * COLS + c;
    const t = this.type[i] as Cell;
    if (t === Cell.Empty) return;
    if (t === Cell.Shield || t === Cell.Metal) {
      this.type[i] = Cell.Empty;
      this.dirty.push(i);
      this.host.onCellDestroyed(t, c * CELL + CELL / 2, GRID_Y + r * CELL + CELL / 2, false, cause);
      return;
    }
    this.destroy(i, cause);
  }

  update(dt: number): void {
    // Explosiones en cadena (radio 2)
    for (let n = this.explosions.length - 1; n >= 0; n--) {
      const e = this.explosions[n];
      e.t -= dt;
      if (e.t > 0) continue;
      this.explosions.splice(n, 1);
      this.host.onExplosion(e.c * CELL + CELL / 2, GRID_Y + e.r * CELL + CELL / 2);
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          if (dc * dc + dr * dr > 5) continue;
          const c = e.c + dc;
          const r = e.r + dr;
          if (!this.inBounds(c, r)) continue;
          const i = r * COLS + c;
          const t = this.type[i];
          if (t === Cell.Empty || SOLID_NO_DAMAGE.has(t)) continue;
          this.destroy(i, 'explosion');
        }
      }
    }
    // Regeneración
    for (let n = this.regen.length - 1; n >= 0; n--) {
      const g = this.regen[n];
      g.t -= dt;
      if (g.t > 0) continue;
      const c = g.i % COLS;
      const r = (g.i / COLS) | 0;
      if (this.type[g.i] !== Cell.Empty) {
        this.regen.splice(n, 1);
        continue;
      }
      if (this.host.cellBlocked(c, r)) {
        g.t = 0.4;
        continue;
      }
      this.regen.splice(n, 1);
      this.type[g.i] = this.regenAs[g.i];
      this.hp[g.i] = 1;
      if (this.counted[g.i]) this.destroyed--;
      this.dirty.push(g.i);
    }
  }

  // ----------------------------------------------------------- dibujo ---
  private redrawAll(): void {
    this.g.clearRect(0, 0, W, GRID_H);
    for (let i = 0; i < this.type.length; i++) if (this.type[i]) this.paint(i);
    this.dirty.length = 0;
  }

  private paint(i: number): void {
    const g = this.g;
    const x = (i % COLS) * CELL;
    const y = ((i / COLS) | 0) * CELL;
    const t = this.type[i] as Cell;
    g.clearRect(x, y, CELL, CELL);
    if (t === Cell.Empty) return;
    const th = this.theme;
    const n = this.tint[i];
    let base: string;
    switch (t) {
      case Cell.Normal:
      case Cell.Power:
        base = th.cells[n % th.cells.length];
        break;
      case Cell.Hard:
        base = th.hard[Math.min(th.hard.length, this.hp[i]) - 1];
        break;
      case Cell.Ice:
        base = this.hp[i] > 1 ? '#d6f3ff' : '#8fd0f5';
        break;
      case Cell.Metal:
        base = n % 2 ? '#8a93a6' : '#7c8598';
        break;
      case Cell.Explosive:
        base = '#ff4d3d';
        break;
      case Cell.Key:
        base = '#ffd23f';
        break;
      case Cell.Door:
        base = '#4a5568';
        break;
      case Cell.Regen:
        base = n % 2 ? '#ff7a1a' : '#ff9a2e';
        break;
      case Cell.Shield:
        base = n % 2 ? '#7d6bd8' : '#6b5bc4';
        break;
      default:
        base = '#fff';
    }
    g.fillStyle = shade(base, -0.35);
    g.fillRect(x, y, CELL, CELL);
    g.fillStyle = base;
    g.fillRect(x, y, CELL - 1, CELL - 1);
    g.fillStyle = shade(base, 0.3);
    g.fillRect(x, y, CELL - 1, 1);
    // Detalles por tipo
    if (t === Cell.Hard) {
      g.fillStyle = shade(base, -0.3);
      if (this.hp[i] >= 2) g.fillRect(x + 2, y + 2, 1, 1);
      if (this.hp[i] >= 3) g.fillRect(x + 3, y + 3, 1, 1);
      if (this.hp[i] === 1) {
        g.fillRect(x + 1, y + 3, 2, 1);
        g.fillRect(x + 3, y + 2, 1, 2);
      }
    } else if (t === Cell.Ice) {
      g.fillStyle = '#ffffff';
      g.fillRect(x + 1, y + 1, 2, 1);
      if (this.hp[i] === 1) {
        g.fillStyle = '#4c8ad6';
        g.fillRect(x + 2, y + 2, 1, 3);
      }
    } else if (t === Cell.Metal) {
      g.fillStyle = '#c9d0de';
      g.fillRect(x + 1, y + 1, 1, 1);
      g.fillStyle = '#525a6b';
      g.fillRect(x + 3, y + 3, 1, 1);
    } else if (t === Cell.Explosive) {
      g.fillStyle = '#ffe14d';
      g.fillRect(x + 2, y + 1, 1, 3);
      g.fillRect(x + 1, y + 2, 3, 1);
    } else if (t === Cell.Power) {
      g.fillStyle = '#ffffff';
      g.fillRect(x + 2, y + 1, 1, 3);
      g.fillRect(x + 1, y + 2, 3, 1);
    } else if (t === Cell.Key) {
      g.fillStyle = '#7a5200';
      g.fillRect(x + 1, y + 2, 3, 1);
      g.fillRect(x + 1, y + 1, 1, 3);
    } else if (t === Cell.Door) {
      g.fillStyle = '#ffd23f';
      g.fillRect(x + 2, y + 2, 1, 1);
      g.fillStyle = '#2d3544';
      g.fillRect(x, y + 4, CELL - 1, 1);
    } else if (t === Cell.Regen) {
      g.fillStyle = '#ffe07a';
      g.fillRect(x + 1 + (n % 3), y + 1 + (n % 2), 1, 1);
      g.fillStyle = '#c73a0a';
      g.fillRect(x + 3 - (n % 2), y + 3, 1, 1);
    } else if (t === Cell.Shield) {
      g.fillStyle = '#c9c0ff';
      g.fillRect(x + 1, y + 1, 1, 1);
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (this.dirty.length) {
      for (const i of this.dirty) this.paint(i);
      this.dirty.length = 0;
    }
    ctx.drawImage(this.canvas, 0, GRID_Y);
  }
}
