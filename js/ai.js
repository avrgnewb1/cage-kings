/* CAGE KINGS - ai.js : AI controller (3 difficulties) + player controller + test dummies.
 * AI plays to its discipline and approach and respects stamina (it backs off to recover).
 */
(function () {
  const C = CK.CONFIG;
  const blank = () => ({ dir: 0, low: false, up: false, block: false, pressed: {} });

  class PlayerController {
    constructor() { this.human = true; }
    update(fight, me) {
      const s = CK.Input.poll(); CK.Input.playerFacing = me.facing;
      return { dir: (s.right ? 1 : 0) - (s.left ? 1 : 0), low: s.low, up: s.up, block: s.block, pressed: s.pressed };
    }
  }

  class AIController {
    constructor(level, def) {
      this.level = level; this.L = C.AI[level] || C.AI.normal; this.def = def;
      this.A = CK.DATA.APPROACHES[def.appr].ai; this.disc = def.disc;
      this.t = 0; this.nextThink = 0; this.queue = []; this.threat = null; this.lastOppSt = null; this.mode = 'fight';
      this.blockUntil = 0; this.counterAt = 0; this.recovering = false; this.jitter = 0; this.subNext = 0;
    }
    update(fight, me, o, dt) {
      this.t += dt; const it = blank(); const rng = fight.rng;
      if (fight.mode === 'sub') return this.subPlay(fight, me, it, rng);
      if (fight.mode === 'clinch') return this.clinchPlay(fight, me, o, it, rng);
      if (fight.mode === 'ground') return this.groundPlay(fight, me, o, it, rng);
      return this.standPlay(fight, me, o, it, rng);
    }
    press(it, k, opt) { it.pressed[k] = true; if (opt) { it.low = !!opt.low; it.up = !!opt.up; if (opt.fwd) it.dir = opt.fwd; } }

    standPlay(fight, me, o, it, rng) {
      const L = this.L, A = this.A, dist = fight.dist(), s = me.size, fwd = me.facing;
      // --- perceive threats with a reaction delay
      const threatSt = (o.st === 'attack' || o.st === 'shoot' || o.st === 'grab') ? o.st + ':' + (o.mvKey || '') : null;
      if (threatSt && threatSt !== this.lastOppSt) {
        this.threat = { kind: o.st, mv: o.mvKey, at: this.t + L.react * rng.range(0.75, 1.25), decided: false };
      }
      this.lastOppSt = threatSt; if (!threatSt) this.threat = null;
      const free = me.st === 'idle' || me.st === 'walk' || me.st === 'block';
      // caught a kick -> dump him
      if (me.catchUntil > fight.time && free) { if (this.catchPick == null || this.catchPick < me.catchUntil - 2000) { this.catchPick = me.catchUntil; this.catchDump = rng.chance(C.AI.weights.catchDump[this.disc] || 0.3); } this.press(it, this.catchDump ? 'i' : 'k'); return it; }
      // opponent down -> pounce (grapplers) or wait
      if (o.st === 'knockdown' && free) {
        if (rng.chance((0.02 + A.grapple * 0.08) * (this.level === 'easy' ? 0.5 : 1)) && dist < 170 * s) { this.press(it, 'i'); return it; }
        it.dir = dist > 160 * s ? fwd : 0; return it;
      }
      // anticipatory guard (QA CK-05): a jab (~85 ms) is faster than any reaction, so the AI could never block one.
      // Like a real fighter it reads rhythm: after the opponent has thrown in range recently, it pre-loads the guard.
      if (o.st === 'attack' && o.mvTimes && o.mvTimes !== this.lastMvObj && (o.mvKey === 'jab' || o.mvKey === 'jab_body')) {   // the read is on the jab rhythm
        this.lastMvObj = o.mvTimes; this.recentAtk = (this.recentAtk || []).filter(x => this.t - x < 1800); this.recentAtk.push(this.t);
      }
      if (this.recentAtk && this.recentAtk.length && this.t - this.recentAtk[this.recentAtk.length - 1] > 1800) this.recentAtk = [];
      const inJabRange = dist < C.MOVES.jab.reach * o.size * o.reach + 30;
      if (free && inJabRange && this.t >= (this.guardCheck || 0)) {
        this.guardCheck = this.t + 400;
        // reading a busy opponent: high guard most of the time; otherwise a fighter in range still keeps his hands up now and then
        const busy = this.recentAtk && this.recentAtk.length >= 2;
        const pg = busy ? L.block * 0.8 + (A.counter > 0.6 ? 0.1 : 0) - (me.gassed ? 0.2 : 0) : L.block * 0.3;
        this.guardUntil = rng.chance(pg) ? this.t + 380 : 0;
        if (this.guardUntil && rng.chance(L.counter * (0.4 + A.counter))) this.counterAt = this.t + 320;
      }
      if (free && this.guardUntil && this.t < this.guardUntil && o.st !== 'shoot') { it.block = true; it.low = o.mvKey === 'leg_kick'; return it; }
      if (this.threat && this.t >= this.threat.at && free) {
        const th = this.threat;
        if (!th.decided) {
          th.decided = true;
          if (th.kind === 'attack') {
            const reach = o.mv ? o.mv.reach * o.size * o.reach + 30 : 140;
            th.inRange = dist < reach;
            th.block = th.inRange && rng.chance(L.block + (A.counter > 0.6 ? 0.12 : 0) - (me.gassed ? 0.15 : 0));
            th.perfect = th.block && rng.chance(L.perfect * (A.counter > 0.6 ? 1.5 : 1));
            th.low = o.mvKey === 'leg_kick' && rng.chance(0.5 + L.block * 0.4);
            th.counter = th.block && rng.chance(L.counter * (0.4 + A.counter));
            th.back = !th.block && th.inRange && rng.chance(0.25 + A.counter * 0.3);
          } else if (th.kind === 'shoot') {
            th.sprawl = rng.chance(L.sprawl + (this.disc === 'WR' ? 0.15 : 0));
            const KC = C.AI.weights.kneeCounter;   // CK-03: any striker can time a knee, Muay Thai most often
            th.knee = !th.sprawl && rng.chance((KC[this.disc] != null ? KC[this.disc] : KC.other) * (0.6 + L.counter));
            th.guillo = !th.sprawl && !th.knee && rng.chance(this.disc === 'BJJ' ? 0.4 : this.def.id === 'hollander' ? 0.4 : 0.1);
          }
        }
        if (th.kind === 'attack' && o.st === 'attack') {
          if (th.block) {
            const remain = o.mvTimes ? o.mvTimes.s - o.mvT : 0;
            if (!th.perfect || remain < 110) { it.block = true; it.low = th.low; }
            if (th.counter) this.counterAt = this.t + 60;
            return it;
          }
          if (th.back) { it.dir = -fwd; return it; }
        } else if (th.kind === 'shoot' && o.st === 'shoot') {
          if (th.sprawl) { it.block = true; it.low = true; return it; }
          if (th.knee && dist < 150 * s) { this.press(it, 'l'); return it; }
          if (th.guillo && dist < 130 * s) { this.press(it, 'u'); return it; }
        }
      }
      // counter into the opponent's recovery too (a jab spammer is never out of 'attack', so counters never fired)
      if (this.counterAt && this.t >= this.counterAt && free && !(o.st === 'attack' && o.mvTimes && o.mvT < o.mvTimes.s + o.mvTimes.a)) {
        this.counterAt = 0;
        if (dist < 130 * s * me.reach) { this.press(it, rng.chance(0.55) ? 'k' : 'j'); return it; }
      }
      if (!free) {
        // chain hook -> uppercut for boxers
        if (me.st === 'attack' && me.mvKey === 'hook' && me.hitDone && rng.chance(0.3)) this.press(it, 'k');
        return it;
      }
      // --- stamina management
      const floor = L.floor * A.floorMult;
      if (me.stam < floor) this.recovering = true;
      if (this.recovering && me.stam > Math.min(me.maxStam * 0.85, floor + 35)) this.recovering = false;
      if (this.recovering) {
        it.dir = dist < 230 * s ? -fwd : 0;
        if (o.st === 'walk' && dist < 150 * s && rng.chance(0.03)) it.block = true;
        if (dist < 130 * s && me.stam > 12 && rng.chance(0.02)) this.press(it, 'j');
        return it;
      }
      // --- queued combo
      if (this.queue.length && me.st !== 'attack') { const q = this.queue.shift(); this.press(it, q.k, q); return it; }
      // --- think
      if (this.t >= this.nextThink) {
        this.nextThink = this.t + L.think * rng.range(0.7, 1.3) / (0.6 + A.aggression * 0.6);
        this.jitter = rng.range(-20, 20);
        const act = this.chooseAttack(fight, me, o, dist, rng);
        if (act) { this.press(it, act.k, act); if (act.then) this.queue = act.then.slice(); return it; }
      }
      // --- footwork toward preferred range
      if (this.stepUntil && this.t < this.stepUntil) { it.dir = fwd; return it; }
      const R = this.A.range * s + this.jitter;
      if (dist > R + 18) it.dir = fwd;
      else if (dist < R - 28 && A.forward < 0.7) it.dir = -fwd;
      else if (A.forward >= 0.9 && dist > R) it.dir = fwd;
      if (rng.chance(L.mistake * 0.02)) it.dir = -it.dir;
      return it;
    }
    chooseAttack(fight, me, o, dist, rng) {
      const A = this.A, L = this.L, s = me.size, M = C.MOVES, disc = this.disc;
      if (!rng.chance(Math.min(0.95, A.aggression * (this.level === 'easy' ? 0.75 : 1) * (o.gassed && this.level !== 'easy' ? 1.8 : 1)))) return null;   // jump on a gassed opponent
      const can = (mk) => me.stam > M[mk].stam * me.costMult() + L.floor * A.floorMult * 0.6;
      const reach = (mk) => M[mk].reach * s * me.reach;
      const w = {};
      if (dist < reach('jab') + 6 && can('jab')) { w.jab = 1.0; w.jab2 = disc === 'BOX' || A.aggression > 0.6 ? 0.6 : 0.2; w.jab_body = 0.25; }
      if (dist < reach('power') + 4 && can('power')) { w.power = A.power * 1.4; w.onetwo = A.power * 0.8; w.power_body = A.power * 0.4; }
      const kickW = (disc === 'MT' ? 0.6 : disc === 'BOX' ? 0.08 : 0.22) + (A.kicks || 0);
      if (dist < reach('leg_kick') + 4 && dist > 70 * s && can('leg_kick')) w.leg_kick = kickW * (disc === 'MT' ? 1.3 : 0.8);
      if (dist < reach('kick_body') + 4 && dist > 90 * s && can('kick_body')) { w.kick_body = kickW * 0.8; w.kick_head = kickW * 0.35; }
      if (disc === 'MT' && dist < reach('teep') && dist > 80 * s && can('teep')) w.teep = o.st === 'walk' && o.facing * (me.x - o.x) > 0 ? 0.9 : 0.25;
      if (disc === 'MT' && dist < M.elbow.closeOnly * s && can('elbow')) w.elbow = 0.6;
      if (me.appr === 'CREATIVE' && dist < reach('spin_fist') && can('spin_fist')) w.spin_fist = 0.35;
      if (me.appr === 'CREATIVE' && dist < reach('spin_kick') && dist > 90 * s && can('spin_kick')) w.spin_kick = 0.3;
      const AW = C.AI.weights;
      if (dist < AW.clinchRange * s && me.stam > 15) w.clinch = A.grapple * 0.9 + (AW.clinchDisc[disc] || 0.1);
      if (dist < C.TAKEDOWN.maxRange * s && dist > 80 * s && me.stam > 22) if (this.t - (this.lastShot || -1e9) >= AW.shotCooldownMs * (o.gassed ? 0.5 : 1)) {   // a gassed striker is there to be taken down
        w.shoot = Math.max(A.grapple, AW.grappleFloor[disc] || 0) * (AW.shootDisc[disc] || 0.1) * (o.gassed ? 1.5 : 1); if (dist > reach('jab') + 6) w.step = AW.stepIn; }
      if (disc === 'BJJ' && dist < C.TAKEDOWN.guardPullRange * s && me.stam > 15) w.pull = 0.35;
      if (!Object.keys(w).length) return null;
      const pick = rng.weighted(w);
      switch (pick) {
        case 'jab': return { k: 'j' };
        case 'jab2': return { k: 'j', then: [{ k: 'j' }].concat(rng.chance(0.5) ? [{ k: 'k' }] : []) };
        case 'jab_body': return { k: 'j', low: true };
        case 'power': return { k: 'k' };
        case 'onetwo': return { k: 'j', then: [{ k: 'k' }] };
        case 'power_body': return { k: 'k', low: true };
        case 'leg_kick': return { k: 'l', low: true };
        case 'kick_body': return { k: 'l' };
        case 'kick_head': return { k: 'l', up: true };
        case 'teep': return { k: 'l', fwd: me.facing };
        case 'elbow': return { k: 'k' };
        case 'spin_fist': return { k: 'k', fwd: -me.facing };
        case 'spin_kick': return { k: 'l', fwd: -me.facing };
        case 'clinch': return { k: 'u' };
        case 'shoot': this.lastShot = this.t; return { k: 'i' };
        case 'pull': return { k: 'i' };
        case 'step': this.stepUntil = this.t + C.AI.weights.stepInMs; return null;
      }
      return null;
    }

    clinchPlay(fight, me, o, it, rng) {
      const L = this.L, A = this.A, c = fight.clinch;
      if (o.act && !o.act.done && rng.chance(L.block * 0.08)) this.blockUntil = this.t + 400;
      if (this.t < this.blockUntil) { it.block = true; return it; }
      if (me.cd > 0 || me.act || this.t < this.nextThink) return it;
      this.nextThink = this.t + L.think * rng.range(0.8, 1.4);
      const controlled = c.ctrl === o && c.thai;
      const w = { punch: 0.6, elbow: this.disc === 'MT' ? 0.7 : 0.3, knee: this.disc === 'MT' ? 1.2 : 0.6, td: A.grapple * (this.disc === 'WR' ? 1.6 : 1) * C.AI.weights.clinchTd, brk: ((controlled ? 1.0 : 0.25) + (me.stam < 30 ? 0.8 : 0) + A.counter * 0.5) * C.AI.weights.clinchBreak,
        guillo: (this.disc === 'BJJ' || this.def.id === 'hollander') ? 0.15 : 0.02 };
      if (me.stam < 14) return it;
      const pick = rng.weighted(w);
      if (pick === 'punch') this.press(it, 'j'); else if (pick === 'elbow') this.press(it, 'k'); else if (pick === 'knee') this.press(it, 'l'); else if (pick === 'td') this.press(it, 'i');
      else if (pick === 'brk') this.press(it, 'u'); else { it.low = true; this.press(it, 'u'); it.low = true; }
      return it;
    }

    groundPlay(fight, me, o, it, rng) {
      const g = fight.ground, L = this.L, A = this.A, top = g.top === me;
      // bottom blocks incoming strikes after the reaction delay
      if (!top && o.act && !o.act.done) {
        if (!this.gBlock) this.gBlock = { at: this.t + L.react * rng.range(0.7, 1.2), yes: rng.chance(L.block * 0.9) };
        if (this.gBlock.yes && this.t >= this.gBlock.at) { it.block = true; return it; }
      } else this.gBlock = null;
      if (me.cd > 0 || me.act || this.t < this.nextThink) { if (!top && rng.chance(0.3)) it.block = this.lastGBlock; return it; }
      this.nextThink = this.t + L.think * rng.range(0.6, 1.2) * (top ? 0.9 : 1.1);
      const P = CK.GROUND_POS[g.pos][top ? 'top' : 'bot'];
      const w = {};
      const grap = this.disc === 'BJJ' ? 1.6 : this.disc === 'WR' ? 1.2 : 0.7;
      for (const k of ['j', 'k', 'l', 'u']) {
        const a = P[k]; if (!a) continue;
        if (a.act === 'strike') w[k] = (a.heavy || a.strike.indexOf('heavy') >= 0 ? 0.5 : 1.0) * (me.stam > 18 ? 1 : 0.1) * (A.power > 0.3 ? 1.2 : 1);
        else if (a.act === 'advance') w[k] = 0.35 * grap;
        else if (a.act === 'sub') w[k] = (0.05 + (o.gassed ? 0.12 : 0) + (o.head < 50 ? 0.05 : 0)) * grap * (me.stam > 30 ? 1 : 0.15) * (a.sub === 'rnc' ? 2.0 : 1) * C.AI.weights.subAttempt;
        else if (a.act === 'scramble') w[k] = (this.disc === 'BJJ' ? 0.3 : 1.0) * (me.stam > 20 ? 1 : 0.3);
        else if (a.act === 'sweep') w[k] = 0.6 * grap;
        else if (a.act === 'escape') w[k] = 1.0;
        else if (a.act === 'handfight') w[k] = 3.0;
      }
      if (!top) w.wait = 0.6; else w.wait = 0.25 + (me.stam < 25 ? 1.5 : 0);
      const k = rng.weighted(w);
      if (k !== 'wait') { this.press(it, k); if (P[k] && P[k].low && rng.chance(0.45)) it.low = true; }
      if (k === 'j' && P.j && P.j.act === 'handfight') this.nextThink = this.t + this.L.pressGap;
      return it;
    }

    subPlay(fight, me, it, rng) {
      const s = fight.sub, L = this.L;
      if (this.t < this.subNext) return it;
      const onBeat = fight.subBeat();
      if (onBeat ? rng.chance(L.subAcc) : rng.chance((1 - L.subAcc) * 0.25)) {
        this.press(it, 'j'); this.subNext = this.t + Math.max(L.pressGap, C.SUB.minPressGapMs + 10) + (onBeat ? C.SUB.beatWindowMs : 0);
      }
      return it;
    }
  }

  // Test / scripted controllers
  class ScriptController {
    constructor(mode) { this.mode = mode || 'idle'; this.t = 0; this.next = 600; }
    update(fight, me, o, dt) {
      this.t += dt; const it = blank();
      if (this.mode === 'block') { it.block = true; return it; }
      if (this.mode === 'jab' && fight.mode === 'stand' && this.t > this.next) { this.next = this.t + 900; it.pressed.j = true; if (fight.dist() > 130) it.dir = me.facing; }
      if (this.mode === 'walk') it.dir = me.facing;
      return it;
    }
  }

  CK.AI = { PlayerController, AIController, ScriptController, make(level, def) { return new AIController(level, def); } };
})();
