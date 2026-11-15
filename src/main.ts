import './style.css';
import { App } from './core/App';
import { suspendAudio } from './core/audio';
import { changelogPending, showChangelog } from './core/changelog';
import { bindLifecycle } from './core/platform';
import { loadSave } from './core/save';
import { checkForUpdate, showUpdateNotice } from './core/updates';
import { LEVELS } from './game/levels';
import { GameScene } from './scenes/GameScene';
import { MenuScene } from './scenes/MenuScene';

async function boot(): Promise<void> {
  await loadSave();
  const params = new URLSearchParams(location.search);
  const app = new App(document.getElementById('game') as HTMLCanvasElement);
  // ?debug=1 o ?testUpdate=1 activan el modo debug (opciones de prueba en el menú)
  app.debug = params.get('debug') === '1' || params.get('testUpdate') === '1';
  // Solo en desarrollo: acceso desde la consola para pruebas automáticas
  if (import.meta.env.DEV) Object.assign(window, { __gb: { app, LEVELS, GameScene } });
  app.scenes.set(new MenuScene(app));
  app.start();

  bindLifecycle(
    () => app.blur(),
    () => app.back(),
  );
  document.addEventListener('visibilitychange', () => suspendAudio(document.hidden));

  // La consulta de actualización corre en paralelo y nunca bloquea el juego.
  const update = checkForUpdate();
  if (changelogPending()) await showChangelog(app);
  const info = await update;
  if (info) await showUpdateNotice(app, info);
}

void boot();
