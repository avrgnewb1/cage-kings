/* CAGE KINGS - fight.js : fight simulation (logic only, no drawing).
 * Modes inside a round: 'stand' | 'clinch' | 'ground' | 'sub'.  Phases: intro | fight | break | over.
 * Controllers return an intent per tick: { dir:-1|0|1 (world), low, up, block, pressed:{j,k,l,u,i} }
 */
(function () {
  const C = CK.CONFIG, clamp = CK.clamp;

  // ---------- Data-driven ground positions (add a new position = add an entry here + poses in rig.js) ----------
  // topDx: top fighter x offset from bottom, in units of bottom.facing * size; topFacing: 'toward' (faces bottom's feet side) | 'same'
  // Button mapping follows Larry's ui.json hud.contextButtons; labels are read from there at runtime (label here = fallback).
  // uiKey + 'Top'/'Bottom' = the ui.json key. 'low' = alternate action when holding the low modifier (S / stick down).
  const GROUND_POS = {
    guard: {
      uiKey: 'guard', label: 'Guard', topPose: 'top_guard', botPose: 'bottom_guard', botBlockPose: 'bottom_guard_block', topDx: 60, topFacing: 'opposite', dmgKey: 'guard',
      top: { j: { label: 'POUND', act: 'strike', strike: 'gnp' }, k: { label: 'ELBOW', act: 'strike', strike: 'gnp_heavy' },
             l: { label: 'MOUNT', act: 'advance', to: 'mount' }, u: null },
      bot: { j: { label: 'STRIKE', act: 'strike', strike: 'up_strike' }, k: { label: 'SWEEP', act: 'sweep' },
             l: { label: 'GET UP', act: 'scramble' }, u: { label: 'SUBMIT', act: 'sub', sub: 'armbar', low: { act: 'sub', sub: 'triangle' } } }
    },
    mount: {
      uiKey: 'mount', label: 'Mount', topPose: 'top_mount', botPose: 'bottom_mount', botBlockPose: 'bottom_mount', topDx: -30, topFacing: 'opposite', dmgKey: 'mount',
      top: { j: { label: 'POUND', act: 'strike', strike: 'gnp_mount' }, k: { label: 'ELBOW', act: 'strike', strike: 'gnp_mount_heavy' },
             l: { label: 'TAKE BACK', act: 'advance', to: 'back' }, u: { label: 'ARMBAR', act: 'sub', sub: 'armbar' } },
      bot: { j: { label: 'HAND FIGHT', act: 'handfight', to: 'guard' }, k: { label: 'BRIDGE', act: 'escape', to: 'guard', kind: 'bridge' }, l: null, u: null }
    },
    back: {
      uiKey: 'back', label: 'Back', topPose: 'back_att', botPose: 'back_def', botBlockPose: 'back_def', topDx: -30, topFacing: 'same', dmgKey: 'back',
      top: { j: { label: 'STRIKE', act: 'strike', strike: 'back_strike' }, k: null, l: null, u: { label: 'CHOKE', act: 'sub', sub: 'rnc' } },
      bot: { j: { label: 'HAND FIGHT', act: 'handfight', to: 'guard' }, k: { label: 'TURN', act: 'escape', to: 'guard', kind: 'turn' }, l: null, u: null }
    }
  };
  const GROUND_STRIKES = {
    gnp: { cfg: 'gnp', wind: 160, dur: 460 }, gnp_heavy: { cfg: 'gnpHeavy', wind: 320, dur: 800, elbow: true },
    gnp_mount: { cfg: 'gnp', wind: 160, dur: 460 }, gnp_mount_heavy: { cfg: 'gnpHeavy', wind: 320, dur: 800, elbow: true },
    back_strike: { cfg: 'backStrike', wind: 150, dur: 450 },
    up_strike: { cfg: 'upStrike', wind: 150, dur: 420 }
  };
  const SUB_ENTRY = { guillotine: 'stand', armbar: 'ground', triangle: 'ground', rnc: 'ground' };

  function lerpArr(arr, t) { return arr[0] + (arr[1] - arr[0]) * clamp(t, 0, 1); }

  class Fighter {
    constructor(def, idx, ctrl) {
      this.def = def; this.idx = idx; this.ctrl = ctrl; this.name = def.name;
      this.stats = def.stats; this.disc = def.disc; this.appr = def.appr;
      this.wcKey = def.wc; this.wc = C.WEIGHT[def.wc]; this.look = def.look; this.skin = def.skin || 'default';
      this.size = this.wc.scale * ((def.look.build && def.look.build.h) || 1);
      this.reach = (CK.DATA.APPROACHES[def.appr].reach || 1) * ((def.look.build && def.look.build.limb) || 1);
      this.discMult = C.DISCIPLINE_MULT[def.disc];
      this.head = C.HEALTH.head; this.body = C.HEALTH.body; this.leg = C.HEALTH.leg;
      this.maxStam = C.STAMINA.max; this.stam = this.maxStam; this.fatigue = def.fatigue || 0;
      if (this.fatigue) this.stam = this.maxStam = Math.max(C.STAMINA.minMax, C.STAMINA.max - this.fatigue * C.CAREER.fatigueStamPenalty);
      this.x = 0; this.facing = 1; this.st = 'idle'; this.stT = 0; this.stDur = 0;
      this.mvKey = null; this.mv = null; this.mvT = 0; this.hitDone = false; this.lastMove = null; this.lastMoveEnd = -9999; this.lastMoveHit = false;
      this.blockStart = -9999; this.blockLow = false; this.buffer = null; this.cd = 0; this.act = null;
      this.ref = 0; this.kdTotal = 0; this.legGone = false; this.reShotUntil = 0; this.catchUntil = 0; this.lastSubPress = -9999;
      this.flash = 0; this.animT = 0; this.rs = null; this.hitbox = null; this.answeredAt = 0; this.subPresses = 0;
    }
    get s() { return this.stats; }
    get gassed() { return this.stam < C.STAMINA.lowThreshold; }
    get hurt() { return this.head < C.REF.hurtHead || this.st === 'stagger' || this.st === 'hitstun' && this.head < C.REF.hurtHead + 15; }
    costMult() { return lerpArr(C.STAMINA.cardioCostMult, this.s.cardio / 100) / this.wc.cardio; }
    regenMult() { return lerpArr(C.STAMINA.cardioRegenMult, this.s.cardio / 100) * this.wc.cardio; }
    spend(n) { this.stam = Math.max(0, this.stam - n * this.costMult()); }
    timeMult() { return this.discMult.speed * (1.12 - this.s.striking * 0.0025) / Math.sqrt(this.wc.speed) * (this.gassed ? C.STAMINA.lowSpeedMult : 1); }
    powerMult() { return (0.7 + this.s.power * 0.006) * this.wc.power * (this.gassed ? C.STAMINA.lowDmgMult : 1); }
    moveSpeed() {
      const legSlow = (1 - this.leg / 100) * C.MOVE.legSlowMax;
      return C.MOVE.speed * this.wc.speed * (1 - legSlow) * (this.gassed ? 0.82 : 1);
    }
    chinMult() { return lerpArr(C.CHIN_HEAD_DMG, this.s.chin / 100); }
    perfectWindow() { return C.BLOCK.perfectWindowMs + (this.disc === 'BOX' ? C.BLOCK.boxingBonusMs : 0) + (this.appr === 'COUNTER' ? C.BLOCK.counterBonusMs : 0); }
    has(move) { const own = { teep: 'MT', elbow: 'MT', thai: 'MT', chain: 'BOX', reshot: 'WR', pull: 'BJJ' }; return this.disc === own[move] || (this.def.unlocks || []).includes(move); }
    setState(st, dur) { this.st = st; this.stT = 0; this.stDur = dur || 0; this.animT = 0; }
  }

  function newRoundStats() { return { dmg: 0, head: 0, body: 0, leg: 0, thrown: 0, landed: 0, kd: 0, td: 0, tdAtt: 0, ctrl: 0, subAtt: 0, nearSub: 0, fwd: 0, bottom: 0, refPeak: 0, subEsc: 0, kicks: 0, power: 0, perfect: 0, checks: 0, standLanded: 0, standTaken: 0, stall: 0 }; }

  class Fight {
    constructor(opts) {
      this.opts = opts; this.rng = CK.makeRng(opts.seed || (Date.now() & 0xffffff));
      this.rounds = opts.rounds || (opts.title ? C.TITLE_ROUNDS : C.ROUNDS);
      this.f = [new Fighter(opts.a, 0, opts.ctrlA), new Fighter(opts.b, 1, opts.ctrlB)];
      this.f[0].opp = this.f[1]; this.f[1].opp = this.f[0];
      this.round = 1; this.time = 0; this.events = []; this.headless = !!opts.headless;
      this.roundStats = []; this.cards = null; this.result = null; this.debug = false; this.paused = false;
      this.startRound();
    }
    emit(type, data) { if (!this.headless) this.events.push(Object.assign({ type, t: this.time }, data || {})); }
    text(msg, who, color) { this.emit('text', { msg, who, color }); }
    // announcer/ref callout from callouts.json (falls back to the given text)
    callout(cat, fallback, who, color) {
      if (this.headless) return;
      const vars = { round: this.round };
      if (who) vars.targetLast = (who.def.last || who.name).toUpperCase();
      const w = this.result && this.result.winner >= 0 ? this.f[this.result.winner] : null; if (w) vars.winnerLast = (w.def.last || w.name).toUpperCase();
      this.text(CK.Text ? CK.Text.callout(cat, vars, fallback) : fallback, who, color);
    }

    startRound() {
      const A = C.ARENA, mid = (A.left + A.right) / 2;
      this.f[0].x = mid - C.ARENA.startGap / 2; this.f[1].x = mid + C.ARENA.startGap / 2;
      this.f.forEach(f => { f.setState('idle'); f.mv = null; f.act = null; f.buffer = null; f.ref = 0; f.rs = newRoundStats(); f.legDownThisRound = false; f.wobbled = false; });
      this.roundStats.push([this.f[0].rs, this.f[1].rs]);
      this.mode = 'stand'; this.clinch = null; this.ground = null; this.sub = null;
      this.roundLeft = C.ROUND_SECONDS * 1000; this.phase = 'intro'; this.phaseT = 0; this.clapDone = false;
      this.emit('roundStart', { round: this.round });
    }

    // ===================== MAIN STEP =====================
    step(dt) {
      if (this.paused || this.phase === 'over') { if (this.phase === 'over') this.phaseT += dt; return; }
      this.phaseT += dt;
      const [a, b] = this.f;
      if (this.phase === 'intro') {
        this.face(); a.animT += dt; b.animT += dt;
        if (this.phaseT >= C.INTRO_MS) { this.phase = 'fight'; this.phaseT = 0; this.emit('fightCall'); }
        return;
      }
      if (this.phase === 'break') {
        if (this.headless && this.phaseT >= C.CORNER.minMs) this.nextRound();
        return;
      }
      if (this.phase === 'finish') { // freeze frame after a stoppage, still animate
        a.animT += dt; b.animT += dt; a.stT += dt; b.stT += dt;
        if (this.phaseT >= C.FINISH_FREEZE_MS) { this.phase = 'over'; this.phaseT = 0; this.emit('over', { result: this.result }); }
        return;
      }
      this.time += dt;
      const ia = a.ctrl.update(this, a, b, dt) || {}, ib = b.ctrl.update(this, b, a, dt) || {};
      ia.pressed = ia.pressed || {}; ib.pressed = ib.pressed || {};
      a.animT += dt; b.animT += dt; a.flash = Math.max(0, a.flash - dt / 120); b.flash = Math.max(0, b.flash - dt / 120);
      for (const f of this.f) { if (f.cd > 0) f.cd -= dt; }
      if (this.mode === 'stand') this.stepStand([ia, ib], dt);
      else if (this.mode === 'clinch') this.stepClinch([ia, ib], dt);
      else if (this.mode === 'ground') this.stepGround([ia, ib], dt);
      else if (this.mode === 'sub') this.stepSub([ia, ib], dt);
      if (this.phase !== 'fight') return;
      // ref meter decay
      for (const f of this.f) f.ref = Math.max(0, f.ref - C.REF.decayPerSec * dt / 1000);
      // clock
      this.roundLeft -= dt;
      if (!this.clapDone && this.roundLeft <= 2000) { this.clapDone = true; this.emit('sound', { name: 'clap_10s' }); }
      if (this.roundLeft <= 0) this.endRound();
    }

    face() { const [a, b] = this.f; a.facing = b.x >= a.x ? 1 : -1; b.facing = -a.facing; }
    dist() { return Math.abs(this.f[1].x - this.f[0].x); }

    // ===================== STANDING =====================
    stepStand(intents, dt) {
      const [a, b] = this.f;
      if (a.st !== 'knockdown' && b.st !== 'knockdown' && a.st !== 'getup' && b.st !== 'getup') this.face();
      for (let i = 0; i < 2; i++) { this.standFighter(this.f[i], this.f[1 - i], intents[i], dt); if (this.mode !== 'stand' || this.phase !== 'fight') return; }
      // separation + arena clamp
      const minSep = C.MOVE.minSeparation * (a.size + b.size) / 2;
      const d = b.x - a.x;
      if (Math.abs(d) < minSep && a.st !== 'knockdown' && b.st !== 'knockdown') {
        const push = (minSep - Math.abs(d)) / 2, s = Math.sign(d) || 1; a.x -= s * push; b.x += s * push;
      }
      for (const f of this.f) f.x = clamp(f.x, C.ARENA.left, C.ARENA.right);
    }

    standFighter(f, o, it, dt) {
      f.stT += dt;
      const S = C.STAMINA; let regen = 0;
      // buffer presses
      for (const k of ['j', 'k', 'l', 'u', 'i']) if (it.pressed[k]) f.buffer = { k, t: this.time, low: it.low, up: it.up, dir: it.dir };
      if (f.buffer && this.time - f.buffer.t > C.BUFFER_MS) f.buffer = null;
      switch (f.st) {
        case 'idle': case 'walk': case 'block': {
          // reactive options vs a shooting opponent
          if (o.st === 'shoot' && f.buffer && f.buffer.k === 'u' && this.dist() < 140 * f.size) { f.buffer = null; return this.startSub(f, o, 'guillotine', 'vsShoot'); }
          if (f.catchUntil > this.time && f.buffer && (f.buffer.k === 'i' || f.buffer.k === 'u')) { f.buffer = null; f.catchUntil = 0; return this.resolveTakedown(f, o, { caught: true }); }
          if (o.st === 'knockdown' && f.buffer && (f.buffer.k === 'i' || f.buffer.k === 'k') && this.dist() < 190 * f.size) { f.buffer = null; return this.pounce(f, o); }
          if (it.block && !f.buffer) {
            if (f.st !== 'block') { f.setState('block'); f.blockStart = this.time; }
            f.blockLow = !!it.low; regen = S.regenBlock;
            break;
          }
          if (f.buffer && this.tryAction(f, o, f.buffer)) { f.buffer = null; break; }
          if (f.st === 'block') f.setState('idle');
          const dir = it.dir || 0;
          if (dir) {
            const back = dir !== f.facing; const sp = f.moveSpeed() * (back ? C.MOVE.backMult : 1);
            f.x += dir * sp * dt / 1000; if (f.st !== 'walk') { f.st = 'walk'; } regen = S.regenWalk;
            if (!back) f.rs.fwd += sp * dt / 1000;
          } else { if (f.st !== 'idle') f.st = 'idle'; regen = S.regenIdle; }
          break;
        }
        case 'attack': this.stepAttack(f, o, dt); break;
        case 'hitstun': case 'stagger': case 'sprawled': case 'shootmiss': case 'sprawl': case 'whiff': case 'caught':
          if (f.stT >= f.stDur) f.setState('idle'); regen = S.regenIdle * 0.4; break;
        case 'knockdown':
          regen = S.regenIdle * 0.5;
          if (f.stT >= f.stDur) { if (f.legGone && f.leg <= 0) { f.leg = 12; } f.setState('getup', C.KNOCKDOWN.getUpMs); this.answer(f); }
          break;
        case 'getup': if (f.stT >= f.stDur) f.setState('idle'); break;
        case 'shoot': this.stepShoot(f, o, dt); break;
        case 'grab':
          if (f.stT >= C.CLINCH.grabStartup) {
            if (this.dist() <= C.CLINCH.grabRange * f.size && o.st !== 'knockdown' && o.st !== 'shoot') return this.startClinch(f, o);
            f.setState('whiff', 260);
          }
          break;
      }
      if (regen) f.stam = Math.min(f.maxStam, f.stam + regen * f.regenMult() * dt / 1000);
    }

    // returns true if an action started
    tryAction(f, o, bf) {
      const dist = this.dist(), M = C.MOVES, fwd = bf.dir === f.facing;
      let key = null;
      if (bf.k === 'j') key = bf.low ? 'jab_body' : 'jab';
      else if (bf.k === 'k' && f.appr === 'CREATIVE' && bf.dir && bf.dir !== f.facing) key = 'spin_fist';
      else if (bf.k === 'l' && f.appr === 'CREATIVE' && bf.dir && bf.dir !== f.facing && !bf.low) key = 'spin_kick';
      else if (bf.k === 'k') {
        if (f.has('elbow') && dist < M.elbow.closeOnly * f.size && !bf.low) key = 'elbow';
        else if (f.has('chain') && !bf.low) key = (f.lastMove === 'hook' && f.lastMoveHit && this.time - f.lastMoveEnd < C.CHAIN_WINDOW_MS + 400) ? 'uppercut' : 'hook';
        else key = bf.low ? 'power_body' : 'power';
      } else if (bf.k === 'l') {
        if (bf.low) key = 'leg_kick';
        else if (bf.up) key = 'kick_head';
        else if (fwd && f.has('teep')) key = 'teep';
        else if (dist < 92 * f.size) key = 'knee';
        else key = 'kick_body';
      } else if (bf.k === 'u') {
        f.spend(C.CLINCH.grabStam); f.setState('grab'); f.rs.thrown++; return true;
      } else if (bf.k === 'i') {
        if (f.has('pull') && dist < C.TAKEDOWN.guardPullRange * f.size) { f.spend(C.TAKEDOWN.guardPullStam); this.callout('guardPull', 'GUARD PULL', f); this.startGround(o, f, 'guard'); return true; }
        if (dist > C.TAKEDOWN.maxRange * f.size + 40) return false;
        const reshot = f.reShotUntil > this.time;
        f.spend(C.TAKEDOWN.stam * (reshot ? C.TAKEDOWN.reShotStamMult : 1)); f.rs.tdAtt++; f.reShot = reshot;
        f.setState('shoot'); this.emit('sound', { name: 'whiff' }); return true;
      }
      if (!key) return false;
      const mv = M[key]; const tm = f.timeMult();
      f.mvKey = key; f.mv = mv; f.mvT = 0; f.hitDone = false;
      f.mvTimes = { s: mv.startup * tm, a: mv.active, r: mv.recovery * tm };
      f.setState('attack'); f.spend(mv.stam); f.rs.thrown++;
      return true;
    }

    stepAttack(f, o, dt) {
      f.mvT += dt; const T = f.mvTimes;
      if (f.mvT >= T.s && f.mvT < T.s + T.a && !f.hitDone) {
        f.hitbox = this.hitboxFor(f);
        if (o.st !== 'knockdown' && o.st !== 'getup' && this.overlaps(f.hitbox, this.hurtboxes(o))) { f.hitDone = true; this.resolveHit(f, o, f.mv); }
      } else if (f.mvT >= T.s + T.a) f.hitbox = null;
      if (f.mvT >= T.s + T.a && !f.hitDone && !f.whiffed) { f.whiffed = true; this.emit('sound', { name: 'whiff' }); }
      if (f.mvT >= T.s + T.a + T.r) {
        f.lastMove = f.mvKey; f.lastMoveHit = f.hitDone; f.lastMoveEnd = this.time; f.whiffed = false;
        f.mv = null; f.mvKey = null; f.hitbox = null; f.setState('idle');
      } else if (f.mvT >= T.s + T.a && f.mvKey === 'hook' && f.hitDone && f.buffer && f.buffer.k === 'k') {
        // chain: hook -> uppercut (Boxing)
        f.lastMove = 'hook'; f.lastMoveHit = true; f.lastMoveEnd = this.time; f.setState('idle');
      }
    }

    // ---- hit/hurt boxes (virtual px, world space) ----
    height(f) { return 178 * f.size; }
    hitboxFor(f) {
      const mv = f.mv, H = this.height(f), floor = C.ARENA.floorY;
      const reach = mv.reach * f.size * f.reach;
      const x1 = f.x + f.facing * reach * 0.45, x2 = f.x + f.facing * reach;
      const band = mv.target === 'head' ? [0.74, 1.0] : mv.target === 'body' ? [0.42, 0.78] : [0.05, 0.45];
      return { x: Math.min(x1, x2), w: Math.abs(x2 - x1), y: floor - H * band[1], h: H * (band[1] - band[0]), target: mv.target };
    }
    hurtboxes(o) {
      const H = this.height(o), floor = C.ARENA.floorY, w = 24 * o.size;
      let head = [0.8, 1.0], body = [0.42, 0.8], leg = [0, 0.45];
      if (o.st === 'shoot' || o.st === 'sprawled') { head = [0.38, 0.56]; body = [0.22, 0.48]; leg = [0, 0.25]; }
      const box = (b, ww) => ({ x: o.x - ww, w: ww * 2, y: floor - H * b[1], h: H * (b[1] - b[0]) });
      return { head: box(head, w * 0.7), body: box(body, w), leg: box(leg, w * 1.2) };
    }
    overlaps(hb, hurt) {
      const box = hurt[hb.target]; const r = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
      if (r(hb, box)) return true;
      // a head strike at a shooting opponent can still clip the body (it was aimed high)
      return false;
    }

    // ---- Hit resolution ----
    resolveHit(f, o, mv) {
      const B = C.BLOCK; const rng = this.rng;
      // knee vs a shooter = knee counter
      if (o.st === 'shoot' && (mv.kind === 'knee' || f.mvKey === 'uppercut')) {
        const dmg = C.TAKEDOWN.kneeCounterDmg * f.powerMult() * f.discMult.knee;
        this.applyDamage(f, o, dmg, 'head', 1.6, true, mv);
        this.text('KNEE COUNTER!', f, '#ffcf3f'); if (o.st !== 'knockdown' && this.phase === 'fight') o.setState('stagger', 650);
        return;
      }
      // slip (head movement)
      if (mv.target === 'head' && mv.kind === 'punch' && (o.st === 'idle' || o.st === 'walk' || o.st === 'block' && false)) {
        let p = o.s.defense * C.SLIP.perDefense + (o.disc === 'BOX' ? C.SLIP.boxingBonus : 0) - (o.appr === 'CREATIVE' ? C.SLIP.creativePenalty : 0);
        if (o.gassed) p *= 0.5;
        if (rng.chance(p)) { this.text('SLIP', o, '#9ad'); this.emit('sound', { name: 'whiff' }); return; }
      }
      const covers = o.st === 'block' && (o.blockLow ? B.lowBlockStops : B.highBlockStops).includes(mv.target);
      if (covers) {
        const perfect = this.time - o.blockStart <= o.perfectWindow();
        this.answer(o);
        if (perfect) {
          if (mv.catchable) { f.setState('caught', B.catchKickStaggerMs); o.catchUntil = this.time + B.catchKickStaggerMs; this.callout('kickCaught', 'KICK CAUGHT!', o, '#7fd3ff'); this.emit('sound', { name: 'kick_caught' }); }
          else { f.setState('stagger', B.perfectStaggerMs); this.callout('perfectBlock', 'PERFECT BLOCK', o, '#7fd3ff'); }
          o.rs.perfect++;
          f.mv = null; this.emit('sound', { name: 'perfect_block' }); this.emit('perfect', { who: o.idx });
          o.blockStart = -9999; return;
        }
        let dmg = mv.dmg * this.dmgMult(f, mv) * B.dmgMult;
        o.stam = Math.max(0, o.stam - mv.dmg * B.staminaPerDmg * (o.gassed ? C.STAMINA.lowBlockMult : 1) * (1.2 - o.s.defense * 0.004));
        if (mv.target === 'leg' && o.blockLow) { // check
          const chk = mv.dmg * B.checkDmg * (o.disc === 'MT' ? 1.3 : 1);
          f.leg = Math.max(0, f.leg - chk); o.rs.checks++; this.callout('kickChecked', 'CHECKED', o, '#7fd3ff'); this.emit('sound', { name: 'check' });
          if (f.leg <= 0) this.legGives(f, o);
        } else this.emit('sound', { name: 'block' });
        if (mv.target === 'head') o.head -= dmg * 0.5; else if (mv.target === 'body') o.body -= dmg * 0.5;
        o.x += f.facing * C.MOVE.blockPushback; o.flash = 0.25;
        return;
      }
      // clean hit
      let mult = 1; let counter = false;
      if (o.st === 'attack' || o.st === 'whiff' || o.st === 'shootmiss') { mult *= C.COUNTER_HIT_MULT; counter = true; if (f.appr === 'COUNTER') mult *= C.COUNTER_STRIKER_MULT / C.COUNTER_HIT_MULT; }
      if (o.st === 'stagger' || o.st === 'caught') mult *= 1.15;
      const dmg = mv.dmg * this.dmgMult(f, mv) * mult * rng.range(0.9, 1.1);
      if (counter && f.appr === 'COUNTER') this.text('COUNTER!', f, '#ffcf3f');
      this.applyDamage(f, o, dmg, mv.target, mv.kd, mv.heavy, mv);
      if (this.phase !== 'fight' || o.st === 'knockdown') return;
      if (mv.push) { o.x += f.facing * mv.push * f.size; o.stam = Math.max(0, o.stam - mv.drain); }
      else o.x += f.facing * C.MOVE.pushback * (mv.heavy ? 1.4 : 1);
      const stun = mv.heavy ? C.HITSTUN.heavy : C.HITSTUN.light;
      if (o.st === 'attack' || o.st === 'shoot' || o.st === 'grab') { o.mv = null; o.hitbox = null; }
      o.setState('hitstun', stun); o.hitKind = mv.target;
    }
    dmgMult(f, mv) {
      let m = f.powerMult() * (f.discMult[mv.kind] || 1);
      if (f.mvKey === 'leg_kick' && f.discMult.legKick) m *= f.discMult.legKick;
      if (mv.kind === 'kick') m *= 0.6 + f.leg / 250; // a damaged leg weakens kicks
      return m * (0.85 + f.s.striking * 0.003);
    }
    // central damage application (standing, clinch, ground)
    applyDamage(f, o, dmg, target, kd, heavy, mv, opts) {
      opts = opts || {}; dmg *= C.DAMAGE_SCALE;
      const rs = f.rs;
      if (target === 'head') { dmg *= o.chinMult(); o.head = Math.max(0, o.head - dmg); rs.head += dmg; }
      else if (target === 'body') { o.body = Math.max(0, o.body - dmg); rs.body += dmg; o.maxStam = Math.max(C.STAMINA.minMax, C.STAMINA.max - (100 - o.body) * C.STAMINA.bodyDmgToMax); o.stam = Math.min(o.stam, o.maxStam); o.stam = Math.max(0, o.stam - dmg * 0.6); }
      else { o.leg = Math.max(0, o.leg - dmg); rs.leg += dmg; }
      rs.dmg += dmg * (target === 'head' ? 1 : target === 'body' ? 0.8 : 0.7); rs.landed++;
      o.flash = 1; this.answer(f);
      const snd = mv && mv.kind === 'kick' ? (f.mvKey === 'leg_kick' ? 'leg_kick' : f.mvKey === 'kick_head' ? 'kick_head' : 'hit_body')
        : mv && mv.kind === 'elbow' || opts.elbow ? (this.mode === 'ground' ? 'elbow_126' : 'elbow') : mv && mv.kind === 'knee' ? 'knee' : target === 'body' ? 'hit_body' : heavy ? (f.wcKey === 'HW' ? 'hit_heavy_hw' : 'hit_heavy') : 'hit_light';
      this.emit('hit', { who: o.idx, target, dmg, heavy: !!heavy, sound: snd });
      // ref meter: unanswered clean hits
      const downed = this.isDowned(o);
      const posMult = this.mode === 'ground' && this.ground ? (C.REF.groundMult[this.ground.pos] || 1) : (downed ? C.REF.downedMult : 1);
      let add = (C.REF.perHit + dmg * C.REF.perDmg) * (o.hurt ? C.REF.hurtMult : 1) * posMult * (o.legGone ? C.REF.legGoneHitMult : 1);
      o.ref += add; o.rs.refPeak = Math.max(o.rs.refPeak, o.ref);
      if (this.mode === 'stand') { rs.standLanded += dmg; o.rs.standTaken += dmg; }
      if (mv && mv.kind === 'kick') rs.kicks++; if (mv && mv.heavy) rs.power++;
      if (target === 'head' && o.hurt && !o.wobbled) { o.wobbled = true; this.emit('sound', { name: 'hurt' }); this.emit('sound', { name: 'crowd_ooh' }); }
      else if (heavy && target === 'head' && dmg >= 7 && this.time - (this.lastOoh || -9e9) > 2500) { this.lastOoh = this.time; this.emit('sound', { name: 'crowd_ooh' }); }
      if (o.ref > 65 && !o.dangerCalled) { o.dangerCalled = true; this.callout('refMeterDanger', 'FIGHT BACK!', o, '#ff9f43'); }
      // KO
      if (o.head <= 0) return this.finish(f, 'KO', this.finishDetail(f, mv, opts));
      if (o.ref >= C.REF.tkoAt) return this.finish(f, 'TKO', 'Ref stoppage (' + this.finishDetail(f, mv, opts).toLowerCase() + ')');
      // knockdown (standing only)
      if (this.mode === 'stand' && target === 'head' && kd > 0) {
        const K = C.KNOCKDOWN;
        const p = K.base * dmg * kd * (1 + (1 - o.head / 100) * K.lowHeadMult) * (1.45 - o.s.chin / 100) * (o.st === 'attack' ? 1.2 : 1);
        if (this.rng.chance(p)) this.knockdown(f, o);
      }
      if (target === 'leg' && o.leg <= 0 && this.mode === 'stand') this.legGives(o.opp === f ? o : o, f);
    }
    isDowned(o) {
      if (o.st === 'knockdown' || o.st === 'getup') return true;
      if (this.mode === 'ground' && this.ground && this.ground.bot === o) return true; // back/hips on the mat
      if (this.mode === 'ground' && this.ground && this.ground.pos === 'back' && this.ground.bot === o) return true;
      return false;
    }
    finishDetail(f, mv, opts) {
      if (opts && opts.detail) return opts.detail;
      if (!mv) return 'Strikes';
      const n = { jab: 'Jab', jab_body: 'Body jab', power: 'Power punch', power_body: 'Body shot', hook: 'Hook', uppercut: 'Uppercut', elbow: 'Elbow',
        kick_body: 'Body kick', kick_head: 'Head kick', spin_fist: 'Spinning back fist', spin_kick: 'Spinning back kick', leg_kick: 'Leg kicks', teep: 'Teep', knee: 'Knee' };
      return n[f.mvKey] || 'Strikes';
    }
    legGives(o, f) {
      if (o.legGone && o.st === 'knockdown') return;
      o.legGone = true; o.ref += C.REF.legGoneAdd; this.callout('legHurt', 'LEG GIVES OUT!', o, '#ff6b6b');
      if (o.ref >= C.REF.tkoAt) return this.finish(f, 'TKO', 'Ref stoppage (leg kicks)');
      this.knockdown(f, o, true);
    }
    knockdown(f, o, leg) {
      const K = C.KNOCKDOWN;
      if (o.head < K.flashKoBelowHead && !leg && this.rng.chance(K.flashKoChance)) { o.head = 0; return this.finish(f, 'KO', this.finishDetail(f, f.mv)); }
      o.setState('knockdown', K.downMs); o.mv = null; o.hitbox = null; o.kdTotal++;
      f.rs.kd++; o.ref += C.REF.knockdownAdd;
      this.callout(leg ? 'tkoLegDamage' : 'knockdown', leg ? 'DOWN!' : 'KNOCKDOWN!', o, '#ff4d4d'); this.emit('knockdown', { who: o.idx }); this.emit('sound', { name: 'knockdown' }); this.emit('sound', { name: 'vo_knockdown' }); this.emit('sound', { name: 'crowd_swell' });
      if (o.ref >= C.REF.tkoAt) this.finish(f, 'TKO', 'Ref stoppage');
    }
    answer(f) { f.ref = Math.max(0, f.ref - C.REF.answerDrop); f.answeredAt = this.time; if (f.ref < 40) f.dangerCalled = false; }
    pounce(f, o) { this.text('POUNCE', f); this.startGround(f, o, 'guard'); }

    // ---- Takedowns ----
    stepShoot(f, o, dt) {
      const T = C.TAKEDOWN, dist = this.dist();
      const wind = T.windup * (f.disc === 'WR' ? 0.75 : 1) * (f.gassed ? 1.3 : 1);
      if (f.stT < wind) return;   // level change: readable tell
      if (dist > T.contact * f.size) f.x += f.facing * T.dashSpeed * Math.min(1, f.wc.speed) * dt / 1000;
      if (Math.abs(o.x - f.x) <= T.contact * f.size) return this.resolveTakedown(f, o, {});
      if (f.stT >= wind + T.startup) { f.setState('shootmiss', T.missRecovery); if (f.has('reshot')) f.reShotUntil = this.time + 1200; }
    }
    resolveTakedown(f, o, opt) {
      const T = C.TAKEDOWN; let p = T.base + (f.s.grappling - o.s.defense) * T.perGrapple - (o.s.defense - 50) * 0 + (f.disc === 'WR' ? T.wrestlingBonus : 0)
        + (o.s.grappling - 50) * -0.002 + (f.s.strength - o.s.strength) * 0.003;
      if (o.gassed) p += T.gassedDefBonus;
      if (f.reShot) p += 0.08;
      if (o.st === 'attack' || o.st === 'whiff' || o.st === 'hitstun' || o.st === 'stagger') p += 0.15;
      const sprawling = o.st === 'block' && o.blockLow && !opt.caught;
      if (sprawling) p *= T.sprawlMult * (o.disc === 'WR' ? (1 - T.wrestlingSprawlBonus * 2) : 1);
      if (opt.caught) p = Math.max(p, 0.7) + 0.1;
      if (opt.clinch) p = C.CLINCH.tdBase + (f.s.grappling + f.s.strength - o.s.defense - o.s.strength) * 0.004 + (f.disc === 'WR' ? 0.12 : 0) + (o.gassed ? 0.12 : 0) - (o.st === 'block' && o.blockLow ? 0.15 : 0);
      p = clamp(p, 0.05, 0.92);
      if (this.rng.chance(p)) {
        f.rs.td++; this.callout('takedown', opt.caught ? 'CATCH & DUMP!' : 'TAKEDOWN!', f, '#ffcf3f'); this.emit('sound', { name: 'takedown' });
        this.startGround(f, o, 'guard');
      } else {
        this.callout('takedownDefended', sprawling ? 'SPRAWL!' : 'STUFFED', o, '#7fd3ff'); this.emit('sound', { name: 'sprawl' }); this.answer(o);
        this.mode = 'stand'; this.clinch = null;
        f.setState('sprawled', T.sprawledMs); o.setState('sprawl', 420); f.spend(4);
        if (f.has('reshot')) f.reShotUntil = this.time + T.sprawledMs + 900;
      }
    }

    // ===================== CLINCH =====================
    startClinch(f, o) {
      this.mode = 'clinch'; const thai = f.has('thai');
      this.clinch = { ctrl: f, thai, t: 0, lastStrike: 0 };
      f.setState('clinch'); o.setState('clinch'); f.act = o.act = null; f.cd = o.cd = 250;
      this.callout('clinch', thai ? 'THAI CLINCH' : 'CLINCH', f); this.emit('sound', { name: 'clinch' });
    }
    clinchLabels(f) {
      const thaiCtrl = this.clinch && this.clinch.thai && this.clinch.ctrl === f;
      const L = (k, fb) => CK.Text ? CK.Text.contextLabel('clinch', k, fb) : fb;
      return { j: L('j', 'STRIKE'), k: L('k', 'ELBOW'), l: thaiCtrl ? L('l', 'KNEE') + '+' : L('l', 'KNEE'), u: L('u', 'BREAK') };
    }
    stepClinch(intents, dt) {
      const c = this.clinch, CL = C.CLINCH; c.t += dt;
      const [a, b] = this.f; const mid = (a.x + b.x) / 2, gap = CL.gap * (a.size + b.size) / 2;
      const s = a.x <= b.x ? 1 : -1; a.x = clamp(mid - s * gap / 2, C.ARENA.left, C.ARENA.right); b.x = clamp(mid + s * gap / 2, C.ARENA.left, C.ARENA.right);
      a.facing = s; b.facing = -s;
      for (let i = 0; i < 2; i++) {
        const f = this.f[i], o = this.f[1 - i], it = intents[i]; f.stT += dt;
        f.stam = Math.min(f.maxStam, f.stam + C.STAMINA.regenGround * f.regenMult() * dt / 1000 * (it.block ? 0.5 : 1));
        f.blockHeld = !!it.block;
        if (f.act) { f.act.t += dt; if (!f.act.done && f.act.t >= f.act.wind) { f.act.done = true; this.clinchStrikeLand(f, o, f.act); if (this.mode !== 'clinch' || this.phase !== 'fight') return; } if (f.act.t >= f.act.dur) f.act = null; }
        if (f.cd > 0 || f.act) continue;
        const p = it.pressed;
        if (p.j) { const cfg = CL.punch; f.spend(cfg.stam); f.rs.thrown++; f.act = { name: 'clinch_punch', t: 0, wind: 110, dur: cfg.cd, dmg: cfg.dmg, target: it.low ? 'body' : 'head' }; f.cd = cfg.cd; }
        else if (p.k) { const cfg = CL.elbow; f.spend(cfg.stam); f.rs.thrown++; f.act = { name: 'clinch_elbow', t: 0, wind: 150, dur: cfg.cd, dmg: cfg.dmg, target: 'head', elbow: true }; f.cd = cfg.cd; }
        else if (p.l) { const thai = c.thai && c.ctrl === f; f.spend(CL.knee.stam); f.rs.thrown++; f.act = { name: 'clinch_knee', t: 0, wind: 180, dur: CL.knee.cd, dmg: thai ? CL.knee.thaiHeadDmg : CL.knee.dmg, target: thai && !it.low ? 'head' : 'body', knee: true, kd: thai ? CL.knee.thaiKd : 0 }; f.cd = CL.knee.cd; }
        else if (p.i) { f.spend(CL.tdStam); f.rs.tdAtt++; f.cd = CL.tdCd; return this.resolveTakedown(f, o, { clinch: true }); }
        else if (p.u) {
          if (it.low) { return this.startSub(f, o, 'guillotine', 'clinch'); }
          f.spend(CL.breakStam); f.cd = CL.breakCd;
          let pb = CL.breakBase + (f.s.strength - o.s.strength) * CL.breakPerStr - (c.thai && c.ctrl === o ? CL.thaiBreakPenalty : 0) + (c.ctrl === f ? 0.4 : 0) + (o.gassed ? 0.15 : 0);
          if (this.rng.chance(clamp(pb, 0.08, 0.95))) { this.breakClinch('BREAK', f); return; }
          else this.text('HELD', o);
        }
      }
      if (c.t - c.lastStrike > CL.refBreakMs && c.t > CL.refBreakMs) { this.emit('sound', { name: 'ref_break' }); this.breakClinch('REF BREAK', null); }
    }
    clinchStrikeLand(f, o, act) {
      const mult = o.blockHeld ? C.CLINCH.blockMult : 1;
      if (o.blockHeld) this.answer(o);
      let dmg = act.dmg * f.powerMult() * (act.knee ? f.discMult.knee : act.elbow ? f.discMult.elbow : f.discMult.punch) * mult * this.rng.range(0.9, 1.1);
      this.clinch.lastStrike = this.clinch.t;
      if (o.blockHeld) { this.emit('sound', { name: 'block' }); o[act.target === 'head' ? 'head' : 'body'] -= dmg * 0.5; return; }
      this.applyDamage(f, o, dmg, act.target, 0, act.knee || act.elbow, null, { elbow: act.elbow, detail: act.knee ? 'Knees in the clinch' : act.elbow ? 'Elbows' : 'Punches' });
      if (this.phase === 'fight' && act.kd && act.target === 'head') {
        const p = C.KNOCKDOWN.base * dmg * act.kd * (1 + (1 - o.head / 100) * C.KNOCKDOWN.lowHeadMult) * (1.45 - o.s.chin / 100);
        if (this.rng.chance(p)) { this.breakClinch(null, null, true); this.knockdown(f, o); }
      }
    }
    breakClinch(msg, who, silent) {
      const [a, b] = this.f; const mid = (a.x + b.x) / 2, s = a.x <= b.x ? 1 : -1, g = C.CLINCH.breakGap;
      a.x = clamp(mid - s * g / 2, C.ARENA.left, C.ARENA.right); b.x = clamp(mid + s * g / 2, C.ARENA.left, C.ARENA.right);
      this.mode = 'stand'; this.clinch = null; a.setState('idle'); b.setState('idle'); a.act = b.act = null;
      if (who) this.answer(who);
      if (msg && !silent) this.text(msg, who);
    }

    // ===================== GROUND =====================
    startGround(top, bot, pos) {
      this.mode = 'ground'; this.clinch = null;
      this.ground = { top, bot, pos, t: 0, idleT: 0, escape: 0, workCalled: false, turnedUntil: 0 };
      top.setState('ground'); bot.setState('ground'); top.act = bot.act = null; top.cd = bot.cd = 350; top.mv = bot.mv = null; top.hitbox = bot.hitbox = null;
      bot.x = clamp(bot.x, C.ARENA.left + 90, C.ARENA.right - 90);
      // the bottom fighter lies with feet toward the top fighter
      bot.facing = top.x >= bot.x ? 1 : -1;
      this.placeGround();
      this.emit('position', { pos });
    }
    placeGround() {
      const g = this.ground, P = GROUND_POS[g.pos], s = (g.top.size + g.bot.size) / 2;
      if (g.pos === 'back') { /* both face the same way */ }
      g.top.x = g.bot.x + g.bot.facing * P.topDx * s;
      g.top.facing = P.topFacing === 'same' ? g.bot.facing : -g.bot.facing;
    }
    groundLabels(f) {
      const g = this.ground; if (!g) return {};
      const role = g.top === f ? 'top' : 'bot', GP = GROUND_POS[g.pos], P = GP[role], out = {};
      const key = GP.uiKey + (role === 'top' ? 'Top' : 'Bottom');
      for (const k of ['j', 'k', 'l', 'u']) out[k] = P[k] ? (CK.Text ? CK.Text.contextLabel(key, k, P[k].label) : P[k].label) : '-';
      return out;
    }
    setGroundPos(pos, by) {
      const g = this.ground; g.pos = pos; g.idleT = 0; g.escape = 0; g.workCalled = false; this.placeGround();
      if (pos === 'mount') this.callout('mount', 'MOUNT', by || g.top, '#ffcf3f');
      else if (pos === 'back' && by === g.top) this.callout('backTake', 'BACK TAKE', by, '#ffcf3f');
      else this.text(GROUND_POS[pos].label.toUpperCase(), by || g.top, '#ffcf3f');
      this.emit('position', { pos });
    }
    stepGround(intents, dt) {
      const g = this.ground, G = C.GROUND; g.t += dt; g.idleT += dt;
      g.top.rs.ctrl += dt / 1000; g.bot.rs.bottom += dt / 1000;
      for (const f of [g.top, g.bot]) {
        const it = intents[f.idx]; f.stT += dt; f.blockHeld = !!it.block;
        f.stam = Math.min(f.maxStam, f.stam + C.STAMINA.regenGround * f.regenMult() * dt / 1000 * (f === g.top ? 1.2 : 0.9));
        if (f.act) {
          f.act.t += dt;
          if (!f.act.done && f.act.t >= f.act.wind) { f.act.done = true; this.groundStrikeLand(f, f.opp, f.act); if (this.mode !== 'ground' || this.phase !== 'fight') return; }
          if (f.act && f.act.t >= f.act.dur) f.act = null;
          continue;
        }
        if (f.cd > 0) continue;
        const role = f === g.top ? 'top' : 'bot';
        const P = GROUND_POS[g.pos][role];
        for (const k of ['j', 'k', 'l', 'u']) {
          if (!it.pressed[k] || !P[k]) continue;
          this.groundAction(f, f.opp, it.low && P[k].low ? Object.assign({}, P[k], P[k].low) : P[k], role);
          break;
        }
        if (this.mode !== 'ground' || this.phase !== 'fight') return;
      }
      // stall: "Work!" then stand-up
      if (g.idleT >= G.stallWorkMs && !g.workCalled) { g.workCalled = true; g.top.rs.stall = g.bot.rs.stall = 1; this.callout('refWork', 'WORK!', null, '#fff'); this.emit('sound', { name: 'ref_work' }); this.emit('sound', { name: 'boos' }); }
      if (g.idleT >= G.standupMs) { this.callout('refStandUp', 'STAND UP', null, '#fff'); this.emit('sound', { name: 'ref_standup' }); this.emit('sound', { name: 'vo_standup' }); this.standUp(null); }
    }
    groundAction(f, o, a, role) {
      const g = this.ground, G = C.GROUND, rng = this.rng;
      if (a.act === 'strike') {
        const gs = GROUND_STRIKES[a.strike], cfg = G[gs.cfg]; const heavy = !!a.heavy || gs.elbow;
        const dmg = (a.heavy ? cfg.dmg * 1.5 : cfg.dmg);
        f.spend(a.heavy ? cfg.stam * 1.6 : cfg.stam); f.rs.thrown++;
        f.act = { name: a.strike, t: 0, wind: gs.wind * (a.heavy ? 1.6 : 1), dur: gs.dur * (a.heavy ? 1.6 : 1), dmg, heavy, elbow: gs.elbow };
        f.cd = 0; return;
      }
      if (a.act === 'sub') { f.spend(G.subStam); f.cd = G.subCd; return this.startSub(f, o, a.sub, 'ground'); }
      if (a.act === 'advance') {
        f.spend(G.advanceStam); f.cd = G.advanceCd; g.idleT = 0;
        let p = G.advanceBase + (f.s.grappling - o.s.defense) * 0.006 + (f.s.strength - o.s.strength) * 0.002 + (o.gassed ? 0.15 : 0) - (o.blockHeld ? 0.08 : 0);
        if (a.to === 'mount' && f.disc === 'WR') p += G.wrestlingMountBonus;
        if (a.to === 'back' && f.disc === 'BJJ') p += G.bjjBackBonus;
        if (a.to === 'back' && g.turnedUntil > this.time) p += 0.25;   // bottom turned away after a failed bridge
        if (rng.chance(clamp(p, 0.06, 0.9))) this.setGroundPos(a.to, f); else { this.text('BLOCKED', o, '#7fd3ff'); this.answer(o); }
        return;
      }
      if (a.act === 'scramble') {
        f.spend(G.scrambleStam); f.cd = G.scrambleCd; g.idleT = Math.max(0, g.idleT - 2000);
        const p = G.scrambleBase + (f.s.strength + f.s.grappling - o.s.strength - o.s.grappling) * 0.003 + (o.gassed ? 0.15 : 0) - (f.gassed ? 0.12 : 0) + (f.appr === 'PRESSURE' || f.disc === 'BOX' ? 0.04 : 0);
        if (rng.chance(clamp(p, 0.06, 0.85))) { this.callout('scramble', 'BACK UP!', f, '#7fd3ff'); this.standUp(f); } else this.text('HELD DOWN', o);
        return;
      }
      if (a.act === 'sweep') {
        f.spend(G.sweepStam); f.cd = G.sweepCd; g.idleT = 0;
        const p = G.sweepBase + (f.disc === 'BJJ' ? G.bjjSweepBonus : 0) + (f.s.grappling - o.s.grappling) * 0.006 + (o.gassed ? 0.12 : 0) + (o.act ? 0.1 : 0);
        if (rng.chance(clamp(p, 0.05, 0.85))) { this.answer(f); this.callout('reversal', 'SWEEP!', f, '#ffcf3f'); this.startGround(f, o, 'guard'); } else this.text('BASED OUT', o);
        return;
      }
      if (a.act === 'escape') {
        const kind = a.kind; const cost = kind === 'bridge' ? G.bridgeStam : G.turnStam; f.spend(cost); f.cd = G.bridgeCd; g.idleT = Math.max(0, g.idleT - 1500);
        let p = (kind === 'bridge' ? G.bridgeBase : G.turnBase) + (f.s.strength - o.s.strength) * 0.004 + (f.s.grappling - o.s.grappling) * 0.003 + (o.gassed ? 0.12 : 0);
        if (f.stam < 30) p *= 0.4;   // bridge is a stamina check
        if (rng.chance(clamp(p, 0.04, 0.8))) { this.answer(f); if (kind === 'bridge') this.callout('bridgeEscape', 'BRIDGE ESCAPE', f, '#7fd3ff'); else this.text('ESCAPED', f, '#7fd3ff'); f.act = { name: 'bridge', t: 0, wind: 99999, dur: 400 }; this.setGroundPos(a.to, f); }
        else { if (kind === 'bridge') g.turnedUntil = this.time + 1500; this.text('PINNED', o); }
        return;
      }
      if (a.act === 'handfight') {
        f.spend(G.handFightStam); f.cd = 160;
        g.escape += G.handFightPerPress * (0.6 + (f.s.grappling + f.s.defense) / 250) * (f.gassed ? 0.6 : 1);
        g.escape -= 0; if (g.escape >= 100) { this.answer(f); this.text('ESCAPED THE BACK', f, '#7fd3ff'); this.setGroundPos(a.to, f); }
        return;
      }
    }
    groundStrikeLand(f, o, act) {
      const g = this.ground, G = C.GROUND; g.idleT = 0;
      const role = g.top === f ? 'top' : 'bot';
      const posMult = role === 'bot' ? G.posDmg.guardBottom : (G.posDmg[GROUND_POS[g.pos].dmgKey] || 1);
      let dmg = act.dmg * f.powerMult() * posMult * (f.disc === 'WR' ? 1.1 : 1) * this.rng.range(0.85, 1.15);
      if (o.blockHeld && g.pos !== 'back') { dmg *= G.blockMult; this.answer(o); this.emit('sound', { name: 'block' }); o.head -= dmg * 0.6; return; }
      if (o.blockHeld && g.pos === 'back') dmg *= 0.6;
      this.applyDamage(f, o, dmg, 'head', 0, act.heavy, null, { elbow: act.elbow, detail: act.elbow ? 'Elbows on the ground' : 'Ground and pound' });
    }
    standUp(by) {
      const [a, b] = this.f; const mid = clamp((a.x + b.x) / 2, C.ARENA.left + 100, C.ARENA.right - 100);
      const s = a.x <= b.x ? 1 : -1; a.x = mid - s * 80; b.x = mid + s * 80;
      this.mode = 'stand'; this.ground = null; a.setState('getup', 380); b.setState('getup', 380); a.act = b.act = null; a.cd = b.cd = 0;
      if (by) this.answer(by);
    }

    // ===================== SUBMISSION MINIGAME =====================
    startSub(att, def, name, from) {
      const S = C.SUB;
      att.rs.subAtt++;
      this.sub = { name, att, def, bar: S.startBar + (S.entryBonus[name] || 0) + (att.s.grappling - def.s.grappling) * 0.1, t: 0, from, groundPos: this.ground ? this.ground.pos : null, attWasTop: this.ground ? this.ground.top === att : null, peak: 0 };
      this.sub.peak = this.sub.bar;
      this.prevMode = this.mode; this.mode = 'sub';
      att.act = def.act = null; att.mv = def.mv = null; att.hitbox = def.hitbox = null; att.setState('sub'); def.setState('sub');
      const sz = (att.size + def.size) / 2;
      if (name === 'guillotine') { att.facing = def.x >= att.x ? 1 : -1; def.facing = -att.facing; def.x = clamp(att.x + att.facing * 50 * sz, C.ARENA.left, C.ARENA.right); }
      else if (name === 'rnc') { att.facing = def.facing; att.x = def.x - def.facing * 30 * sz; }
      else { att.facing = def.x >= att.x ? 1 : -1; def.facing = -att.facing; def.x = clamp(att.x + att.facing * 62 * sz, C.ARENA.left, C.ARENA.right); }
      this.text((CK.Text ? CK.Text.label('submissions', name, S.names[name]) : S.names[name]).toUpperCase() + '!', att, '#ff4dff'); this.emit('subStart', { name }); this.emit('sound', { name: 'sub_lock' }); this.emit('sound', { name: 'crowd_ooh' });
      if (this.ground) this.ground.idleT = 0;
    }
    subBeat() { const S = C.SUB, ph = (this.sub.t % S.beatMs); return Math.min(ph, S.beatMs - ph) <= S.beatWindowMs; }
    stepSub(intents, dt) {
      const s = this.sub, S = C.SUB; s.t += dt;
      for (const f of [s.att, s.def]) {
        f.stT += dt;
        const p = intents[f.idx].pressed; if (!(p.j || p.k || p.l || p.u)) continue;
        if (this.time - f.lastSubPress < S.minPressGapMs) { f.lastSubPress = this.time; continue; } // mashing too fast is wasted
        f.lastSubPress = this.time;
        const onBeat = this.subBeat();
        let pow = S.press * (0.6 + f.s.grappling / 100 * 0.8) * (onBeat ? S.onBeatMult : S.offBeatMult) * (f.disc === 'BJJ' ? S.bjjMult : 1) * (f.gassed ? S.gassedMult : 1);
        if (f === s.def) pow *= 0.95 + f.s.strength / 400;
        f.spend(S.pressStam);
        s.bar += f === s.att ? pow : -pow;
        this.emit('subPress', { who: f.idx, onBeat });
      }
      s.bar += S.drift * dt / 1000; s.peak = Math.max(s.peak, s.bar);
      if (s.bar >= 100) {
        if (s.peak >= 75) s.att.rs.nearSub++;
        return this.finish(s.att, 'SUB', S.names[s.name]);
      }
      if (s.bar <= 0 || s.t >= S.timeoutMs) {
        if (s.peak >= 75) s.att.rs.nearSub++;
        this.answer(s.def); s.def.rs.subEsc++; this.callout('submissionEscape', 'ESCAPED!', s.def, '#7fd3ff'); this.emit('sound', { name: 'sub_escape' }); this.emit('subEnd', { escaped: true });
        const { att, def } = s; this.sub = null;
        if (s.from === 'ground' && this.ground) {
          // escape outcomes: back -> guard (att stays top); mount armbar -> guard (att top); guard subs from bottom -> guard; top armbar -> guard with att top
          this.mode = 'ground'; att.setState('ground'); def.setState('ground');
          const pos = s.groundPos === 'back' || s.groundPos === 'mount' ? 'guard' : s.groundPos;
          this.ground.pos = pos; this.ground.idleT = 0; this.ground.escape = 0; this.placeGround(); this.ground.top.cd = this.ground.bot.cd = 500;
        } else { this.mode = 'stand'; this.ground = null; this.clinch = null; const [a, b] = this.f; const s2 = a.x <= b.x ? 1 : -1, mid = (a.x + b.x) / 2; a.x = mid - s2 * 75; b.x = mid + s2 * 75; att.setState('idle'); def.setState('hitstun', 200); }
      }
    }

    // ===================== ROUNDS / FINISH / JUDGING =====================
    endRound() {
      this.emit('sound', { name: 'bell' });
      const sc = this.scoreRound(this.round - 1);
      this.roundScores = this.roundScores || []; this.roundScores.push(sc);
      if (this.round >= this.rounds) return this.decision();
      this.phase = 'break'; this.phaseT = 0; this.mode = 'stand'; this.sub = null; this.clinch = null; this.ground = null;
      // corner: did not answer the bell?
      for (const f of this.f) {
        if (f.head < C.REF.bellHeadBelow && this.rng.chance(C.REF.bellChance)) { this.phase = 'fight'; return this.finish(f.opp, 'TKO', 'Did not answer the bell', true); }
      }
      this.emit('roundEnd', { round: this.round, scores: sc });
    }
    nextRound() {
      if (this.phase !== 'break') return;
      for (const f of this.f) {
        f.stam = Math.min(f.maxStam, f.stam + (f.maxStam - f.stam) * C.STAMINA.betweenRounds);
        f.head = Math.min(100, f.head + C.HEALTH.headHealBetweenRounds); f.ref = 0;
        if (f.legGone) { f.leg = Math.max(f.leg, 15); f.legGone = false; }
      }
      this.round++; this.startRound();
    }
    finish(winner, method, detail, betweenRounds) {
      if (this.phase === 'over' || this.phase === 'finish') return;
      const loser = winner.opp;
      const elapsed = C.ROUND_SECONDS * 1000 - Math.max(0, this.roundLeft);
      this.result = { winner: winner.idx, method, detail, round: this.round, clock: betweenRounds ? '5:00' : this.clockFor(elapsed), cards: null, roundScores: this.roundScores || [] };
      this.phase = 'finish'; this.phaseT = 0; winner.setState('victory'); loser.setState(method === 'SUB' ? 'tapped' : method === 'TKO' && this.mode !== 'stand' ? 'tapped' : 'ko');
      if (method === 'KO' || (method === 'TKO' && this.mode === 'stand')) loser.setState('ko');
      if (this.mode === 'stand' || method === 'KO') { this.mode = 'stand'; this.ground = null; this.clinch = null; }
      this.sub = null;
      const cat = method === 'SUB' ? 'submission' : method === 'KO' ? 'ko' : detail === 'Did not answer the bell' ? 'didNotAnswerBell' : /leg/.test(detail) ? 'tkoLegDamage' : 'tko';
      this.callout(cat, method === 'SUB' ? 'TAP OUT!' : method === 'KO' ? 'K.O.!' : 'T.K.O.!', loser, '#ff4d4d');
      if (method === 'SUB') { this.emit('sound', { name: 'tap' }); this.emit('sound', { name: 'vo_submission' }); this.emit('sound', { name: 'crowd_swell' }); }
      else if (betweenRounds) { this.emit('sound', { name: 'ref_stop' }); this.emit('sound', { name: 'crowd_swell' }); }
      else { this.emit('sound', { name: 'ref_stoppage' }); this.emit('sound', { name: method === 'KO' ? 'vo_ko' : 'vo_tko' }); }
      this.emit('sound', { name: 'bell' });
    }
    // 60s rounds show a 5:00 clock at 5x; returns display string for elapsed real ms
    clockFor(elapsedMs) { const disp = Math.round(elapsedMs / 1000 * C.CLOCK.displaySeconds / C.ROUND_SECONDS); return Math.floor(disp / 60) + ':' + String(disp % 60).padStart(2, '0'); }
    clockLeft() { const s = Math.max(0, Math.ceil(this.roundLeft / 1000 * C.CLOCK.displaySeconds / C.ROUND_SECONDS)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

    // per-round criteria for each fighter
    roundCriteria(ri) {
      const J = C.JUDGE; const rs = this.roundStats[ri];
      return rs.map(r => ({ dmg: r.dmg + r.kd * J.kdDmg + r.nearSub * J.nearSubDmg, aggr: r.thrown + r.fwd / 120 + r.tdAtt * 2 + r.subAtt * 2, ctrl: r.ctrl, kd: r.kd }));
    }
    scoreRound(ri, noNoise) {
      const J = C.JUDGE, cr = this.roundCriteria(ri), out = [];
      for (let j = 0; j < 3; j++) {
        // judges disagree: each judge perceives each fighter's damage / aggression / control with its own +/-noise
        const n = () => noNoise ? 1 : 1 + this.rng.range(-J.noise, J.noise);
        const d = [cr[0].dmg * n(), cr[1].dmg * n()], ag = [cr[0].aggr * n(), cr[1].aggr * n()], ct = [cr[0].ctrl * n(), cr[1].ctrl * n()];
        let win;
        const md = Math.max(d[0], d[1], 1);
        if (Math.abs(d[0] - d[1]) / md > J.tieMargin) win = d[0] > d[1] ? 0 : 1;
        else if (Math.abs(ag[0] - ag[1]) / Math.max(ag[0], ag[1], 1) > 0.1) win = ag[0] > ag[1] ? 0 : 1;
        else if (Math.abs(ct[0] - ct[1]) > 1) win = ct[0] > ct[1] ? 0 : 1;
        else win = d[0] !== d[1] ? (d[0] > d[1] ? 0 : 1) : (noNoise ? 0 : (this.rng() < 0.5 ? 0 : 1));
        const lose = 1 - win, ratio = cr[win].dmg / Math.max(1, cr[lose].dmg);
        const tenEight = (cr[win].kd > cr[lose].kd && ratio >= 1.8) || (ratio >= J.tenEightRatio && cr[win].dmg - cr[lose].dmg >= J.tenEightMin);
        const sc = [0, 0]; sc[win] = 10; sc[lose] = tenEight ? 8 : 9; out.push(sc);
      }
      return out;
    }
    decision() {
      const scores = this.roundScores; const totals = [0, 1, 2].map(j => scores.reduce((t, r) => [t[0] + r[j][0], t[1] + r[j][1]], [0, 0]));
      let w0 = 0, w1 = 0, dr = 0; totals.forEach(t => t[0] > t[1] ? w0++ : t[1] > t[0] ? w1++ : dr++);
      let winner = -1, kind;
      if (w0 === 3 || w1 === 3) { winner = w0 === 3 ? 0 : 1; kind = 'Unanimous decision'; }
      else if ((w0 === 2 && w1 === 1) || (w1 === 2 && w0 === 1)) { winner = w0 > w1 ? 0 : 1; kind = 'Split decision'; }
      else if ((w0 === 2 && dr === 1) || (w1 === 2 && dr === 1)) { winner = w0 > w1 ? 0 : 1; kind = 'Majority decision'; }
      else kind = w0 === w1 && w0 === 1 ? 'Split draw' : (dr === 3 ? 'Unanimous draw' : 'Majority draw');
      const ordered = totals.map(t => winner === 1 ? `${t[1]}-${t[0]}` : `${t[0]}-${t[1]}`);
      this.result = { winner, method: winner === -1 ? 'DRAW' : 'DEC', detail: kind, round: this.rounds, clock: '5:00', cards: totals, roundScores: scores,
        readout: ordered.join(', ') + ', ' + kind.toLowerCase() };
      this.phase = 'finish'; this.phaseT = 0; this.mode = 'stand'; this.ground = null; this.clinch = null; this.sub = null;
      this.f.forEach(f => f.setState(f.idx === winner ? 'victory' : 'idle'));
      this.callout(winner === -1 ? 'draw' : kind === 'Split decision' ? 'splitDecision' : kind === 'Majority decision' ? 'majorityDecision' : 'unanimousDecision', kind.toUpperCase(), null, '#fff');
    }
    // live scorecard estimate (for the corner screen)
    estimate() { const t = [0, 0]; (this.roundScores || []).forEach(r => { const z = r[0]; t[0] += z[0]; t[1] += z[1]; }); return t; }

    // context labels for HUD/touch
    labelsFor(f) {
      if (this.mode === 'clinch') return this.clinchLabels(f);
      if (this.mode === 'ground') return this.groundLabels(f);
      if (this.mode === 'sub') return { j: 'TAP', k: 'TAP', l: 'TAP', u: 'TAP' };
      const d = this.dist(), o = f.opp, L = (k, fb) => CK.Text ? CK.Text.contextLabel('standing', k, fb) : fb;
      return {
        j: L('j', 'JAB'), k: f.disc === 'MT' && d < C.MOVES.elbow.closeOnly * f.size ? 'ELBOW' : L('k', 'POWER'),
        l: L('l', 'KICK'), u: o.st === 'shoot' ? 'GUILLOTINE' : f.catchUntil > this.time ? 'DUMP!' : L('u', 'GRAB')
      };
    }
  }

  CK.Fight = Fight; CK.GROUND_POS = GROUND_POS; CK.GROUND_STRIKES = GROUND_STRIKES;
})();
