import { W, view } from '../config';

export type ProjectileKind = 'laser' | 'rock' | 'clod' | 'shard' | 'fire';

export class Projectile {
  alive = true;
  t = 0;
  r: number;
  /** Segundos de parálisis que causa a la pala (enemigos). */
  stun: number;
  friendly: boolean;
  /** Última celda visitada (para prender celdas una sola vez). */
  lastCell = -1;
  constructor(
    public kind: ProjectileKind,
    public x: number,
    public y: number,
    public vx: number,
    public vy: number,
  ) {
    this.friendly = kind === 'laser';
    this.r = kind === 'rock' ? 4 : kind === 'laser' ? 1 : 3;
    this.stun = kind === 'rock' ? 1 : kind === 'clod' ? 0.7 : kind === 'fire' ? 0.6 : 0.5;
  }

  update(dt: number): void {
    this.t += dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.y > view.H + 12 || this.y < -12 || this.x < -12 || this.x > W + 12) this.alive = false;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const x = Math.round(this.x);
    const y = Math.round(this.y);
    switch (this.kind) {
      case 'laser':
        ctx.fillStyle = '#ff3b3b';
        ctx.fillRect(x - 1, y - 4, 2, 7);
        ctx.fillStyle = '#ffd0d0';
        ctx.fillRect(x, y - 4, 1, 3);
        break;
      case 'rock':
        ctx.fillStyle = '#3d2c1e';
        ctx.fillRect(x - 4, y - 3, 8, 7);
        ctx.fillStyle = '#9a7b5c';
        ctx.fillRect(x - 3, y - 4, 6, 7);
        ctx.fillStyle = '#c9a57e';
        ctx.fillRect(x - 2, y - 3, 2, 2);
        break;
      case 'clod':
        ctx.fillStyle = '#5a3b1c';
        ctx.fillRect(x - 3, y - 3, 6, 6);
        ctx.fillStyle = '#8a5a2b';
        ctx.fillRect(x - 2, y - 3, 4, 4);
        break;
      case 'shard':
        ctx.fillStyle = '#e8f7ff';
        ctx.fillRect(x - 1, y - 4, 2, 8);
        ctx.fillStyle = '#7cc4ff';
        ctx.fillRect(x - 2, y - 1, 4, 3);
        break;
      case 'fire': {
        const f = Math.floor(this.t * 14) % 2;
        ctx.fillStyle = '#ff3b1f';
        ctx.fillRect(x - 3, y - 3, 6, 6);
        ctx.fillStyle = '#ffb11f';
        ctx.fillRect(x - 2, y - 2 - f, 4, 4);
        ctx.fillStyle = '#fff3a0';
        ctx.fillRect(x - 1, y - 1, 2, 2);
        break;
      }
    }
  }
}
