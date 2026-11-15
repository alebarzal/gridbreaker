import { CELL, COLS, GRID_BOTTOM, GRID_Y, W } from '../../config';
import { sfx } from '../../core/audio';
import type { GameScene } from '../../scenes/GameScene';
import type { GravityDir } from '../levels';
import { Boss } from './Boss';

interface Portal {
  x: number;
  y: number;
  pair: number;
}

const PORTAL_R = 7;

/**
 * Jefe 5 — Núcleo Cósmico (final). Tres fases:
 *  1) placas orbitales, portales, inversión de gravedad, terrones y anillo regenerable
 *  2) + rocas del Gólem y hielo de la Reina
 *  3) + abanico de fuego del Dragón, gravedad en cualquier dirección
 */
export class CosmicCore extends Boss {
  name = 'NÚCLEO CÓSMICO';
  private portals: Portal[] = [];
  private spin = 0;
  private atk = 3;
  private gravT = 8;
  private gravLeft = 0;

  constructor(g: GameScene) {
    super(g, 72);
    this.x = W / 2;
    this.y = GRID_Y + 72;
    this.setup();
  }

  private setup(): void {
    const plates = 2 + this.phase;
    this.boxes = [{ x: this.x - 10, y: this.y - 10, w: 20, h: 20, weak: true }];
    for (let i = 0; i < plates; i++) this.boxes.push({ x: 0, y: 0, w: 8, h: 8, weak: false });
    // Portales: uno abajo (zona de juego) y su pareja dentro de la cámara
    const low = GRID_BOTTOM - 44;
    const layouts: Portal[][] = [
      [
        { x: 34, y: low, pair: 1 },
        { x: W - 58, y: GRID_Y + 44, pair: 0 },
        { x: W - 34, y: low, pair: 3 },
        { x: 58, y: GRID_Y + 100, pair: 2 },
      ],
      [
        { x: W / 2, y: low + 10, pair: 1 },
        { x: W / 2, y: GRID_Y + 36, pair: 0 },
        { x: 30, y: low - 30, pair: 3 },
        { x: W - 30, y: low - 30, pair: 2 },
      ],
      [
        { x: 40, y: low, pair: 1 },
        { x: 60, y: GRID_Y + 44, pair: 0 },
        { x: W - 40, y: low, pair: 3 },
        { x: W - 60, y: GRID_Y + 100, pair: 2 },
      ],
    ];
    this.portals = layouts[this.phase - 1];
    // Despeja las celdas bajo los portales
    for (const p of this.portals) {
      const pc = Math.floor(p.x / CELL);
      const pr = Math.floor((p.y - GRID_Y) / CELL);
      for (let r = pr - 2; r <= pr + 2; r++) for (let c = pc - 2; c <= pc + 2; c++) this.g.grid.clear(c, r, 'system');
      this.g.particles.burst(p.x, p.y, 10, '#c8a0ff', 50, 0.5);
    }
  }

  protected onDamage(): void {
    const next = this.hp <= this.maxHp / 3 ? 3 : this.hp <= (this.maxHp * 2) / 3 ? 2 : 1;
    if (next > this.phase) {
      this.phase = next;
      this.invuln = 1.6;
      this.g.banner(`FASE ${next}`, next === 3 ? '#ff6ad5' : '#c8a0ff');
      this.g.addRing(this.x, this.y, 130, '#ffffff');
      this.g.clearEnemyProjectiles();
      this.g.shake(8);
      this.g.setGravity('down');
      this.gravLeft = 0;
      this.gravT = 5;
      this.atk = 2.5;
      this.setup();
    }
  }

  protected onDeath(): void {
    this.g.setGravity('down');
    this.portals = [];
  }

  private origin = () => ({ x: this.x, y: this.y + 12 });

  protected tick(dt: number): void {
    // Placas orbitales
    this.spin += dt * (0.9 + this.phase * 0.35);
    const n = this.boxes.length - 1;
    for (let i = 0; i < n; i++) {
      const a = this.spin + (i * Math.PI * 2) / n;
      const b = this.boxes[i + 1];
      b.x = this.x + Math.cos(a) * 24 - 4;
      b.y = this.y + Math.sin(a) * 24 - 4;
    }

    // Portales: teletransportan bolas a su pareja
    for (const ball of this.g.balls) {
      if (ball.portalCd > 0 || ball.stuck || !ball.alive) continue;
      for (const p of this.portals) {
        if (Math.abs(ball.x - p.x) < PORTAL_R && Math.abs(ball.y - p.y) < PORTAL_R) {
          const q = this.portals[p.pair];
          this.g.particles.burst(ball.x, ball.y, 5, '#c8a0ff', 40, 0.3);
          ball.x = q.x;
          ball.y = q.y;
          ball.portalCd = 0.8;
          this.g.particles.burst(q.x, q.y, 5, '#ffffff', 40, 0.3);
          sfx('laser');
          break;
        }
      }
    }

    // Gravedad: inversión telegrafiada
    if (this.gravLeft > 0) {
      this.gravLeft -= dt;
      if (this.gravLeft <= 0) this.g.setGravity('down');
    } else {
      this.gravT -= dt;
      if (this.gravT <= 0) {
        this.gravT = this.phase === 3 ? 7 : 9;
        const dirs: GravityDir[] = this.phase === 3 ? ['up', 'left', 'right'] : ['up'];
        const dir = dirs[Math.floor(Math.random() * dirs.length)];
        this.g.banner(dir === 'up' ? '¡GRAVEDAD INVERTIDA!' : '¡GRAVEDAD LATERAL!', '#ff6ad5');
        this.telegraph(
          1.2,
          (ctx, k) => {
            if (Math.floor(k * 12) % 2) return;
            ctx.fillStyle = '#ff6ad5';
            const dx = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
            const dy = dir === 'up' ? -1 : 0;
            for (let i = 0; i < 4; i++) {
              const ax = 40 + i * 53;
              const ay = GRID_BOTTOM + 30;
              for (let s = 0; s < 8; s++) ctx.fillRect(ax + dx * s - 0.5, ay + dy * s, 2, 2);
              ctx.fillRect(ax + dx * 8 - 2 - Math.abs(dy) , ay + dy * 8 - 2 * Math.abs(dx), 2 + 4 * Math.abs(dy), 2 + 4 * Math.abs(dx));
            }
          },
          () => {
            this.g.setGravity(dir);
            this.gravLeft = 4;
          },
        );
      }
    }

    // Ataques combinados de jefes anteriores
    this.atk -= dt;
    if (this.atk > 0 || this.busy) return;
    this.atk = this.phase === 3 ? 2.2 : this.phase === 2 ? 2.8 : 3.4;
    const pool = ['clod', 'ring'];
    if (this.phase >= 2) pool.push('rock', 'freeze', 'wall');
    if (this.phase >= 3) pool.push('fan', 'fan');
    switch (pool[Math.floor(Math.random() * pool.length)]) {
      case 'clod':
        this.throwAt('clod', this.origin, 3, 125, 32);
        break;
      case 'ring':
        this.regenRing(this.x, this.y, 7 + this.phase);
        break;
      case 'rock':
        this.throwAt('rock', this.origin, this.phase === 3 ? 2 : 1, 155, 46, 0.9);
        break;
      case 'freeze':
        this.freezeBeam(this.origin, this.phase, 1.6);
        break;
      case 'wall': {
        const cols = 16 + Math.floor(Math.random() * 8);
        this.iceWall(Math.floor(Math.random() * (COLS - cols)), 28 + Math.floor(Math.random() * 12), cols, 1);
        break;
      }
      case 'fan':
        this.fireFan(this.origin, 5, 1.2, 80);
        break;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    // Portales
    this.portals.forEach((p, i) => {
      const col = i < 2 ? '#5ad1ff' : '#ffb347';
      const pulse = Math.round(Math.sin(this.t * 6 + i) * 1.5);
      ctx.strokeStyle = col;
      ctx.lineWidth = 1;
      ctx.strokeRect(p.x - PORTAL_R - pulse + 0.5, p.y - PORTAL_R - pulse + 0.5, (PORTAL_R + pulse) * 2 - 1, (PORTAL_R + pulse) * 2 - 1);
      ctx.fillStyle = 'rgba(10,6,24,0.9)';
      ctx.fillRect(p.x - PORTAL_R + 2, p.y - PORTAL_R + 2, PORTAL_R * 2 - 4, PORTAL_R * 2 - 4);
      ctx.fillStyle = col;
      const a = this.t * 5 + i;
      ctx.fillRect(Math.round(p.x + Math.cos(a) * 3), Math.round(p.y + Math.sin(a) * 3), 2, 2);
      ctx.fillRect(Math.round(p.x - Math.cos(a) * 3), Math.round(p.y - Math.sin(a) * 3), 1, 1);
    });
    if (this.done) return;
    const x = Math.round(this.x);
    const y = Math.round(this.y + (this.dead ? Math.sin(this.t * 40) * 2 : 0));
    if (this.invuln > 0.3 && Math.floor(this.t * 16) % 2 === 0) return;
    const pulse = Math.round(Math.sin(this.t * 4) * 1.5);
    const cols = ['#c8a0ff', '#ff9ad8', '#ff5a7a'];
    // Halo
    ctx.fillStyle = 'rgba(200,160,255,0.16)';
    ctx.fillRect(x - 16 - pulse, y - 16 - pulse, 32 + pulse * 2, 32 + pulse * 2);
    // Núcleo
    ctx.fillStyle = this.col('#2a1458');
    ctx.fillRect(x - 11, y - 11, 22, 22);
    ctx.fillStyle = this.col(cols[this.phase - 1]);
    ctx.fillRect(x - 9, y - 9, 18, 18);
    ctx.fillStyle = this.col('#ffffff');
    ctx.fillRect(x - 4 - pulse, y - 4 - pulse, 8 + pulse * 2, 8 + pulse * 2);
    ctx.fillStyle = '#12082b';
    ctx.fillRect(x - 2, y - 2, 4, 4);
    // Placas
    for (let i = 1; i < this.boxes.length; i++) {
      const b = this.boxes[i];
      ctx.fillStyle = '#2d2550';
      ctx.fillRect(Math.round(b.x), Math.round(b.y), 8, 8);
      ctx.fillStyle = this.col('#8f86c9');
      ctx.fillRect(Math.round(b.x), Math.round(b.y), 7, 7);
      ctx.fillStyle = '#d8d2ff';
      ctx.fillRect(Math.round(b.x) + 1, Math.round(b.y) + 1, 2, 1);
    }
  }
}
