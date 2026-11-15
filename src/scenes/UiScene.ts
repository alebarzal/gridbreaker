import { W } from '../config';
import { sfx, unlockAudio } from '../core/audio';
import { Scene, type Pointer } from '../core/Scene';
import { Button, ButtonSet } from '../core/ui';

/** Base para escenas de menú: gestiona un conjunto de botones. */
export abstract class UiScene extends Scene {
  protected buttons = new ButtonSet();
  protected t = 0;

  protected addButton(label: string, y: number, onClick: () => void, w = 150, h = 24, x = (W - w) / 2): Button {
    return this.buttons.add(new Button(x, y, w, h, label, onClick));
  }

  update(dt: number): void {
    this.t += dt;
  }

  onPointerDown(p: Pointer): void {
    unlockAudio();
    this.buttons.down(p.x, p.y);
  }

  onPointerUp(p: Pointer): void {
    if (this.buttons.up(p.x, p.y)) sfx('click');
  }
}
