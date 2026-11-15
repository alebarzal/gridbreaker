import { CELL, COLS, GRID_Y, ROWS, W } from '../../config';
import { sfx } from '../../core/audio';
import { haptic } from '../../core/platform';
import { Cell } from '../Grid';
import type { GameScene } from '../../scenes/GameScene';
import type { ProjectileKind } from '../Projectile';

export interface Hitbox {
  x: number;
  y: number;
  w: number;
  h: number;
  /** true = punto débil (recibe daño); false = armadura (solo rebota). */
  weak: boolean;
}

/** Ataque telegrafiado: se dibuja un aviso durante `dur` y luego se ejecuta. */
interface Telegraph {
  t: number;
  dur: number;
  draw: (ctx: CanvasRenderingContext2D, k: number) => void;
  fire: () => void;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Base de todos los jefes: vida, flash de daño, telegrafiado de ataques,
 * muerte y una pequeña biblioteca de ataques reutilizables.
 */
export abstract class Boss {
  abstract name: string;
  maxHp: number;
  boxes: Hitbox[] = [];
  flash = 0;
  invuln = 0;
  dead = false;
  deathT = 0;
  /** true cuando ha terminado la animación de muerte. */
  done = false;
  phase = 1;
  t = 0;
  x = W / 2;
  y = GRID_Y + 60;
  private tele: Telegraph[] = [];

  constructor(
    protected g: GameScene,
    public hp: number,
  ) {
    this.maxHp = hp;
  }

  update(dt: number): void {
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    if (this.dead) {
      this.deathT += dt;
      if (Math.random() < dt * 14) {
        const px = this.x + (Math.random() - 0.5) * 40;
        const py = this.y + (Math.random() - 0.5) * 36;
        this.g.particles.burst(px, py, 10, Math.random() < 0.5 ? '#fff' : this.g.theme.accent, 80, 0.5, 2);
        this.g.shake(2);
        sfx('explode');
      }
      if (this.deathT > 1.8) this.done = true;
      return;
    }
    for (let i = this.tele.length - 1; i >= 0; i--) {
      const tl = this.tele[i];
      tl.t += dt;
      if (tl.t >= tl.dur) {
        this.tele.splice(i, 1);
        tl.fire();
      }
    }
    this.tick(dt);
  }

  protected abstract tick(dt: number): void;
  abstract draw(ctx: CanvasRenderingContext2D): void;

  drawTelegraphs(ctx: CanvasRenderingContext2D): void {
    for (const tl of this.tele) tl.draw(ctx, tl.t / tl.dur);
  }

  /** Aplica daño. Devuelve true si el golpe contó. */
  damage(n: number, x: number, y: number): boolean {
    if (this.dead || this.invuln > 0) return false;
    this.hp -= n;
    this.flash = 0.14;
    this.invuln = 0.3;
    this.g.shake(3.5);
    this.g.particles.burst(x, y, 10, '#ffffff', 70, 0.35, 2);
    this.g.addScore(100, x, y, true);
    sfx('bossHit');
    haptic('medium');
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.tele.length = 0;
      this.boxes.length = 0;
      this.g.clearEnemyProjectiles();
      this.onDeath();
    } else this.onDamage();
    return true;
  }

  /** Una bola o láser ha tocado una caja de armadura (índice en boxes). */
  onArmorHit(_index: number, _x: number, _y: number): void {}

  protected onDamage(): void {}
  protected onDeath(): void {}

  protected telegraph(dur: number, draw: Telegraph['draw'], fire: () => void): void {
    this.tele.push({ t: 0, dur, draw, fire });
    sfx('warn');
  }

  protected get busy(): boolean {
    return this.tele.length > 0;
  }

  /** Color del sprite teniendo en cuenta el flash blanco de daño. */
  protected col(c: string): string {
    return this.flash > 0 ? '#ffffff' : c;
  }

  // ------------------------------------------------- ataques compartidos ---

  /** Proyectiles apuntados a la pala con una dispersión (rocas, terrones, carámbanos). */
  protected throwAt(kind: ProjectileKind, origin: () => Point, count: number, speed: number, spreadPx = 26, dur = 0.85): void {
    const targets: number[] = [];
    const px = this.g.paddle.x;
    for (let i = 0; i < count; i++) {
      const off = count === 1 ? 0 : (i - (count - 1) / 2) * spreadPx;
      targets.push(Math.max(8, Math.min(W - 8, px + off)));
    }
    const ty = this.g.paddle.y;
    this.telegraph(
      dur,
      (ctx, k) => {
        const o = origin();
        const blink = Math.floor(k * 12) % 2 === 0;
        for (const tx of targets) {
          ctx.fillStyle = blink ? '#ff3b3b' : '#ffd0d0';
          // Marca en X sobre la línea de la pala
          for (let d = -3; d <= 3; d++) {
            ctx.fillRect(Math.round(tx + d), Math.round(ty - 6 + d), 1, 1);
            ctx.fillRect(Math.round(tx + d), Math.round(ty - 6 - d), 1, 1);
          }
          // Trayectoria punteada
          ctx.fillStyle = 'rgba(255,80,80,0.55)';
          for (let s = 0.1; s < k; s += 0.08) {
            ctx.fillRect(Math.round(o.x + (tx - o.x) * s), Math.round(o.y + (ty - o.y) * s), 1, 1);
          }
        }
      },
      () => {
        const o = origin();
        for (const tx of targets) {
          const dx = tx - o.x;
          const dy = ty - o.y;
          const l = Math.hypot(dx, dy) || 1;
          this.g.spawnProjectile(kind, o.x, o.y, (dx / l) * speed, (dy / l) * speed);
        }
        sfx('launch');
      },
    );
  }

  /** Abanico de bolas de fuego hacia la pala. */
  protected fireFan(origin: () => Point, count: number, spread: number, speed: number, dur = 0.9): void {
    let aim = 0;
    const o0 = origin();
    aim = Math.atan2(this.g.paddle.y - o0.y, this.g.paddle.x - o0.x);
    this.telegraph(
      dur,
      (ctx, k) => {
        const o = origin();
        // Resplandor creciente en la boca + líneas del abanico
        const r = 2 + k * 5;
        ctx.fillStyle = Math.floor(k * 14) % 2 ? '#ffb11f' : '#ff3b1f';
        ctx.fillRect(Math.round(o.x - r), Math.round(o.y - r), Math.round(r * 2), Math.round(r * 2));
        ctx.fillStyle = `rgba(255,120,40,${0.25 + k * 0.45})`;
        for (let i = 0; i < count; i++) {
          const a = aim + (count === 1 ? 0 : (i / (count - 1) - 0.5) * spread);
          for (let d = 12; d < 12 + k * 150; d += 7) {
            ctx.fillRect(Math.round(o.x + Math.cos(a) * d), Math.round(o.y + Math.sin(a) * d), 1, 1);
          }
        }
      },
      () => {
        const o = origin();
        for (let i = 0; i < count; i++) {
          const a = aim + (count === 1 ? 0 : (i / (count - 1) - 0.5) * spread);
          this.g.spawnProjectile('fire', o.x, o.y, Math.cos(a) * speed, Math.sin(a) * speed);
        }
        sfx('explode');
        this.g.shake(2);
      },
    );
  }

  /** Rayo que congela temporalmente las bolas apuntadas. */
  protected freezeBeam(origin: () => Point, nTargets: number, freezeFor = 1.6, dur = 0.8): void {
    const pool = this.g.balls.filter((b) => b.alive && !b.stuck && b.frozen <= 0);
    if (!pool.length) return;
    const targets = pool.sort(() => Math.random() - 0.5).slice(0, nTargets);
    this.telegraph(
      dur,
      (ctx, k) => {
        const o = origin();
        ctx.fillStyle = Math.floor(k * 14) % 2 ? '#e8f7ff' : '#5ac8ff';
        for (const b of targets) {
          if (!b.alive) continue;
          const dx = b.x - o.x;
          const dy = b.y - o.y;
          const l = Math.hypot(dx, dy) || 1;
          for (let d = 0; d < l; d += 5) ctx.fillRect(Math.round(o.x + (dx / l) * d), Math.round(o.y + (dy / l) * d), 1, 1);
          // Retícula sobre la bola
          ctx.fillRect(Math.round(b.x - 5), Math.round(b.y - 5), 3, 1);
          ctx.fillRect(Math.round(b.x + 3), Math.round(b.y - 5), 3, 1);
          ctx.fillRect(Math.round(b.x - 5), Math.round(b.y + 5), 3, 1);
          ctx.fillRect(Math.round(b.x + 3), Math.round(b.y + 5), 3, 1);
        }
      },
      () => {
        const o = origin();
        let any = false;
        for (const tb of targets) {
          if (!tb.alive) continue;
          any = true;
          const dx = tb.x - o.x;
          const dy = tb.y - o.y;
          const l = Math.hypot(dx, dy) || 1;
          const ux = dx / l;
          const uy = dy / l;
          this.g.addBeam(o.x, o.y, o.x + ux * (l + 30), o.y + uy * (l + 30), '#bfeaff');
          for (const b of this.g.balls) {
            if (!b.alive || b.stuck) continue;
            const rx = b.x - o.x;
            const ry = b.y - o.y;
            const along = rx * ux + ry * uy;
            if (along < 0 || along > l + 30) continue;
            const perp = Math.abs(rx * uy - ry * ux);
            if (perp < 7) {
              b.frozen = freezeFor;
              this.g.particles.burst(b.x, b.y, 6, '#bfeaff', 40, 0.4);
            }
          }
        }
        if (any) sfx('freeze');
      },
    );
  }

  /** Muro de hielo: franja de celdas duras que aparece tras un aviso. */
  protected iceWall(c0: number, r0: number, cols: number, rows: number, dur = 1.0): void {
    this.telegraph(
      dur,
      (ctx, k) => {
        if (Math.floor(k * 10) % 2) return;
        ctx.strokeStyle = '#bfeaff';
        ctx.lineWidth = 1;
        ctx.strokeRect(c0 * CELL + 0.5, GRID_Y + r0 * CELL + 0.5, cols * CELL - 1, rows * CELL - 1);
      },
      () => {
        for (let r = r0; r < r0 + rows; r++) {
          for (let c = c0; c < c0 + cols; c++) this.g.grid.place(c, r, Cell.Ice, 2);
        }
        this.g.particles.burst((c0 + cols / 2) * CELL, GRID_Y + (r0 + rows / 2) * CELL, 14, '#e8f7ff', 60, 0.5);
        sfx('freeze');
      },
    );
  }

  /** Anillo de celdas regenerables alrededor de un punto. */
  protected regenRing(cx: number, cy: number, radiusCells: number, dur = 1.0): void {
    this.telegraph(
      dur,
      (ctx, k) => {
        ctx.strokeStyle = Math.floor(k * 12) % 2 ? '#ff9a2e' : '#ffe07a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, radiusCells * CELL, 0, Math.PI * 2 * k);
        ctx.stroke();
      },
      () => {
        const cc = Math.floor(cx / CELL);
        const cr = Math.floor((cy - GRID_Y) / CELL);
        for (let r = cr - radiusCells - 1; r <= cr + radiusCells + 1; r++) {
          for (let c = cc - radiusCells - 1; c <= cc + radiusCells + 1; c++) {
            if (c < 0 || c >= COLS || r < 0 || r >= ROWS) continue;
            const d = Math.hypot(c - cc, r - cr);
            if (d >= radiusCells - 0.5 && d < radiusCells + 1) this.g.grid.place(c, r, Cell.Regen);
          }
        }
        sfx('hard');
      },
    );
  }
}
