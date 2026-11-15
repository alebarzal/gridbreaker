import { COLS, GRID_Y, W } from '../../config';
import type { GameScene } from '../../scenes/GameScene';
import { Boss } from './Boss';

/**
 * Jefe 3 — Reina de Hielo.
 * Congela bolas con un rayo y levanta muros de hielo. Al 50% de vida entra en
 * fase 2: más rápida, congela dos bolas, muros dobles y lluvia de carámbanos.
 */
export class IceQueen extends Boss {
  name = 'REINA DE HIELO';
  private atk = 2.5;
  private seq = 0;
  private sway = 0;

  constructor(g: GameScene) {
    super(g, 22);
    this.y = GRID_Y + 34;
    this.boxes = [{ x: 0, y: 0, w: 18, h: 22, weak: true }];
  }

  protected onDamage(): void {
    if (this.phase === 1 && this.hp <= this.maxHp / 2) {
      this.phase = 2;
      this.invuln = 1.2;
      this.g.banner('FASE 2 — VENTISCA', '#bfeaff');
      this.g.addRing(this.x, this.y, 90, '#bfeaff');
      this.g.clearEnemyProjectiles();
      this.g.shake(6);
    }
  }

  protected tick(dt: number): void {
    const speed = this.phase === 2 ? 1.0 : 0.6;
    this.sway += dt * speed;
    this.x = W / 2 + Math.sin(this.sway) * 84;
    this.y = GRID_Y + 34 + Math.sin(this.sway * 2.3) * 8;
    const b = this.boxes[0];
    b.x = this.x - 9;
    b.y = this.y - 11;

    this.atk -= dt;
    if (this.atk > 0 || this.busy) return;
    const p2 = this.phase === 2;
    this.atk = p2 ? 2.1 : 3.1;
    const origin = () => ({ x: this.x, y: this.y + 4 });
    const pattern = p2 ? ['freeze', 'wall', 'shards', 'freeze', 'wall'] : ['freeze', 'wall'];
    const kind = pattern[this.seq++ % pattern.length];
    if (kind === 'freeze') {
      this.freezeBeam(origin, p2 ? 2 : 1, p2 ? 2 : 1.6);
    } else if (kind === 'wall') {
      const cols = 14 + Math.floor(Math.random() * 9);
      const c0 = Math.floor(Math.random() * (COLS - cols));
      const r0 = 22 + Math.floor(Math.random() * 16);
      this.iceWall(c0, r0, cols, p2 ? 2 : 1);
    } else {
      this.throwAt('shard', origin, 3, 150, 34, 0.8);
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const x = Math.round(this.x);
    const y = Math.round(this.y + (this.dead ? Math.sin(this.t * 40) * 2 : 0));
    const blink = this.invuln > 0.3 && Math.floor(this.t * 16) % 2 === 0;
    if (blink) return;
    // Aura
    ctx.fillStyle = this.phase === 2 ? 'rgba(160,220,255,0.22)' : 'rgba(160,220,255,0.12)';
    ctx.fillRect(x - 13, y - 15, 26, 30);
    // Vestido
    ctx.fillStyle = this.col('#2b5fa8');
    ctx.fillRect(x - 9, y - 1, 18, 12);
    ctx.fillStyle = this.col('#6fb6ff');
    ctx.fillRect(x - 7, y - 1, 14, 11);
    ctx.fillStyle = this.col('#cfeaff');
    ctx.fillRect(x - 7, y + 8, 14, 2);
    // Cabeza
    ctx.fillStyle = this.col('#e8f7ff');
    ctx.fillRect(x - 5, y - 9, 10, 9);
    ctx.fillStyle = '#10284a';
    ctx.fillRect(x - 3, y - 6, 2, 2);
    ctx.fillRect(x + 1, y - 6, 2, 2);
    ctx.fillStyle = this.phase === 2 ? '#ff5a7a' : '#7c9cff';
    ctx.fillRect(x - 2, y - 3, 4, 1);
    // Corona de hielo
    ctx.fillStyle = this.col('#9ad4ff');
    ctx.fillRect(x - 6, y - 12, 2, 4);
    ctx.fillRect(x - 1, y - 14, 2, 6);
    ctx.fillRect(x + 4, y - 12, 2, 4);
    // Cetro
    ctx.fillStyle = this.col('#cfeaff');
    ctx.fillRect(x + 10, y - 8, 1, 16);
    ctx.fillStyle = this.busy && Math.floor(this.t * 12) % 2 ? '#ffffff' : '#5ac8ff';
    ctx.fillRect(x + 9, y - 11, 3, 3);
  }
}
