import { W, view } from '../config';
import type { App } from '../core/App';
import { refreshMusic } from '../core/audio';
import { persist, save } from '../core/save';
import { panel, text } from '../core/ui';
import { GameScene } from './GameScene';
import { LevelSelectScene } from './LevelSelectScene';
import { UiScene } from './UiScene';

/** Pausa: se pinta sobre la partida congelada. */
export class PauseScene extends UiScene {
  overlay = true;

  constructor(
    app: App,
    private game: GameScene,
  ) {
    super(app);
  }

  enter(): void {
    const y0 = Math.round(view.H / 2) - 70;
    this.addButton('CONTINUAR', y0 + 30, () => this.app.scenes.pop());
    this.addButton('REINICIAR', y0 + 60, () => this.app.scenes.set(new GameScene(this.app, this.game.level))).color = '#b9c0e0';
    const snd = this.addButton('', y0 + 90, () => {
      save.settings.sound = !save.settings.sound;
      save.settings.music = save.settings.sound;
      persist();
      refreshMusic();
      label();
    });
    snd.color = '#b9c0e0';
    const label = () => (snd.label = save.settings.sound ? 'SONIDO: SÍ' : 'SONIDO: NO');
    label();
    this.addButton('SALIR', y0 + 120, () => this.app.scenes.set(new LevelSelectScene(this.app, this.game.level.world.id - 1))).color = '#ff8a8a';
    if (this.app.debug) {
      this.addButton('DEBUG: SALTAR NIVEL', y0 + 150, () => {
        this.app.scenes.pop();
        this.game.win();
      }).color = '#7dff7d';
    }
  }

  onKey(key: string): void {
    if (key === 'p' || key === ' ' || key === 'Enter') this.app.scenes.pop();
  }

  onBack(): boolean {
    this.app.scenes.pop();
    return true;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const H = view.H;
    ctx.fillStyle = 'rgba(5,6,12,0.72)';
    ctx.fillRect(0, 0, W, H);
    const y0 = Math.round(H / 2) - 70;
    const h = this.app.debug ? 190 : 160;
    panel(ctx, 30, y0 - 4, W - 60, h);
    text(ctx, 'PAUSA', W / 2, y0 + 12, { size: 13, align: 'center', color: '#ffd166' });
    this.buttons.draw(ctx);
  }
}
