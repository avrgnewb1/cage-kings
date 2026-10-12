/* CAGE KINGS - engine.js : fixed-timestep loop, letterboxed 16:9 scaling, screen manager, seeded RNG */
(function () {
  const C = CK.CONFIG;
  // Seeded RNG (mulberry32) so fights and sims are reproducible.
  CK.makeRng = function (seed) {
    let a = (seed >>> 0) || 1;
    const r = function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    r.range = (lo, hi) => lo + r() * (hi - lo);
    r.chance = p => r() < p;
    r.pick = arr => arr[Math.floor(r() * arr.length)];
    r.weighted = (obj) => { let tot = 0; for (const k in obj) tot += Math.max(0, obj[k]); let x = r() * tot; for (const k in obj) { x -= Math.max(0, obj[k]); if (x <= 0) return k; } return Object.keys(obj)[0]; };
    return r;
  };
  CK.clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
  CK.lerp = (a, b, t) => a + (b - a) * t;

  const E = {
    stage: null, canvas: null, ctx: null, scale: 1, screens: {}, current: null, currentName: null,
    acc: 0, last: 0, tick: 0, frame: 0, running: false, timeScale: 1,
    init() {
      E.stage = document.getElementById('stage');
      E.canvas = document.getElementById('game');
      E.ctx = E.canvas.getContext('2d');
      window.addEventListener('resize', E.resize);
      window.addEventListener('orientationchange', () => setTimeout(E.resize, 100));
      E.resize();
    },
    resize() {
      const W = C.VIEW.W, H = C.VIEW.H, vw = window.innerWidth, vh = window.innerHeight;
      E.scale = Math.min(vw / W, vh / H);
      const ox = (vw - W * E.scale) / 2, oy = (vh - H * E.scale) / 2;
      E.stage.style.transform = `translate(${ox}px, ${oy}px) scale(${E.scale})`;
      E.offset = { x: ox, y: oy };
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const px = Math.max(1, E.scale * dpr);
      E.canvas.width = Math.round(W * px); E.canvas.height = Math.round(H * px);
      E.pxScale = px;
      document.getElementById('rotateHint').classList.toggle('show', vh > vw * 1.05);
    },
    clientToVirtual(cx, cy) { return { x: (cx - E.offset.x) / E.scale, y: (cy - E.offset.y) / E.scale }; },
    register(name, screen) { E.screens[name] = screen; },
    go(name, params) {
      if (E.current && E.current.exit) E.current.exit();
      E.current = E.screens[name]; E.currentName = name;
      const ui = document.getElementById('ui'); ui.innerHTML = ''; ui.className = 'screen-' + name;
      CK.Input.clear();
      if (E.current.enter) E.current.enter(params || {});
    },
    start() {
      E.running = true; E.last = performance.now();
      const step = 1000 / C.TICK_HZ;
      const loop = (now) => {
        if (!E.running) return;
        let dt = Math.min(250, now - E.last); E.last = now;
        E.acc += dt * E.timeScale;
        let n = 0;
        while (E.acc >= step && n < C.MAX_STEPS_PER_FRAME) {
          if (E.current && E.current.update) E.current.update(step);
          E.acc -= step; n++; E.tick++;
        }
        if (n >= C.MAX_STEPS_PER_FRAME) E.acc = 0;
        E.render();
        E.frame++;
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    },
    render() {
      const ctx = E.ctx;
      ctx.setTransform(E.pxScale, 0, 0, E.pxScale, 0, 0);
      if (E.current && E.current.render) E.current.render(ctx);
      else { ctx.fillStyle = '#0b0b10'; ctx.fillRect(0, 0, C.VIEW.W, C.VIEW.H); }
    }
  };
  CK.Engine = E;
})();
