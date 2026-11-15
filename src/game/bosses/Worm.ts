import { CELL, GRID_BOTTOM, GRID_Y, W } from '../../config';
import { Cell } from '../Grid';
import type { GameScene } from '../../scenes/GameScene';
import { Boss } from './Boss';

const SEGS = 13;
const SPACING = 7;

/**
 * Jefe 1 — Gusano de Tierra.
 * Excava túneles por la cuadrícula y la cola va rellenando tierra a su paso.
 * Solo la cabeza recibe daño; el cuerpo hace rebotar las bolas.
 */
export class Worm extends Boss {
  name = 'GUSANO DE TIERRA';
  private segs: { x: number; y: number }[] = [];
  private angle = 0;
  private tx = 0;
  private ty = 0;
  private retarget = 0;
  private atk = 4;
  private regenT = 0;
  private speed = 30;
  private peek = false;

  constructor(g: GameScene) {
    super(g, 12);
    for (let i = 0; i < SEGS; i++) this.segs.push({ x: W / 2 - i * SPACING, y: GRID_Y + 90 });
    this.boxes = this.segs.map((_, i) => ({ x: 0, y: 0, w: i ? 8 : 14, h: i ? 8 : 14, weak: i === 0 }));
    this.pickTarget();
  }

  private pickTarget(): void {
    // Al asomar recorre el fondo de lado a lado
    this.tx = this.peek ? 16 + Math.random() * (W - 32) : this.segs[0].x < W / 2 ? W - 24 : 24;
    // Alterna entre excavar en la tierra y asomar por debajo (donde es vulnerable)
    this.peek = !this.peek;
    this.ty = this.peek ? GRID_BOTTOM - 62 + Math.random() * 14 : GRID_Y + 14 + Math.random() * 150;
    this.retarget = 7;
  }

  protected onDamage(): void {
    this.pickTarget();
    if (this.phase === 1 && this.hp <= this.maxHp / 2) {
      this.phase = 2;
      this.speed = 46;
      this.g.banner('¡EL GUSANO SE ENFURECE!', '#ffb36b');
    }
  }

  protected tick(dt: number): void {
    const head = this.segs[0];
    // Dirección: gira suavemente hacia el objetivo
    const want = Math.atan2(this.ty - head.y, this.tx - head.x);
    let diff = want - this.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const turn = 2.4 * dt;
    this.angle += Math.max(-turn, Math.min(turn, diff));
    const boost = this.flash > 0 ? 2 : 1;
    head.x += Math.cos(this.angle) * this.speed * boost * dt;
    head.y += Math.sin(this.angle) * this.speed * boost * dt;
    head.x = Math.max(8, Math.min(W - 8, head.x));
    head.y = Math.max(GRID_Y + 8, Math.min(GRID_BOTTOM - 44, head.y));
    this.retarget -= dt;
    if (this.retarget <= 0 || Math.hypot(this.tx - head.x, this.ty - head.y) < 12) this.pickTarget();

    // El cuerpo sigue a la cabeza como una cadena
    for (let i = 1; i < SEGS; i++) {
      const p = this.segs[i - 1];
      const s = this.segs[i];
      const dx = p.x - s.x;
      const dy = p.y - s.y;
      const d = Math.hypot(dx, dy);
      if (d > SPACING) {
        s.x += (dx / d) * (d - SPACING);
        s.y += (dy / d) * (d - SPACING);
      }
    }
    this.x = head.x;
    this.y = head.y;

    // Excava delante de la cabeza
    const grid = this.g.grid;
    const hc = Math.floor(head.x / CELL);
    const hr = Math.floor((head.y - GRID_Y) / CELL);
    for (let r = hr - 1; r <= hr + 1; r++) {
      for (let c = hc - 1; c <= hc + 1; c++) if (grid.solid(c, r)) grid.clear(c, r, 'boss');
    }
    // La cola regenera tierra
    this.regenT -= dt;
    if (this.regenT <= 0) {
      this.regenT = 0.12;
      const tail = this.segs[SEGS - 1];
      const tc = Math.floor(tail.x / CELL);
      const tr = Math.floor((tail.y - GRID_Y) / CELL);
      for (let r = tr - 1; r <= tr + 1; r++) {
        for (let c = tc - 1; c <= tc + 1; c++) {
          if (this.overBody(c, r)) continue;
          grid.place(c, r, Cell.Normal);
        }
      }
    }

    for (let i = 0; i < SEGS; i++) {
      const b = this.boxes[i];
      b.x = this.segs[i].x - b.w / 2;
      b.y = this.segs[i].y - b.h / 2;
    }

    // Ataque: escupe terrones hacia la pala
    this.atk -= dt;
    if (this.atk <= 0 && !this.busy) {
      this.atk = this.phase === 2 ? 3 : 4.5;
      this.throwAt('clod', () => ({ x: this.segs[0].x, y: this.segs[0].y }), this.phase === 2 ? 4 : 2, 120, 30);
    }
  }

  private overBody(c: number, r: number): boolean {
    const x = c * CELL + CELL / 2;
    const y = GRID_Y + r * CELL + CELL / 2;
    for (let i = 0; i < SEGS - 1; i++) {
      if (Math.abs(this.segs[i].x - x) < 8 && Math.abs(this.segs[i].y - y) < 8) return true;
    }
    return false;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (let i = SEGS - 1; i >= 0; i--) {
      const s = this.segs[i];
      const x = Math.round(s.x);
      const y = Math.round(s.y + (this.dead ? Math.sin(this.t * 30 + i) * 2 : 0));
      if (i === 0) {
        ctx.fillStyle = this.col('#7a2e3b');
        ctx.fillRect(x - 6, y - 6, 12, 12);
        ctx.fillStyle = this.col('#e0607a');
        ctx.fillRect(x - 5, y - 5, 10, 10);
        ctx.fillStyle = this.col('#ff9db0');
        ctx.fillRect(x - 4, y - 5, 6, 2);
        // Ojos y boca orientados
        const ex = Math.round(Math.cos(this.angle) * 2);
        const ey = Math.round(Math.sin(this.angle) * 2);
        ctx.fillStyle = '#fff';
        ctx.fillRect(x - 3 + ex, y - 3 + ey, 2, 2);
        ctx.fillRect(x + 1 + ex, y - 3 + ey, 2, 2);
        ctx.fillStyle = '#20060c';
        ctx.fillRect(x - 2 + ex, y + 1 + ey, 4, 2);
        if (this.busy && Math.floor(this.t * 12) % 2) {
          ctx.fillStyle = '#ffe14d';
          ctx.fillRect(x - 6, y - 8, 12, 1);
        }
      } else {
        const dark = i % 2 === 0;
        ctx.fillStyle = this.col('#5a2230');
        ctx.fillRect(x - 4, y - 4, 9, 9);
        ctx.fillStyle = this.col(dark ? '#b84a62' : '#cf5873');
        ctx.fillRect(x - 4, y - 4, 8, 8);
        ctx.fillStyle = this.col('#e88aa0');
        ctx.fillRect(x - 3, y - 4, 4, 1);
      }
    }
  }
}
