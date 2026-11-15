import { W, view } from '../config';
import type { App } from '../core/App';
import { panel, text } from '../core/ui';
import { GameScene } from './GameScene';
import { LevelSelectScene } from './LevelSelectScene';
import { UiScene } from './UiScene';

export class GameOverScene extends UiScene {
  overlay = true;

  constructor(
    app: App,
    private game: GameScene,
  ) {
    super(app);
  }

  enter(): void {
    const y0 = Math.round(view.H / 2) - 60;
    this.addButton('REINTENTAR', y0 + 62, () => this.app.scenes.set(new GameScene(this.app, this.game.level)));
    this.addButton('NIVELES', y0 + 92, () => this.app.scenes.set(new LevelSelectScene(this.app, this.game.level.world.id - 1))).color = '#b9c0e0';
  }

  onKey(key: string): void {
    if (key === ' ' || key === 'Enter') this.app.scenes.set(new GameScene(this.app, this.game.level));
  }

  onBack(): boolean {
    this.app.scenes.set(new LevelSelectScene(this.app, this.game.level.world.id - 1));
    return true;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const a = Math.min(1, this.t * 2);
    ctx.fillStyle = `rgba(20,4,6,${0.75 * a})`;
    ctx.fillRect(0, 0, W, view.H);
    const y0 = Math.round(view.H / 2) - 60;
    panel(ctx, 30, y0 - 4, W - 60, 132, '#1f1114', '#ff5a5a');
    text(ctx, 'FIN DE LA PARTIDA', W / 2, y0 + 14, { size: 12, align: 'center', color: '#ff8a8a' });
    text(ctx, `${this.game.level.id}  ${this.game.level.name}`, W / 2, y0 + 32, { size: 7, align: 'center', color: '#b9c0e0' });
    text(ctx, `PUNTOS  ${this.game.score}`, W / 2, y0 + 46, { size: 9, align: 'center', color: '#ffe14d' });
    this.buttons.draw(ctx);
  }
}
