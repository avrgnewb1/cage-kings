/* CAGE KINGS - rig.js
 * Modular skeletal rig drawn in code: head, torso, upper/lower arms, thighs/shins (+ gloves, feet).
 * Poses are joint angles in degrees; animations are keyframed poses. All drawing goes through
 * CK.Renderer (one interface) so Remy's sprite parts can replace the code shapes per part.
 *
 * Angle convention (absolute angle a: vector = (sin a, -cos a), 0 = up, 90 = forward):
 *   torso   = rot + lean
 *   upperArm= torso + 180 - ua      lowerArm = upperArm - la   (la > 0 bends the elbow)
 *   thigh   = rot + 180 - th        shin     = thigh + sh      (sh > 0 bends the knee back)
 */
(function () {
  const D2R = Math.PI / 180;
  const KEYS = ['rot', 'lean', 'head', 'fua', 'fla', 'bua', 'bla', 'fth', 'fsh', 'bth', 'bsh'];
  const STANCE = { rot: 0, lean: 6, head: 6, fua: 35, fla: 125, bua: 22, bla: 138, fth: 22, fsh: 20, bth: -20, bsh: 24 };
  const P = (o) => Object.assign({}, STANCE, o);
  const lerpPose = (a, b, t) => { const o = {}; for (const k of KEYS) o[k] = a[k] + (b[k] - a[k]) * t; return o; };

  // ---- Static poses ----
  const POSES = {
    stance: P({}),
    // strikes: chamber -> ext
    jab_ext: P({ lean: 12, fua: 90, fla: 4, head: 0 }),
    jab_body_ext: P({ lean: 34, fua: 70, fla: 6, fth: 40, fsh: 50, bth: -30, bsh: 50 }),
    power_ch: P({ lean: 0, rot: -4, bua: 30, bla: 140 }),
    power_ext: P({ lean: 22, rot: 4, bua: 92, bla: 4, fua: 30, fla: 130 }),
    power_body_ext: P({ lean: 40, rot: 4, bua: 72, bla: 6, fth: 40, fsh: 55, bth: -30, bsh: 55 }),
    hook_ch: P({ lean: 4, rot: -6, fua: 55, fla: 90 }),
    hook_ext: P({ lean: 18, rot: 8, fua: 88, fla: 72, head: 0 }),
    upper_ch: P({ lean: 26, fth: 36, fsh: 50, bua: 20, bla: 150 }),
    upper_ext: P({ lean: 8, bua: 62, bla: 118, fua: 40, fla: 125 }),
    elbow_ch: P({ lean: 4, fua: 75, fla: 150 }),
    elbow_ext: P({ lean: 22, fua: 104, fla: 150, rot: 4 }),
    kick_body_ch: P({ lean: -8, bth: 60, bsh: 100, fth: 4, fsh: 8 }),
    kick_body_ext: P({ lean: -22, rot: -8, bth: 98, bsh: 2, fth: 2, fsh: 6, fua: 40, bua: -20, bla: 60 }),
    kick_head_ch: P({ lean: -12, bth: 80, bsh: 110, fth: 4, fsh: 8 }),
    kick_head_ext: P({ lean: -36, rot: -12, bth: 140, bsh: -4, fth: 0, fsh: 4, fua: 50, bua: -30, bla: 60 }),
    leg_kick_ch: P({ lean: -4, bth: 30, bsh: 70 }),
    leg_kick_ext: P({ lean: -12, rot: -6, bth: 62, bsh: 14, fth: 4, fsh: 6, bua: -20, bla: 70 }),
    teep_ch: P({ lean: -6, fth: 92, fsh: 100, bth: -6, bsh: 10 }),
    teep_ext: P({ lean: -16, fth: 96, fsh: 2, bth: -8, bsh: 8 }),
    spin_fist_ch: P({ lean: 10, rot: 6, head: 20, bua: 40, bla: 120, fua: 20, fla: 100 }),
    spin_fist_ext: P({ lean: 14, rot: 6, head: 0, bua: 96, bla: 2, fua: 30, fla: 120 }),
    spin_kick_ch: P({ lean: 40, head: 30, bth: 40, bsh: 110, fth: 10, fsh: 10 }),
    spin_kick_ext: P({ lean: 60, rot: 10, head: 20, bth: 100, bsh: 0, fth: 6, fsh: 6, fua: 60, fla: 60 }),
    knee_ch: P({ lean: 14, fua: 110, fla: 50, bua: 105, bla: 55 }),
    knee_ext: P({ lean: 2, bth: 112, bsh: 135, fth: 0, fsh: 4, fua: 115, fla: 50, bua: 110, bla: 55 }),
    // defense / reactions
    block_high: P({ lean: 10, fua: 62, fla: 145, bua: 52, bla: 150, head: 18 }),
    block_low: P({ lean: 22, fua: 30, fla: 100, bua: 25, bla: 115, fth: 58, fsh: 76 }),
    check: P({ lean: 14, fua: 40, fla: 130, fth: 70, fsh: 80, bth: -14, bsh: 14 }),
    catch: P({ lean: 10, fua: 70, fla: 70, bua: 60, bla: 120 }),
    hit_head: P({ lean: -16, head: -28, fua: 20, fla: 70, bua: 10, bla: 80 }),
    hit_body: P({ lean: 34, head: 14, fua: 15, fla: 120, bua: 10, bla: 130, fth: 30, fsh: 40 }),
    hit_leg: P({ lean: 4, fth: 10, fsh: 60, bth: -26, bsh: 20 }),
    stagger: P({ lean: -18, rot: -6, head: -16, fua: 10, fla: 40, bua: 5, bla: 30, fth: 30, fsh: 10, bth: -30, bsh: 10 }),
    down: P({ rot: -90, lean: 0, head: 10, fua: 40, fla: 20, bua: 20, bla: 30, fth: 8, fsh: 12, bth: -6, bsh: 22 }),
    getup: P({ rot: -40, lean: 40, head: 0, fua: -20, fla: 10, bua: -30, bla: 10, fth: 50, fsh: 110, bth: 20, bsh: 120 }),
    victory: P({ lean: -6, head: -14, fua: 172, fla: 12, bua: 168, bla: 12 }),
    defeated: P({ lean: 30, head: 28, fua: 5, fla: 10, bua: 5, bla: 10 }),
    // clinch
    clinch: P({ lean: 26, fua: 112, fla: 52, bua: 106, bla: 58 }),
    thai_clinch: P({ lean: 22, head: 0, fua: 142, fla: 84, bua: 138, bla: 88 }),
    clinched: P({ lean: 36, head: 24, fua: 70, fla: 90, bua: 60, bla: 100 }),
    clinch_punch: P({ lean: 22, fua: 112, fla: 52, bua: 60, bla: 90 }),
    clinch_knee: P({ lean: 8, fua: 135, fla: 82, bua: 130, bla: 86, bth: 115, bsh: 135, fth: 0, fsh: 4 }),
    // takedowns
    shoot: P({ lean: 68, head: -30, fua: 88, fla: 18, bua: 80, bla: 30, fth: 88, fsh: 104, bth: -40, bsh: 30 }),
    sprawl: P({ rot: 62, lean: 10, head: -40, fua: 100, fla: 10, bua: 96, bla: 14, fth: 18, fsh: 0, bth: 10, bsh: 0 }),
    sprawled_on: P({ rot: 86, lean: 4, head: -60, fua: 120, fla: 10, bua: 110, bla: 20, fth: 4, fsh: 10, bth: -4, bsh: 20 }),
    guard_pull: P({ rot: -50, lean: 30, fua: 110, fla: 50, bua: 100, bla: 50, fth: 70, fsh: 60, bth: 50, bsh: 90 }),
    // ground (positions are data-driven in fight.js: each references pose names here)
    top_guard: P({ rot: 0, lean: 32, head: 0, fua: 92, fla: 30, bua: 70, bla: 60, fth: 4, fsh: 96, bth: -6, bsh: 96 }),
    top_guard_gnp: P({ rot: 0, lean: 38, head: 0, fua: 108, fla: 6, bua: 50, bla: 100, fth: 4, fsh: 96, bth: -6, bsh: 96 }),
    top_elbow_ch: P({ rot: 0, lean: 18, head: 0, fua: 172, fla: 150, bua: 70, bla: 60, fth: 4, fsh: 96, bth: -6, bsh: 96 }),
    top_elbow: P({ rot: 0, lean: 40, head: 0, fua: 40, fla: 155, bua: 70, bla: 60, fth: 4, fsh: 96, bth: -6, bsh: 96 }),
    bottom_guard: P({ rot: -90, lean: 14, head: 14, fua: 100, fla: 70, bua: 90, bla: 80, fth: 64, fsh: 92, bth: 52, bsh: 96 }),
    bottom_guard_block: P({ rot: -90, lean: 22, head: 24, fua: 120, fla: 140, bua: 115, bla: 145, fth: 66, fsh: 90, bth: 54, bsh: 94 }),
    top_mount: P({ rot: 0, lean: 10, head: 0, fua: 60, fla: 60, bua: 40, bla: 80, fth: -2, fsh: 92, bth: -8, bsh: 92 }),
    top_mount_gnp: P({ rot: 0, lean: 28, head: 0, fua: 120, fla: 6, bua: 40, bla: 110, fth: -2, fsh: 92, bth: -8, bsh: 92 }),
    bottom_mount: P({ rot: -90, lean: 4, head: 16, fua: 120, fla: 140, bua: 110, bla: 145, fth: 4, fsh: 40, bth: 0, bsh: 50 }),
    bridge: P({ rot: -76, lean: -4, head: 20, fua: 100, fla: 60, bua: 90, bla: 70, fth: 60, fsh: 120, bth: 50, bsh: 130 }),
    back_att: P({ rot: -62, lean: 70, head: 0, fua: 108, fla: 70, bua: 100, bla: 80, fth: 0, fsh: 10, bth: 10, bsh: 20 }),
    back_att_rnc: P({ rot: -62, lean: 66, head: 10, fua: 118, fla: 118, bua: 112, bla: 125, fth: 0, fsh: 10, bth: 10, bsh: 20 }),
    back_def: P({ rot: -66, lean: 72, head: -8, fua: 120, fla: 140, bua: 112, bla: 140, fth: -18, fsh: 24, bth: -10, bsh: 34 }),
    // submissions
    guillotine_att: P({ lean: 46, head: 10, fua: 100, fla: 96, bua: 110, bla: 92, fth: 30, fsh: 40 }),
    guillotine_def: P({ lean: 82, head: 40, fua: 60, fla: 40, bua: 50, bla: 50, fth: 40, fsh: 60, bth: -20, bsh: 40 }),
    armbar_att: P({ rot: -90, lean: 0, head: 20, fua: 75, fla: 15, bua: 80, bla: 20, fth: 78, fsh: 6, bth: 64, bsh: 20 }),
    armbar_def: P({ rot: 0, lean: 52, head: 10, fua: 120, fla: 0, bua: 70, bla: 60, fth: 4, fsh: 96, bth: -6, bsh: 96 }),
    triangle_att: P({ rot: -90, lean: 18, head: 20, fua: 110, fla: 70, bua: 100, bla: 80, fth: 64, fsh: 104, bth: 70, bsh: 96 }),
    triangle_def: P({ rot: 0, lean: 56, head: 26, fua: 90, fla: 40, bua: 70, bla: 60, fth: 4, fsh: 96, bth: -6, bsh: 96 }),
    rnc_att: P({ rot: -62, lean: 66, head: 10, fua: 120, fla: 122, bua: 114, bla: 128, fth: 0, fsh: 10, bth: 10, bsh: 20 }),
    rnc_def: P({ rot: -66, lean: 64, head: -26, fua: 140, fla: 150, bua: 132, bla: 150, fth: -18, fsh: 24, bth: -10, bsh: 34 })
  };

  // ---- Keyframed animations: [time 0..1, poseName] ----
  const ANIMS = {
    idle: { dur: 1000, loop: true, keys: [[0, 'stance'], [0.5, P({ lean: 9, head: 8, fua: 37, fla: 120, bua: 24, bla: 134, fth: 24, fsh: 26, bth: -18, bsh: 30 })], [1, 'stance']] },
    walk: { dur: 520, loop: true, keys: [[0, 'stance'], [0.25, P({ fth: 34, fsh: 10, bth: -10, bsh: 40 })], [0.5, 'stance'], [0.75, P({ fth: 10, fsh: 40, bth: -30, bsh: 10 })], [1, 'stance']] },
    knockdown: { dur: 500, loop: false, keys: [[0, 'hit_head'], [0.4, P({ rot: -40, lean: -20, head: -30, fth: 50, fsh: 30 })], [1, 'down']] },
    getup: { dur: 500, loop: false, keys: [[0, 'down'], [0.5, 'getup'], [1, 'stance']] },
    victory: { dur: 900, loop: true, keys: [[0, 'victory'], [0.5, P({ lean: -2, head: -20, fua: 160, fla: 30, bua: 175, bla: 4 })], [1, 'victory']] },
    sub_struggle: { dur: 440, loop: true, keys: [[0, null], [0.5, null], [1, null]] } // filled per position at runtime (wobble)
  };
  // strike name -> [chamber pose or null, extended pose]
  const STRIKES = {
    jab: [null, 'jab_ext'], jab_body: [null, 'jab_body_ext'], power: ['power_ch', 'power_ext'], power_body: ['power_ch', 'power_body_ext'],
    hook: ['hook_ch', 'hook_ext'], uppercut: ['upper_ch', 'upper_ext'], elbow: ['elbow_ch', 'elbow_ext'],
    kick_body: ['kick_body_ch', 'kick_body_ext'], kick_head: ['kick_head_ch', 'kick_head_ext'], leg_kick: ['leg_kick_ch', 'leg_kick_ext'],
    teep: ['teep_ch', 'teep_ext'], knee: ['knee_ch', 'knee_ext'], spin_fist: ['spin_fist_ch', 'spin_fist_ext'], spin_kick: ['spin_kick_ch', 'spin_kick_ext'],
    clinch_punch: [null, 'clinch_punch'], clinch_knee: ['thai_clinch', 'clinch_knee'], clinch_elbow: ['elbow_ch', 'elbow_ext'],
    gnp: ['top_guard', 'top_guard_gnp'], gnp_heavy: ['top_elbow_ch', 'top_elbow'], gnp_mount: ['top_mount', 'top_mount_gnp'],
    gnp_mount_heavy: ['top_elbow_ch', 'top_elbow'], back_strike: ['back_att', P({ rot: -62, lean: 70, fua: 140, fla: 10 })]
  };
  const get = (p) => typeof p === 'string' ? POSES[p] : p;

  function sampleAnim(name, tMs) {
    const a = ANIMS[name]; if (!a) return POSES.stance;
    let t = tMs / a.dur; t = a.loop ? (t % 1) : Math.min(1, t);
    const k = a.keys;
    for (let i = 0; i < k.length - 1; i++) {
      if (t <= k[i + 1][0]) { const u = (t - k[i][0]) / Math.max(1e-6, k[i + 1][0] - k[i][0]); return lerpPose(get(k[i][1]), get(k[i + 1][1]), ease(u)); }
    }
    return get(k[k.length - 1][1]);
  }
  const ease = (u) => u * u * (3 - 2 * u);
  // phase: 'startup' | 'active' | 'recovery', frac 0..1, base = pose to start/return to
  function strikePose(name, phase, frac, base) {
    const s = STRIKES[name]; if (!s) return base || POSES.stance;
    base = base || POSES.stance; const ch = s[0] ? get(s[0]) : null, ext = get(s[1]);
    if (phase === 'startup') {
      if (ch) return frac < 0.55 ? lerpPose(base, ch, ease(frac / 0.55)) : lerpPose(ch, ext, ease((frac - 0.55) / 0.45));
      return lerpPose(base, ext, ease(frac));
    }
    if (phase === 'active') return ext;
    return lerpPose(ext, base, ease(frac));
  }

  // ---- Proportions ----
  function proportions(wcKey, build) {
    const w = CK.CONFIG.WEIGHT[wcKey] || CK.CONFIG.WEIGHT.MW; build = build || { h: 1, w: 1, limb: 1 };
    const s = w.scale * (build.h || 1), wd = w.width * (build.w || 1), lb = build.limb || 1;
    return {
      s, torso: 64 * s, neck: 4 * s, headR: 23 * s * (0.94 + 0.06 * wd), uArm: 31 * s * lb, lArm: 30 * s * lb, thigh: 45 * s * lb, shin: 45 * s * lb, foot: 15 * s,
      shoulderW: 17 * s * wd, waistW: 12.5 * s * wd, armW: 11 * s * wd, legW: 15 * s * wd, gloveR: 8.5 * s * Math.sqrt(wd)
    };
  }

  const v = (a, len) => [Math.sin(a * D2R) * len, -Math.cos(a * D2R) * len];
  function computeJoints(pose, pr) {
    const T = pose.rot + pose.lean;
    const hip = [0, 0];
    const sh = add(hip, v(T, pr.torso));
    const neck = add(sh, v(T, pr.neck * 0.5));
    const headC = add(sh, v(T + pose.head, pr.neck + pr.headR));
    const fUA = T + 180 - pose.fua, fLA = fUA - pose.fla, bUA = T + 180 - pose.bua, bLA = bUA - pose.bla;
    const fEl = add(sh, v(fUA, pr.uArm)), fHa = add(fEl, v(fLA, pr.lArm));
    const bSh = add(sh, v(T - 90, pr.shoulderW * 0.25));
    const bEl = add(bSh, v(bUA, pr.uArm)), bHa = add(bEl, v(bLA, pr.lArm));
    const fTh = pose.rot + 180 - pose.fth, fSh = fTh + pose.fsh, bTh = pose.rot + 180 - pose.bth, bShA = bTh + pose.bsh;
    const fKn = add(hip, v(fTh, pr.thigh)), fAn = add(fKn, v(fSh, pr.shin));
    const bKn = add(hip, v(bTh, pr.thigh)), bAn = add(bKn, v(bShA, pr.shin));
    const fFt = add(fAn, v(fSh - 90 + 0, pr.foot * 0)), bFt = bAn;
    return { T, hip, sh, bSh, neck, headC, fEl, fHa, bEl, bHa, fKn, fAn, bKn, bAn, fFt, bFt, ang: { fUA, fLA, bUA, bLA, fTh, fSh, bTh, bShA } };
  }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
  // vertical offset so the lowest point rests on the floor
  function groundOffset(J, pr) {
    const pts = [[J.fAn, pr.legW * 0.35], [J.bAn, pr.legW * 0.35], [J.fKn, pr.legW * 0.5], [J.bKn, pr.legW * 0.5], [J.hip, pr.legW * 0.7],
      [J.sh, pr.armW * 0.9], [J.headC, pr.headR], [J.fHa, pr.gloveR], [J.bHa, pr.gloveR], [J.fEl, pr.armW * 0.5], [J.bEl, pr.armW * 0.5]];
    let m = -1e9; for (const [p, r] of pts) m = Math.max(m, p[1] + r);
    return m;
  }

  // ---------------- Renderer interface ----------------
  // view = { x, floorY, facing, pose, wc, look, build, skin, dmg:{head,body,leg}, alpha, flash }
  const RigRenderer = {
    name: 'rig',
    drawFighter(ctx, view) {
      const pr = proportions(view.wc, view.look && view.look.build);
      const pose = Object.assign({}, view.pose);
      const J = computeJoints(pose, pr);
      const yOff = view.floorY - groundOffset(J, pr) + (view.lift || 0);
      ctx.save();
      ctx.translate(view.x, yOff);
      ctx.scale(view.facing, 1);
      if (view.alpha != null) ctx.globalAlpha = view.alpha;
      // shadow
      ctx.save(); ctx.scale(1, 0.18); ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath(); ctx.ellipse(J.hip[0], (view.floorY - yOff) / 0.18, 46 * pr.s, 40 * pr.s, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      const L = view.look, skin = L.skin, dmg = view.dmg || { head: 0, body: 0, leg: 0 };
      const shade = (c, k) => shadeColor(c, k);
      const skinBack = shade(skin, -0.18);
      // back arm, back leg
      this.limb(ctx, view, 'upper_arm', J.bSh, J.bEl, pr.armW, skinBack);
      this.limb(ctx, view, 'lower_arm', J.bEl, J.bHa, pr.armW * 0.9, skinBack);
      this.glove(ctx, view, J.bHa, pr.gloveR, shade(L.gloves, -0.2));
      this.leg(ctx, view, J.hip, J.bKn, J.bAn, pr, skinBack, shade(L.shorts[0], -0.2), L, dmg.leg * 0.4, false);
      // torso
      this.torso(ctx, view, J, pr, skin, dmg.body, L);
      this.leg(ctx, view, J.hip, J.fKn, J.fAn, pr, skin, L.shorts[0], L, dmg.leg, true);
      this.shorts(ctx, J, pr, L);
      this.head(ctx, view, J, pr, L, dmg.head);
      this.limb(ctx, view, 'upper_arm', J.sh, J.fEl, pr.armW, skin);
      this.limb(ctx, view, 'lower_arm', J.fEl, J.fHa, pr.armW * 0.9, skin);
      this.glove(ctx, view, J.fHa, pr.gloveR, L.gloves);
      if (view.flash) { ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = `rgba(255,255,255,${view.flash})`; ctx.fillRect(-200, -300, 400, 400); }
      ctx.restore();
      return { J, yOff, pr };
    },
    // a bone-aligned part; if a sprite part exists for this skin it replaces the code shape
    limb(ctx, view, part, a, b, w, color) {
      const img = CK.Art && CK.Art.part(view.skin, part);
      if (img) return drawBoneImage(ctx, img, a, b, w * 1.4);
      ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    },
    glove(ctx, view, p, r, color) {
      const img = CK.Art && CK.Art.part(view.skin, 'glove');
      if (img) { ctx.drawImage(img, p[0] - r, p[1] - r, r * 2, r * 2); return; }
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); ctx.arc(p[0] + r * 0.25, p[1] - r * 0.3, r * 0.4, 0, Math.PI * 2); ctx.fill();
    },
    leg(ctx, view, hip, kn, an, pr, skin, shortsColor, L, legDmg, front) {
      const imgT = CK.Art && CK.Art.part(view.skin, 'thigh'), imgS = CK.Art && CK.Art.part(view.skin, 'shin');
      if (imgT) drawBoneImage(ctx, imgT, hip, kn, pr.legW * 1.4); else this.limb(ctx, view, 'thigh', hip, kn, pr.legW, skin);
      if (imgS) drawBoneImage(ctx, imgS, kn, an, pr.legW * 1.3);
      else {
        ctx.strokeStyle = skin; ctx.lineWidth = pr.legW * 0.85; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(kn[0], kn[1]); ctx.lineTo(an[0], an[1]); ctx.stroke();
        if (front && legDmg > 20) { // bruising on the lead leg
          ctx.strokeStyle = `rgba(150,30,90,${Math.min(0.75, legDmg / 110)})`; ctx.lineWidth = pr.legW * 0.6;
          ctx.beginPath(); ctx.moveTo(lerp2(view, kn, an, 0.0)[0], kn[1]); ctx.lineTo((kn[0] * 0.5 + an[0] * 0.5), (kn[1] * 0.5 + an[1] * 0.5)); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(kn[0], kn[1]); ctx.lineTo((hip[0] * 0.5 + kn[0] * 0.5), (hip[1] * 0.5 + kn[1] * 0.5)); ctx.stroke();
        }
        if (L.tape) { ctx.strokeStyle = 'rgba(245,245,245,0.9)'; ctx.lineWidth = pr.legW * 0.9; ctx.lineCap = 'butt';
          const m = [kn[0] * 0.25 + an[0] * 0.75, kn[1] * 0.25 + an[1] * 0.75]; ctx.beginPath(); ctx.moveTo(m[0], m[1]); ctx.lineTo(an[0], an[1]); ctx.stroke(); ctx.lineCap = 'round'; }
      }
      // foot
      const img = CK.Art && CK.Art.part(view.skin, 'foot');
      const fa = Math.atan2(an[1] - kn[1], an[0] - kn[0]) - Math.PI / 2;
      if (img) { ctx.save(); ctx.translate(an[0], an[1]); ctx.rotate(fa); ctx.drawImage(img, -pr.foot * 0.3, -pr.legW * 0.3, pr.foot * 1.3, pr.legW * 0.6); ctx.restore(); }
      else { ctx.save(); ctx.translate(an[0], an[1]); ctx.rotate(fa); ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(pr.foot * 0.45, 0, pr.foot * 0.75, pr.legW * 0.32, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    },
    torso(ctx, view, J, pr, skin, bodyDmg, L) {
      const img = CK.Art && CK.Art.part(view.skin, 'torso');
      if (img) return drawBoneImage(ctx, img, J.hip, J.sh, pr.shoulderW * 2.2, true);
      const T = J.T * D2R; const nx = Math.cos(T), ny = Math.sin(T); // perpendicular to spine
      const sw = pr.shoulderW, ww = pr.waistW;
      ctx.fillStyle = skin; ctx.beginPath();
      ctx.moveTo(J.hip[0] - nx * ww, J.hip[1] - ny * ww);
      ctx.lineTo(J.sh[0] - nx * sw * 0.9, J.sh[1] - ny * sw * 0.9);
      ctx.quadraticCurveTo(J.sh[0] + Math.sin(T) * 8, J.sh[1] - Math.cos(T) * 8, J.sh[0] + nx * sw, J.sh[1] + ny * sw);
      ctx.lineTo(J.hip[0] + nx * ww * 1.05, J.hip[1] + ny * ww * 1.05);
      ctx.closePath(); ctx.fill();
      // chest/ab hint
      ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1.5;
      const mid = [J.hip[0] * 0.45 + J.sh[0] * 0.55, J.hip[1] * 0.45 + J.sh[1] * 0.55];
      ctx.beginPath(); ctx.moveTo(mid[0] + nx * sw * 0.2, mid[1] + ny * sw * 0.2); ctx.lineTo(mid[0] + nx * sw * 0.85, mid[1] + ny * sw * 0.85); ctx.stroke();
      if (bodyDmg > 15) { // body redness
        ctx.fillStyle = `rgba(210,30,30,${Math.min(0.45, (bodyDmg - 15) / 160)})`; ctx.beginPath();
        ctx.ellipse(mid[0] + nx * sw * 0.3, mid[1] + ny * sw * 0.3, sw * 0.8, pr.torso * 0.32, T, 0, Math.PI * 2); ctx.fill();
      }
    },
    shorts(ctx, J, pr, L) {
      const draw = (kn, col) => {
        const e = [J.hip[0] * 0.45 + kn[0] * 0.55, J.hip[1] * 0.45 + kn[1] * 0.55];
        ctx.strokeStyle = col; ctx.lineWidth = pr.legW * 1.35; ctx.lineCap = 'butt';
        ctx.beginPath(); ctx.moveTo(J.hip[0], J.hip[1]); ctx.lineTo(e[0], e[1]); ctx.stroke();
        if (L.checkerHem) { const t = [J.hip[0] * 0.25 + kn[0] * 0.75, J.hip[1] * 0.25 + kn[1] * 0.75]; ctx.strokeStyle = '#fff'; ctx.lineWidth = pr.legW * 0.25; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(e[0], e[1]); ctx.lineTo(t[0], t[1]); ctx.stroke(); ctx.setLineDash([]); }
        if (L.inkTrim) { ctx.strokeStyle = '#141114'; ctx.lineWidth = 1.5; ctx.stroke(); }
        if (L.camo) { ctx.fillStyle = 'rgba(40,50,20,0.55)'; ctx.beginPath(); ctx.arc(e[0] * 0.6 + J.hip[0] * 0.4, e[1] * 0.6 + J.hip[1] * 0.4, pr.legW * 0.35, 0, 7); ctx.fill(); }
      };
      draw(J.bKn, shadeColor(L.shorts[0], -0.15)); draw(J.fKn, L.shorts[0]);
      ctx.fillStyle = L.shorts[0]; ctx.beginPath(); ctx.arc(J.hip[0], J.hip[1], pr.legW * 0.8, 0, Math.PI * 2); ctx.fill();
      // waistband
      const T = J.T * D2R, nx = Math.cos(T), ny = Math.sin(T), up = [Math.sin(T), -Math.cos(T)];
      const wb = [J.hip[0] + up[0] * pr.legW * 0.55, J.hip[1] + up[1] * pr.legW * 0.55];
      ctx.strokeStyle = L.shorts[1]; ctx.lineWidth = pr.legW * 0.32; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(wb[0] - nx * pr.waistW * 1.05, wb[1] - ny * pr.waistW * 1.05); ctx.lineTo(wb[0] + nx * pr.waistW * 1.1, wb[1] + ny * pr.waistW * 1.1); ctx.stroke();
    },
    head(ctx, view, J, pr, L, headDmg) {
      const c = J.headC, r = pr.headR, a = (J.T + view.pose.head) * D2R;
      const img = CK.Art && CK.Art.part(view.skin, 'head');
      // neck
      ctx.strokeStyle = shadeColor(L.skin, -0.08); ctx.lineWidth = r * 0.8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(J.sh[0], J.sh[1]); ctx.lineTo(c[0] * 0.6 + J.sh[0] * 0.4, c[1] * 0.6 + J.sh[1] * 0.4); ctx.stroke();
      ctx.save(); ctx.translate(c[0], c[1]); ctx.rotate(a);
      if (img) { ctx.drawImage(img, -r * 1.3, -r * 1.3, r * 2.6, r * 2.6); ctx.restore(); return; }
      // back hair (ponytail / braids / mullet)
      ctx.fillStyle = L.hairColor;
      if (L.hair === 'ponytail') { ctx.beginPath(); ctx.ellipse(-r * 1.15, r * 0.1, r * 0.35, r * 0.8, 0.5, 0, 7); ctx.fill(); }
      if (L.hair === 'braids') { for (let i = 0; i < 4; i++) { ctx.fillRect(-r * 1.0 + i * 3, -r * 0.2, 3.2, r * 1.5); } }
      if (L.hair === 'mullet') { ctx.beginPath(); ctx.ellipse(-r * 0.75, r * 0.55, r * 0.45, r * 0.7, 0.2, 0, 7); ctx.fill(); }
      // skull
      ctx.fillStyle = L.skin; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.95, r, 0, 0, Math.PI * 2); ctx.fill();
      // jaw/nose bump facing forward
      ctx.beginPath(); ctx.ellipse(r * 0.55, r * 0.35, r * 0.48, r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(r * 0.85, -r * 0.05); ctx.lineTo(r * 1.12, r * 0.2); ctx.lineTo(r * 0.85, r * 0.3); ctx.fill();
      // hair top
      ctx.fillStyle = L.hairColor;
      const hs = L.hair;
      if (hs === 'shaved') { ctx.globalAlpha *= 0.25; ctx.beginPath(); ctx.arc(-r * 0.05, -r * 0.1, r * 0.95, Math.PI * 1.05, Math.PI * 1.95); ctx.fill(); ctx.globalAlpha /= 0.25; }
      else if (hs === 'buzz') { ctx.beginPath(); ctx.arc(-r * 0.05, -r * 0.05, r * 0.98, Math.PI * 1.0, Math.PI * 1.92); ctx.closePath(); ctx.fill(); }
      else if (hs === 'slick') { ctx.beginPath(); ctx.ellipse(-r * 0.15, -r * 0.35, r * 1.05, r * 0.72, -0.15, Math.PI * 0.9, Math.PI * 2.02); ctx.fill(); }
      else if (hs === 'mullet' || hs === 'curly') { for (let i = 0; i < 7; i++) { const t = Math.PI * (1.0 + i * 0.15); ctx.beginPath(); ctx.arc(Math.cos(t) * r * 0.85, Math.sin(t) * r * 0.85, r * 0.32, 0, 7); ctx.fill(); } }
      else if (hs === 'cap') { ctx.fillStyle = '#3a3f47'; ctx.beginPath(); ctx.arc(0, -r * 0.1, r * 1.02, Math.PI * 0.98, Math.PI * 2.02); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#9a1c1c'; ctx.fillRect(-r, -r * 0.25, r * 2, r * 0.18); }
      else if (hs === 'ponytail') { ctx.beginPath(); ctx.ellipse(-r * 0.1, -r * 0.35, r * 1.02, r * 0.7, 0, Math.PI * 0.95, Math.PI * 2.02); ctx.fill(); }
      else if (hs === 'twists') { for (let i = 0; i < 7; i++) { const t = Math.PI * (1.0 + i * 0.16); ctx.beginPath(); ctx.ellipse(Math.cos(t) * r * 0.95, Math.sin(t) * r * 0.95, r * 0.18, r * 0.36, t + Math.PI / 2, 0, 7); ctx.fill(); } }
      else if (hs === 'bowl') { ctx.beginPath(); ctx.arc(0, -r * 0.05, r * 1.05, Math.PI * 0.92, Math.PI * 2.0); ctx.lineTo(r * 0.95, -r * 0.05); ctx.lineTo(-r * 1.0, r * 0.15); ctx.closePath(); ctx.fill(); }
      else if (hs === 'topknot') { ctx.globalAlpha *= 0.3; ctx.beginPath(); ctx.arc(-r * 0.05, -r * 0.1, r * 0.95, Math.PI * 1.05, Math.PI * 1.95); ctx.fill(); ctx.globalAlpha /= 0.3; ctx.beginPath(); ctx.ellipse(-r * 0.35, -r * 1.05, r * 0.26, r * 0.22, 0, 0, 7); ctx.fill(); ctx.fillRect(-r * 0.42, -r * 0.92, r * 0.14, r * 0.12); }
      else if (hs === 'curls_tall') { for (let i = 0; i < 9; i++) { const t = Math.PI * (1.0 + i * 0.12); ctx.beginPath(); ctx.arc(Math.cos(t) * r * 0.9, Math.sin(t) * r * 0.95 - r * 0.15, r * 0.3, 0, 7); ctx.fill(); } for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(-r * 0.5 + i * r * 0.35, -r * 1.05, r * 0.28, 0, 7); ctx.fill(); } }
      else if (hs === 'crew') { ctx.beginPath(); ctx.arc(-r * 0.05, -r * 0.08, r * 1.0, Math.PI * 1.02, Math.PI * 1.9); ctx.closePath(); ctx.fill(); ctx.fillRect(-r * 0.7, -r * 1.02, r * 1.1, r * 0.2); }
      else if (hs === 'zigzag') { ctx.beginPath(); ctx.arc(-r * 0.05, -r * 0.05, r * 0.98, Math.PI * 1.0, Math.PI * 1.92); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = L.stripe || '#eee'; ctx.lineWidth = Math.max(1.5, r * 0.09); ctx.beginPath(); ctx.moveTo(-r * 0.8, -r * 0.2); for (let i = 1; i <= 4; i++) ctx.lineTo(-r * 0.8 + i * r * 0.28, -r * 0.2 - (i % 2 ? r * 0.22 : 0) - i * r * 0.08); ctx.stroke(); }
      else if (hs === 'braids') { ctx.beginPath(); ctx.arc(-r * 0.05, -r * 0.05, r * 1.0, Math.PI * 0.95, Math.PI * 1.95); ctx.closePath(); ctx.fill(); }
      // beard
      if (L.beard !== 'none') {
        ctx.fillStyle = L.beardColor || L.hairColor;
        if (L.beard === 'pencil') { ctx.strokeStyle = L.beardColor || L.hairColor; ctx.lineWidth = Math.max(1.4, r * 0.06); ctx.beginPath(); ctx.moveTo(r * 0.55, r * 0.45); ctx.lineTo(r * 1.0, r * 0.42); ctx.stroke(); }
        else if (L.beard === 'goatee') { ctx.beginPath(); ctx.ellipse(r * 0.75, r * 0.82, r * 0.22, r * 0.2, 0, 0, 7); ctx.fill(); }
        else if (L.beard === 'boxed') { ctx.beginPath(); ctx.moveTo(-r * 0.05, r * 0.1); ctx.lineTo(r * 0.95, r * 0.35); ctx.lineTo(r * 0.95, r * 1.0); ctx.lineTo(r * 0.15, r * 1.0); ctx.closePath(); ctx.fill(); }
        else if (L.beard === 'handlebar') { ctx.lineWidth = 2.6; ctx.strokeStyle = L.beardColor || L.hairColor; ctx.beginPath(); ctx.moveTo(r * 0.45, r * 0.62); ctx.quadraticCurveTo(r * 0.8, r * 0.2, r * 1.05, r * 0.55); ctx.stroke(); }
        else { const thick = L.beard === 'thick' ? 1.15 : 1; ctx.beginPath(); ctx.ellipse(r * 0.45, r * 0.6, r * 0.62 * thick, r * 0.45 * thick, 0.2, 0, Math.PI); ctx.fill(); ctx.beginPath(); ctx.ellipse(r * 0.2, r * 0.35, r * 0.6, r * 0.4, 0, 0, Math.PI); ctx.fill(); }
      }
      // eye
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(r * 0.55, -r * 0.12, Math.max(1.4, r * 0.1), 0, 7); ctx.fill();
      ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(r * 0.38, -r * 0.32); ctx.lineTo(r * 0.78, -r * 0.3); ctx.stroke();
      // ear
      ctx.fillStyle = shadeColor(L.skin, -0.1); ctx.beginPath(); ctx.ellipse(-r * 0.1, r * 0.05, r * 0.18, r * 0.26, 0, 0, 7); ctx.fill();
      // face damage tiers: 1 reddened, 2 swollen eye, 3 swollen + cut
      const tier = headDmg >= 75 ? 3 : headDmg >= 50 ? 2 : headDmg >= 25 ? 1 : 0;
      if (tier >= 1) { ctx.fillStyle = 'rgba(220,40,40,0.35)'; ctx.beginPath(); ctx.ellipse(r * 0.55, r * 0.25, r * 0.35, r * 0.25, 0, 0, 7); ctx.fill(); }
      if (tier >= 2) { ctx.fillStyle = 'rgba(120,40,110,0.75)'; ctx.beginPath(); ctx.ellipse(r * 0.62, -r * 0.12, r * 0.3, r * 0.24, 0, 0, 7); ctx.fill(); }
      if (tier >= 3) { ctx.fillStyle = 'rgba(150,40,120,0.8)'; ctx.beginPath(); ctx.ellipse(r * 0.4, -r * 0.4, r * 0.36, r * 0.24, 0.3, 0, 7); ctx.fill();
        ctx.strokeStyle = '#b00000'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(r * 0.7, -r * 0.55); ctx.lineTo(r * 0.82, r * 0.2); ctx.stroke(); }
      ctx.restore();
    }
  };
  function lerp2(view, a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
  function drawBoneImage(ctx, img, a, b, w, upward) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), ang = Math.atan2(b[1] - a[1], b[0] - a[0]) - Math.PI / 2;
    ctx.save(); ctx.translate(a[0], a[1]); ctx.rotate(ang); ctx.drawImage(img, -w / 2, 0, w, len); ctx.restore();
  }
  function shadeColor(hex, k) {
    if (!hex || hex[0] !== '#') return hex;
    let h = hex.slice(1); if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const f = (c) => Math.round(CK.clamp(k < 0 ? c * (1 + k) : c + (255 - c) * k, 0, 255));
    return '#' + ((1 << 24) + (f(r) << 16) + (f(g) << 8) + f(b)).toString(16).slice(1);
  }

  // Sprite renderer: identical interface; per-part images come from CK.Art (via the limb/head/torso
  // hooks above), so the rig renderer already swaps parts in when Remy's files exist.
  // A full-sheet sprite renderer can be registered here later with the same drawFighter(ctx, view).
  const Renderer = {
    impl: RigRenderer,
    set(impl) { Renderer.impl = impl; },
    drawFighter(ctx, view) { return Renderer.impl.drawFighter(ctx, view); }
  };

  CK.Rig = { POSES, ANIMS, STRIKES, STANCE, KEYS, P, lerpPose, sampleAnim, strikePose, proportions, computeJoints, shadeColor };
  CK.Renderer = Renderer; CK.RigRenderer = RigRenderer;
})();
