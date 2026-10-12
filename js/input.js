/* CAGE KINGS - input.js : keyboard + touch (virtual stick + 4 context buttons + block + grab) */
(function () {
  const KEYMAP = {
    left: ['a', 'arrowleft'], right: ['d', 'arrowright'], low: ['s', 'arrowdown'], up: ['w', 'arrowup'],
    j: ['j', 'z'], k: ['k', 'x'], l: ['l', 'c'], u: ['u', 'v'], i: ['i', 'b'], block: [' ', 'shift'],
    pause: ['escape', 'p']
  };
  const keyToAction = {};
  Object.entries(KEYMAP).forEach(([a, ks]) => ks.forEach(k => keyToAction[k] = a));
  const EDGE = ['j', 'k', 'l', 'u', 'i', 'pause'];

  const I = {
    KEYMAP, down: {}, edges: {}, touch: { active: false, sx: 0, sy: 0, btn: {}, flickArmed: true, lastCenterT: 0 },
    touchEnabled: false,
    init() {
      window.addEventListener('keydown', e => {
        const k = e.key.toLowerCase(); const a = keyToAction[k];
        if (!a) return;
        if (e.target && /input|select|textarea/i.test(e.target.tagName)) return;
        e.preventDefault();
        if (!I.down[a] && EDGE.includes(a)) I.edges[a] = true;
        I.down[a] = true;
      });
      window.addEventListener('keyup', e => { const a = keyToAction[e.key.toLowerCase()]; if (a) I.down[a] = false; });
      window.addEventListener('blur', () => { I.down = {}; });
      I.touchEnabled = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || /[?&]touch=1/.test(location.search);
      if (I.touchEnabled) document.body.classList.add('touch');   // CK-09: larger type and targets
      I.buildTouch();
    },
    // Called once per fixed tick by the fight; returns a snapshot and clears edges.
    poll() {
      const t = I.touch, d = I.down;
      const s = {
        left: !!d.left || t.sx < -0.35, right: !!d.right || t.sx > 0.35,
        low: !!d.low || t.sy > 0.5, up: !!d.up || t.sy < -0.55,
        block: !!d.block || !!t.btn.block || (t.blockLatch || 0) > performance.now(),   // CK-15: a quick tap still blocks for a beat
        pressed: Object.assign({}, I.edges)
      };
      I.edges = {};
      return s;
    },
    peekPause() { const p = !!I.edges.pause; if (p) delete I.edges.pause; return p; },
    clear() { I.edges = {}; },
    // ---------- touch ----------
    buildTouch() {
      const root = document.getElementById('touch');
      root.innerHTML = `
        <div id="stickZone"><div id="stickBase"><div id="stickKnob"></div></div></div>
        <div id="btnZone">
          <button class="tbtn" data-b="j"><span>Jab</span></button>
          <button class="tbtn" data-b="k"><span>Power</span></button>
          <button class="tbtn" data-b="l"><span>Kick</span></button>
          <button class="tbtn" data-b="u"><span>Grab</span></button>
          <button class="tbtn blockbtn" data-b="block"><span>Block</span></button>
        </div>
        <button id="tPause" aria-label="Pause">II</button>`;
      const zone = root.querySelector('#stickZone'), base = root.querySelector('#stickBase'), knob = root.querySelector('#stickKnob');
      let pid = null, cx = 0, cy = 0;
      const R = 70;
      const toVirt = (e) => CK.Engine.clientToVirtual(e.clientX, e.clientY);
      zone.addEventListener('pointerdown', e => {
        pid = e.pointerId; zone.setPointerCapture(pid); const v = toVirt(e); cx = v.x; cy = v.y;
        /* CK-04: the base is positioned inside the zone, so convert stage coords to zone coords */ base.style.left = (cx - zone.offsetLeft - 80) + 'px'; base.style.top = (cy - zone.offsetTop - 80) + 'px'; base.classList.add('on');
        I.touch.sx = 0; I.touch.sy = 0; I.touch.lastCenterT = performance.now(); e.preventDefault();
      });
      zone.addEventListener('pointermove', e => {
        if (e.pointerId !== pid) return; const v = toVirt(e);
        let dx = (v.x - cx) / R, dy = (v.y - cy) / R; const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
        I.touch.sx = dx; I.touch.sy = dy; knob.style.transform = `translate(${dx * R}px, ${dy * R}px)`;
        // flick down-forward = takedown (I). "forward" is resolved by the fight from the player's facing.
        const now = performance.now();
        if (Math.hypot(dx, dy) < 0.3) { I.touch.lastCenterT = now; I.touch.flickArmed = true; }
        const fwd = CK.Input.playerFacing || 1;
        if (I.touch.flickArmed && dy > 0.55 && dx * fwd > 0.45 && now - I.touch.lastCenterT < 220) { I.edges.i = true; I.touch.flickArmed = false; }
      });
      const end = e => { if (e.pointerId !== pid) return; pid = null; I.touch.sx = 0; I.touch.sy = 0; knob.style.transform = ''; base.classList.remove('on'); };
      zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
      root.querySelectorAll('.tbtn').forEach(b => {
        const k = b.dataset.b;
        b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture(e.pointerId); if (k === 'block') { I.touch.btn.block = true; I.touch.blockLatch = performance.now() + 120; } else I.edges[k] = true; b.classList.add('on'); });
        const up = () => { if (k === 'block') I.touch.btn.block = false; b.classList.remove('on'); };
        b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
      });
      root.querySelector('#tPause').addEventListener('pointerdown', e => { e.preventDefault(); I.edges.pause = true; });
    },
    showTouch(on) { document.getElementById('touch').classList.toggle('show', !!(on && I.touchEnabled)); },
    setLabels(labels) {
      const bs = document.querySelectorAll('#touch .tbtn');
      ['j', 'k', 'l', 'u'].forEach((k, i) => { const el = bs[i].querySelector('span'); if (el.textContent !== labels[k]) el.textContent = labels[k] || '-'; bs[i].classList.toggle('dim', !labels[k] || labels[k] === '-'); });
    }
  };
  CK.Input = I;
})();
