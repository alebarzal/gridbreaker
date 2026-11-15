/** Configuración global y medidas lógicas del juego. */
export const APP_VERSION: string = __APP_VERSION__;

// Repositorio de GitHub donde se publican las releases (aviso de actualización).
export const GITHUB_OWNER = 'alebarzal';
export const GITHUB_REPO = 'gridbreaker';

// Resolución lógica: ancho fijo, alto adaptable al aspecto de la pantalla.
export const W = 240;
export const MIN_H = 430;
export const MAX_H = 540;

// Cuadrícula
export const COLS = 40;
export const ROWS = 46;
export const CELL = 6;
export const GRID_Y = 20; // debajo del HUD
export const GRID_H = ROWS * CELL;
export const GRID_BOTTOM = GRID_Y + GRID_H;

export const STEP = 1 / 120; // timestep fijo de la simulación
export const MAX_BALLS = 250;

/** Medidas que cambian con la pantalla. */
export const view = { H: 460 };
