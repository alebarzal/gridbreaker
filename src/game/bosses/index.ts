import type { GameScene } from '../../scenes/GameScene';
import type { BossId } from '../levels';
import type { Boss } from './Boss';
import { CosmicCore } from './CosmicCore';
import { Dragon } from './Dragon';
import { Golem } from './Golem';
import { IceQueen } from './IceQueen';
import { Worm } from './Worm';

export function createBoss(id: BossId, g: GameScene): Boss {
  switch (id) {
    case 'worm':
      return new Worm(g);
    case 'golem':
      return new Golem(g);
    case 'queen':
      return new IceQueen(g);
    case 'dragon':
      return new Dragon(g);
    case 'core':
      return new CosmicCore(g);
  }
}

export type { Boss };
