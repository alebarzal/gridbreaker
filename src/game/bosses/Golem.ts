import { CELL, GRID_Y } from '../../config';
import { sfx } from '../../core/audio';
import { haptic } from '../../core/platform';
import { Cell } from '../Grid';
import type { GameScene } from '../../scenes/GameScene';
import { Boss } from './Boss';

// Geometría en celdas
const BODY = { c0: 17, c1: 22, r0: 8, r1: 13 };
const RING = { c0: 15, c1: 24, r0: 6, r1: 15 };
const CRYSTALS = [
  { c: 11, r: 3 },
  { c: 28, r: 3 },
  { c: 11, r: 18 },
  { c: 28, r: 18 },
];

/**
 * Jefe 2 — Gólem de Roca.
 * Un anillo de metal lo protege; solo cae al destruir los 4 cristales de las
 * esquinas. Lanza rocas que paralizan la pala 1 s.
 */
export class Golem extends Boss {
  name = 'GÓLEM DE ROCA';
  private crystals = CRYSTALS.map((p) => ({ x: p.c * CELL + 3, y: GRID_Y + p.r * CELL + 3, hp: 3, flash: 0 }));
  private open = 0;
  private atk = 3;
  private arm = 0;

  constructor(g: GameScene) {
    super(g, 16);
    this.x = ((BODY.c0 + BODY.c1 + 1) / 2) * CELL;
    this.y = GRID_Y + ((BODY.r0 + BODY.r1 + 1) / 2) * CELL;
    // Caja 0 = cuerpo; 1..4 = cristales
    this.boxes = [
      { x: BODY.c0 * CELL, y: GRID_Y + BODY.r0 * CELL, w: (BODY.c1 - BODY.c0 + 1) * CELL, h: (BODY.r1 - BODY.r0 + 1) * CELL, weak: false },
      ...this.crystals.map((c) => ({ x: c.x - 5, y: c.y - 5, w: 10, h: 10, weak: false })),
    ];
    this.buildShield();
  }

  private buildShield(): void {
    const grid = this.g.grid;
    for (let r = RING.r0; r <= RING.r1; r++) {
      for (let c = RING.c0; c <= RING.c1; c++) {
        const inside = c >= BODY.c0 && c <= BODY.c1 && r >= BODY.r0 && r <= BODY.r1;
        if (inside) continue;
        if (grid.solid(c, r)) grid.clear(c, r, 'system');
        grid.place(c, r, Cell.Shield);
      }
    }
  }

  private dropShield(): void {
    const grid = this.g.grid;
    for (let r = RING.r0; r <= RING.r1; r++) {
      for (let c = RING.c0; c <= RING.c1; c++) if (grid.get(c, r) === Cell.Shield) grid.clear(c, r, 'system');
    }
    this.open = 9;
    this.boxes[0].weak = true;
    this.g.banner('¡ESCUDO ROTO!', '#ffd166');
    this.g.shake(5);
    sfx('explode');
  }

  /** El juego llama aquí cuando una bola toca una caja que no es punto débil. */
  onArmorHit(index: number, x: number, y: number): void {
    if (index === 0 || this.open > 0) return;
    const c = this.crystals[index - 1];
    if (c.hp <= 0) return;
    c.hp--;
    c.flash = 0.12;
    this.g.particles.burst(x, y, 6, '#7df9ff', 60, 0.35);
    sfx('hard');
    haptic('light');
    if (c.hp <= 0) {
      this.g.particles.burst(c.x, c.y, 18, '#7df9ff', 90, 0.6, 2);
      this.g.addScore(250, c.x, c.y, true);
      sfx('explode');
      this.boxes[index].w = 0; // desactiva la caja
      if (this.crystals.every((k) => k.hp <= 0)) this.dropShield();
    }
  }

  protected tick(dt: number): void {
    for (const c of this.crystals) c.flash = Math.max(0, c.flash - dt);
    this.arm = Math.max(0, this.arm - dt);
    if (this.open > 0) {
      this.open -= dt;
      if (this.open <= 0) {
        // Se recompone: escudo y cristales de nuevo
        this.boxes[0].weak = false;
        this.buildShield();
        this.crystals.forEach((c, i) => {
          c.hp = 3;
          this.boxes[i + 1].w = 10;
          this.g.particles.burst(c.x, c.y, 8, '#7df9ff', 40, 0.4);
        });
        this.g.banner('EL GÓLEM SE RECOMPONE', '#b9c0e0');
        sfx('hard');
      }
      return; // aturdido: no ataca
    }
    this.atk -= dt;
    if (this.atk <= 0 && !this.busy) {
      const enraged = this.hp <= this.maxHp / 2;
      this.atk = enraged ? 2.6 : 3.6;
      this.arm = 0.9;
      this.throwAt('rock', () => ({ x: this.x + 22, y: this.y - 14 }), enraged ? 2 : 1, 150, 44, 0.9);
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const x = BODY.c0 * CELL;
    const y = GRID_Y + BODY.r0 * CELL;
    const stunned = this.open > 0;
    const wob = this.dead ? Math.round(Math.sin(this.t * 40) * 2) : 0;
    // Cuerpo
    ctx.fillStyle = this.col('#3b2a1c');
    ctx.fillRect(x + wob, y, 36, 36);
    ctx.fillStyle = this.col('#8b6a4a');
    ctx.fillRect(x + 1 + wob, y + 1, 34, 33);
    ctx.fillStyle = this.col('#a9865f');
    ctx.fillRect(x + 1 + wob, y + 1, 34, 3);
    ctx.fillStyle = this.col('#6e5237');
    ctx.fillRect(x + 4 + wob, y + 24, 8, 6);
    ctx.fillRect(x + 22 + wob, y + 6, 9, 4);
    // Ojos
    ctx.fillStyle = stunned ? '#ffe14d' : '#ff5a2a';
    if (stunned) {
      const o = Math.floor(this.t * 8) % 2;
      ctx.fillRect(x + 8 + o + wob, y + 12, 5, 2);
      ctx.fillRect(x + 23 - o + wob, y + 12, 5, 2);
    } else {
      ctx.fillRect(x + 8 + wob, y + 11, 5, 4);
      ctx.fillRect(x + 23 + wob, y + 11, 5, 4);
    }
    ctx.fillStyle = '#20140a';
    ctx.fillRect(x + 11 + wob, y + 22, 14, 3);
    // Brazo levantado al telegrafiar
    if (this.arm > 0) {
      ctx.fillStyle = this.col('#8b6a4a');
      ctx.fillRect(x + 36, y - 6, 6, 16);
      ctx.fillStyle = '#9a7b5c';
      ctx.fillRect(x + 35, y - 14, 8, 8);
    }
    if (stunned) {
      // Cuenta atrás del escudo
      const k = this.open / 9;
      ctx.fillStyle = '#20140a';
      ctx.fillRect(x, y - 5, 36, 3);
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(x, y - 5, Math.round(36 * k), 3);
    }
    // Cristales
    for (const c of this.crystals) {
      if (c.hp <= 0) continue;
      const cx = Math.round(c.x);
      const cy = Math.round(c.y + Math.sin(this.t * 3 + c.x) * 1.5);
      const col = c.flash > 0 ? '#ffffff' : c.hp === 3 ? '#7df9ff' : c.hp === 2 ? '#4fc3d9' : '#2f8aa0';
      ctx.fillStyle = '#0b3a47';
      ctx.fillRect(cx - 3, cy - 5, 7, 11);
      ctx.fillRect(cx - 5, cy - 3, 11, 7);
      ctx.fillStyle = col;
      ctx.fillRect(cx - 2, cy - 4, 4, 8);
      ctx.fillRect(cx - 4, cy - 2, 8, 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - 1, cy - 3, 1, 2);
    }
  }
}
