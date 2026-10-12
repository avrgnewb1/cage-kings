/* CAGE KINGS - fightview.js : turns fight state into poses and draws the arena, fighters and HUD */
(function () {
  const C = CK.CONFIG, R = () => CK.Rig, clamp = CK.clamp;

  // ---------- pose selection (pure function of fight state) ----------
  function poseFor(fight, f) {
    const P = R().POSES, rig = R();
    const o = f.opp; let p;
    const mode = fight.mode;
    if (f.st === 'victory') p = rig.sampleAnim('victory', f.animT);
    else if (f.st === 'ko' || f.st === 'tapped') p = f.stT < 450 ? rig.sampleAnim('knockdown', f.stT) : P.down;
    else if (mode === 'sub' && fight.sub) p = subPose(fight, f);
    else if (mode === 'ground' && fight.ground) p = groundPose(fight, f);
    else if (mode === 'clinch' && fight.clinch) p = clinchPose(fight, f);
    else p = standPose(fight, f);
    p = Object.assign({}, p);
    // limp from leg damage, hands drop when gassed
    if ((mode === 'stand' || mode === 'clinch') && f.st !== 'knockdown' && f.st !== 'ko' && f.st !== 'getup') {
      if (f.leg < 55) { const k = (55 - f.leg) / 55; p.fsh += 25 * k; p.fth -= 6 * k; p.lean += 4 * k; }
      if (f.gassed && (f.st === 'idle' || f.st === 'walk')) { p.fua -= 14; p.fla -= 25; p.bua -= 10; p.bla -= 20; p.head += 8; }
    }
    return p;
  }
  function standPose(fight, f) {
    const P = R().POSES, rig = R();
    switch (f.st) {
      case 'walk': return rig.sampleAnim('walk', f.animT);
      case 'block': return f.blockLow ? (f.opp.mvKey === 'leg_kick' ? P.check : P.block_low) : P.block_high;
      case 'attack': {
        const T = f.mvTimes, t = f.mvT;
        if (t < T.s) return rig.strikePose(f.mvKey, 'startup', t / T.s);
        if (t < T.s + T.a) return rig.strikePose(f.mvKey, 'active', 0);
        return rig.strikePose(f.mvKey, 'recovery', clamp((t - T.s - T.a) / T.r, 0, 1));
      }
      case 'hitstun': { const base = f.hitKind === 'body' ? P.hit_body : f.hitKind === 'leg' ? P.hit_leg : P.hit_head; return rig.lerpPose(base, P.stance, clamp(f.stT / f.stDur, 0, 1) * 0.8); }
      case 'stagger': return rig.lerpPose(P.stagger, P.stance, clamp(f.stT / f.stDur - 0.5, 0, 1));
      case 'caught': return P.kick_body_ext;
      case 'knockdown': return rig.sampleAnim('knockdown', f.stT);
      case 'getup': return rig.sampleAnim('getup', f.stT * 500 / Math.max(1, f.stDur));
      case 'shoot': { const w = C.TAKEDOWN.windup * (f.disc === 'WR' ? C.TAKEDOWN.wrWindupMult : 1); return f.stT < w ? rig.lerpPose(P.stance, P.shoot, 0.55 * f.stT / w) : P.shoot; }
      case 'shootmiss': return rig.lerpPose(P.shoot, P.stance, clamp(f.stT / f.stDur, 0, 1));
      case 'sprawled': return P.sprawled_on;
      case 'sprawl': return P.sprawl;
      case 'grab': return rig.lerpPose(P.stance, P.clinch, clamp(f.stT / C.CLINCH.grabStartup, 0, 1));
      case 'whiff': return rig.lerpPose(P.clinch, P.stance, clamp(f.stT / Math.max(1, f.stDur), 0, 1));
      default: return f.catchUntil > fight.time ? P.catch : rig.sampleAnim('idle', f.animT + f.idx * 300);
    }
  }
  function actPose(f, base) {
    const a = f.act, rig = R(); if (!a) return base;
    if (a.t < a.wind) return rig.strikePose(a.name, 'startup', a.t / a.wind, base);
    const rec = clamp((a.t - a.wind) / Math.max(1, a.dur - a.wind), 0, 1);
    return rec < 0.25 ? rig.strikePose(a.name, 'active', 0, base) : rig.strikePose(a.name, 'recovery', (rec - 0.25) / 0.75, base);
  }
  function clinchPose(fight, f) {
    const P = R().POSES, c = fight.clinch;
    let base = c.thai ? (c.ctrl === f ? P.thai_clinch : P.clinched) : P.clinch;
    if (f.blockHeld && !f.act) base = R().lerpPose(base, P.clinched, 0.5);
    return actPose(f, base);
  }
  function groundPose(fight, f) {
    const g = fight.ground, GP = CK.GROUND_POS[g.pos], P = R().POSES;
    if (g.top === f) return actPose(f, P[GP.topPose]);
    let base = P[f.blockHeld ? GP.botBlockPose : GP.botPose];
    if (f.act && f.act.name === 'bridge') base = R().lerpPose(P.bridge, base, clamp(f.act.t / f.act.dur, 0, 1));
    else if (f.act && f.act.name === 'up_strike') base = R().lerpPose(base, Object.assign({}, base, { fua: 150, fla: 10 }), Math.sin(Math.PI * clamp(f.act.t / f.act.dur, 0, 1)));
    return base;
  }
  function subPose(fight, f) {
    const s = fight.sub, P = R().POSES, att = s.att === f, w = Math.sin(s.t / 90) * 4 * (0.4 + Math.abs(s.bar - 50) / 60);
    const key = s.name === 'guillotine' ? 'guillotine' : s.name === 'armbar' ? 'armbar' : s.name === 'triangle' ? 'triangle' : 'rnc';
    const p = Object.assign({}, P[key + (att ? '_att' : '_def')]);
    p.lean += w; p.head += att ? 0 : -w;
    return p;
  }

  // ---------- drawing ----------
  const View = {
    rposes: new Map(), shake: 0, texts: [], particles: [], showHitboxes: false,
    reset() { this.rposes = new Map(); this.texts = []; this.particles = []; this.shake = 0; },
    smoothPose(f, target, dt) {
      let cur = this.rposes.get(f);
      if (!cur) { this.rposes.set(f, Object.assign({}, target)); return target; }
      const fast = f.st === 'attack' || (f.act && true) || f.st === 'hitstun';
      const k = 1 - Math.exp(-dt / 1000 * (fast ? 40 : 16));
      for (const key of R().KEYS) cur[key] += (target[key] - cur[key]) * k;
      return cur;
    },
    drawArena(ctx) {
      const W = C.VIEW.W, H = C.VIEW.H, bg = CK.Art.get('bg/arena');
      if (bg) ctx.drawImage(bg, 0, 0, W, H);
      else {
        const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0c0f1a'); g.addColorStop(0.7, '#1a2033'); g.addColorStop(1, '#0a0a10'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#d9d4c7'; ctx.fillRect(0, 527, W, 120); ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.lineWidth = 1; for (let x = 0; x < W; x += 24) { ctx.beginPath(); ctx.moveTo(x, 150); ctx.lineTo(x + 120, 527); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + 120, 150); ctx.lineTo(x, 527); ctx.stroke(); }
        ctx.fillStyle = 'rgba(220,40,60,0.35)'; ctx.beginPath(); ctx.ellipse(W / 2, 587, 210, 46, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#20232c'; ctx.fillRect(0, 647, W, 73);
      }
    },
    drawFront(ctx) { const img = CK.Art.get('bg/cage_front'); if (img) ctx.drawImage(img, 0, 0, C.VIEW.W, C.VIEW.H); },
    drawFight(ctx, fight, dt) {
      ctx.save();
      if (this.shake > 0) { ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake); this.shake = Math.max(0, this.shake - dt * 0.05); }
      this.drawArena(ctx);
      // draw order: the bottom / lying fighter first
      const order = fight.f.slice();
      if (fight.mode === 'ground' && fight.ground) order.sort((a, b) => (a === fight.ground.bot ? -1 : 1));
      else if (fight.mode === 'sub' && fight.sub) order.sort((a) => (a === fight.sub.def ? (fight.sub.name === 'rnc' ? -1 : 1) : (fight.sub.name === 'rnc' ? 1 : -1)));
      let guardLegs = null;
      for (const f of order) {
        const pose = this.smoothPose(f, poseFor(fight, f), dt);
        // spinning attacks: the fighter turns his back during the first part of the windup
        const spin = f.st === 'attack' && f.mv && f.mv.spin && f.mvT < f.mvTimes.s * 0.6 && f.mvT > f.mvTimes.s * 0.15;
        CK.Renderer.drawFighter(ctx, { x: f.x, floorY: C.ARENA.floorY, facing: spin ? -f.facing : f.facing, pose, wc: f.wcKey, look: f.look, skin: f.skin,
          dmg: { head: 100 - f.head, body: 100 - f.body, leg: 100 - f.leg }, flash: f.flash * 0.5 });
        if (fight.mode === 'ground' && fight.ground && f === fight.ground.bot && /guard/.test(fight.ground.pos))
          guardLegs = { x: f.x, floorY: C.ARENA.floorY, facing: f.facing, pose, wc: f.wcKey, look: f.look, skin: f.skin, dmg: { head: 0, body: 0, leg: 100 - f.leg }, legsOnly: true };
      }
      if (guardLegs) CK.Renderer.drawFighter(ctx, guardLegs);   // bottom fighter's legs show around the top fighter in guard
      this.drawFront(ctx);
      if (this.showHitboxes || fight.debug) this.drawBoxes(ctx, fight);
      this.drawParticles(ctx, dt);
      ctx.restore();
    },
    drawBoxes(ctx, fight) {
      for (const f of fight.f) {
        const hb = fight.hurtboxes(f); ctx.strokeStyle = 'rgba(0,255,120,0.8)'; ctx.lineWidth = 1.5;
        for (const k in hb) ctx.strokeRect(hb[k].x, hb[k].y, hb[k].w, hb[k].h);
        if (f.hitbox) { ctx.strokeStyle = 'rgba(255,40,40,0.95)'; ctx.strokeRect(f.hitbox.x, f.hitbox.y, f.hitbox.w, f.hitbox.h); }
      }
    },
    onEvent(e, fight) {
      if (e.type === 'sound') CK.Audio.play(e.name);
      else if (e.type === 'hit') {
        CK.Audio.play(fight.mode === 'ground' && !/elbow/.test(e.sound) ? 'gnp' : e.sound);
        const f = fight.f[e.who]; this.shake = Math.max(this.shake, e.heavy ? 9 : 3);
        const y = C.ARENA.floorY - (e.target === 'head' ? 160 : e.target === 'body' ? 105 : 40) * f.size * (fight.mode === 'stand' ? 1 : 0.4);
        for (let i = 0; i < (e.heavy ? 12 : 6); i++) this.particles.push({ x: f.x, y, vx: (Math.random() - 0.5) * 300, vy: (Math.random() - 0.8) * 260, life: 1, c: e.target === 'leg' ? '#ffd27f' : '#fff6d0' });
      } else if (e.type === 'text') {
        this.texts.push({ msg: e.msg, color: e.color || '#fff', life: 1.4, who: e.who ? e.who.idx : null });
        if (this.texts.length > 3) this.texts.shift();
      } else if (e.type === 'knockdown') { this.shake = 14; }
      else if (e.type === 'subStart') { CK.Audio.loop('sub_loop'); }
      else if (e.type === 'subEnd') { CK.Audio.stop('sub_loop'); }
      else if (e.type === 'fightCall') { CK.Audio.play('ref_fight'); CK.Audio.play('bell_start'); }
      else if (e.type === 'position') { CK.Audio.play('scramble'); }
      else if (e.type === 'roundStart') { CK.Audio.play(fight.round === fight.rounds && fight.round > 1 ? 'vo_final_round' : 'vo_round_' + Math.min(5, fight.round)); this.texts.push({ msg: CK.Text.callout(fight.round === fight.rounds ? 'finalRound' : fight.rounds === 5 && fight.round >= 4 ? 'championshipRound' : 'roundStart', { round: fight.round }, 'ROUND ' + fight.round), color: '#fff', life: 1.5 }); }
    },
    drawParticles(ctx, dt) {
      const s = dt / 1000;
      this.particles = this.particles.filter(p => (p.life -= s * 2.5) > 0);
      for (const p of this.particles) { p.x += p.vx * s; p.y += p.vy * s; p.vy += 600 * s; ctx.globalAlpha = p.life; ctx.fillStyle = p.c; ctx.fillRect(p.x - 2, p.y - 2, 4, 4); }
      ctx.globalAlpha = 1;
    },

    // ---------- HUD ----------
    drawHUD(ctx, fight, dt, player) {
      const W = C.VIEW.W;
      for (const f of fight.f) this.drawPanel(ctx, f, f.idx === 0 ? 24 : W - 24, f.idx === 0 ? 1 : -1, fight);
      // round + clock
      ctx.save(); ctx.translate(W / 2, 18);
      ctx.fillStyle = 'rgba(10,12,20,0.85)'; roundRect(ctx, -86, 0, 172, 84, 10); ctx.fill();
      ctx.strokeStyle = '#d4a017'; ctx.lineWidth = 2; roundRect(ctx, -86, 0, 172, 84, 10); ctx.stroke();
      ctx.textAlign = 'center'; ctx.fillStyle = '#d4a017'; ctx.font = '700 16px system-ui, sans-serif';
      ctx.fillText(CK.Text.ui('hud.roundOf', { round: fight.round, totalRounds: fight.rounds }, `Round ${fight.round}/${fight.rounds}`).toUpperCase(), 0, 24);
      ctx.fillStyle = fight.roundLeft < 10000 && fight.phase === 'fight' ? '#ff5a5a' : '#fff'; ctx.font = '800 40px ui-monospace, Menlo, monospace';
      ctx.fillText(fight.phase === 'intro' ? '5:00' : fight.clockLeft(), 0, 68);
      ctx.restore();
      // position label
      let posLabel = null;
      if (fight.mode === 'clinch' && fight.clinch) posLabel = CK.Text.position(fight.clinch.thai ? 'thaiClinch' : 'clinch', 'Clinch');
      if (fight.mode === 'ground' && fight.ground) { const g = fight.ground, GP = CK.GROUND_POS[g.pos]; posLabel = (fight.f[0] === g.top ? CK.Text.position(GP.uiKey + 'Top', GP.label) : CK.Text.position(GP.uiKey + 'Bottom', GP.label)); }
      if (posLabel) { ctx.font = '700 15px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(0,0,0,0.6)'; const w = ctx.measureText(posLabel).width + 24; roundRect(ctx, W / 2 - w / 2, 108, w, 26, 13); ctx.fill(); ctx.fillStyle = '#ffcf3f'; ctx.fillText(posLabel.toUpperCase(), W / 2, 126); }
      // ground stall timer hint
      if (fight.mode === 'ground' && fight.ground && fight.ground.idleT > C.GROUND.stallWorkMs - 3000) { ctx.fillStyle = '#ff9f43'; ctx.font = '700 14px system-ui'; ctx.textAlign = 'center'; ctx.fillText(CK.Text.ui('hud.stallWarning', null, 'WORK!') + '  ' + Math.max(0, Math.ceil((C.GROUND.standupMs - fight.ground.idleT) / 1000)) + 's', W / 2, 150); }
      if (fight.mode === 'sub' && fight.sub) this.drawSub(ctx, fight, player);
      this.drawTexts(ctx, dt);
      if (player && !CK.Input.touchEnabled) this.drawKeyHints(ctx, fight, player);
    },
    tz() { return CK.Input && CK.Input.touchEnabled ? 3 : 0; },   // CK-09: bigger HUD type on phones
    drawPanel(ctx, f, x, dir, fight) {
      ctx.save(); ctx.translate(x, 16);
      const tx = dir > 0 ? 0 : -470;
      ctx.fillStyle = 'rgba(10,12,20,0.78)'; roundRect(ctx, tx, 0, 470, 116, 10); ctx.fill();
      // damage figure
      const fx = dir > 0 ? 44 : -44;
      this.damageFigure(ctx, fx, 58, f);
      // name
      ctx.textAlign = dir > 0 ? 'left' : 'right'; const nx = dir > 0 ? 88 : -88;
      ctx.fillStyle = '#fff'; ctx.font = '800 20px system-ui, sans-serif';
      ctx.fillText((f.def.first + ' ' + f.def.last).toUpperCase(), nx, 28);
      ctx.fillStyle = '#d4a017'; ctx.font = '600 13px system-ui, sans-serif';
      ctx.fillText((f.def.nick ? '"' + f.def.nick + '"  ' : '') + CK.Text.label('disciplines', f.disc, f.disc) + ' / ' + CK.Text.label('approaches', f.appr, f.appr), nx, 47);
      // stamina bar
      const bw = 340, bx = dir > 0 ? nx : nx - bw, by = 60;
      ctx.fillStyle = '#222'; ctx.fillRect(bx, by, bw, 16);
      const maxW = bw * f.maxStam / 100; ctx.fillStyle = 'rgba(120,120,120,0.35)'; ctx.fillRect(dir > 0 ? bx + maxW : bx, by, bw - maxW, 16);
      const sw = bw * clamp(f.stam / 100, 0, 1);
      ctx.fillStyle = f.gassed ? (Math.floor(performance.now() / 200) % 2 ? '#ff4d4d' : '#b33') : '#2fd47a';
      ctx.fillRect(dir > 0 ? bx : bx + bw - sw, by, sw, 16);
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = '700 ' + (11 + this.tz()) + 'px system-ui'; ctx.textAlign = dir > 0 ? 'left' : 'right';
      ctx.fillText(CK.Text.ui('hud.stamina', null, 'STAMINA'), dir > 0 ? bx + 4 : bx + bw - 4, by + 12);
      // ref meter
      const rw = 140, rx = dir > 0 ? nx : nx - rw, ry = 86;
      ctx.fillStyle = '#222'; ctx.fillRect(rx, ry, rw, 8);
      ctx.fillStyle = f.ref > 65 ? '#ff4d4d' : '#ff9f43'; const rf = rw * clamp(f.ref / C.REF.tkoAt, 0, 1); ctx.fillRect(dir > 0 ? rx : rx + rw - rf, ry, rf, 8);
      ctx.fillStyle = '#aaa'; ctx.font = '700 ' + (10 + this.tz()) + 'px system-ui'; ctx.fillText(CK.Text.ui('hud.refMeter', null, 'REF'), dir > 0 ? rx + rw + 6 : rx - 6, ry + 8);
      // part readouts
      ctx.font = '600 ' + (11 + this.tz()) + 'px system-ui'; ctx.fillStyle = '#bbb';
      const parts = [['hud.head', 'HEAD', f.head], ['hud.body', 'BODY', f.body], ['hud.leg', 'LEG', f.leg]];
      parts.forEach((pt, i) => { ctx.fillStyle = hpColor(pt[2]); const gap = 58 + this.tz() * 5, x0 = 170 + this.tz() * 2; const px = dir > 0 ? nx + x0 + i * gap : nx - x0 - i * gap; ctx.fillText(CK.Text.ui(pt[0], null, pt[1]) + ' ' + Math.max(0, Math.round(pt[2])), px, 102); });
      ctx.restore();
    },
    damageFigure(ctx, x, y, f) {
      // face/body/leg damage indicator: colored silhouette with swelling tiers on the face
      ctx.save(); ctx.translate(x, y);
      const tier = (hp) => hp <= 25 ? 3 : hp <= 50 ? 2 : hp <= 75 ? 1 : 0;
      ctx.fillStyle = hpColor(f.leg); ctx.fillRect(-10, 14, 8, 30); ctx.fillRect(2, 14, 8, 30);
      ctx.fillStyle = hpColor(f.body); roundRect(ctx, -14, -16, 28, 32, 6); ctx.fill();
      ctx.fillStyle = hpColor(f.head); ctx.beginPath(); ctx.arc(0, -30, 14, 0, Math.PI * 2); ctx.fill();
      const t = tier(f.head);
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-5, -32, 2, 0, 7); ctx.arc(5, -32, 2, 0, 7); ctx.fill();
      if (t >= 1) { ctx.fillStyle = 'rgba(160,30,120,0.85)'; ctx.beginPath(); ctx.ellipse(5, -32, 5, 4, 0, 0, 7); ctx.fill(); }
      if (t >= 2) { ctx.beginPath(); ctx.ellipse(-5, -33, 5, 4, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#b00'; ctx.fillRect(-1, -42, 2, 7); }
      if (t >= 3) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-8, -24); ctx.lineTo(8, -20); ctx.stroke(); }
      if (f.legGone) { ctx.strokeStyle = '#ff4d4d'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-12, 20); ctx.lineTo(12, 40); ctx.stroke(); }
      ctx.restore();
    },
    drawSub(ctx, fight, player) {
      const s = fight.sub, W = C.VIEW.W, bw = 560, x = W / 2 - bw / 2, y = 190;
      ctx.save();
      ctx.fillStyle = 'rgba(10,8,20,0.82)'; roundRect(ctx, x - 24, y - 52, bw + 48, 128, 12); ctx.fill();
      ctx.textAlign = 'center'; ctx.fillStyle = '#ff4dff'; ctx.font = '900 26px system-ui';
      const subName = CK.Text.label('submissions', s.name, C.SUB.names[s.name]);
      ctx.fillText(CK.Text.ui('hud.submissionMinigame.title', { submission: subName.toUpperCase() }, subName.toUpperCase() + '!'), W / 2, y - 18);
      // bar
      ctx.fillStyle = '#2a2a3a'; ctx.fillRect(x, y, bw, 26);
      const attLeft = s.att.idx === 0; // P1 side on the left
      const frac = clamp(s.bar / 100, 0, 1);
      const split = attLeft ? x + bw * frac : x + bw * (1 - frac);
      ctx.fillStyle = '#ff4dff'; attLeft ? ctx.fillRect(x, y, split - x, 26) : ctx.fillRect(split, y, x + bw - split, 26);
      ctx.fillStyle = '#4dc3ff'; attLeft ? ctx.fillRect(split, y, x + bw - split, 26) : ctx.fillRect(x, y, split - x, 26);
      ctx.fillStyle = '#fff'; ctx.fillRect(split - 3, y - 6, 6, 38);
      // beat ring
      const ph = (s.t % C.SUB.beatMs) / C.SUB.beatMs, on = fight.subBeat();
      ctx.strokeStyle = on ? '#ffe14d' : 'rgba(255,255,255,0.4)'; ctx.lineWidth = on ? 5 : 2;
      ctx.beginPath(); ctx.arc(W / 2, y + 56, 8 + 14 * (1 - ph), 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = on ? '#ffe14d' : '#888'; ctx.beginPath(); ctx.arc(W / 2, y + 56, 6, 0, Math.PI * 2); ctx.fill();
      if (player) {
        const mine = s.att === player;
        ctx.font = '800 16px system-ui'; ctx.fillStyle = '#fff';
        ctx.fillText(CK.Text.ui(mine ? 'hud.submissionMinigame.attackPrompt' : 'hud.submissionMinigame.defendPrompt', null, mine ? 'TAP J IN RHYTHM!' : 'TAP J TO ESCAPE!').replace(/TAP J\b/, CK.Input.touchEnabled ? 'TAP ANY BUTTON' : 'TAP J'), W / 2, y + 96);
      }
      ctx.restore();
    },
    drawTexts(ctx, dt) {
      const W = C.VIEW.W; let yy = 250;
      this.texts = this.texts.filter(t => (t.life -= dt / 1000) > 0);
      for (const t of this.texts) {
        ctx.save(); ctx.globalAlpha = clamp(t.life / 0.4, 0, 1); ctx.textAlign = 'center';
        ctx.font = '900 46px system-ui, Impact, sans-serif'; ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.75)';
        const x = t.who == null ? W / 2 : (t.who === 0 ? W * 0.3 : W * 0.7);
        ctx.strokeText(t.msg, x, yy); ctx.fillStyle = t.color; ctx.fillText(t.msg, x, yy); ctx.restore(); yy += 52;
      }
    },
    drawKeyHints(ctx, fight, player) {
      const L = fight.labelsFor(player), W = C.VIEW.W, H = C.VIEW.H;
      const items = [['J', L.j], ['K', L.k], ['L', L.l], ['U', L.u]];
      if (fight.mode === 'stand' || fight.mode === 'clinch') items.push(['I', fight.mode === 'clinch' ? 'TAKEDOWN' : (player.has('pull') ? 'TD / PULL' : 'TAKEDOWN')]);
      items.push(['SPC', 'BLOCK']); items.push(['S', fight.mode === 'stand' ? 'LOW' : 'ALT']);
      ctx.save(); ctx.font = '700 13px system-ui'; let x = W / 2 - items.length * 70;
      for (const [k, l] of items) {
        if (!l || l === '-') { x += 140; continue; }
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; roundRect(ctx, x, H - 40, 132, 26, 6); ctx.fill();
        ctx.fillStyle = '#d4a017'; ctx.textAlign = 'left'; ctx.fillText(k, x + 8, H - 22); ctx.fillStyle = '#fff'; ctx.fillText(l, x + 40, H - 22); x += 140;
      }
      ctx.restore();
    }
  };
  function hpColor(hp) { return hp > 75 ? '#2fd47a' : hp > 50 ? '#c8d42f' : hp > 25 ? '#f0a020' : '#ff3b3b'; }
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  CK.FightView = View; CK.poseFor = poseFor; CK.roundRect = roundRect;
})();
