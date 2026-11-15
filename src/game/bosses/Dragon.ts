import { GRID_Y, W } from '../../config';
import { sfx } from '../../core/audio';
import type { GameScene } from '../../scenes/GameScene';
import { Boss } from './Boss';

/**
 * Jefe 4 — Dragón de Lava.
 * Dispara bolas de fuego en abanico hacia la pala. Las bolas de fuego prenden
 * las celdas que tocan (pasan a regenerarse) y dejan brasas que rebrotan.
 */
export class Dragon extends Boss {
  name = 'DRAGÓN DE LAVA';
  private atk = 2.5;
  private seq = 0;
  private sway = 0;

  constructor(g: GameScene) {
    super(g, 30);
    this.y = GRID_Y + 34;
    this.boxes = [
      { x: 0, y: 0, w: 16, h: 14, weak: true }, // cabeza
      { x: 0, y: 0, w: 50, h: 10, weak: false }, // alas
    ];
  }

  protected onDamage(): void {
    if (this.phase === 1 && this.hp <= this.maxHp / 2) {
      this.phase = 2;
      this.g.banner('¡EL DRAGÓN ARDE DE FURIA!', '#ff9a2e');
      this.g.addRing(this.x, this.y, 90, '#ff7a1a');
      this.g.shake(6);
    }
  }

  private mouth = () => ({ x: this.x, y: this.y + 16 });

  protected tick(dt: number): void {
    this.sway += dt * (this.phase === 2 ? 0.8 : 0.5);
    this.x = W / 2 + Math.sin(this.sway) * 70;
    this.y = GRID_Y + 34 + Math.sin(this.sway * 2) * 6;
    const head = this.boxes[0];
    head.x = this.x - 8;
    head.y = this.y + 2;
    const wings = this.boxes[1];
    wings.x = this.x - 25;
    wings.y = this.y - 9;

    this.atk -= dt;
    if (this.atk > 0 || this.busy) return;
    const p2 = this.phase === 2;
    this.atk = p2 ? 2.5 : 3.5;
    if (p2 && this.seq++ % 3 === 2) this.fireRain();
    else this.fireFan(this.mouth, p2 ? 7 : 5, p2 ? 1.5 : 1.2, p2 ? 88 : 74);
  }

  /** Fase 2: lluvia de fuego desde arriba, marcada antes de caer. */
  private fireRain(): void {
    const xs: number[] = [];
    for (let i = 0; i < 5; i++) xs.push(16 + Math.random() * (W - 32));
    this.telegraph(
      1.0,
      (ctx, k) => {
        ctx.fillStyle = Math.floor(k * 12) % 2 ? '#ffb11f' : '#ff3b1f';
        for (const x of xs) {
          ctx.fillRect(Math.round(x) - 2, GRID_Y + 1, 5, 2);
          ctx.fillRect(Math.round(x), GRID_Y + 3, 1, Math.round(k * 14));
        }
      },
      () => {
        for (const x of xs) this.g.spawnProjectile('fire', x, GRID_Y + 2, 0, 95);
        sfx('explode');
      },
    );
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const x = Math.round(this.x);
    const y = Math.round(this.y + (this.dead ? Math.sin(this.t * 40) * 2 : 0));
    const flap = Math.round(Math.sin(this.t * 6) * 3);
    // Alas
    ctx.fillStyle = this.col('#6e1410');
    ctx.fillRect(x - 26, y - 8 + flap, 18, 9);
    ctx.fillRect(x + 8, y - 8 + flap, 18, 9);
    ctx.fillStyle = this.col('#b3261a');
    ctx.fillRect(x - 25, y - 8 + flap, 16, 6);
    ctx.fillRect(x + 9, y - 8 + flap, 16, 6);
    ctx.fillStyle = this.col('#ff7a1a');
    ctx.fillRect(x - 25, y - 2 + flap, 4, 3);
    ctx.fillRect(x - 17, y - 2 + flap, 4, 3);
    ctx.fillRect(x + 13, y - 2 + flap, 4, 3);
    ctx.fillRect(x + 21, y - 2 + flap, 4, 3);
    // Cuerpo
    ctx.fillStyle = this.col('#8f1d14');
    ctx.fillRect(x - 9, y - 10, 18, 14);
    ctx.fillStyle = this.col('#d1361f');
    ctx.fillRect(x - 8, y - 10, 16, 12);
    // Cabeza
    ctx.fillStyle = this.col('#8f1d14');
    ctx.fillRect(x - 8, y + 2, 16, 14);
    ctx.fillStyle = this.col('#e0502e');
    ctx.fillRect(x - 7, y + 2, 14, 12);
    ctx.fillStyle = '#ffe14d';
    ctx.fillRect(x - 5, y + 5, 3, 3);
    ctx.fillRect(x + 2, y + 5, 3, 3);
    ctx.fillStyle = '#200606';
    ctx.fillRect(x - 4, y + 6, 1, 2);
    ctx.fillRect(x + 3, y + 6, 1, 2);
    ctx.fillRect(x - 4, y + 11, 8, 2);
    // Cuernos
    ctx.fillStyle = this.col('#ffd9a0');
    ctx.fillRect(x - 9, y - 1, 2, 5);
    ctx.fillRect(x + 7, y - 1, 2, 5);
    if (this.phase === 2 && Math.floor(this.t * 10) % 2) {
      ctx.fillStyle = '#ffb11f';
      ctx.fillRect(x - 3, y + 13, 6, 2);
    }
  }
}
