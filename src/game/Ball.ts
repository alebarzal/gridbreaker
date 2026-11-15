export class Ball {
  /** Dirección unitaria; la velocidad la decide el juego. */
  dx = 0;
  dy = -1;
  r = 2;
  alive = true;
  /** Pegada a la pala (inicio o imán). */
  stuck = false;
  stuckOffset = 0;
  stuckT = 0;
  /** Segundos que le quedan congelada (Reina de Hielo). */
  frozen = 0;
  portalCd = 0;
  bossCd = 0;
  /** Segundos sin romper celdas ni tocar la pala (antiatasco). */
  idle = 0;
  constructor(
    public x: number,
    public y: number,
  ) {}

  setAngle(a: number): void {
    this.dx = Math.sin(a);
    this.dy = -Math.cos(a);
  }

  normalize(): void {
    const l = Math.hypot(this.dx, this.dy) || 1;
    this.dx /= l;
    this.dy /= l;
  }
}
