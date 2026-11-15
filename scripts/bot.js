// Bot de pruebas (solo desarrollo). Juega niveles a cámara rápida sin pintar,
// para detectar errores y medir cuánto se tarda en superar cada nivel.
// Uso, con `npm run dev` abierto en el navegador, desde la consola:
//   await import('/scripts/bot.js'); __bot(0, 30)
window.__bot = (from = 0, to = 30, maxSec = 300) => {
  const { app, LEVELS, GameScene } = window.__gb;
  const out = [];
  for (const lv of LEVELS.slice(from, to)) {
    const g = new GameScene(app, lv);
    app.scenes.set(g);
    let steps = 0;
    let err = '';
    let maxBalls = 0;
    const t0 = performance.now();
    try {
      while (app.scenes.top === g && steps < 120 * maxSec) {
        if (g.state === 'ready') g.launch();
        const p = g.paddle;
        let best = null;
        for (const b of g.balls) if (!b.stuck && b.dy > 0 && b.y > 300 && (!best || b.y > best.y)) best = b;
        let tx = null;
        if (best) {
          // Predice dónde caerá la bola (con rebote en las paredes laterales)
          let x = best.x + (best.dx / best.dy) * (p.y - best.y);
          while (x < 0 || x > 240) x = x < 0 ? -x : 480 - x;
          tx = x + Math.sin(steps * 0.013) * 10;
        }
        else {
          let pu = null;
          for (const u of g.powerups) if (u.info.good && (!pu || u.y > pu.y)) pu = u;
          if (pu) tx = pu.x;
        }
        if (tx === null) tx = p.x;
        for (const pr of g.projectiles) {
          if (!pr.friendly && pr.y > p.y - 45 && Math.abs(pr.x - tx) < p.w / 2 + 8 && !(best && best.y > p.y - 30)) {
            tx = pr.x + (tx >= pr.x ? 1 : -1) * (p.w / 2 + 12);
          }
        }
        p.targetX = tx;
        if (g.balls.length > maxBalls) maxBalls = g.balls.length;
        g.update(1 / 120);
        steps++;
      }
    } catch (e) {
      err = String(e.stack).slice(0, 300);
    }
    out.push(
      `${lv.id} ${g.state} t=${g.time.toFixed(0)}/${lv.par} lost=${g.livesLost} pct=${(g.grid.pct * 100) | 0} boss=${g.boss ? g.boss.hp : '-'} maxBalls=${maxBalls} ms=${(performance.now() - t0) | 0} ${err}`,
    );
  }
  return out.join('\n');
};
