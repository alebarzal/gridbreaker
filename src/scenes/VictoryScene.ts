import { W, view } from '../config';
import type { App } from '../core/App';
import { sfx } from '../core/audio';
import { panel, star, text } from '../core/ui';
import { LEVELS } from '../game/levels';
import { GameScene, type LevelResult } from './GameScene';
import { LevelSelectScene } from './LevelSelectScene';
import { UiScene } from './UiScene';

export class VictoryScene extends UiScene {
  overlay = true;
  private shown = 0;

  constructor(
    app: App,
    private res: LevelResult,
  ) {
    super(app);
  }

  private get next() {
    return LEVELS[this.res.level.index + 1] ?? null;
  }

  enter(): void {
    const y0 = Math.round(view.H / 2) - 110;
    const next = this.next;
    if (next) this.addButton('SIGUIENTE', y0 + 150, () => this.app.scenes.set(new GameScene(this.app, next)));
    this.addButton('REPETIR', y0 + (next ? 180 : 150), () => this.app.scenes.set(new GameScene(this.app, this.res.level))).color = '#b9c0e0';
    this.addButton('NIVELES', y0 + (next ? 210 : 180), () => this.toLevels()).color = '#b9c0e0';
  }

  private toLevels(): void {
    const w = (this.next ?? this.res.level).world.id - 1;
    this.app.scenes.set(new LevelSelectScene(this.app, w));
  }

  update(dt: number): void {
    super.update(dt);
    // Las estrellas aparecen una a una
    const want = Math.min(this.res.stars, Math.floor((this.t - 0.3) / 0.35) + 1);
    if (this.t > 0.3 && want > this.shown) {
      this.shown = want;
      sfx('star', 1 + this.shown * 0.12);
    }
  }

  onKey(key: string): void {
    if (key === ' ' || key === 'Enter') {
      const next = this.next;
      if (next) this.app.scenes.set(new GameScene(this.app, next));
      else this.toLevels();
    }
  }

  onBack(): boolean {
    this.toLevels();
    return true;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const a = Math.min(1, this.t * 3);
    ctx.fillStyle = `rgba(5,6,12,${0.72 * a})`;
    ctx.fillRect(0, 0, W, view.H);
    const y0 = Math.round(view.H / 2) - 110;
    const r = this.res;
    panel(ctx, 24, y0 - 4, W - 48, 246, '#161a2b', r.level.world.theme.accent);
    const last = !this.next;
    text(ctx, last ? '¡JUEGO COMPLETADO!' : r.level.boss ? '¡JEFE DERROTADO!' : '¡NIVEL SUPERADO!', W / 2, y0 + 14, {
      size: 12,
      align: 'center',
      color: '#ffe14d',
    });
    text(ctx, `${r.level.id}  ${r.level.name}`, W / 2, y0 + 30, { size: 7, align: 'center', color: '#b9c0e0' });
    for (let i = 0; i < 3; i++) {
      const on = i < this.shown;
      const pop = on && i === this.shown - 1 ? Math.max(0, 1 - (this.t - 0.3 - i * 0.35) * 4) * 4 : 0;
      star(ctx, W / 2 + (i - 1) * 34, y0 + 56 - (i === 1 ? 4 : 0), 13 + pop, on ? '#ffd23f' : '#2c3350');
    }
    r.checks.forEach((c, i) => {
      const y = y0 + 84 + i * 12;
      text(ctx, c.ok ? '★' : '·', 44, y, { size: 8, color: c.ok ? '#ffd23f' : '#5b6384' });
      text(ctx, c.label, 56, y, { size: 7, color: c.ok ? '#e8ecff' : '#7a83a8' });
    });
    text(ctx, `PUNTOS  ${r.score}`, W / 2, y0 + 128, { size: 10, align: 'center', color: '#ffe14d' });
    if (r.newBest && Math.floor(this.t * 3) % 2 === 0) text(ctx, '¡NUEVO RÉCORD!', W / 2, y0 + 140, { size: 7, align: 'center', color: '#7dff7d' });
    this.buttons.draw(ctx);
  }
}
