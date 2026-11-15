import { APP_VERSION, W, view } from '../config';
import { refreshMusic } from '../core/audio';
import { showChangelog } from '../core/changelog';
import { haptic } from '../core/platform';
import { persist, resetProgress, save, type Settings } from '../core/save';
import { text } from '../core/ui';
import { MenuScene } from './MenuScene';
import { UiScene } from './UiScene';

export class SettingsScene extends UiScene {
  private confirmReset = false;

  enter(): void {
    let y = 62;
    const toggle = (name: string, key: keyof Settings, after?: () => void) => {
      const b = this.addButton('', y, () => {
        save.settings[key] = !save.settings[key];
        persist();
        after?.();
        label();
      });
      const label = () => {
        b.label = `${name}: ${save.settings[key] ? 'SÍ' : 'NO'}`;
        b.color = save.settings[key] ? '#ffd166' : '#6b7391';
      };
      label();
      y += 30;
    };
    toggle('SONIDO', 'sound');
    toggle('MÚSICA', 'music', refreshMusic);
    toggle('VIBRACIÓN', 'haptics', () => haptic('medium'));
    toggle('TEMBLOR', 'shake');
    this.addButton('NOVEDADES', y, () => void showChangelog(this.app)).color = '#b9c0e0';
    y += 30;
    const reset = this.addButton('BORRAR PROGRESO', y, () => {
      if (!this.confirmReset) {
        this.confirmReset = true;
        reset.label = '¿SEGURO? TOCA OTRA VEZ';
        return;
      }
      resetProgress();
      this.confirmReset = false;
      reset.label = 'PROGRESO BORRADO';
    });
    reset.color = '#ff8a8a';
    this.addButton('VOLVER', view.H - 40, () => this.app.scenes.set(new MenuScene(this.app)));
  }

  onBack(): boolean {
    this.app.scenes.set(new MenuScene(this.app));
    return true;
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#0b0d14';
    ctx.fillRect(0, 0, W, view.H);
    text(ctx, 'AJUSTES', W / 2, 30, { size: 14, align: 'center', color: '#ffd166' });
    this.buttons.draw(ctx);
    text(ctx, `Grid Breaker v${APP_VERSION}`, W / 2, view.H - 10, { size: 6, align: 'center', color: '#5b6384' });
  }
}
